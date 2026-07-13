# TODO per Ray — setup CI & Supabase

Cose che deve fare **una persona** (non l'agente): riguardano segreti e
account esterni. Aggiornato al completamento della Fase 3.

## 1 · Secret del progetto Supabase di test (per la CI GitHub) — DA FARE

La CI (`.github/workflows/ci.yml`, curata dall'agente Test) esegue i test di
**contratto** ed **E2E** contro un **progetto Supabase dedicato ai test**, mai
quello di produzione. Serve quindi crearlo e dare i segreti a GitHub.

Passi:
1. Su supabase.com → **New project** (nome suggerito: `gestionale-test`,
   regione EU). Va bene il piano free.
2. SQL Editor → esegui **in ordine**: `supabase/schema.sql`, poi
   `supabase/migrazioni/002_ordini_buste.sql`, `003_catalogo_magazzino.sql`,
   `004_agenda_richiami.sql`. Una volta ciascuno.
3. Authentication → Providers → Email → **"Confirm email" OFF** (gli E2E
   registrano tenant usa-e-getta e devono entrare subito).
4. GitHub → repo **raydalessandro/Gestionale** → Settings → Secrets and
   variables → **Actions** → *New repository secret*, aggiungi:
   - `TEST_SUPABASE_URL` = Project URL del progetto di test
   - `TEST_SUPABASE_ANON_KEY` = anon key del progetto di test
   - `TEST_SUPABASE_SERVICE_ROLE_KEY` = service_role key del progetto di test
     (⚠️ è una chiave potente: sta solo nei secret CI, mai nel codice/nel client)

Finché i secret non ci sono, il job `build` (typecheck + build + unit +
guardie) gira lo stesso su ogni PR; i job `contratto` ed `e2e` restano in
attesa dei secret (skippati, non falliti).

## 2 · Supabase principale (produzione/test manuali) — NIENTE DA FARE

Le migrazioni 002, 003 e **004 (Agenda & Richiami)** sono **già applicate** al
progetto principale `uijfhhctrgirglmkrgoo` (le ho eseguite io via MCP mentre
codavo le fasi). L'app deployata su Vercel funziona senza altri passaggi.

Come da tua indicazione, **per ora si tiene un solo progetto** per i test
manuali dal vivo: è sufficiente. Il progetto `gestionale-test` del punto 1
serve **solo** alla CI, è separato e non tocca i tuoi dati.

## 3 · Promemoria conferma email (dominio localhost) — quando vuoi

Rimane aperta la sistemazione del link di conferma email sul progetto
principale: Authentication → URL Configuration → **Site URL** = URL Vercel di
produzione, e **Redirect URLs** con `<dominio>/auth/callback`. Non blocca
nulla (l'account demo confermato a mano funziona), è solo per le registrazioni
reali con conferma attiva.
