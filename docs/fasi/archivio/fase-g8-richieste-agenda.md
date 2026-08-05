# Fase G8 · Le richieste dentro l'agenda

**Branch:** `gest/g8-richieste-agenda` · **Prerequisito:** 017 su `main`, CI verde.
**Migrazione:** `018_prendi_come_cliente.sql` (companion, approvata da Ray).

## Scopo

Chiudere il giro. Prima di G8 una persona prenota dal portale e la richiesta
finisce nel database; da qui **l'ottico la vede e la accetta**, dentro l'agenda
che usa già. Nessun modulo nuovo: l'agenda è una sola — portale e banco vivono
nello stesso posto.

## Il checkpoint della §8 (fermarsi e dirlo)

La consegna diceva: «se serve una migrazione, fermati e dillo — significa che
abbiamo sbagliato qualcosa a monte». È successo, ed era previsto:

- **§2–§5** (striscia sospesi, accetta, rifiuta) girano **dentro il tenant**
  (`appuntamenti`/`prenotazioni`, policy «della propria azienda»): **zero DB**.
  `appuntamenti.stato` include già `in_attesa` dalla 013.
- **§6 «Prendi come cliente»** scrive `persone.ottico_di_riferimento` e il
  `persone_riferimento_registro` — due tabelle che la 011 (ID-01) chiude a chiave:
  **RLS attiva senza policy**, «ci arrivano solo le funzioni security definer».
  Da server action, con la sola RLS, quelle scritture **non avvengono**. Il
  service role è vietato (§7). L'unico percorso sancito è una **funzione definer**
  → una migrazione. Ray ha approvato la **018 companion**.

Nel farlo è emerso il **secondo pezzo** del nodo, già annotato come **TODO §7**:
il trigger di coerenza del registro non poteva funzionare (il registro non ha
`azienda_id`, quindi il trigger tenant generico sollevava `23514` su ogni insert).
G8 è la consegna che lo chiude, perché è la prima a scriverci davvero.

## Cosa cambia — DB (migrazione 018)

1. **Fix TODO §7**: `trg_coerenza_registro` usa ora `coerenza_registro_riferimento()`
   — verifica che la prenotazione che autorizza il passaggio sia dell'azienda
   **ricevente** (`a_azienda_id`). Il registro spanna due aziende: `da_azienda` è
   legittimamente altrui (o nulla).
2. **`cliente_per_telefono(tel)`** — un cliente PROPRIO con lo stesso telefono
   normalizzato, per **proporre** il collegamento invece del doppione (§6.1).
3. **`prendi_persona_come_cliente(prenotazione, cliente?)`** `security definer` —
   l'atto della §6, atomico: collega/crea il cliente (nome/telefono/fonte dalla
   prenotazione, **niente consenso commerciale**), riempie i due `cliente_id`,
   imposta `ottico_di_riferimento`, scrive **una** riga di registro. Guardie
   **dentro** (prenotazione tua + accettata), idempotente.

Dry-run `BEGIN…ROLLBACK` sul DB di test verde su tutto (fix registro positivo/
negativo, e i rami crea/idempotenza/lookup/`NON_ACCETTATA`/collega-esistente con
auth simulata), poi applicata al DB di test. **Produzione dopo OK + merge.**

## Cosa cambia — App (solo agenda)

- **`lib/actions.ts`** (in coda alla sezione agenda; `eventoAppuntamento` **intatto**,
  §7): `accettaRichiesta` (in_attesa→prenotato / prenotazione→accettata),
  `rifiutaRichiesta` (→annullato + motivo facoltativo in nota / prenotazione→
  rifiutata; lo slot torna in `slot_liberi` da sé), `prendiComeCliente` (auto/
  nuovo/collega, chiamabile dal client). Update **condizionati** (`.eq("stato",…)`):
  due tocchi non fanno due effetti. Niente service role.
- **`components/AzioniAgenda.tsx`**: `AzioniAppuntamento` ora **consapevole dello
  stato** — in_attesa→Accetta/Rifiuta; prenotato→le tre di sempre + «Prendi come
  cliente» se la riga viene dal portale ed è ancora libera; stati finali→niente.
- **`app/(app)/agenda/page.tsx`**: **striscia delle richieste in sospeso da oggi
  in avanti** sopra la navigazione (se zero, non compare); righe `in_attesa`
  **distinte** (pill «In attesa» ottone + fondo tenue) con **chi ha prenotato**
  (nome/telefono/per conto di/servizio dalla prenotazione collegata) e la **fonte**.
- **Riuso** dei token e delle classi esistenti (`PillStatoApp`, palette ottone/
  ambra, `Badge`/`tintaFonte`): **nessuno stile nuovo** — l'aspetto verrà
  sostituito da una passata di design già preparata.

## Fuori (come da consegna)

Sposta, conferma automatica per negozio, griglia disponibilità, i tre contatori.

## Test

- **§1 caratterizzazione** (`e2e/g8-richieste-agenda.spec.ts`, primo commit):
  il flusso appuntamenti *esistente* (crea→compare, completa, mancato, annulla).
  Rete di non-regressione **prima** di toccare l'agenda.
- **§9 contratto + E2E**: li estende l'agente-test (accetta/rifiuta/idempotenza,
  prendi-come-cliente collega/crea/senza-consenso, registro a una riga,
  `NON_ACCETTATA`, isolamento fra negozi, giro completo portale→agenda→cliente).

## Rifiniture chieste in revisione

- **Motivo sull'annulla inline** (allineamento §5): l'annulla dell'agenda ora ha
  il suo campo motivo facoltativo, come Rifiuta — `eventoAppuntamento` già lo
  scriveva in nota, mancava lo spazio. Niente più scarto col modello mentale
  «prima le note, poi la tabella».
- **Fuso Europe/Rome (TODO §6) → sistemato per agenda/appuntamenti.** Il difetto:
  `creaAppuntamento` costruiva l'istante con `new Date("gg T hh:mm")`, interpretato
  nel fuso del **processo** (UTC su Vercel) → «10:00» al banco diventava un istante
  diverso da quello che il portale scrive per le stesse 10:00 (e si rompeva **solo
  in produzione**). Il conto era piccolo: **una riga** (1119). Fix:
  - helper condivisi `istanteRomaISO`/`oggiRoma` in `lib/utils.ts` (ancorati a
    Europe/Rome, DST inclusa, indipendenti dal processo);
  - `creaAppuntamento` li usa; `oraDi`/`oraFine` e le finestre-giorno formattano/
    filtrano in Europe/Rome (o il display mostrerebbe l'ora UTC);
  - **migrazione 019**: backfill mirato e idempotente delle righe banco già scritte
    (`fonte='banco' AND note<>'seed-g6'`), la trasformazione
    `(inizio at time zone 'UTC') at time zone 'Europe/Rome'` gestisce l'ora legale;
  - `seed_demo` allineato al pattern corretto;
  - **sentinella** a contratto: banco 10:00 e portale 10:00, stesso giorno → stesso
    istante. Impedisce alla divergenza di tornare.
  Resta aperto solo lo strato dei formatter di *date* (`fmtData`/`fmtQuando`),
  rischio di giorno solo a mezzanotte — vedi TODO §6.

## Debiti annotati

- **TODO §7** → **chiuso** qui (fix trigger registro, migrazione 018).

## Criterio di accettazione

Una persona prenota dalla vetrina, l'ottico apre l'agenda e la vede in cima anche
se è fra cinque giorni, la accetta con un tocco, e decide separatamente se
prendersela come cliente. Fino a quel momento quella persona non è di nessuno.
