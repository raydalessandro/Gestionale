# Fase G7 — Il percorso di prenotazione

La **prima scrittura** del portale. Una persona scansiona il QR in vetrina alle
nove di sera e in **meno di un minuto** invia una richiesta di appuntamento.
Alla fine la richiesta **esiste nel database** in stato `in_attesa`, con un
codice di riferimento in mano alla persona.

**È una richiesta, non una conferma.** La schermata finale non dice mai
«prenotazione confermata»: dice che la richiesta è arrivata e che **il negozio
la conferma**. Nessuna promessa di SMS — gli SMS non esistono ancora. La
conferma da parte dell'ottico è G8.

## Per chi rivede — le richieste della consegna

### 1 · URL di preview e un codice di prenotazione

- Percorso: `/ottica/ottica-vista-demo/prenota?da=qr` (o si arriva col CTA
  «Prenota un appuntamento» dalla pagina del negozio, che **trascina `?da`**).
- Cinque passi, una domanda per schermata: **servizio → copertura → chi sei
  (nome + telefono) → quando (griglia slot) → conferma** (spunta informativa
  **obbligatoria** + lista d'attesa facoltativa).
- All'invio compare un **codice** grande — formato tipo `LMP-N56V` (alfabeto
  senza O/0/I/1, così non si sbaglia a leggerlo al telefono) — e il testo
  onesto: la richiesta è arrivata, il negozio conferma.

La 012 si applica al DB della preview **dopo l'OK** (per ora un solo database
per preview e produzione — il DB di test si farà prima del go-live).

### 2 · Disponibilità atomica, non «controlla-poi-scrivi»

Il rischio di due persone che prendono lo stesso slot nello stesso istante non
si risolve leggendo prima e scrivendo dopo. `crea_prenotazione` è **security
definer** e, sotto un `pg_advisory_xact_lock` per azienda, **ricontrolla la
disponibilità dentro la stessa transazione** dell'inserimento; l'ultima parola
la dà comunque il vincolo **EXCLUDE gist** `prenotazioni_niente_sovrapposizioni`
(sull'intervallo `appuntamento_intervallo(inizio, durata_minuti)`, per gli stati
`in_attesa`/`accettata`): se due inserimenti collidono, uno solo passa e
l'altro riceve `SLOT_OCCUPATO`. Nessuna finestra fra il controllo e la scrittura.

### 3 · Idempotenza — un doppio tocco non crea due richieste

Ogni percorso genera una `chiave_richiesta` **stabile** (una `randomUUID` per
sessione del wizard, non rigenerata a ogni tentativo). Un indice unico
`uq_prenotazioni_chiave` la vincola: se la stessa chiave arriva due volte
(doppio tocco, rete lenta, retry dopo un errore), la seconda **ritorna la riga
già creata** invece di crearne un'altra. Il bottone disabilitato durante l'invio
è cosmesi; la difesa vera è qui.

### 4 · Limite di frequenza (prima barriera anti-spam)

`lib/ratelimit.ts` — un limitatore in-memory, **puro e testabile** (pattern
copiato da Impero, non una dipendenza). Soglie: **8 richieste / 10 min per IP**
(generose: dietro un wifi condiviso escono più persone dallo stesso IP) e
**3 richieste / ora per telefono** (strette: una persona non prenota molte volte
di fila). Limite noto e **documentato in testa al file**: lo stato vive nel
processo, quindi su un runtime a più istanze (serverless) è **per-istanza**, non
globale. È la prima difesa; quella forte contro i doppioni è la
`chiave_richiesta` lato DB. Un limite **condiviso** (Redis/DB) è da valutare
prima del go-live.

## Dove sta cosa

- **`app/(portale)/ottica/[slug]/prenota/WizardPrenota.tsx`** (`"use client"`) —
  il percorso. Il **passo sta nell'URL** (`?passo`) così il tasto «indietro» del
  telefono funziona; le **risposte stanno nello stato** (un refresh ricomincia, e
  per un percorso da un minuto va bene). **Niente `localStorage`, niente cookie.**
  La griglia degli slot al passo 4 è una **lettura** (`slot_liberi` via chiave
  anon dal browser). L'invio **non** chiama mai `crea_prenotazione`: chiama la
  server action.
- **`app/(portale)/ottica/[slug]/prenota/azioni.ts`** (`"use server"`) —
  `inviaPrenotazione` (1) applica il rate limit (IP dagli header del proxy,
  telefono normalizzato leggero), (2) **rivalida** ogni ingresso, (3) chiama
  `crea_prenotazione` con la chiave **anon** (nessun service role) e **traduce**
  gli errori distinti in italiano.
