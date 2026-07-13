# Fase 2 — Catalogo & Magazzino (v0.3) · Specifica di codifica

Stessa disciplina della Fase 1: questa spec è la fonte di verità. Dove tace,
si sceglie la via più semplice coerente col repo; dove parla, non si devia.

## 0 · Prima di scrivere una riga

Leggere: `README.md` (contratto) · `supabase/migrazioni/003_catalogo_magazzino.sql` ·
`docs/dominio-ottica.md` §8 (flussi merce di catena) · il codice della Fase 1
(`app/(app)/ordini/**`, `components/Wizard*.tsx`, `components/AzioniOrdine.tsx`,
`lib/actions.ts`) per riusarne i pattern.

**Stato di partenza garantito**: 003 applicata al DB; `lib/database.types.ts`
(ProdottoRow esteso, `MovimentoMagazzinoRow`, `FermoRow`) e `lib/utils.ts`
(`ETICHETTE_MOVIMENTO`, `STATI_FERMO`) già allineati. Come per la Fase 1, se
si trova un disallineamento evidente tra 003 e i tipi: correggere i tipi,
segnalarlo nel commit, non toccare la migrazione.

Convenzioni tecniche: identiche alla Fase 1 (§0 di quella spec vale tutto:
Next 15 con params Promise, server actions + `useActionState`, RLS senza
filtri manuali in select, `azienda_id` sempre negli insert, UI da `ui.tsx`,
nessuna nuova dipendenza).

## 1 · Obiettivo e perimetro

**Dentro**: modulo Magazzino — anagrafica prodotti (CRUD, mai delete: si
disattiva), giacenze con libro giornale movimenti append-only, carico da
bolla con conferma quantità e rettifica automatica, rettifiche manuali,
sotto scorta, fermi per cliente, aggancio al wizard LAC ("Da catalogo") e
scarico automatico alla consegna degli ordini LAC, KPI dashboard.

**Fuori** (non costruire nemmeno gli attacchi): listini/promozioni, prezzi
per canale, valorizzazione di magazzino e report economici, import CSV,
lettore barcode, multi-sede, vendita da cassa (fase 4), esposizione del
catalogo sul sito (fase 6 — qui `visibile_sito` è solo un interruttore
salvato).

## 2 · Regole di dominio vincolanti

1. **La giacenza non si scrive mai a mano.** `prodotti.giacenza` è una cache
   mantenuta dal trigger di 003: le action inseriscono **solo** movimenti.
   Nessuna `update` su `giacenza`, in nessun punto del codice.
2. **Movimenti append-only.** Niente update né delete sui movimenti (il DB
   li rifiuta comunque: non esistono policy). Un errore si corregge con una
   **rettifica** di segno opposto, mai riscrivendo la storia.
3. **Segni**: `carico` > 0; `scarico`, `ordine_cliente`, `reso_fornitore`,
   `danno`, `uso_interno` < 0; `rettifica` ±. La UI presenta sempre quantità
   positive e applica il segno in base al tipo; la action li impone; il
   check del DB è l'ultima rete.
4. **Carico da bolla con conferma** (dal dominio di catena, §8): il form di
   carico chiede *quantità in bolla* e *quantità contata*. Si registra:
   movimento `carico` = quantità **in bolla** (riferimento = n° bolla) e, se
   contata ≠ bolla, un secondo movimento `rettifica` = (contata − bolla) con
   nota `Differenza da bolla <n°>`. Così lo stock riflette il contato e la
   discrepanza resta scritta. Un'unica action, due insert.
5. **Sotto scorta**: prodotto `attivo` con `scorta_minima > 0` e
   `giacenza ≤ scorta_minima`. (Il confronto usa la giacenza, non la
   disponibile.)
