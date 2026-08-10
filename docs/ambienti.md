# Ambienti

Quali progetti Supabase esistono, a cosa serve ciascuno, chi punta dove — e come
si ricostruisce il progetto di test da zero.

> **Nessuna chiave in questo documento.** Solo i *nomi* dei segreti e dove
> stanno. Le chiavi vivono nell'ambiente (Supabase, GitHub Actions Secrets, il
> gestore di password), mai in un file del repository — che è pubblico.

## I progetti

| Progetto Supabase | A cosa serve | Chi ci punta |
|---|---|---|
| **`vista-gestionale`** (`uijfhhctrgirglmkrgoo`) | Anteprima **e** produzione (un solo DB, per ora) | l'app deployata su Vercel (`main` e le preview di ramo) |
| **`gestionale-test`** (`ktjzsjvmutfqnxbatisa`) | Solo la CI: contratto (L2) ed E2E (L3) girano qui | i job `contratto-e2e` di `.github/workflows/ci.yml`, via i segreti |

Lo sviluppo locale usa un file `.env.local` (non versionato) che punta, a scelta,
al progetto di anteprima o a uno personale. La CI non usa mai il progetto di
produzione.

## I segreti (GitHub → Settings → Secrets and variables → Actions)

Il job del contratto/E2E gira **solo** se questi tre esistono; altrimenti la CI
lo salta pulito (il job `guard` stampa `secrets=false`).

| Nome del segreto | Cos'è |
|---|---|
| `TEST_SUPABASE_URL` | Project URL di `gestionale-test` |
| `TEST_SUPABASE_ANON_KEY` | anon key di `gestionale-test` |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | service role key di `gestionale-test` (potente: solo qui, mai nel repo) |
| `TEST_SUPABASE_DB_URL` | connessione Postgres diretta a `gestionale-test`. **Opzionale ma consigliata**: senza, i due test di catalogo di `bonifica-020` skippano puliti e la CI non allinea da sé il DB di test. Come metterlo: runbook B in [`scripts/LEGGIMI.md`](../scripts/LEGGIMI.md) |

Sul progetto di test, **Authentication → «Confirm email» = OFF**: gli E2E
registrano tenant usa-e-getta e devono entrare subito.

## Il cancello d'ambiente

`gestionale-test` ha in `public.ambiente` la riga `('test')`. È il **cancello
positivo** che abilita `svuota_dati_di_test()`: la funzione si rifiuta di girare
dove quella riga non c'è (produzione compresa). La riga la scrive lo script di
provisioning con `MARCA_AMBIENTE_TEST=1` — **solo** sul progetto di test.

La CI chiama `svuota_dati_di_test()` (via `scripts/svuota-test.ts`) **prima** del
contratto: se un giro fallisce a metà, il successivo parte pulito lo stesso. La
funzione cancella solo ciò che le prove creano (tenant `test-…`/`ottica-e2e-…`,
prenotazioni/persone, utenti `@test.local`); il seed dimostrativo resta.

## Come arrivano le migrazioni, ambiente per ambiente

Una sola strada, quella che registra (`_infra_migrazioni`). Mai l'SQL editor del
dashboard: esegue e non registra, e da quel momento il registro mente.

| Ambiente | Chi applica | Quando |
|---|---|---|
| **test** | la CI, da sé | primo passo del job `contratto-e2e`, prima della pulizia e del contratto. Gira solo se `TEST_SUPABASE_DB_URL` esiste; è idempotente, su un progetto allineato non tocca nulla |
| **prod** | una persona, a mano | `sh scripts/migra-cloud.sh prod`, **nella stessa seduta del merge** — Vercel deploya `main` da solo, e fra il merge e la migrazione il codice online chiede tabelle che non esistono ancora |
| **locale** | chi sviluppa | `bash scripts/db-locale.sh` su un Postgres usa-e-getta |

Il passo in CI **non** passa `MARCA_AMBIENTE_TEST`, e non è una dimenticanza:
marcherebbe come `'test'` qualunque database il segreto stia puntando. La riga
`('test')` la mette il provisioning, una volta, con `migra-cloud.sh test`.

## Ricostruire `gestionale-test` da zero

1. Supabase → **New project**, nome `gestionale-test`, **stessa regione** di
   `vista-gestionale`. Poi Authentication → «Confirm email» **OFF**.
2. Da *Project Settings → Database* copia la **Connection string (URI)** e portala
   in ambiente come `SUPABASE_DB_URL` (mai su file).
3. Applica schema + migrazioni + marca l'ambiente di test:
   ```bash
   sh scripts/migra-cloud.sh test
   ```
   L'URI si incolla al prompt: non compare a schermo e non entra nella history.
   Lo strumento verifica il ref del progetto prima di connettersi, e la
   marcatura `'test'` la mette lui perché il bersaglio è `test` — non è una
   variabile da ricordarsi. Idempotente: rilanciarlo non rompe nulla e salta
   ciò che è già applicato. Il runbook completo è in
   [`scripts/LEGGIMI.md`](../scripts/LEGGIMI.md).
4. Semina i dati dimostrativi (i due negozi che gli E2E si aspettano):
   ```bash
   # seed SQL (via psql o SQL editor): supabase/seed/seed_demo.sql
   SUPABASE_URL='https://<ref>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<service>' \
     DEMO_PASSWORD='<password>' npx tsx scripts/crea-negozio-demo.ts
   ```
5. Da *Project Settings → API* copia URL / anon / service role e mettili nei tre
   segreti GitHub qui sopra.

## Debito aperto — separazione anteprima/produzione

**Oggi anteprima e produzione condividono `vista-gestionale`.** Finché i dati
sono fittizi e non siamo online va bene; **prima del primo negozio reale** vanno
separati (un progetto di produzione distinto, con le sue chiavi e il suo backup),
altrimenti una prova manuale o una migrazione sull'anteprima tocca dati veri.
Questa consegna **non** chiude quel debito: accende solo la rete di sicurezza
della CI sul progetto di test.
