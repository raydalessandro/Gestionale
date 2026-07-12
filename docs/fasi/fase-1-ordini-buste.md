# Fase 1 — Ordini & Buste (v0.2) · Specifica di codifica

Questa è la specifica completa della Fase 1. Chi coda (Opus) la segue alla
lettera: dove la spec tace, si sceglie la soluzione più semplice coerente con
le convenzioni del repo; dove la spec parla, non si devia.

## 0 · Prima di scrivere una riga

Leggere, in quest'ordine:
1. `README.md` — sezione **Il contratto** (vocabolario intoccabile)
2. `supabase/schema.sql` (001) e `supabase/migrazioni/002_ordini_buste.sql`
3. `docs/dominio-ottica.md` — §1 vocabolario, §3 busta, §4 caparre, §11 automazioni
4. Il codice esistente: `lib/actions.ts` (pattern delle action), `components/ui.tsx`, `components/PrescrizioneForm.tsx` (pattern wizard/controlled), `app/(app)/clienti/*`

**Stato di partenza garantito**: la migrazione 002 è già applicata al DB;
`lib/database.types.ts` e `lib/utils.ts` sono **già allineati** (tipi nuovi,
`STATI_LAC`, `STATI_BUSTA`, `fmtQuando`, `rxValida`). Non modificarli se non
per bug evidenti. Non modificare mai 001/002.

**Convenzioni tecniche vincolanti** (già in uso nel repo):
- Next 15 App Router: `params` e `searchParams` sono **Promise** → `await`.
- Pagine = server component; form = client component + `useActionState` +
  server action in `lib/actions.ts`; dopo mutazione: `revalidatePath` + `redirect`.
- Client Supabase: `@/lib/supabase/server` nelle pagine/action. RLS fa lo
  scoping per azienda: **mai** filtrare a mano per `azienda_id` nelle select;
  **sempre** valorizzarlo negli insert (pattern esistente: `getUser` →
  `utenti.eq(id).maybeSingle()`).
- UI solo da `components/ui.tsx` + Tailwind coi token del progetto. Diottrie e
  numeri ordine in `f-mono`/classe `diottria`. Nessuna nuova dipendenza.

## 1 · Obiettivo e perimetro

**Dentro**: modulo Ordini completo — liste LAC e Buste con filtri e ricerca,
wizard di creazione (LAC 3 step, Busta 6 step), scheda ordine con macchina a
stati e azioni, ispezione, avviso cliente, consegna, annullo, remake, busta
stampabile, aggancio a scheda cliente e dashboard, attivazione modulo in sidebar.

**Fuori** (fasi successive — non costruire nemmeno "gli attacchi"):
catalogo prodotti (le righe LAC sono a testo libero), pagamenti/scontrini
(l'acconto qui è solo un numero informativo), resi post-consegna, invio reale
di messaggi (solo "segna avvisato" + link `wa.me` precompilato se c'è il
telefono), generazione PDF (basta la vista stampabile), notifiche.

## 2 · Regole di dominio vincolanti

1. **Numerazione**: SEMPRE via `rpc('prossimo_numero', { p_prefisso: 'BL' | 'OL' })`
   dentro la server action di creazione. Il numero **non cambia mai** — né su
   remake né su modifica. Formato risultante: `BL-2026-0141` / `OL-2026-0032`.
2. **Mai delete**: annullare ≠ cancellare. Nessuna `delete` fisica in tutta la fase.
3. **Macchina a stati LAC** (`ordini_lac.stato`):

   | Da | Evento (UI) | A | Effetti collaterali |
   |---|---|---|---|
   | da_ordinare | "Segna ordinato" | ordinato | — |
   | ordinato | "Segna arrivato" | arrivato | — |
   | arrivato | "Consegna" | consegnato | `data_consegna = now()` |
   | da_ordinare · ordinato · arrivato | "Annulla" (motivo obbligatorio) | annullato | motivo in `note` (append) |

   "Segna avvisato" è disponibile **solo** in stato `arrivato`: setta
   `avvisato_il = now()` senza cambiare stato.
4. **Macchina a stati Busta** (`ordini_occhiali.stato`):

   | Da | Evento (UI) | A | Effetti collaterali |
   |---|---|---|---|
   | preventivo | "Conferma ordine" | lavorazione | chiede/aggiorna acconto (suggerito 30%) |
   | lavorazione | "Segna arrivata" | arrivata | — |
   | arrivata | "Ispeziona e segna pronta" | pronta | `ispezionata_da = utente corrente`, `ispezionata_il = now()` — **obbligatori, insieme, solo qui** |
   | arrivata · pronta | "Remake" (motivo obbligatorio) | lavorazione | azzera `ispezionata_da/il` e `avvisato_il`; append su `note`: `— Remake gg/mm/aaaa: <motivo>` |
   | pronta | "Consegna" | consegnata | `data_consegna = now()`; mostrare il **saldo** in evidenza prima di confermare |
   | preventivo · lavorazione · arrivata · pronta | "Annulla" (motivo obbligatorio) | annullata | motivo in `note` (append) |

   "Segna avvisata" solo in stato `pronta` → `avvisato_il = now()`.
   **Non esiste** percorso lavorazione→pronta che salti l'ispezione.
5. **Ogni transizione va validata anche lato server**: la action rifiuta con
   errore se lo stato attuale non ammette l'evento (la UI nasconde i bottoni
   non ammessi, ma la difesa vera è nella action).