6. **Fermi**: un fermo **non** muove la giacenza: la *impegna*.
   `disponibile = giacenza − Σ quantità dei fermi attivi` del prodotto,
   calcolata in query dove serve mostrarla. Macchina a stati:

   | Da | Evento | A | Effetti |
   |---|---|---|---|
   | attivo | "Segna ritirato" | ritirato | inserisce movimento `scarico` −quantità, riferimento `Fermo <cognome nome>` |
   | attivo | "Annulla fermo" | annullato | nessun movimento (la merce torna disponibile) |

   Scadenza di default proposta nel form: **+14 giorni** (modificabile). Un
   fermo scaduto e ancora attivo si evidenzia in rosso in lista — nessun
   automatismo di chiusura (arriverà col Recall, fase 3).
7. **Prodotti: mai delete.** La disattivazione (`attivo = false`) li toglie
   da ricerche e wizard ma non dalla storia. Un prodotto con giacenza ≠ 0 o
   fermi attivi può comunque essere disattivato: mostrare un avviso, non un
   blocco.
8. **Scarico automatico alla consegna LAC**: nell'evento `consegna` di
   `eventoOrdineLac`, per ogni riga di `righe` con `prodotto_id` valorizzato
   inserire un movimento `ordine_cliente` con quantità −(quantità riga) e
   `riferimento = numero ordine`. Se il prodotto non esiste più: saltare la
   riga senza bloccare la consegna. La consegna della **busta** non scarica
   nulla in questa fase.
9. **SKU**: è il campo barcode/EAN-UPC. Unicità per azienda già garantita
   dal DB (indice parziale di 001): la action intercetta l'errore `23505` e
   risponde "SKU già in uso".
10. **`parametri` (jsonb) per LAC**: il form prodotto, quando `tipo = 'lac'`,
    mostra tre campi dedicati — raggio (BC), diametro (DIA), confezione
    (testo, es. "×6") — salvati come `{ "raggio": 8.6, "diametro": 14.2,
    "confezione": "×6" }`. Per gli altri tipi, `parametri` resta `{}` (non
    esporre editor JSON).

## 3 · Pagine e rotte

### 3.1 `lib/modules.ts`
`magazzino` → `attivo: true`.

### 3.2 `/magazzino` — vista principale (server)
`searchParams`: `vista` (`prodotti` default | `movimenti` | `fermi`),
`q` (ricerca), `filtro` (per prodotti: `tutti` default | `sotto_scorta` |
`disattivati`; per fermi: stato; per movimenti: tipo).

- **Tabs** Prodotti / Movimenti / Fermi (pattern tabs della pipeline ordini).
- **Contatori in testa** (3 mini-card, sempre visibili): prodotti attivi ·
  sotto scorta (rosso se > 0) · fermi attivi (evidenzia quanti scaduti).
- **Vista Prodotti**: ricerca su nome/marca/sku; righe: nome + marca ·
  `sku` in mono · tipo (badge neutro) · prezzo · **giacenza** in mono
  (rossa se ≤ scorta minima e scorta > 0; grigia se prodotto disattivato) ·
  eventuale "n impegnati" se ha fermi attivi. Riga → scheda prodotto.
  CTA header: "Nuovo prodotto" (accent).
- **Vista Movimenti**: ultimi 100, filtro per tipo (chips con
  `ETICHETTE_MOVIMENTO`); righe: data (`fmtQuando`) · prodotto (link) ·
  etichetta tipo · quantità **con segno** in mono (verde se >0, rosso se <0) ·
  riferimento · chi (nome utente se presente). Nessuna azione: si legge e basta.
- **Vista Fermi**: chips stato (`STATI_FERMO`); righe: prodotto · cliente
  (link) · quantità · scadenza (rossa se passata e stato attivo) · badge
  stato · azioni inline "Segna ritirato" / "Annulla" (solo su attivi,
  conferma con motivo NON richiesta). CTA header: "Nuovo fermo".

