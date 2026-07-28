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
| **`gestionale-test`** | Solo la CI: contratto (L2) ed E2E (L3) girano qui | i job `contratto-e2e` di `.github/workflows/ci.yml`, via i segreti |

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

## Ricostruire `gestionale-test` da zero

1. Supabase → **New project**, nome `gestionale-test`, **stessa regione** di
   `vista-gestionale`. Poi Authentication → «Confirm email» **OFF**.
2. Da *Project Settings → Database* copia la **Connection string (URI)** e portala
   in ambiente come `SUPABASE_DB_URL` (mai su file).
3. Applica schema + migrazioni + marca l'ambiente di test:
   ```bash
   SUPABASE_DB_URL='postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
     MARCA_AMBIENTE_TEST=1 npm run db:applica-migrazioni
   ```
   Idempotente: rilanciarlo non rompe nulla e salta ciò che è già applicato.
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