6. **tipo_lavoro** (busta): `occhiale_completo | solo_lenti | solo_montatura |
   montatura_cliente`. Con `solo_lenti` e `montatura_cliente` i campi montatura
   sono facoltativi (per `montatura_cliente` usare marca/modello come
   descrizione libera della montatura portata dal cliente, es. "Ray-Ban del
   cliente, nero"). Con `solo_montatura` sono facoltativi i campi lenti e la
   centratura.
7. **Centratura** (busta, step 5): DNP per occhio **20–40 mm**, altezze
   **10–35 mm**, step 0.5, input classe `diottria`. Validare in UI (bordo
   rosso + hint del range) E nella action. Facoltativa nel complesso, ma se un
   campo è compilato deve essere nel range.
8. **Prescrizione collegata**: selettore tra le prescrizioni del cliente del
   tipo giusto (`occhiali` per busta, `lac` per LAC), mostrando per ciascuna la
   riga mono compatta (riusare la formattazione di `PrescrizioneCard`). In
   evidenza quelle **valide** (`attiva && !scaduta` — helper `rxValida` in
   utils); le scadute/inattive selezionabili solo dietro conferma esplicita.
   Cliente senza Rx del tipo giusto: si può procedere con `prescrizione_id =
   null` mostrando l'avviso "Ordine senza prescrizione collegata".
9. **Righe LAC** (`ordini_lac.righe`, jsonb — shape del contratto in
   schema.sql): editor righe con descrizione (obbligatoria), occhio
   `OD | OS | —`(null), quantità ≥ 1, prezzo ≥ 0, parametri facoltativi
   (sfero/cilindro/asse/raggio/diametro/addizione). Pulsante **"Da
   prescrizione"**: genera due righe (OD e OS) precompilate coi parametri
   della Rx collegata. Il `totale` è SEMPRE ricalcolato lato server come
   Σ(quantità × prezzo): il client lo mostra, il server lo decide.
10. **Totale busta** (server): `prezzo_montatura + prezzo_lenti + prezzo_extra
    − sconto`. Acconto suggerito al riepilogo: 30% del totale arrotondato ai
    5€ (`Math.round(t*0.3/5)*5`), modificabile, ≥ 0 e ≤ totale.
11. **fonte**: sempre `'banco'` per ordini creati dal gestionale in questa
    fase. Badge fonte con `tintaFonte` esistente.
12. **data_promessa** (busta): default suggerito +7 giorni, modificabile.
    In lista, se `data_promessa < oggi` e stato non finale → evidenziare la
    data in rosso.

## 3 · Pagine e rotte

### 3.1 `lib/modules.ts`
`ordini` → `attivo: true`. Nient'altro.

### 3.2 `/ordini` — la pipeline (server component)
`searchParams`: `vista` (`lac` default | `buste`), `stato` (id stato | assente
= tutti), `q` (ricerca).

- **Tabs** LAC / Buste (link con `?vista=`), stile segmented come il toggle di
  `PrescrizioneForm`.
- **Chips stato**: "Tutti" + gli stati della vista corrente (etichette e
  colori da `STATI_LAC`/`STATI_BUSTA` in utils). Chip attiva = filtro.
- **Ricerca** `q`: match su `numero` (ilike) **oppure** nome/cognome cliente.
  Implementazione semplice e robusta: se `q` matcha `/^(bl|ol)/i` cercare per
  numero, altrimenti risolvere prima gli id cliente
  (`clienti.or(nome.ilike,cognome.ilike).select(id)`) e poi `in('cliente_id', ids)`.
- **Righe lista** (Card a righe divise, pattern lista clienti): numero in
  `f-mono` semibold · cliente (cognome nome, link) · descrizione sintetica
  (LAC: descrizione prima riga + "+n" se più righe; busta: `lente_tipo ·
  indice · etichetta tipo_lavoro`) · badge fonte · badge stato (pill coi
  colori bg/fg dello stato) · `fmtQuando(updated_at)` · per buste
  `data_promessa` (rossa se scaduta e stato non finale).
- **Contatori in testa** (3 mini-card per vista): LAC = da ordinare /
  ordinati / arrivati da avvisare (`arrivato && avvisato_il is null`).
  Buste = in lavorazione / arrivate da ispezionare / pronte in giacenza
  (`pronta`, evidenziando quante da più di 7 giorni).
- CTA "Nuovo ordine LAC" / "Nuova busta" (variante accent) in header, in base
  alla vista. Stato vuoto con `Vuoto` + CTA.
- Ordinamento `updated_at desc`, `limit 100`. Escludere di default
  annullati/consegnati? **No**: "Tutti" mostra tutto; sono le chips a filtrare.

### 3.3 `/ordini/lac/nuovo` — wizard 3 step (client)
Pattern `PrescrizioneForm` (stato locale + hidden fields + una server action).
Accetta `?cliente=<id>` per saltare lo step 1.

1. **Cliente & prescrizione** — ricerca cliente live (input + lista risultati
   via query client-side su `clienti` con `or ilike`, max 8) → selezionato
   mostra card compatta; sotto, selettore Rx LAC (regola §2.8).
2. **Righe** — editor righe (§2.9) + "Da prescrizione" + totale live (mono).
3. **Riepilogo** — note, `data_arrivo_prevista` (opzionale), acconto
   (opzionale, default 0). Bottone "Crea ordine".

La action crea con `stato='da_ordinare'`, `fonte='banco'`, numero da rpc →
redirect alla scheda.

### 3.4 `/ordini/buste/nuova` — wizard 6 step (client, il flusso legacy)
Accetta `?cliente=<id>`. Step navigabili avanti/indietro senza perdere dati.

1. **Cliente & prescrizione** (come sopra, tipo `occhiali`).
2. **Tipo lavoro & montatura** — 4 scelte `tipo_lavoro` (radio card con una
   riga di spiegazione ciascuna); campi montatura: marca, modello, colore,
   calibro (placeholder `52▢18 145`), UPC, prezzo. Obbligo/facoltà da §2.6.
3. **Lenti & trattamenti** — `lente_tipo` (monofocale/progressiva/bifocale/
   office), materiale (testo), indice (select 1.50 · 1.60 · 1.67 · 1.74),
   trattamenti (checkbox multipli: antiriflesso, indurente, filtro luce blu,
   fotocromatico, idrorepellente), prezzo lenti.
4. **Garanzia & extra** — garanzia (testo libero, es. "Garanzia 24 mesi
   inclusa"), prezzo_extra, sconto.
5. **Centratura** — griglia OD/OS × (DNP, altezza), regola §2.7, intestazioni
   colonna come la griglia refrazione esistente.
6. **Riepilogo** — specchietto completo, totale calcolato (mono, grande),
   acconto precompilato al 30% (§2.10), saldo live = totale − acconto,
   `data_promessa` (default +7gg), note. Due bottoni: **"Crea busta"**
   (stato `lavorazione`) e "Salva come preventivo" (ghost, stato `preventivo`).

### 3.5 Schede ordine — `/ordini/lac/[id]` e `/ordini/buste/[id]` (server)
Layout comune: header con numero `f-mono` grande + badge stato e fonte;
cliente (link) e telefono; Rx collegata come riga mono (o "Nessuna
prescrizione collegata"); poi:

- **LAC**: tabella righe (descrizione, occhio, parametri in mono compatto,
  q.tà, prezzo, subtotale) + totale/acconto/saldo.
- **Busta**: blocchi Montatura · Lenti e trattamenti · Centratura (mono) ·
  Economia (montatura + lenti + extra − sconto = totale; acconto; **saldo**
  in evidenza) · date (ordine, promessa, arrivo/ispezione, consegna).
- **Cronologia essenziale**: righe data → evento ricavate dai campi valorizzati
  (creato, ispezionata da X il Y, avvisato il, consegnato il, caparra
  incamerata il). Niente tabella eventi: si legge dai campi.
- **Azioni**: solo i bottoni ammessi dallo stato corrente (§2.3/2.4).
  "Annulla" e "Remake" aprono un piccolo form inline (motivo obbligatorio,
  `useActionState`). "Consegna" per la busta mostra riga di conferma:
  "Saldo da incassare: € — confermi la consegna?".
- **Avvisa**: bottone "Segna avvisato" + se `clienti.telefono` presente, link
  ghost "Apri WhatsApp" → `https://wa.me/<telefono normalizzato>?text=<msg>`
  con messaggio precompilato: LAC "Ciao {nome}! Le tue lenti sono arrivate in
  negozio, quando vuoi passare a ritirarle? — {nome azienda}"; busta "Ciao
  {nome}! Il tuo occhiale è pronto 👓 Ti aspettiamo per la consegna. —
  {nome azienda}". Normalizzazione telefono: togliere spazi/trattini; se non
  inizia con `+`, prefissare `+39`.
- **Nota rapida**: input + bottone che appende a `note` con data.
- Busta: bottone "Stampa busta" → 3.6.

### 3.6 `/ordini/buste/[id]/stampa` — busta stampabile
Pagina dedicata, pulita, senza sidebar (layout proprio nel segment o wrapper
che la nasconde), ottimizzata per **A4 in bianco e nero**:

intestazione col nome azienda (da `aziende`) e "Busta lavoro" · numero
`f-mono` XXL · cliente e telefono · data ordine e data promessa · Rx completa
in mono (OD/OS/ADD, prisma se presente) · tipo lavoro · montatura · lenti,
indice e trattamenti · tabella centratura · totale/acconto/**saldo** ·
laboratorio e note · due righe firma (operatore / cliente al ritiro).
Bottone "Stampa" fisso (chiama `window.print()`), nascosto in `@media print`.
Margini e corpo pensati per essere leggibili appesi a una montatura.

### 3.7 Aggancio scheda cliente — `/clienti/[id]`
Sotto le prescrizioni, sezione **Ordini**: ultimi 5 (misto LAC+buste, ordinati
per `created_at desc`, ognuno con numero mono, badge stato, link) + due
bottoni ghost "Nuova busta" e "Nuovo ordine LAC" con `?cliente=<id>`.

### 3.8 Dashboard
Le due card KPI ordini esistenti perdono la nota "modulo in arrivo" e
diventano link (`/ordini?vista=lac` e `/ordini?vista=buste`).

## 4 · Server actions (in `lib/actions.ts`)

Tutte col pattern esistente (profilo via `getUser` + `utenti`, ritorno
`{ errore } | null`, `revalidatePath` su `/ordini`, scheda e `/clienti/[id]`
quando pertinente).

| Azione | Firma (bind) | Note |
|---|---|---|
| `creaOrdineLac` | `(prev, formData)` | righe come JSON string in hidden `righe`; valida righe (§2.9); numero da rpc `OL`; redirect scheda |
| `creaBusta` | `(prev, formData)` | totale server-side (§2.10); numero da rpc `BL`; `stato` da hidden (`lavorazione` \| `preventivo`); redirect scheda |
| `eventoOrdineLac` | `(id, evento, prev, formData)` con `evento ∈ ordina·arriva·avvisa·consegna·annulla` | mappa transizioni §2.3; `annulla` richiede `motivo` |
| `eventoBusta` | `(id, evento, prev, formData)` con `evento ∈ conferma·arriva·ispeziona·avvisa·consegna·annulla·remake` | mappa §2.4; `conferma` legge `acconto`; `ispeziona` setta ispezionata_*; `remake`/`annulla` richiedono `motivo` |
| `aggiungiNotaOrdine` | `(tipo, id, prev, formData)` | append `— gg/mm/aaaa: testo` |

Validazione transizioni: leggere lo stato attuale dal DB nella action e
verificare che l'evento sia ammesso PRIMA di scrivere; in caso contrario
`{ errore: "Transizione non valida da <stato>" }`.

## 5 · Già pronto in `lib/utils.ts` (usare, non duplicare)

`STATI_LAC` e `STATI_BUSTA` (id, label, bg, fg — colori demo + estensioni
fase 1), `fmtQuando(iso)` ("2 min fa" / "ieri" / "3 gg fa" / data),
`rxValida(p)` (attiva e non scaduta), oltre ai formattatori esistenti
(`fmtEuro`, `fmtData`, `fmtRefrazione`, `fmtDiottria`, `ETICHETTE_FONTE`).

## 6 · Cosa NON fare

Niente delete fisici. Niente nuove dipendenze. Niente modifiche a
schema/migrazioni/tipi/vocabolario. Niente `localStorage`. Niente API route
dove basta una server action. Non toccare auth, middleware, onboarding.
Niente colonne o tabelle nuove: se sembra servirne una, fermarsi e segnalarlo.

## 7 · Criteri di accettazione

`npm run build` verde. Tutto usabile a 390px (wizard compresi). Ogni
transizione non ammessa: assente dalla UI **e** rifiutata dal server. Numeri
solo dalla rpc (mai generati in JS). Annullati e consegnati restano visibili
in lista con "Tutti". Ispezione impossibile da saltare. Stampa busta leggibile
in bianco e nero. Nessuna regressione su clienti/prescrizioni/dashboard.

## 8 · Collaudo manuale (script per gli ottici)

Da eseguire su ambiente con dati propri, dopo il deploy. Per ogni scenario:
passi → risultato atteso.

**S1 · LAC dal banco.** Nuovo ordine LAC per una cliente esistente con Rx LAC
valida → "Da prescrizione" genera OD/OS coi parametri giusti → crea →
"Segna ordinato" → "Segna arrivato" → "Segna avvisato" (prova il link
WhatsApp) → "Consegna". *Atteso: numero OL-AAAA-NNNN, badge stato che segue i
colori, data consegna in cronologia.*

**S2 · Busta progressiva completa.** Nuova busta: occhiale completo,
montatura con calibro, progressiva 1.67 con antiriflesso, garanzia, centratura
OD/OS → riepilogo: acconto suggerito 30%, saldo giusto → crea → **stampa la
busta e giudicala come oggetto da laboratorio** → "Segna arrivata" →
"Ispeziona e segna pronta" → "Segna avvisata" → "Consegna" (verifica il saldo
mostrato). *Atteso: impossibile segnare pronta senza passare dall'ispezione;
in cronologia compare chi ha ispezionato.*

**S3 · Preventivo.** "Salva come preventivo" → in scheda "Conferma ordine"
chiedendo l'acconto. *Atteso: passa a lavorazione, acconto salvato.*

**S4 · Remake.** Su una busta arrivata: "Remake" con motivo "graffio su AR".
*Atteso: torna in lavorazione, STESSO numero, ispezione azzerata, motivo in
nota con data.*

**S5 · Annullo.** Ordine LAC in stato ordinato → "Annulla" con motivo.
*Atteso: annullato, resta in lista con "Tutti", nessun bottone di avanzamento.*

**S6 · Montatura del cliente.** Busta `montatura_cliente` ("Persol del
cliente, havana") solo lenti nuove. *Atteso: nessun obbligo sui campi
montatura, dicitura chiara in scheda e in stampa.*

**S7 · Pipeline e ricerca.** Con 6–8 ordini misti: filtra per stato, cerca per
numero (`BL-…`) e per cognome. *Atteso: chips e ricerca coerenti, promesse
scadute in rosso, contatori giusti.*

**S8 · Senza prescrizione.** Ordine LAC per cliente senza Rx. *Atteso: avviso
"senza prescrizione collegata", ordine comunque creato.*

**Domande finali ai tester** (raccogliere per iscritto): le etichette sono
quelle che usereste al banco? Manca un passaggio della vostra giornata tipo?
Cosa aggiungereste/togliereste dalla busta stampata? Il wizard busta rispetta
l'ordine mentale con cui prendete un ordine?

## 9 · Consegna

Commit granulari (`feat(ordini): …`), build verde a ogni commit, README:
spuntare la Fase 1 nella roadmap. Nessun file fuori da: `app/(app)/ordini/**`,
`app/(app)/clienti/[id]/page.tsx` (sezione ordini), `app/(app)/dashboard/page.tsx`
(link KPI), `components/**` (nuovi componenti ordini), `lib/actions.ts`,
`lib/modules.ts`.