### 3.3 `/magazzino/prodotti/nuovo` e `/magazzino/prodotti/[id]/modifica`
Un solo `ProdottoForm` (pattern `ClienteForm`): tipo (select 6 valori del
contratto) · marca · nome* · descrizione · sku · fornitore · prezzo* ·
costo · scorta minima · toggle `visibile_sito` (hint: "comparirà sul sito
pubblico quando attiveremo l'integrazione — Fase 6") · toggle `attivo` (solo
in modifica) · blocco parametri LAC (§2.10, solo se tipo lac).
**La giacenza non è nel form**: in modifica si mostra read-only con link
"Registra un movimento".

### 3.4 `/magazzino/prodotti/[id]` — scheda prodotto (server)
Header: nome + marca, badge tipo, sku mono, badge "Disattivato" se serve.
Tre numeri grandi in mono: **giacenza** · **impegnata** (fermi attivi) ·
**disponibile**. Prezzo/costo/fornitore/scorta minima. Poi **azioni**:

- **"Carico da bolla"** — form inline (§2.4): n° bolla, q.tà in bolla, q.tà
  contata (default = bolla), note.
- **"Rettifica"** — form inline: direzione (+/−), quantità, motivo
  obbligatorio (finisce in `note`).
- **"Altro movimento"** — select tipo (`scarico`, `reso_fornitore`, `danno`,
  `uso_interno`), quantità, riferimento/motivo.
- **"Nuovo fermo"** — cliente (ricerca live riusando il pattern dei wizard),
  quantità (≤ disponibile, altrimenti errore), scadenza (default +14gg), note.

Sotto: **ultimi 20 movimenti** del prodotto (stessa resa della vista
movimenti) e **fermi attivi** con le azioni inline.

### 3.5 Wizard LAC — "Da catalogo" (modifica a `WizardOrdineLac`)
Nell'editor righe, accanto a "Da prescrizione", bottone **"Da catalogo"**:
apre una mini-ricerca (client-side, max 8 risultati) sui `prodotti` attivi
con `tipo in ('lac','soluzione')`; la selezione compila
`descrizione = marca + nome (+ confezione)`, `prezzo`, `prodotto_id`, e per
le LAC precompila raggio/diametro da `parametri`. La riga resta modificabile.
Mostrare la disponibilità accanto al risultato ("disp. 4") senza bloccare
niente: si può ordinare anche a giacenza zero (è il mestiere: si ordina al
fornitore).

### 3.6 Dashboard
Aggiungere una quinta… no: **sostituire la nota** della card "Ordini LAC
attivi"? No. Le 4 card KPI restano; sotto di esse, se `sotto scorta > 0`,
una riga di avviso ambra: "N prodotti sotto scorta →" (link a
`/magazzino?filtro=sotto_scorta`). Se zero: niente.

### 3.7 Scheda cliente
Nella scheda cliente, se ha fermi **attivi**: riga informativa sopra la
sezione Ordini ("Ha 1 articolo fermato in negozio →" link al magazzino
filtrato). Niente di più.

## 4 · Server actions (in `lib/actions.ts`)

| Azione | Firma | Note |
|---|---|---|
| `creaProdotto` / `aggiornaProdotto` | pattern `creaCliente`/`aggiornaCliente` | parametri LAC composti server-side; 23505 → "SKU già in uso"; `giacenza` MAI nel payload |
| `caricoDaBolla` | `(prodottoId, prev, formData)` | valida bolla ≥ 0 e contata ≥ 0; insert `carico` (+bolla) e, se serve, `rettifica` (contata−bolla) |
| `registraMovimento` | `(prodottoId, prev, formData)` | tipi ammessi §3.4; applica il segno; motivo obbligatorio per `rettifica` |
| `creaFermo` | `(prodottoId, prev, formData)` | quantità ≤ disponibile (ricalcolata server-side) |
| `eventoFermo` | `(id, evento, prev, formData)` con `evento ∈ ritira·annulla` | macchina §2.6; `ritira` inserisce lo scarico |
| `eventoOrdineLac` (esistente) | — | estendere SOLO l'evento `consegna` con lo scarico automatico §2.8 |

