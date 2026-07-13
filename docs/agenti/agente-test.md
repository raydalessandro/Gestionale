# Ordine di lavoro — Agente Test & CI

Missione: costruire la **rete di sicurezza** del gestionale, in parallelo alla
codifica delle fasi, senza mai toccarne il codice. Tre livelli + un cancello CI.

## Perché così

Il cuore del progetto è il **contratto** (schema + RLS + trigger + vincoli):
è lì che si gioca la solidità, non nei pixel. Quindi: pochi test UI ma d'oro
(i percorsi dei collaudi), tanti test sul contratto vero, unit solo dove c'è
logica pura. I collaudi manuali delle spec di fase (S1, S2, …) **sono già gli
scenari E2E**: si automatizzano quelli, non se ne inventano altri.

## Proprietà dei file (regola dura, evita collisioni con chi coda)

L'agente test scrive SOLO in: `tests/**`, `e2e/**`, `.github/**`,
`vitest.config.ts`, `playwright.config.ts`, e in `package.json` limitatamente
a `devDependencies` e agli script `test`, `test:contratto`, `test:e2e`.
**MAI** toccare `app/`, `components/`, `lib/`, `supabase/`, `docs/` (eccetto
il proprio report). Se serve un gancio nel codice applicativo: scriverlo nel
report come richiesta, non applicarlo.

## L1 · Unit (Vitest) — `tests/unit/`

Bersagli: `lib/utils.ts` (fmtDiottria con meno tipografico, fmtRefrazione con
plano e cilindro, rxValida/scadenzaRx ai bordi mese, slugify con accenti,
fmtQuando) e ogni funzione pura futura (es. `lib/richiami-proposte.ts` per la
parte di sole trasformazioni, se estraibile). Veloci, zero rete, girano sempre.

## L2 · Contratto (il livello che conta) — `tests/contratto/`

Script Node/Vitest che parlano con un **progetto Supabase di test dedicato**
(mai quello vero) usando la service key per il setup e client anon+password
per le verifiche. Ogni run crea aziende con slug prefissato `test-<runid>-…`
via la stessa rpc di onboarding; il teardown (o uno script `pulisci`) elimina
per prefisso.

Asserzioni minime, in ordine di importanza:
1. **Isolamento RLS**: due aziende, due utenti; l'utente A non vede né tocca
   clienti/ordini/prodotti/richiami di B (select vuote, insert/update
   rifiutati). Questo test da solo vale il progetto.
2. **prossimo_numero sotto concorrenza**: 10 chiamate in `Promise.all` →
   10 numeri unici e progressivi per la stessa azienda; contatori invisibili
   ai client (select su `contatori` → negato).
3. **Trigger giacenza**: carico +10, uso interno −4 → giacenza 6; la
   `update` diretta di `giacenza`... è permessa dalla RLS, quindi il test
   verifica invece che il **codice** non la usi: grep di guardia (vedi L4).
4. **Vincoli**: movimento `carico` negativo → rifiutato; `rettifica` 0 →
   rifiutata; stato ordine fuori lista → rifiutato; asse 181 → rifiutato;
   `numero` duplicato per azienda → 23505.
5. **Movimenti immutabili**: update e delete su un movimento → rifiutati
   (nessuna policy).
6. **Onboarding**: doppia chiamata alla rpc con lo stesso utente →
   `UTENTE_GIA_REGISTRATO`; slug duplicato → 23505.

A ogni nuova migrazione (00N): estendere qui, stessa sessione di checkpoint.

## L3 · E2E (Playwright, chromium) — `e2e/`

- Ambiente: `next dev`/`next start` locale puntato al progetto Supabase di
  test (le stesse env del L2). Un tenant **usa e getta per run**: il primo
  test È la registrazione+onboarding (email `e2e-<timestamp>@test.local`,
  conferma email disattivata sul progetto di test).
- **Selettori solo per ruolo/etichetta** (`getByRole`, `getByLabel`,
  `getByText`): la UI ha label vere ovunque, i test non devono rompersi a
  ogni ritocco di stile. Vietati selettori CSS e data-testid.
- Scenari, presi 1:1 dai collaudi: Fase 1 → S1 (LAC dalla Rx alla consegna)
  e S2 (busta completa: acconto 30%, ispezione obbligatoria, consegna col
  saldo; della stampa si verifica solo che la pagina `/stampa` renda i dati
  chiave); Fase 2 → S2 (carico con differenza → due movimenti), S4 (Da
  catalogo → consegna → scarico), S5 (fermo: ritiro scarica, annullo no).
  Fase 3 quando completata → S3 e S4 del suo collaudo.
- Regola anti-flake: ogni test crea i SUOI dati nel SUO tenant; nessun test
  dipende da un altro run; niente sleep fissi, solo attese su condizioni.

## L4 · Guardie statiche — dentro `tests/unit/guardie.test.ts`

Test che leggono il sorgente e falliscono se: compare `.delete(` su tabelle
di dominio in `lib/actions.ts`; compare `giacenza` dentro una `update` in
`lib/`; compare un numero ordine generato in JS (`BL-`/`OL-` costruiti a mano
fuori dai test). Economiche, brutali, efficaci.

## CI — `.github/workflows/ci.yml`

- Job `build` (sempre, anche su fork): install → typecheck/lint → `next build`
  con env fittizie → L1 + L4.
- Job `contratto-e2e` (solo se i secrets esistono): L2 poi L3. Trigger: PR
  verso `main`, `workflow_dispatch`, cron notturno.
- Secrets attesi (li crea Ray su un progetto Supabase nuovo "gestionale-test"):
  `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`.
  Sul progetto di test: schema 001 + migrazioni in ordine, conferma email OFF.
- Vercel continua a deployare; la CI è il cancello di merge, non il deploy.

## Checkpoint e report

A ogni completamento di fase (non a ogni commit): estendere L2 per la nuova
migrazione, aggiungere gli E2E del collaudo di fase, aggiornare
`docs/agenti/report-test.md` (cosa è coperto, cosa no, flakiness osservata,
ganci richiesti al codice). Il report è l'unico file fuori da tests/e2e/ci
che quest'agente tocca.

## Cosa NON fare

Niente mock del database al livello contratto (il contratto si testa vero).
Niente screenshot-test o snapshot fragili. Niente dipendenze oltre a
`vitest`, `@playwright/test` (e i browser Playwright in CI). Niente test che
girano sul Supabase di produzione. Niente modifiche al codice applicativo,
mai, per nessun motivo.
