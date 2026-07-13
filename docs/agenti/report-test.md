# Report — Agente Test & CI

Aggiornato: 2026-07-13 · Fasi coperte: 1, 2, 3 (v0.1–v0.4).

La rete di sicurezza segue l'ordine di lavoro (`docs/agenti/agente-test.md`):
pochi test UI d'oro (i collaudi), tanto contratto vero, unit solo sulla logica
pura, guardie statiche. Nessun file dell'app è stato toccato dall'agente.

## Esito auto-verifica (locale)

`npm test` (= L1 unit + L4 guardie, gli unici eseguibili senza rete/DB):

    Test Files  2 passed (2)
         Tests  29 passed (29)

`npm run test:contratto` senza le env `TEST_SUPABASE_*` → 22 test skippati
(come da progetto: il contratto non gira senza il suo DB). `npx tsc --noEmit`
sull'intero progetto (test inclusi) → exit 0.

L2 (contratto) ed L3 (E2E) non sono stati eseguiti qui: mancano il progetto
Supabase di test e i suoi secret (li prepara Ray — vedi `docs/agenti/TODO-ray.md`).
Il codice è scritto e tipizzato, ma il loro esito reale lo darà la CI.

## Cosa è coperto

### L1 · Unit — `tests/unit/utils.test.ts`
Funzioni pure di `lib/utils.ts` ai bordi: `fmtDiottria` (segno esplicito, meno
tipografico vs ASCII, zero, null/NaN), `fmtRefrazione` (plano, solo sfera, riga
completa, asse mancante→0), `slugify` (accenti, trim, taglio a 40), `scadenzaRx`,
`rxValida` (non attiva, valida, scaduta, bordo con fake timers), `fmtQuando`.

> `lib/richiami-proposte.ts` non ha unit: `calcolaProposte` non è pura
> (interroga il DB). La sua logica è esercitata a livello E2E (Fase 3).

### L2 · Contratto — `tests/contratto/**` (girano in CI)
Client `@supabase/supabase-js` (già dipendenza). Ogni run crea tenant con slug
`test-<runid>-…` via la rpc di onboarding e pulisce per prefisso. Suite:
1. RLS isolamento: A non vede/tocca clienti/prodotti di B; `contatori` non leggibile.
2. Numerazione: 10 `prossimo_numero` in parallelo → 10 numeri unici; prefisso non valido rifiutato.
3. Trigger giacenza: carico +10, uso interno −4 → 6; rettifica ± col segno.
4. Vincoli: carico negativo, rettifica 0, stato fuori lista, asse 181 → rifiutati; numero duplicato → 23505.
5. Movimenti immutabili: update/delete su un movimento senza effetto (nessuna policy).
6. Onboarding: doppia rpc stesso utente → UTENTE_GIA_REGISTRATO; slug preso → 23505.

### L3 · E2E — `e2e/**` (Playwright chromium, girano in CI)
Selettori per ruolo/etichetta/testo. Ogni test parte dalla registrazione di un
tenant usa-e-getta (`e2e/_helpers.ts`).
- Fase 1: S1 (LAC dalla Rx alla consegna), S2 (busta: pronta solo via ispezione, consegna col saldo).
- Fase 2: S2 (carico 10/contate 9), S4 (Da catalogo → consegna → scarico), S5 (fermo → ritiro scarica).
- Fase 3: S3 (proposta sollecito → esito → redirect agenda), S4 (GDPR: LAC in esaurimento col consenso, sparisce togliendolo).

### L4 · Guardie statiche — `tests/unit/guardie.test.ts`
- G1: `lib/actions.ts` non contiene `.delete(`.
- G2: nessun file in `lib/` scrive `giacenza` dentro un `.update({…})`.
- G3: la legacy `generaNumero()` non è usata in `lib/actions.ts` né in `app/`.
- G4: nessun numero BL-/OL- costruito in JS; la numerazione passa dalla rpc.

> Limite noto di G2: ispeziona solo gli oggetti-letterale di `.update({…})`; le
> `.update(patch)` con variabile non sono lette (trade-off economico).

## Cosa NON è coperto (per scelta o per limite)
Collaudi fuori dalla lista minima; stampa busta oltre "rende i dati chiave";
nessun test su Supabase di produzione, nessuno snapshot fragile.

## Flakiness attesa
Gli E2E sono scritti senza app viva: i selettori dei wizard multi-step e delle
ricerche cliente/catalogo vanno validati al primo run CI (probabile un giro di
aggiustamenti). Fase 3 S3/S4 dipendono dal tempo: si retrodatano via service
role. La numerazione per anno riparte da 1 a Capodanno (atteso).

## Ganci richiesti al codice applicativo
1. Etichette vere (`Field label`/`aria-label`) sui `select` di
   `components/AzioniMagazzino.tsx` e `components/AzioniRichiami.tsx`: oggi
   select "nudi" → gli E2E ripiegano su `combobox`. Migliorerebbe anche
   l'accessibilità. **Non applicato: da valutare.**
2. `tsconfig.json` `exclude` di `tests`/`e2e` e `.gitignore` degli artefatti
   Playwright: **applicati dall'orchestratore** (fuori dalla proprietà dell'agente test).

## Cosa resta a Ray / CI
Vedi `docs/agenti/TODO-ray.md`: creare `gestionale-test`, impostare i 3 secret,
primo `workflow_dispatch` per far girare L2+L3 e rifinire i selettori E2E.

## File creati
`vitest.config.ts`, `playwright.config.ts`, `tests/unit/{utils,guardie}.test.ts`,
`tests/contratto/_helpers.ts` + 6 suite, `e2e/_helpers.ts` + 3 spec,
`.github/workflows/ci.yml`; `package.json` (devDeps `vitest`, `@playwright/test`;
script `test`, `test:contratto`, `test:e2e`).
