# Stack tecnico — VISTA Gestionale

Documento vivo dello stack e dei suoi salti di versione. Chi arriva fra sei
mesi deve poter capire da qui *cosa gira* e *perché è stato aggiornato*.

## Versioni fissate

Le versioni del framework sono **pinnate esatte** (niente `^`, niente `~`):
un aggiornamento di framework è una decisione, non un effetto collaterale di
`npm install`.

| Pacchetto        | Versione    | Note                                             |
|------------------|-------------|--------------------------------------------------|
| next             | `16.2.12`   | esatta — App Router, Turbopack default           |
| react            | `19.2.8`    | esatta                                            |
| react-dom        | `19.2.8`    | esatta                                            |
| @types/react     | `19.2.17`   | esatta (+ `overrides` per coerenza transitiva)   |
| @types/react-dom | `19.2.3`    | esatta (+ `overrides`)                            |
| typescript       | `5.9.3`     | esatta (ST-02) — ≥ 5.6                            |
| tailwindcss      | `3.4.19`    | esatta (ST-02) — 3.4.x, NON aggiornata a Tailwind 4 |
| @supabase/ssr    | `0.12.0`    | esatta (ST-02) — è la libreria di `proxy.ts`; cookie `getAll/setAll` intatto |
| @supabase/supabase-js | `2.110.2` | esatta (ST-02)                                |
| Node (locale)    | 22.x        | vedi CI sotto                                     |

> **Nota ST-02.** «Versioni fissate» vale per l'intero stack, non solo per
> `next`/`react`. `@supabase/ssr`, `@supabase/supabase-js`, `tailwindcss` e
> `typescript` sono **pinnati esatti** alle versioni già risolte (nessun
> movimento di dipendenze: il lockfile cambia solo le 4 righe dei range).
> Motivo forte per `@supabase/ssr`: è la libreria del file che protegge tutta
> l'applicazione (`proxy.ts`) — un `npm install` di chiunque non deve poterla
> spostare.

## G1 · Passaggio a Next 16 / React 19.2 (2026-07-26)

### Perché siamo saliti

- **Ragione architetturale (la principale):** stiamo per aggiungere rotte
  pubbliche e anonime (portale). Fra Next 15 e Next 16 cambiano il caching e
  le API asincrone delle richieste: farlo *dopo* aver scritto quelle pagine
  significherebbe rifarle. Si aggiorna il framework **prima**, su una base a
  comportamento noto e verde.
- **Avvisi di deprecazione catturati sulla base di partenza:** il build su
  **Next 15.5.20** è risultato pulito — `npm run build`, `tsc --noEmit` e
  `npm test` (57/57) verdi, **nessun avviso di deprecazione emesso**. Quindi
  la spinta di G1 non è un allarme del framework ma la scelta architetturale
  qui sopra. (Output della base salvato in fase di lavorazione; la base era
  verde al 100%.)

### Cosa è cambiato — file per file

Tutte le modifiche derivano dal **codemod ufficiale**
`npx @next/codemod@canary upgrade latest`, salvo dove indicato.

- `middleware.ts` → **`proxy.ts`** — rename imposto da Next 16 (il file di
  edge protection ora esporta `proxy` invece di `middleware`). **Rename fatto
  dal codemod.** L'unica differenza di contenuto è la firma della funzione
  (`export async function middleware` → `export async function proxy`): cookie
  `getAll/setAll`, `matcher` e le tre rotte pubbliche (`/login`, `/registrati`,
  `/auth`) sono **byte-identici**. Nessuna rotta pubblica aggiunta.
- `package.json` — versioni portate a Next 16.2.12 / React 19.2.8 (esatte, dal
  codemod); aggiunto blocco `overrides` per `@types/react`/`@types/react-dom`
  (dal codemod); **rimosso lo script `lint`** (vedi "Aperto").
- `package-lock.json` — rigenerato dal codemod con le nuove risoluzioni.
- `tsconfig.json` — due modifiche funzionali imposte dal build di Next 16:
  `jsx: "preserve"` → `"react-jsx"` (React automatic runtime) e aggiunto
  `.next/dev/types/**/*.ts` agli `include`. La formattazione compatta è stata
  **ripristinata a mano** dopo il build (Next l'aveva espansa): niente reformat
  gratuito, solo le due righe che contano.
- `next.config.mjs` — **non toccato** (era ed è vuoto).

### Turbopack

Next 16 usa **Turbopack come bundler di default**. `npm run build` e
`npm run dev` passano senza flag né configurazione aggiuntiva. Nessun
`webpack` custom da migrare (config vuota).

### Node nella CI

Next 16.2.12 richiede **Node `>=20.9.0`** (`npm view next@16.2.12 engines`).
La CI usa `node-version: 20`, che su GitHub Actions risolve all'ultima 20.x
(20.19+) — **sufficiente**. Perciò la CI è **lasciata a Node 20**, come da
regola della consegna ("se 20 basta, lascialo e scrivilo"). L'ambiente di
sviluppo locale gira su Node 22.

### Verifiche (tutte verdi su Next 16)

- `npx tsc --noEmit` → exit 0
- `npm run build` → Next.js 16.2.12 (Turbopack), Compiled successfully
- `npm test` → 57/57 (unit + guardie)
- `npm run dev` → Ready in ~0.4s; `/login` → 200; `/` → 307 redirect a
  `/login?da=%2F` (protezione `proxy.ts` invariata)
- `npm run test:e2e` → **non eseguito**: mancano i segreti `TEST_SUPABASE_*`
  del progetto di test (girano in CI quando presenti).

## Cosa resta aperto

- **ESLint.** Il vecchio script `"lint": "next lint"` è stato rimosso: nel
  repo non è mai esistita una configurazione ESLint e la CI non lo eseguiva.
  In Next 16 quel comando non esiste più. **ESLint va impostato per davvero in
  una consegna dedicata** (config + step di CI), non abborracciato qui.
- **Advisory `npm audit` (3 high).** Riguardano un `postcss` transitivo dentro
  `next`; l'unico "fix" proposto da `npm audit fix --force` è **declassare Next
  a 9.x** (una regressione assurda), quindi **non applicabile**. Da riprendere
  se/quando la catena `next`→`postcss` verrà aggiornata a monte.
- **E2E in CI.** Restano da far girare col progetto Supabase di test (segreti
  `TEST_SUPABASE_*`), come già annotato in `docs/agenti/TODO-ray.md`.
