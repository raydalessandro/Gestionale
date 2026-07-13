# Report — Agente Test & CI

Aggiornato: 2026-07-13 · Fasi coperte: 1, 2, 3, 4 (v0.1–v0.5).

La rete di sicurezza segue l'ordine di lavoro (`docs/agenti/agente-test.md`):
pochi test UI d'oro (i collaudi), tanto contratto vero, unit solo sulla logica
pura, guardie statiche. Nessun file dell'app è stato toccato dall'agente.

## Esito auto-verifica (locale)

`npm test` (= L1 unit + L4 guardie, gli unici eseguibili senza rete/DB):

    Test Files  2 passed (2)
         Tests  34 passed (34)   ← 24 unit + 5 guardie base + 5 guardie di coerenza

`npm run test:contratto` senza le env `TEST_SUPABASE_*` → 48 test skippati su
8 file (come da progetto: il contratto non gira senza il suo DB). `npx tsc
--noEmit` sull'intero progetto (test inclusi) → exit 0.

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
7. **004 · Agenda & Richiami** (`agenda-richiami.test.ts`): RLS su
   `appuntamenti`/`richiami` (A non vede/inserisce nell'azienda di B); trigger
   `updated_at` su entrambe (l'update fa avanzare il timestamp); check di
   dominio tipo/stato/durata su appuntamenti e tipo/esito/canale su richiami.
8. **005 · Cassa & Vendite** (`cassa-vendite.test.ts`): `prossimo_numero`
   accetta `VE`/`RE` (formato `PP-AAAA-NNNN`) e rifiuta i prefissi non validi;
   RLS su `vendite`/`resi`/`chiusure_cassa`/`movimenti_cassa`; `scarico` (rif.
   VE) abbassa la giacenza col trigger 003 e lo scarico con segno positivo è
   rifiutato; indici parziali `vendite_busta_unica`/`vendite_lac_unica` → 23505
   sul doppio incasso (l'annullo libera il posto); `movimenti_cassa` append-only
   (update/delete senza effetto, importo>0, tipo in lista); colonna generata
   `chiusure_cassa.versamento` (= contanti−fondo_chiusura, non scrivibile a
   mano) e unicità `(azienda, data)` → 23505; check importo/causale sui resi.

### L3 · E2E — `e2e/**` (Playwright chromium, girano in CI)
Selettori per ruolo/etichetta/testo. Ogni test parte dalla registrazione di un
tenant usa-e-getta (`e2e/_helpers.ts`).
- Fase 1: S1 (LAC dalla Rx alla consegna), S2 (busta: pronta solo via ispezione, consegna col saldo).
- Fase 2: S2 (carico 10/contate 9), S4 (Da catalogo → consegna → scarico), S5 (fermo → ritiro scarica).
- Fase 3: S3 (proposta sollecito → esito → redirect agenda), S4 (GDPR: LAC in esaurimento col consenso, sparisce togliendolo).
- **Fase 4** (`fase4-cassa.spec.ts`): S1 (vendita veloce anonima, contanti col
  resto a video 42 → dettaglio VE "Non associato"); S3 (consegna busta con
  caparra: "Consegna e incassa", vendita per l'INTERO valore, secondo incasso
  dello stesso ordine → messaggio "già una vendita" — *gated su service role*,
  la busta pronta con acconto si retrodata via seed); S6 (reso denaro con
  causale sulla vendita veloce → RE- nel registro, vendita ancora emessa); S8
  (chiusura serale con +1 € di eccedenza contanti → causale pretesa, redirect
  al dettaglio chiusura, una sola per oggi).

### L4 · Guardie statiche — `tests/unit/guardie.test.ts`
Base (regressioni di contratto):
- G1: `lib/actions.ts` non contiene `.delete(`.
- G2: nessun file in `lib/` scrive `giacenza` dentro un `.update({…})`.
- G3: la legacy `generaNumero()` non è usata in `lib/actions.ts` né in `app/`.
- G4: nessun numero BL-/OL- costruito in JS; la numerazione passa dalla rpc.

Coerenza (codice morto / bottoni mancati / fantasmi) — **tutte verdi oggi**:
- G5: ogni file in `components/` ha almeno un export usato altrove (niente file morti).
- G6: ogni componente React esportato (PascalCase) è renderizzato/importato
  da qualche parte — *esclusi* `components/ui.tsx` (primitive del design-system,
  legittime anche se inutilizzate) e le costanti `UPPER_CASE` (trade-off documentato).
- G7: ogni pagina sotto `app/(app)/<modulo>/` di un modulo `attivo:true` è
  raggiungibile (l'indice via Sidebar; i dettagli via prefisso statico linkato
  con `${id}`) — niente pagine orfane.
- G8: ogni `export async function` di `lib/actions.ts` è referenziata da un
  componente/pagina — nessuna server action fantasma (30/30 agganciate).
- G9: ogni modulo `attivo:true` ha un capitolo in `docs/manuale-utente/`,
  **tranne** una allowlist documentata (vedi *Ganci*).

> Limite noto di G2: ispeziona solo gli oggetti-letterale di `.update({…})`; le
> `.update(patch)` con variabile non sono lette (trade-off economico).
> Cosa hanno trovato le guardie di coerenza sul codice app: **nessun problema
> reale** su G5–G8 (nessun componente morto, nessuna pagina orfana, nessuna
> action fantasma). L'unico disallineamento reale è la copertura del manuale
> (G9) — vedi *Ganci*, è cross-agente, non un bug del codice.

## Cosa NON è coperto (per scelta o per limite)
Collaudi fuori dalla lista minima; stampa busta oltre "rende i dati chiave";
nessun test su Supabase di produzione, nessuno snapshot fragile.

## Flakiness attesa
Gli E2E sono scritti senza app viva: i selettori dei wizard multi-step e delle
ricerche cliente/catalogo vanno validati al primo run CI (probabile un giro di
aggiustamenti). Fase 3 S3/S4 dipendono dal tempo: si retrodatano via service
role. La numerazione per anno riparte da 1 a Capodanno (atteso).

## Ganci richiesti (al codice app e agli altri agenti)
1. **Manuale utente — capitoli mancanti (gancio per l'agente manuali).** La
   guardia G9 segnala che i moduli `attivo:true` **agenda**, **richiami** e
   **cassa** (Fasi 3–4) non hanno ancora un capitolo in `docs/manuale-utente/`
   (ci sono 01-clienti…05-magazzino, ma nulla per agenda/richiami/cassa).
   Problema **reale ma cross-agente**, non un bug del codice: per tenere
   `npm test` verde, G9 li tratta con una allowlist esplicita
   (`IN_CARICO_MANUALI`). Azione richiesta: l'agente manuali scrive i tre
   capitoli e, quando esistono, si toglie la voce dalla allowlist (la guardia
   scatterà da sola su qualunque futuro modulo attivo senza capitolo).
2. Etichette vere (`Field label`/`aria-label`) sui `select` di
   `components/AzioniMagazzino.tsx` e `components/AzioniRichiami.tsx`, e sul
   campo **Descrizione** del `WizardVendita` (oggi solo `placeholder`): gli E2E
   ripiegano su `getByPlaceholder`/`combobox`. Migliorerebbe anche
   l'accessibilità. **Non applicato: da valutare.**
3. `tsconfig.json` `exclude` di `tests`/`e2e` e `.gitignore` degli artefatti
   Playwright: **applicati dall'orchestratore** (fuori dalla proprietà dell'agente test).

## Cosa resta a Ray / CI
Vedi `docs/agenti/TODO-ray.md`: creare `gestionale-test`, impostare i 3 secret,
primo `workflow_dispatch` per far girare L2+L3 e rifinire i selettori E2E.

## File creati / aggiornati (questo giro)
Creati: `tests/contratto/agenda-richiami.test.ts` (004),
`tests/contratto/cassa-vendite.test.ts` (005), `e2e/fase4-cassa.spec.ts`.
Aggiornati: `tests/unit/guardie.test.ts` (+5 guardie di coerenza G5–G9),
`e2e/_helpers.ts` (seed `seedBustaProntaConAcconto` per Fase 4 · S3),
`docs/agenti/report-test.md`. **CI (`ci.yml`) invariata**: `build` esegue già
`npm test` (L1+L4); `contratto-e2e` include automaticamente i nuovi file (glob
`tests/**` / `e2e/`). Nessuna nuova devDep né nuovo script: bastano `vitest` e
`@playwright/test` già presenti.

## Base storica (giri precedenti)
`vitest.config.ts`, `playwright.config.ts`, `tests/unit/{utils,guardie}.test.ts`,
`tests/contratto/_helpers.ts` + 8 suite, `e2e/_helpers.ts` + 4 spec,
`.github/workflows/ci.yml`; `package.json` (devDeps `vitest`, `@playwright/test`;
script `test`, `test:contratto`, `test:e2e`).