- **`lib/portale/fonte.ts`** — `fonteDaParametro(da)`: `qr → qr_vetrina`,
  `sito → sito_negozio`, altro → `portale`. La provenienza va trascinata lungo
  tutto il percorso: se si perde, la misura del funnel (fase 1) diventa inutile.
- **`app/(portale)/informativa/page.tsx`** — informativa privacy **minima ma
  reale**: una spunta che rimanda al nulla è peggio che non averla.
- **Pagina del negozio** — il CTA da inerte diventa un `<Link>` attivo verso il
  percorso, con `?da` al seguito. Resta un vero link: funziona senza JavaScript.

## La funzione (migrazione 012)

`crea_prenotazione(p_slug, p_servizio, p_inizio, p_nome, p_telefono, p_email,
p_per_conto_di, p_note, p_fonte, p_chiave_richiesta, p_lista_attesa)` →
`table(id, codice, inizio, durata_minuti)`, **security definer**, eseguibile da
`anon`. Sequenza: idempotenza-prima → risolvi lo slug (solo negozi con portale
attivo, altrimenti `NEGOZIO_NON_TROVATO`) → `advisory_xact_lock` per azienda →
ricontrolla idempotenza → ricontrolla disponibilità (durata del servizio, altrimenti
`SERVIZIO_NON_ATTIVO`; orizzonte 90gg → `FUORI_ORIZZONTE`; anticipo 2h →
`TROPPO_TARDI`; chiusura/copertura fascia → `FUORI_ORARIO`; overlap con
appuntamenti/prenotazioni/blocchi → `SLOT_OCCUPATO`) → trova/crea la **persona**
(dedup sul telefono normalizzato, il nome si aggiorna solo se vuoto) → normalizza
la `fonte` → genera il **codice** (ciclo su alfabeto senza O/0/I/1) → **inserisce**
(`exclusion_violation` → `SLOT_OCCUPATO`; `unique_violation` sulla chiave → ritorno
idempotente). Aggiunge alla `lista_attesa` se richiesto.

Colonne aggiunte a `prenotazioni`: `codice`, `chiave_richiesta`,
`informativa_accettata_at`, con gli indici unici `uq_prenotazioni_codice` e
`uq_prenotazioni_chiave`. `slot_liberi` è ridefinita per escludere le
prenotazioni via lo **stesso** `appuntamento_intervallo`, così l'indice GiST
combacia con la condizione del vincolo.

### Verifica su DB (dry-run, non persistito)

`BEGIN … ROLLBACK` sul DB reale, tutti e sei i comportamenti visti funzionare:
crea ok (codice `LMP-N56V`), doppia chiave → **una** riga, doppio slot → il
secondo `SLOT_OCCUPATO`, lo slot **sparisce** da `slot_liberi`, telefono in due
formati → **una** persona, `07:00` (fuori apertura) → `FUORI_ORARIO`.

## Il prototipo

Il prototipo della consegna (i passi 1–6) è stato **riscritto** nei token `lim-*`
e nei primitivi del portale, non incollato: il passo «scegli il negozio» **non
esiste** (si arriva sempre da un negozio, l'aggregatore è spento), il testo
finale è stato riscritto per essere onesto sulla natura di richiesta, e la
scrittura è stata incanalata nella server action per non esporre `crea_prenotazione`
al browser.

## Guardie e test

- **Guardia statica**: `crea_prenotazione` può comparire **solo** in file server
  (la server action con `"use server"`), mai in un componente `"use client"` né
  in `lib/portale/slot.ts` — il browser non chiama mai la scrittura direttamente.
- **Contratto** (`crea_prenotazione`) ed **E2E** (percorso completo dal QR alla
  schermata finale, con la verifica che dica «richiesta» e non «confermata»):
  preparati dall'agente di test.
- **Unit**: `lib/ratelimit.ts` (il limite scatta ed è registrato, le chiavi non
  si consumano a vicenda, la finestra scorre) e `lib/portale/fonte.ts`.

## Criterio di accettazione

Chi arriva da un QR invia una richiesta di appuntamento in meno di un minuto e
resta con un codice in mano; la richiesta esiste nel database in stato
`in_attesa`, senza doppioni e senza slot rubati — e in nessun punto le si dice
che è confermata.
