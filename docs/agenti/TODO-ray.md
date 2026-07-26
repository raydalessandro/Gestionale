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

## 4 · Portale — favicon e immagine OG (TERMINE: prima del primo negozio reale)

Il portale pubblico (G4) è online come pagina, ma **favicon** e **immagine OG**
del negozio sono **scoperti**. Vanno chiusi **PRIMA che vada online il primo
negozio reale** — non «più avanti»: senza, la prima pagina condivisa/indicizzata
esce senza icona e con anteprima social vuota.

- Il marchio è oggi reso **inline SVG** (`components/portale/Marchio.tsx`): la
  pagina mostra il logo, ma non esistono ancora i file `public/marchio/**`.
- La cartella `public/marchio/` (SVG/PNG del pacchetto, favicon) arriva in una
  **consegna dedicata al riordino asset**; favicon + OG image vanno però anticipati
  entro il termine qui sopra.

## 5 · Debiti tecnici tracciati (dev, non bloccanti)

- **Commento stale `schema.sql:431`.** Dice ancora che il sito pubblico scrive
  ordini con `fonte='sito'`; dopo la migrazione 009 il valore è `sito_negozio`.
  È **solo un commento** (nessun DDL). Da correggere quando si riordina lo schema
  (portale on). Vedi `docs/fasi/fase-g3bis-fonte-ordini.md`.
- **Contrasto testata del portale → FATTO in G5.** Funzione deterministica
  `testoSuFondo` (luminanza WCAG di `brand.primary` → inchiostro o bianco, stessa
  logica su bordo e sfumature). Voce chiusa.
- **Residuo dei test di prenotazione sul DB di test (G7).** Le prenotazioni sono
  **non cancellabili** (trigger no-delete, §ID-01) e **pinnano la persona** (FK
  restrict): il contratto `crea-prenotazione` lascia quindi righe residue che una
  delete a cascata dell'azienda di test non riesce a rimuovere. Mitigato oggi con
  slug/telefoni unici per `RUN_ID`, ma sul progetto `gestionale-test` serve una
  **RPC `SECURITY DEFINER` di pulizia** (o un reset periodico) per non accumulare.
  Da fare **insieme al setup del progetto di test (punto 1)**, prima che la CI
  giri il contratto in continuo. Vedi `docs/agenti/report-test.md`.

## 6 · Fuso orario preesistente in `lib/utils.ts` (TERMINE: prima di stampare date)

Difetto **preesistente**, scoperto in G5. `lib/utils.ts` formatta le date con
`Intl.DateTimeFormat("it-IT")` **senza `timeZone`**, quindi eredita il fuso del
server: su Vercel è **UTC**, non l'ora italiana. Riguarda anche l'agenda del
gestionale (orari e date mostrati/stampati possono slittare di 1–2 ore).

- **Non risolto in G5** (fuori ambito): il portale ha una gestione del fuso
  **tutta sua** in `lib/portale/orari.ts`, che àncora ogni confronto e ogni
  formattazione a `Europe/Rome`. Quel codice è al sicuro.
- **Da chiudere PRIMA che si stampi qualcosa con delle date** (buste, quietanze,
  agenda): passare `timeZone: "Europe/Rome"` esplicito nei formatter di
  `lib/utils.ts`, o centralizzare un helper unico come nel portale.