Tutte con la solita difesa: stato/valori riletti dal DB nella action prima di
scrivere; errori come `{ errore }`; `revalidatePath` su `/magazzino`, scheda
prodotto e, dove tocca, `/ordini` e scheda cliente.

## 5 · Cosa NON fare

Niente update/delete su movimenti (nemmeno "per admin"). Niente scrittura
diretta di `giacenza`. Niente nuove dipendenze, tabelle o colonne. Niente
editor JSON esposto all'utente. Non toccare 001/002/003 né il vocabolario.
Non modificare la Fase 1 oltre ai due punti previsti (§3.5 e §4 ultima riga).

## 6 · Criteri di accettazione

Build verde. Tutto usabile a 390px. La giacenza cambia **solo** via
movimenti (verificabile: nessuna occorrenza di `giacenza` nelle `update`).
Carico con differenza produce due movimenti coerenti. Fermo ritirato scarica;
annullato no. Sotto scorta appare/sparisce al variare di giacenza e soglia.
"Da catalogo" compila la riga LAC e la consegna scarica. Prodotti mai
cancellati. Nessuna regressione su ordini/clienti/prescrizioni.

## 7 · Collaudo manuale (script per gli ottici)

**S1 · Anagrafica.** Crea 4 prodotti: una LAC mensile con parametri e sku,
una soluzione, una montatura con costo e fornitore, un servizio. *Atteso:
form nel linguaggio giusto, la LAC chiede BC/DIA/confezione.*

**S2 · Carico da bolla con sorpresa.** Sulla LAC: bolla n° 123, in bolla 10,
contate 9. *Atteso: giacenza 9; nei movimenti un carico +10 e una rettifica
−1 "Differenza da bolla 123".*

**S3 · Sotto scorta.** Scorta minima 6 sulla LAC → non è sotto scorta;
registra uso interno −4 → giacenza 5, compare sotto scorta (chip, contatore,
avviso in dashboard).

**S4 · Ordine dal catalogo.** Nuovo ordine LAC → riga "Da catalogo" → la
descrizione, il prezzo e i parametri si compilano da soli → porta l'ordine
fino a "Consegna". *Atteso: alla consegna la giacenza scende della quantità,
movimento `ordine_cliente` col numero OL come riferimento.*

**S5 · Fermo.** Ferma la montatura per un cliente, scadenza breve. *Atteso:
giacenza invariata, disponibile −1, riga nel cliente; "Segna ritirato" →
scarico e stato ritirato; un secondo fermo annullato non muove nulla.*

**S6 · L'errore si corregge, non si cancella.** Prova a immaginare di aver
sbagliato un carico: l'unico modo è una rettifica opposta. *Atteso: la
storia resta tutta, il saldo torna giusto.*

**S7 · Disattivazione.** Disattiva la soluzione. *Atteso: sparisce da "Da
catalogo" e dalle ricerche di default, resta nei movimenti e col filtro
"disattivati".*

**Domande ai tester**: i tipi di movimento coprono la vostra settimana vera?
Il carico da bolla rispecchia come ricevete la merce? Cosa vi serve sapere di
un prodotto *a colpo d'occhio* che qui manca? I fermi funzionano come i
vostri "messi da parte"?

## 8 · Consegna

Commit granulari `feat(magazzino): …`, build verde a ogni commit, README:
spuntare la Fase 2. File ammessi: `app/(app)/magazzino/**` (nuovo),
`components/ProdottoForm.tsx` + eventuali componenti magazzino,
`components/WizardOrdineLac.tsx` (§3.5), `app/(app)/dashboard/page.tsx`
(avviso sotto scorta), `app/(app)/clienti/[id]/page.tsx` (riga fermi),
`lib/actions.ts`, `lib/modules.ts`.
