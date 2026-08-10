# scripts · la libreria di strumenti

*Le procedure che oggi si fanno a mano, scritte una volta perché domani si
facciano da sole. Qui sta il **come**; il **chi punta dove** sta in
[`docs/ambienti.md`](../docs/ambienti.md), e la verità sullo schema sta nelle
migrazioni.*

> **Nessuna chiave in questa cartella.** Mai, in nessun file. Il patto è uno
> solo, e regge tutto il resto:
>
> **i valori vivono sul computer di chi lancia · gli script li leggono ·
> chi orchestra invoca lo script.**
>
> Un segreto che passa dentro una conversazione — con una persona, con un
> modello, in un ticket — è un segreto da ruotare. Uno che passa da `read` in
> un terminale non è passato da nessuna parte.

## Gli strumenti

| File | A cosa serve |
|---|---|
| `applica-migrazioni.ts` | Il motore: porta un Postgres a schema in ordine, tenendo il registro `_infra_migrazioni`. Idempotente, si ferma alla prima migrazione che fallisce e dice quale. |
| `migra-cloud.sh` | Il motore + le due cinture per il cloud: URI digitato (mai in history), ref del progetto verificato prima di connettersi. **È questo che si usa a mano.** |
| `svuota-test.ts` | Ripulisce il residuo delle prove sul progetto di test. Si rifiuta di girare dove `public.ambiente` non contiene `'test'`. |
| `db-locale.sh` | Postgres usa-e-getta in locale, schema + migrazioni, per provare senza toccare il cloud. |
| `crea-negozio-demo.ts` | Semina i due negozi dimostrativi che gli E2E si aspettano. |
| `mappa-db.py` | Rigenera `docs/mappa-db.md` e valida contro `docs/regole/`. Fa parte del DoD di ogni migrazione. |

## Runbook A · portare le migrazioni in PRODUZIONE

*Quando: dopo che una PR con migrazioni è entrata in `main`, **nella stessa
seduta**. Vercel deploya `main` da solo: fra il merge e questo passo, il codice
online chiede al database tabelle che non esistono ancora.*

1. Repo aggiornato e dipendenze a posto:
   ```sh
   git checkout main && git pull && npm ci
   ```
2. L'URI: Supabase → **`vista-gestionale`** → *Connect* → **Direct connection**,
   sostituendo `[YOUR-PASSWORD]`. Password dimenticata → *Project Settings →
   Database → Reset database password*: non tocca l'app deployata, che parla per
   chiavi API e non per password Postgres.
3. Si lancia:
   ```sh
   sh scripts/migra-cloud.sh prod
   ```
   L'URI si incolla al prompt e non compare. Se il ref non combacia, lo script
   si ferma prima di connettersi.
4. Verifica d'arrivo, in sola lettura: `_infra_migrazioni` arriva all'ultima
   migrazione del repo, e gli oggetti nuovi esistono davvero (non basta il
   registro: il registro dice cosa è stato eseguito, non cosa c'è).
5. Rigenerare `docs/mappa-db.md` (`mappa-db.py`) e scrivere l'esito coi numeri
   dove la busta lo chiede.

**Se `ENETUNREACH` / `ETIMEDOUT`:** la connessione diretta vuole IPv6. Si
riprende l'URI dal **Session pooler** e si rilancia lo stesso comando.

**Mai** l'SQL editor del dashboard: esegue e non registra, e da lì in poi il
registro mente.

## Runbook B · il segreto `TEST_SUPABASE_DB_URL` in CI

*Quando: una volta sola per progetto di test. Serve ai due test di
`bonifica-020.test.ts` che ispezionano il **catalogo** (`pg_class.relrowsecurity`,
`has_function_privilege`) — PostgREST non espone `pg_catalog`, nemmeno col
service role — e allo step che allinea il DB di test prima del contratto.*

1. GitHub → repo → *Settings → Secrets and variables → Actions → New repository
   secret*.
2. Nome **esatto**: `TEST_SUPABASE_DB_URL`.
3. Valore: l'URI del progetto **`gestionale-test`**. Prima di salvare si rilegge
   il ref dentro l'URI: dev'essere quello del test, non quello di produzione.
4. Si rilancia la CI (`workflow_dispatch` sul ramo). I due test passano da
   *skip* a verdi, e lo step «Allinea il DB di test al repo» smette di essere
   saltato.

**Perché il nome è `TEST_…` e non `SUPABASE_DB_URL`:** il test rifiuta
esplicitamente il fallback sul nome generico, perché in una shell locale quel
nome può puntare a produzione. Il workflow fa la mappatura in un solo passo, e
non a livello di job, per la stessa ragione.

## Cosa si è imparato tenendo questa cartella

- **Il registro è la verità, ma non è la prova.** `_infra_migrazioni` dice cosa
  è stato *eseguito*. Che gli oggetti *esistano* si verifica guardando il
  catalogo: sono due domande diverse e ci vogliono due controlli.
- **L'ordine dentro la CI ha un significato.** Migrare prima di pulire, non
  dopo: `svuota_dati_di_test()` nasce da una migrazione, e su un progetto
  ricostruito da zero pulire per primo significa chiamare una funzione che non
  c'è ancora.
- **La marcatura d'ambiente non è una variabile, è una proprietà del
  bersaglio.** Per questo `migra-cloud.sh` prende `prod|test` per nome e decide
  lui: una variabile da ricordarsi di aggiungere è una variabile da
  dimenticarsi di togliere.
