# TODO per Ray — setup CI & Supabase + incognite aperte

Cose che deve fare **una persona** (non l'agente), più i **debiti/incognite
tracciati**: segreti, account esterni, difetti noti e punti dove i moduli si
toccano.

> **Abitudine:** leggere questo file **prima di aprire una consegna**. Diverse
> voci qui sotto vanno chiuse «al momento giusto» — cioè quando si mette mano
> proprio a quel pezzo (cassa, wizard ordini, onboarding). Guardarle prima evita
> di ricostruire un problema a memoria o di ricrearne uno già noto.

## 1 · Secret del progetto Supabase di test (per la CI GitHub) — ✅ CHIUSO (28/07)

> Verificato la sera del 28/07: progetto di test on, CI attiva e girante sul DB
> di test (conferma Ray; `ci.yml` e `docs/ambienti.md` a riscontro).

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
  (portale on). Vedi `docs/fasi/archivio/fase-g3bis-fonte-ordini.md`.
- **Contrasto testata del portale → FATTO in G5.** Funzione deterministica
  `testoSuFondo` (luminanza WCAG di `brand.primary` → inchiostro o bianco, stessa
  logica su bordo e sfumature). Voce chiusa.
- **Residuo dei test di prenotazione sul DB di test (G7).** Le prenotazioni sono
  **non cancellabili** (trigger no-delete, §ID-01) e **pinnano la persona** (FK
  restrict): il contratto `crea-prenotazione` lascia quindi righe residue che una
  delete a cascata dell'azienda di test non riesce a rimuovere. Mitigato oggi con
  slug/telefoni unici per `RUN_ID`. **→ CHIUSO** dalla consegna «Progetto di test»:
  `svuota_dati_di_test()` (migrazione 015) fa la pulizia, chiamata dalla CI prima
  del contratto. Vedi `docs/ambienti.md`.

## 7 · Difetto preesistente — coerenza tenant del REGISTRO → **CHIUSO in G8 (migrazione 018)**

Il trigger `trg_coerenza_registro` (migrazione **011**) su
`persone_riferimento_registro` chiama `assicura_coerenza_tenant('prenotazione_id',
'prenotazioni')`. Quella funzione confronta la riga riferita con `NEW.azienda_id`
della riga che si scrive — ma **il registro non ha una colonna `azienda_id`** (ha
`da_azienda_id` / `a_azienda_id`). Quindi `mia_azienda` è sempre `NULL` e, per
qualunque `prenotazione_id` valorizzato, il confronto fallisce con `23514`:
**ogni inserimento nel registro con una prenotazione collegata verrebbe respinto.**

- **Dormiente oggi:** nessuno scrive ancora nel registro — quel flusso
  (accettazione di una richiesta che àncora la persona a un negozio) è **G8**.
  Emerso solo perché un dry-run della pulizia provava a seminare una riga registro.
- **CHIUSO in G8 (migrazione 018):** il trigger `trg_coerenza_registro` ora usa la
  funzione dedicata `coerenza_registro_riferimento()` — verifica che la prenotazione
  che autorizza il passaggio sia dell'azienda **ricevente** (`a_azienda_id`), non
  un confronto con un `azienda_id` inesistente. Positivo/negativo (23514) verificati
  in dry-run e con la scrittura reale del registro (`prendi_persona_come_cliente`).
  Vedi `docs/fasi/archivio/fase-g8-richieste-agenda.md`.

## 8 · Decisione (scritta) — il trigger di coerenza tenant inghiotte la superficie d'errore delle FK

Su **tutte le 11 tabelle con `trg_tenant`** (coerenza tenant DB-01, migrazione **008**),
il trigger è `BEFORE INSERT/UPDATE` e controlla ogni FK verso una tabella con
`azienda_id` (es. `resi.busta_id → ordini_occhiali`, `appuntamenti.cliente_id →
clienti`, …). Per un valore **non valido** — id inesistente *oppure* di un altro
tenant — la lookup dà `azienda NULL`, `NULL is distinct from mia_azienda` è vero e
il trigger alza **`23514`** (check_violation) *prima* che la FK venga raggiunta.

Conseguenze pratiche, da tenere a mente:
- **Quelle FK restano** come rete di sicurezza a livello di **storage**, ma sono
  **irraggiungibili dall'applicazione**: un riferimento non valido dà sempre
  `23514`, **mai `23503`** (foreign_key_violation). Vale anche per il **service
  role** — i trigger non si bypassano come la RLS.
- **Il front-end non deve mai mappare `23503`** per queste tabelle: non arriverà
  mai. Il codice utile da intercettare è `23514`.
- Verificato: nella suite di contratto `23503` compariva una volta sola
  (`caparra-incasso`), ora corretta a `23514` e rinominata «coerenza tenant».
  Nessun altro test da toccare.

## 9 · E2E rimandati con `test.fixme` — moduli ancora aperti (da riscrivere sui doc)

Cinque scenari E2E sono marcati **`test.fixme`** (skip esplicito, non nascosto):
non falliscono la CI ma restano visibili come «in attesa». Vanno **riscritti bene
sui doc** quando i rispettivi moduli sono finalizzati — sono parti delicate per
il negozio.

- **Cassa** (`fase4-cassa`): **S3** (consegna con caparra + incasso), **S6** (reso
  con causale), **S8** (chiusura serale). Il modulo cassa non è chiuso: provisioning
  dei metodi di pagamento (oggi nessun seed all'onboarding + auto-seed fragile a
  render-time da togliere), IVA/fatturazione, e i **resi** ancora in rifacimento.
  La parte che funziona — **vendita veloce col resto (S1)** — resta attiva.
- **Ordine LAC** (`fase1-ordini-buste` **S1**, `fase2-magazzino` **S4**): la
  **consegna** dell'ordine LAC passa ora dal modulo cassa («Consegna e incassa»),
  e la **selezione ricetta** dipende dal modulo prescrizioni in rifacimento
  (convertitore monofocale/progressiva/LAC). In più, il passo «Crea ordine» del
  wizard LAC *Da catalogo* (S4) è andato in timeout **non diagnosticato**: da
  guardare col trace quando si rimette mano al wizard — potrebbe essere
  selettore/timing o una regressione vera. Lo scarico di magazzino alla consegna
  è comunque coperto a **contratto** (`magazzino-trigger`).

Quando cassa e prescrizioni/ordini sono finalizzati: togliere i `test.fixme`,
riscrivere gli scenari sul comportamento deciso, e rimuovere l'auto-seed dei
metodi a render-time (`app/(app)/cassa/vendita/nuova/page.tsx`) spostandolo
all'onboarding o a un'azione.

## 10 · INCOGNITA APERTA — `fase2 S4`: "Crea ordine" (wizard LAC «Da catalogo») in timeout, MAI diagnosticato

> **04/08 · memoria di Ray**: bug d'epoca già diagnosticato — «mancavano
> dei pezzi» nel catalogo piatto → timeout. Il ridisegno a scala di M5
> (f5g) elimina la classe d'errore; verifica di conferma in S0.

**Non è "modulo da finire": è un possibile difetto vero, mai guardato, oggi
dietro un `test.fixme` con la CI verde sopra.** Va tenuto separato dagli altri
quattro sospesi (quelli sanno cosa aspettano; questo no).

- **Sintomo:** nel run E2E, nel wizard ordine LAC con «Da catalogo», dopo aver
  scelto il prodotto e premuto «Avanti», il bottone **«Crea ordine» va in timeout**
  (passo 3 mai raggiunto). Dal codice *dovrebbe* funzionare (`daCatalogo` popola la
  riga → `righeValide` vero → «Avanti» abilitato), quindi delle due l'una:
  **selettore/timing del test**, oppure **regressione vera** nel wizard.
- **Perché è finito in `fixme`:** la sua coda (consegna→scarico) sbatte comunque
  sulla cassa non finita, quindi lo scenario non poteva chiudersi ora. Ma la causa
  del timeout su «Crea ordine» **precede** la cassa e resta irrisolta.
- **Chi lo chiude:** la **consegna di rifacimento del wizard ordini + modulo
  prescrizioni** (il convertitore Rx monofocale/progressiva/LAC che hai in mente).
  **All'inizio di quella consegna, PRIMA di rifattorizzare:** riprodurre il timeout
  col trace Playwright e stabilire se è test o codice. Se è codice, è una
  regressione da correggere, non solo un test da riscrivere.
- Riferimento: commento su `e2e/fase2-magazzino.spec.ts` (S4) e §9 qui sopra.

## 11 · Intersezione gestionale↔portale — seminare i metodi di pagamento tocca la NASCITA di ogni negozio

Il buco del provisioning dei metodi di pagamento (§ TODO storico riga ~127: oggi
l'onboarding non semina nulla, la pagina vendita fa un auto-seed fragile a
render-time, ed è il motivo per cui i test chiamano `seedMetodiCassa` a mano) si
chiude in modo naturale **seminando i metodi all'onboarding**, cioè dentro
`crea_azienda_con_titolare`.

**Attenzione: è la STESSA funzione che crea OGNI tenant — anche i negozi del
portale Limpidia** — e che con la 014 ha già accumulato il trigger della «Sala 1».
Quindi quando ci metterai mano per la cassa **starai modificando il percorso di
nascita di tutti i negozi**, portale compreso. Non è un problema: è il punto in
cui i due mondi si toccano davvero. Da sapere **prima e non durante** —
verificare che la modifica regga sia per un negozio gestionale sia per un tenant
creato dal flusso portale, e che i test di contratto sull'onboarding restino
verdi.

## 12 · Catalogo servizi del PORTALE ↔ tassonomia visite del GESTIONALE (decisione aperta — stesso innesco delle LAC/prescrizioni)

Sono **la stessa questione**: il catalogo dei servizi del portale (017: 13 voci —
`Visita optometrica`, `Occhiale da vista`, `Controllo miopia bambini`, …) e la
**tassonomia delle visite + prescrizioni del gestionale** devono finire per
parlarsi. **Finché il secondo non è fermo, il primo non si può chiudere.** Vanno
affrontati **insieme**, o si fa il lavoro due volte.

- **`controllo` (Controllo della vista).** Introdotto prima del portale, **non è
  nel prototipo** (la 017 carica i 13, `controllo` resta come 14° legacy). È
  lasciato **in catalogo ma NON attivato sui negozi dimostrativi** (`seed_demo.sql`):
  a un cliente che prenota sarebbe un doppione di «Visita optometrica» — stessa
  cosa. Da decidere se **ritirarlo** o **mapparlo** a un tipo-visita del gestionale.
- **Innesco (lo stesso della §10):** la consegna che **rifà il wizard ordini + il
  modulo prescrizioni** del gestionale (convertitore monofocale/progressiva/LAC).
  Lì si definiscono i tipi di visita/prescrizione: è il momento in cui il catalogo
  del portale va riconciliato con quella tassonomia (e si chiude `controllo`).
- Nota: la 017 **non** rompe nulla nel frattempo — i due mondi convivono; è solo
  la *chiusura* del catalogo che dipende dalla tassonomia del gestionale.

## 6 · Fuso orario preesistente in `lib/utils.ts` — ✅ SALDATO in G8 (migrazione 019 + helper `TZ_ROMA`)

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
- **Appuntamenti & agenda → SISTEMATI in G8.** La parte che G8 rendeva concreta
  (banco naïve-UTC vs portale assoluto-Roma nella stessa agenda) è chiusa:
  helper condivisi `istanteRomaISO`/`oggiRoma` in `lib/utils.ts` (ancorati a
  Europe/Rome, DST inclusa); `creaAppuntamento` li usa; `oraDi`/`oraFine`
  formattano in Europe/Rome; le finestre-giorno dell'agenda idem; **migrazione 019**
  riallinea le righe banco già scritte (mirata: `fonte='banco' AND note<>'seed-g6'`,
  idempotente). Sentinella a contratto: banco 10:00 e portale 10:00 → stesso
  istante. Vedi `docs/fasi/archivio/fase-g8-richieste-agenda.md`.
- **Resta aperto: gli ALTRI formatter di `lib/utils.ts`.** `fmtData`/`fmtQuando`
  (e chi stampa date su buste/quietanze) formattano ancora **senza `timeZone`** →
  ereditano il fuso del processo. Riguardano **date**, non orari, quindi il rischio
  è lo slittamento di giorno solo a cavallo della mezzanotte — ma **prima di
  stampare documenti con date** vanno passati a `Europe/Rome` (o centralizzati in
  un helper, come per l'agenda). Il grosso — l'agenda — è chiuso.
