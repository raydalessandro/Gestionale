# Fase G7-bis — L'agenda unica

Con la 011 e la 012 due tabelle decidevano se uno slot fosse occupato:
`appuntamenti` e `prenotazioni`. Due tabelle che decidono la stessa cosa sono
**due agende**. Il difetto era concreto: una richiesta dal portale per sabato
alle 10 non era un appuntamento, quindi l'ottico apriva l'agenda del gestionale,
**vedeva le 10 libere**, ci metteva un cliente venuto al banco — e sabato alle 10
si presentavano in due.

La correzione non divide *portale contro banco*. Divide **slot contro pratica**:

- **`appuntamenti` è lo slot.** Sempre, da qualunque porta arrivi.
- **`prenotazioni` è la pratica.** Chi ha chiesto, il contatto copiato, il
  consenso, il codice, la provenienza, la lista d'attesa.

Solo SQL (migrazione 013). Nessuna interfaccia. L'allineamento dell'agenda —
mostrare `in_attesa` in modo distinto e dare all'ottico i tasti accetta/rifiuta —
è la consegna successiva.

## Cosa fa la 013

### 1 · `appuntamenti` accoglie lo stato «in attesa»
Il `check` sugli stati guadagna `in_attesa` (restano prenotato, completato,
mancato, annullato). Lo slot è impegnato ma nessuno l'ha ancora confermato:
l'ottico lo vede nell'agenda e decide.

### 2 · La cucitura per le due salette
`appuntamenti.risorsa_id uuid` nullable, **senza FK per ora** (la tabella delle
risorse arriva con la sua consegna). Il vincolo di non-sovrapposizione diventa
per-risorsa:

```sql
exclude using gist (
  azienda_id with =,
  coalesce(risorsa_id, azienda_id) with =,
  appuntamento_intervallo(inizio, durata_minuti) with &&
) where (stato in ('in_attesa','prenotato','completato'))
```

Con `risorsa_id` nullo si comporta **esattamente come oggi** (una poltrona sola);
quando ci saranno due salette, basta valorizzarlo.

> **Nota per la roadmap.** Alcuni negozi hanno **due salette con due ottici che
> visitano in contemporanea**. Questa migrazione prepara il terreno; il supporto
> vero — tabella delle risorse, disponibilità per risorsa, scelta in fase di
> prenotazione — è una consegna a sé.

### 3 · `prenotazioni` smette di governare gli slot
- **Eliminato** il vincolo `prenotazioni_niente_sovrapposizioni`: se restasse,
  spostare un appuntamento lascerebbe l'esclusione appesa al vecchio orario e
  quello slot resterebbe bloccato per sempre.
- `appuntamento_id` diventa **NOT NULL**, previo riempimento. Il riempimento è
  robusto anche sul **residuo dei test** (le prenotazioni sono non-cancellabili):
  a ogni prenotazione senza appuntamento se ne crea uno, e **lo stato
  dell'appuntamento segue la pratica** — `in_attesa`→in_attesa,
  `accettata`→prenotato, `rifiutata`/`annullata`→annullato. Così una richiesta
  già respinta **non occupa** lo slot (altrimenti due annullate sovrapposte
  violerebbero il nuovo EXCLUDE).
- `inizio`/`durata_minuti` restano sulla prenotazione ma cambiano significato:
  sono **quanto è stato chiesto**. La verità dello slot è l'appuntamento. Se
  l'ottico sposta, i due valori divergono — ed è giusto: la divergenza racconta
  che l'appuntamento è stato spostato rispetto alla richiesta (scritto nel
  commento delle colonne).

### 4 · `slot_liberi` guarda un posto solo
Sparisce la sottoquery su `prenotazioni`. Gli stati che occupano diventano
`('in_attesa','prenotato','completato')` su `appuntamenti`. Una sottoquery in
meno per candidato, e quella che resta usa l'indice GiST del vincolo.

### 5 · `crea_prenotazione` scrive due righe
Nella stessa transazione, nell'ordine: (1) l'**appuntamento** con `stato =
'in_attesa'`, `fonte`, `inizio`, `durata_minuti`, `risorsa_id` nullo,
`cliente_id` nullo; (2) la **prenotazione** collegata. Se l'inserimento
dell'appuntamento viola il vincolo di esclusione, l'errore resta `SLOT_OCCUPATO`.
Idempotenza, lock e codice leggibile **non cambiano**: sono soltanto spostati.

Corretta anche un'ambiguità latente della 012: `returning id` nell'insert di
`persone` e dell'appuntamento cozzava con gli OUT param `id`/`codice` della
funzione (errore 42702). Ora qualificato `persone.id` / `appuntamenti.id`. Non
era emerso nel dry-run della 012 perché quel test riusava una persona esistente
(ramo UPDATE, non INSERT…RETURNING); sarebbe scoppiato alla prima prenotazione
di un numero nuovo. La 013 sostituisce la funzione per intero, quindi la
correzione è a bordo.

## Verifica sul DB (dry-run, non persistito)

`BEGIN … ROLLBACK` sul DB reale: una richiesta crea due righe collegate (persona
nuova inclusa), idempotenza per chiave, **un appuntamento manuale sullo slot
richiesto è respinto dal database**, lo slot sparisce da `slot_liberi`, una
`risorsa_id` diversa passa in parallelo, due `risorsa_id` nulle si respingono, un
`annullato` non blocca. DDL idempotente (girata due volte di fila).

## Nella PR — quanto richiesto

1. **Righe toccate dal riempimento:** sul database `prenotazioni` è **vuota** (0
   righe) → il riempimento tocca **0 righe**. Il codice è comunque robusto per il
   residuo dei test.
2. **Vincolo su `prenotazioni` eliminato:** sì, `prenotazioni_niente_sovrapposizioni`
   è droppato; la difesa dello slot è ora solo su `appuntamenti`.
3. **Cosa si è «rotto» (segnalato, non aggiustato):** in `app/(app)/agenda/page.tsx`
   gli appuntamenti `in_attesa` (dal portale) ora **compaiono in agenda**. Rendono
   senza crash ma **non stilizzati**: pill grigia con etichetta grezza `in_attesa`
   (fallback di `statoDi`), nessun nome cliente (`cliente_id` nullo → «Impegno
   interno»), e **nessun tasto accetta/rifiuta** (le azioni sono legate a
   `stato==='prenotato'`). L'ottico li vede ma non può agirci: accettazione,
   etichetta e stile dedicati sono la **consegna di allineamento interfaccia / G8**.
   Il percorso di prenotazione e la pagina negozio **non si rompono** (le firme di
   `slot_liberi`/`crea_prenotazione` non cambiano; la griglia slot ora esclude
   correttamente anche gli slot con richiesta `in_attesa`).

## Criterio di accettazione

Uno slot è occupato in un posto solo. Una richiesta dal portale e un cliente al
banco non possono finire nello stesso orario, e il database lo impedisce da sé.
