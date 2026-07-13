# VISTA Gestionale

Il gestionale dell'ottico indipendente — **il cuore della suite VISTA**.

Repo separato dalla demo, per scelta: qui vive il dato vero. Ciò che mette in
comunicazione tutte le app dell'ottico (gestionale, sito pubblico LAC, app
white-label, demo, tool agente) **è il database**: questo repo ne è il custode.

- Stack: **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Supabase**
- Supabase è open source: stesso schema in cloud o self-hosted, online o offline.
- Multi-tenant con RLS: ogni riga vive dentro la sua `azienda`. Punto.

---

## Setup (~30 minuti)

### 1 · Crea il progetto Supabase
Su [supabase.com](https://supabase.com) → *New project* (regione EU).

### 2 · Esegui lo schema e le migrazioni
Dashboard → **SQL Editor** → incolla tutto `supabase/schema.sql` → *Run*.
Poi, nello stesso modo e **in ordine**, i file in `supabase/migrazioni/`
(oggi: `002_ordini_buste.sql`). Una volta sola ciascuno.

### 3 · (Consigliato per partire) Disattiva la conferma email
*Authentication → Sign In / Providers → Email → "Confirm email" OFF.*
Così la registrazione entra subito nel gestionale. Riattivala quando vuoi:
il flusso con conferma è già gestito (`/auth/callback` → `/benvenuto`).

### 4 · Variabili d'ambiente
Copia `.env.local.example` in `.env.local` e compila da
*Project Settings → API*:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 5 · Avvia
```bash
npm install
npm run dev
```
Vai su `/registrati` → crea l'account → dai il nome al negozio → dashboard.

### 6 · Deploy su Vercel
Importa il repo, aggiungi le due variabili `NEXT_PUBLIC_*` in
*Settings → Environment Variables*, deploy. Fine.

---

## Il contratto (leggere prima di toccare lo schema)

`supabase/schema.sql` non è solo DDL: è **il contratto tra le app**.
Vocabolario condiviso, già in uso nella demo:

| Concetto | Valori |
|---|---|
| `fonte` (clienti e ordini) | `banco` · `sito` · `app` · `convenzione` · `import` |
| Stati ordini LAC | `da_ordinare → ordinato → arrivato → consegnato` (`annullato`) |
| Stati busta lavoro | `preventivo → lavorazione → pronta → consegnata` (`annullata`) |
| Numerazione | buste `BL-2026-0141` · ordini LAC `OL-2026-0032` |
| Tenant | tabella `aziende`, chiave pubblica = `slug` |

**Come scrivono le altre app.** Il sito pubblico e l'app inseriscono ordini con
`fonte='sito'|'app'` passando da un endpoint server che usa la
`SUPABASE_SERVICE_ROLE_KEY` (mai nel client) e risolve l'azienda dallo slug.
Il gestionale li vede comparire nella pipeline come qualunque ordine del banco,
col badge della fonte.

**Multi-sede.** Il tenant è l'insegna (`aziende`); quando serviranno più punti
vendita arriverà la tabella `punti_vendita` senza toccare nessuna FK.

**Dominio.** Le prassi operative del settore (buste, caparre, resi, garanzie,
fiscale, convenzioni, magazzino) distillate dai manuali di catena sono in
[`docs/dominio-ottica.md`](docs/dominio-ottica.md): è la lettura propedeutica
alla v0.2.

---

## Cosa c'è in v0.1

- **Auth completa**: registrazione, login, onboarding `/benvenuto` (crea
  azienda + titolare via RPC `crea_azienda_con_titolare`), middleware di
  protezione rotte, logout.
- **Dashboard**: KPI live (clienti, prescrizioni 30gg, ordini LAC attivi,
  buste in lavorazione) + ultimi clienti con badge fonte.
- **Clienti**: ricerca, creazione, modifica, scheda. Anagrafica con codice
  fiscale (pronto per la fase fiscale), `fonte`, consenso marketing (GDPR —
  è il prerequisito del modulo Recall).
- **Prescrizioni**: form occhiali/LAC con griglia OD/OS (step 0.25, asse
  0–180, cilindro negativo), prisma, addizione, geometria LAC (default
  8.6/14.2), template rapidi dal modulo legacy, anteprima mono "da banco".
- **Schema completo** anche per ciò che la UI non copre ancora:
  `prodotti` (con `visibile_sito` per l'e-commerce LAC), `ordini_lac`,
  `ordini_occhiali`.

## Roadmap

Il piano completo fase per fase è in [`docs/fasi/piano.md`](docs/fasi/piano.md).

- **v0.2 — Ordini & Buste**: pipeline LAC e busta lavoro — ✅ **fatto**
  (spec: `docs/fasi/fase-1-ordini-buste.md` · verifica:
  `docs/fasi/fase-1-verifica-spec.md`).
- **v0.3 — Catalogo & Magazzino**: ✅ **fatto** (DB: migrazione 003 ·
  spec: `docs/fasi/fase-2-catalogo-magazzino.md`).
- **v0.4 — Agenda & Richiami**: ✅ **fatto** (DB: migrazione 004 · spec:
  `docs/fasi/fase-3-agenda-richiami.md`). In parallelo Test & CI e Manuale
  utente (ordini di lavoro in `docs/agenti/`).
- **v0.5 — Cassa**: vendite, incassi, prima base per il ROI reale.
- **Poi**: richiami (Recall legge da qui), voucher convenzioni, punti
  vendita, fase fiscale (Tessera Sanitaria, fattura elettronica).

---

*VISTA Suite — il compagno digitale dell'ottico indipendente · Spirale Editrice*
