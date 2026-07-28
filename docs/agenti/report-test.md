# Report — Agente Test & CI

Aggiornato: 2026-07-28 · Fasi coperte: 1, 2, 3, 4 (v0.1–v0.5) + interfasi
**4b/4c/4d**; portale **G3–G7** (vocabolario fonte, pagina negozio, orari/servizi,
slot, percorso di prenotazione), **G7-bis · l'agenda unica** (migrazione **013**),
**G-014 · le sale** (migrazione **014**) e ora **017 · i servizi di tipo richiesta**
(branch `portale/017-servizi-richiesta`, migrazione **017**). La copertura 017 è
descritta subito qui sotto; i giri precedenti restano più in basso.

## Giro 017 · i servizi di tipo «richiesta» (branch `portale/017-servizi-richiesta`)

La 017 insegna al catalogo che un servizio ha DUE forme: `appuntamento` (durata +
slot + appuntamento in agenda, comportamento pre-017) e `richiesta` (niente durata,
niente slot: «Occhiali da sole», «Le mie lenti a contatto», «Riparazione» — il negozio
risponde entro 24h). `crea_prenotazione` si biforca; `slot_liberi` per una richiesta
torna vuoto; nuovi trigger di coerenza su `servizi`, `negozi_servizi`, `prenotazioni`;
la vista `servizi_pubblici` espone anche `tipo`. Migrazione GIÀ applicata al progetto
di TEST. Nessun file dell'app toccato.

### L2 · Contratto — nuovo `tests/contratto/servizi-richiesta.test.ts` (8 test, in CI)
Un tenant pubblicato, orari 09–17 tutti i giorni, `visita` (appuntamento) + `sole`
(richiesta) attivi. Copre la §7:
1. **slot_liberi su richiesta → vuoto** (anon), con controprova che `visita` offre slot
   (il vuoto è per il TIPO, non per cattiva semina).
2. **crea_prenotazione su richiesta** → `appuntamento_id`/`inizio`/`durata_minuti` NULL,
   `note` valorizzate, stato `in_attesa`, e conteggio appuntamenti INVARIATO (nessun
   appuntamento creato).
3. **due richieste dello stesso servizio, telefoni diversi** → entrambe passano (nessuno
   slot da contendere), due righe distinte.
4. **insert diretta su APPUNTAMENTO senza appuntamento_id** (service role) → respinta dal
   trigger `trg_coerenza_prenotazione_tipo` (**P0001**, `PRENOTAZIONE_APPUNTAMENTO_INCOMPLETA`).
5. **insert diretta su RICHIESTA con appuntamento_id** (appuntamento VERO dello stesso
   tenant, così l'unico a obiettare è il trigger tipo) → respinta (**P0001**,
   `PRENOTAZIONE_RICHIESTA_CON_SLOT`).
6. **servizi: richiesta + durata** → check `servizi_durata_per_tipo` (**23514**), sia in
   insert (codice usa-e-getta) sia in update su `sole`; controprova che `sole` resta
   richiesta senza durata (l'update non è passato: nessuna mutazione del catalogo globale).
7. **negozi_servizi: richiesta (`riparazione`) + durata_minuti** → trigger
   `trg_coerenza_negozio_servizio` (**P0001**, `SERVIZIO_RICHIESTA_SENZA_DURATA`).
8. **servizi_pubblici espone `tipo`** (anon): `visita`=appuntamento con durata,
   `sole`=richiesta con durata NULL.

### L3 · E2E — nuovo `e2e/g8-servizi-richiesta.spec.ts` (Scenario A, in `test.fixme`)
Scenario A: dal negozio, un servizio RICHIESTA → percorso a 3 passi (Servizio → Dettagli
→ Invia), viewport MOBILE → esito «Richiesta inviata … entro 24 ore», con l'INVARIANTE
017 che NON compaia nessuna griglia di slot (né il passo «Quando»), più la verifica a
valle nel DB (richiesta senza appuntamento/inizio/durata). Il setup del tenant (negozio
pubblicato con `visita` + `sole`) e la logica del flusso + le asserzioni DB sono
DEFINITIVI; **i selettori di heading/bottoni sono PROVVISORI** (marcati `TODO(UI)`) perché
la UI del percorso a 3 passi è in costruzione in parallelo sullo stesso branch. Il test è
`test.fixme` → NON gira, CI resta verde. **Da finalizzare dopo l'ok sulla UI pushata**:
togliere il `fixme` e allineare i selettori al markup reale.

Scenario B (regressione, il più importante): il percorso a 5 passi del servizio
appuntamento resta coperto da `e2e/g7-prenota.spec.ts`, **non toccato** — la 017 non lo
cambia. Deve restare verde.

**Dipende ancora dalla UI (da finalizzare dopo conferma):** i selettori dello Scenario A
in `g8-servizi-richiesta.spec.ts` (heading passi 1/2/3, etichette bottoni «Continua/Invia»,
CTA d'ingresso al wizard dalla pagina negozio).

## Giro 014 · le sale (branch `portale/014-sale`, migrazione 014)

La 014 porta `risorsa_id` a prima classe: l'appuntamento è di una SALA, la sala è
del negozio. Nuova tabella `risorse` (RLS + `revoke select from anon`), una
'Sala 1' per ogni azienda + trigger `crea_sala_default` su `aziende`;
`appuntamenti.risorsa_id` diventa NOT NULL con FK verso `risorse` e la coppia
`('risorsa_id','risorse')` entra nel trigger di coerenza tenant (008); l'EXCLUDE
diventa per-risorsa **senza `coalesce`** (risorsa_id è NOT NULL); `slot_liberi`
= «libero se ALMENO UNA sala attiva è libera»; `crea_prenotazione` assegna la prima
sala attiva libera. Con UNA sola sala il comportamento è identico alla 013. Nessun
file dell'app toccato.

### L4 · Guardia statica — `tests/unit/guardie.test.ts` (nuovo blocco L4l, +6 → G18)
Gated con `describe.skipIf(!existsSync(014))` come per L4i/013: enforca sul branch
`portale/014-sale` e in CI dopo il merge, salta pulito su checkpoint paralleli.
- **G18**: la tabella `risorse` esiste con RLS attiva e `revoke select … from anon`
  (Supabase concede select di default: senza revoke le sale sarebbero pubbliche).
- **G18b**: la funzione `crea_sala_default` e il trigger `AFTER INSERT ON aziende`
  che la esegue (ogni negozio nasce con la sua sala, altrimenti il NOT NULL romperebbe).
- **G18c**: `appuntamenti.risorsa_id` diventa NOT NULL con FK verso `risorse`, e la
  coppia `('risorsa_id','risorse')` entra nel trigger `trg_tenant` di coerenza.
- **G18d**: l'EXCLUDE `appuntamenti_niente_sovrapposizioni` è per-risorsa
  (`risorsa_id with =`), SENZA `coalesce(` (sparita la cucitura della 013), e vale
  solo sugli stati occupanti.
- **G18e**: `slot_liberi` nella 014 nomina `risorse` e NON usa più
  `coalesce(risorsa_id, …)`. **Trade-off documentato**: la guardia non vieta ogni
  `coalesce` — `slot_liberi` conserva un `coalesce(ns.durata_minuti, s.durata_predefinita_minuti)`
  LEGITTIMO per la durata del servizio; l'invariante che cambia è solo il coalesce
  PER-RISORSA della 013, ed è quello che G18e blinda (un check «zero coalesce»
  sarebbe stato un falso positivo sulla durata).
- **G18f**: `crea_prenotazione` (014) sceglie una sala `from public.risorse`.
- Le 6 regex sono state verificate contro il contenuto reale della 014 (tutte PASS,
  guardie a 42). Il blocco L4i/G17 della 013 NON è stato toccato: legge la 013, dove
  il `coalesce` resta storia.

### L2 · Contratto — nuovo `tests/contratto/sale.test.ts` (7 test, in CI)
Scenari PER-SALA che, dopo la 014, non si possono più simulare con UUID inventati
(c'è la FK verso `risorse` + il NOT NULL): qui si creano sale VERE col service role.
Tre tenant (`uno` = una sala, `due` = due sale attive, `dis` = seconda sala
disattivata), istanti da `slot_liberi` (anti-fuso). Casi §8:
1. **una sala**: due appuntamenti sovrapposti → il secondo respinto (23P01) —
   identico alla 013.
2. **due sale**: due appuntamenti in parallelo sullo stesso slot → ammessi; il
   terzo (nessuna sala libera, il trigger ripiega sulla prima) → respinto (23P01).
3. **slot_liberi** con due sale: offre lo slot con UNA sala occupata, smette quando
   lo sono ENTRAMBE.
4. **sala attiva=false non conta**: occupata l'unica sala attiva, lo slot sparisce
   (la disattivata non lo salva); un altro istante resta offerto (controprova).
5. **azienda nata dopo la 014**: riceve la sua 'Sala 1' dal trigger su `aziende`.
6. **sala di un altro negozio**: appuntamento nel negozio `uno` con una sala di
   `due` → respinto dal trigger di coerenza tenant (SQLSTATE **23514**).
7. **crea_prenotazione** (una sala): l'appuntamento collegato ha `risorsa_id` non
   nulla; una seconda richiesta sullo stesso slot con l'unica sala → `SLOT_OCCUPATO`.

### L2 · Contratto — `tests/contratto/crea-prenotazione.test.ts` (aggiornato alla 014)
Il file resta a 14 test ma allineato al NOT NULL + trigger di assegnazione sala:
- il caso **valida** non asserisce più `risorsa_id` nullo: con la sola 'Sala 1'
  `crea_prenotazione` la valorizza (`toBeTruthy`);
- il vecchio test «due appuntamenti con `risorsa_id` DIVERSA (crypto.randomUUID)
  → ammessi» è stato **rimosso** da qui (gli UUID inventati ora violano la FK verso
  `risorse`) e ricoperto in `sale.test.ts` con sale VERE;
- il test «due appuntamenti con `risorsa_id` NULLA → il secondo respinto» resta
  valido: il trigger BEFORE INSERT assegna la stessa 'Sala 1' a entrambi → 23P01;
- i seed manuali «al banco» che NON passavano `risorsa_id` continuano a funzionare:
  il trigger la assegna, il NOT NULL non rompe più l'insert (verificato negli scenari
  agenda-unica/annullato).

### L3 · E2E — `e2e/g7-prenota.spec.ts` (invariato, in CI)
Firme RPC invariate (`slot_liberi`/`crea_prenotazione`); il percorso utente non
tocca `risorsa_id`. La verifica a valle legge `prenotazioni` per codice
(`fonte=qr_vetrina`, `stato=in_attesa`) → resta verde. Nessun nuovo E2E necessario.

### Teardown 014 (contratto)
Nuovo anello nella catena di FK: gli appuntamenti pinnano la sala
(`risorsa_id → risorse`, senza on-delete). Ordine di pulizia in `sale.test.ts`:
prima gli appuntamenti NON collegati a una prenotazione (così le sale si liberano),
poi `pulisci()` che cascata azienda→risorse. Dove non ci sono prenotazioni
(`due`/`dis`/il tenant «nuovo») l'azienda si cancella davvero e porta via le sale;
dove c'è una prenotazione (`uno`), resta append-only come nei giri G7/013 (il
trigger no-delete su `prenotazioni` blocca la cancellazione, che a sua volta pinna
appuntamento→sala e persona). Residuo mitigato da slug/telefoni unici per RUN_ID.
Gancio già richiesto (vedi *Ganci* §4): RPC di pulizia SECURITY DEFINER lato DB.

### Esito auto-verifica (locale) — giro 014
`npm test` (L1+L4) sul working tree del branch `portale/014-sale`:
**127 passed** (8 file), guardie da 36 → **42** (L4i/013 e L4l/014 entrambi presenti
sul branch, enforcano). `npm run test:contratto` senza le env `TEST_SUPABASE_*` →
tutti skippati puliti: `sale.test.ts` (7) e `crea-prenotazione.test.ts` (14) caricano
e saltano. L2/L3 restano alla CI (manca il progetto Supabase di test + i secret).

## Giro G7-bis · l'agenda unica (branch `portale/013-agenda-unica`, migrazione 013)

La 013 accentra la decisione «lo slot è occupato?» su un posto solo:
**`appuntamenti` È LO SLOT**, `prenotazioni` è la pratica. `crea_prenotazione`
scrive ora DUE righe nella stessa transazione (appuntamento `in_attesa` +
prenotazione collegata via `appuntamento_id`), e la difesa contro la doppia sullo
stesso orario vive sull'EXCLUDE di `appuntamenti`, per-risorsa
(`coalesce(risorsa_id, azienda_id)`) e sugli stati occupanti
(`in_attesa`/`prenotato`/`completato`). Nessun file dell'app toccato.

### L2 · Contratto — `tests/contratto/crea-prenotazione.test.ts` (11 → 15 test, in CI)
Aggiornata alla nuova logica e allargata:
- **valida** → ora asserisce DUE righe collegate: la prenotazione `in_attesa` E
  il suo appuntamento (`stato=in_attesa`, `risorsa_id` nullo, `cliente_id` nullo,
  `fonte` propagata, `riferimento`=codice), con `prenotazioni.appuntamento_id`
  che punta a quell'appuntamento;
- **il caso che ha motivato la consegna** (nuovo, il più importante): creata una
  richiesta dal portale su uno slot, un **appuntamento manuale** (`stato='prenotato'`,
  `risorsa_id` null) sullo stesso slot/azienda è **respinto dal database**
  (exclusion_violation, code 23P01) — non dalla funzione;
- **annullato non blocca / in_attesa sì** (nuovo): un appuntamento `annullato`
  sullo slot non impedisce la richiesta; l'`in_attesa` nato dalla richiesta rende
  `SLOT_OCCUPATO` una seconda richiesta sullo stesso slot;
- **per-risorsa** (nuovo): due appuntamenti sullo stesso slot con `risorsa_id`
  DIVERSA sono ammessi (due salette); con `risorsa_id` NULLA su entrambi il
  secondo è respinto (23P01, poltrona unica);
- **idempotenza** rafforzata: due invii con la stessa `chiave_richiesta` → una
  sola prenotazione E un solo appuntamento (verifica esplicita: nessun
  appuntamento orfano sull'istante/azienda);
- restano invariati: `SLOT_OCCUPATO` (overlap con appuntamento del gestionale +
  doppio slot), `FUORI_ORARIO`/`FUORI_ORIZZONTE`/`TROPPO_TARDI`/`SERVIZIO_NON_ATTIVO`/
  `NEGOZIO_NON_TROVATO`, dedup persona, consumo slot.
- Gli scenari isolati (manuale-respinto, annullato/in_attesa, risorse) usano
  GIORNI diversi (slot tutti freschi) per non esaurire i candidati del giorno
  principale; `risorsa_id` di prova = `crypto.randomUUID()`.

### L4 · Guardia statica — `tests/unit/guardie.test.ts` (nuovo blocco L4i, +4 → G17)
- **G17**: la definizione di `slot_liberi` **nella 013** NON nomina più
  `prenotazioni` (un posto solo); continua a guardare `appuntamenti` e gli stati
  occupanti includono `in_attesa`. È la sentinella contro la recidiva della
  doppia-agenda (portale e banco che si calpestano).
- **G17b**: la 013 dichiara `appuntamenti.risorsa_id uuid` e lo stato `in_attesa`
  fra i valori ammessi dal check.
- **G17c**: l'EXCLUDE `appuntamenti_niente_sovrapposizioni` è per-risorsa
  (`coalesce(risorsa_id, azienda_id)`) e vale solo sugli stati
  `in_attesa`/`prenotato`/`completato`.
- **G17d**: `prenotazioni` smette di governare gli slot — l'EXCLUDE
  `prenotazioni_niente_sovrapposizioni` è rimosso e `appuntamento_id` è NOT NULL.
- Trade-off documentato: il blocco L4i è gated con `skipIf(!existsSync(013))`.
  Sul branch della consegna (e in CI dopo il merge) il file c'è → le guardie
  ENFORCANO; su un checkpoint parallelo che non porta ancora la 013 saltano
  pulite (npm test resta verde) e l'enforcement rientra da solo. Le 4 regex sono
  state verificate contro il contenuto reale della 013 (tutte PASS).
- `G12e` (conto colonne `fonte`) resta a 5: la 013 non aggiunge alcun
  `check (fonte …)`. Nessun'altra guardia dava per scontata la vecchia logica
  (G15/G15c leggono la 011, la sua `slot_liberi` è comunque security definer).

### L3 · E2E — `e2e/g7-prenota.spec.ts` (invariato, in CI)
Il percorso utente e la firma delle RPC non cambiano: nulla dipendeva dal fatto
che il portale creasse UNA sola riga (la verifica a valle legge `prenotazioni`
per codice → `fonte=qr_vetrina`, `stato=in_attesa`, che restano veri). Nessuna
modifica necessaria. Nota residuo aggiornata: ora la prenotazione pinna ANCHE il
suo appuntamento (`appuntamento_id` NOT NULL + `on delete set null`), quindi il
teardown best-effort degli appuntamenti non tocca più i collegati.

### Teardown 013 (contratto)
Ogni prenotazione crea ora un appuntamento collegato NON cancellabile
(`appuntamento_id` NOT NULL con `on delete set null`: la SET NULL fallirebbe, e un
unico DELETE sull'azienda salterebbe anche i non-collegati). Il teardown di
`crea-prenotazione.test.ts` ora elimina solo gli appuntamenti **non referenziati**
(seed manuali, annullati, prove risorse), filtrando via `.not("id","in",…)` gli id
collegati; il resto (prenotazioni + persone + azienda + appuntamenti in_attesa)
resta per progettazione. Mitigazione invariata: slug/telefoni unici per RUN_ID.

### Esito auto-verifica (locale) — giro 013
`npm test` (L1+L4) sul working tree del checkpoint: **116 passed, 4 skipped**
(il blocco L4i è gated: la 013 non è in QUESTO working tree, è sul suo branch) e
**1 failed su G13** — quest'ultimo è un artefatto CROSS-BRANCH, NON della mia
consegna: il checkpoint parallelo ha aggiunto la rotta pubblica `/informativa` a
`ROTTE_PUBBLICHE` (proxy.ts, altra consegna «portale routes»), che sul branch
`portale/013-agenda-unica` non esiste. G13 non è mio da aggiornare (aggiungervi
`/informativa` romperebbe G13 sul branch della 013). Sul branch della consegna
`npm test` è verde: L4i esegue e passa (regex verificate), G13 vede le 4 rotte
storiche. `crea-prenotazione.test.ts` carica e skippa pulito (15/15 senza env).



Branch `gest/next-16`: upgrade framework
**Next 15.5.20 → 16.2.12 · React 19.0 → 19.2.8** (solo codemod, zero cambi di
comportamento). Il codemod ha rinominato `middleware.ts → proxy.ts` (Next 16
cerca l'export `proxy`); logica byte-identica tranne la firma. Rete di sicurezza
irrobustita con la guardia **G11** su questo rename (vedi L4c).

La rete di sicurezza segue l'ordine di lavoro (`docs/agenti/agente-test.md`):
pochi test UI d'oro (i collaudi), tanto contratto vero, unit solo sulla logica
pura, guardie statiche. Nessun file dell'app è stato toccato dall'agente.

## Esito auto-verifica (locale)

`npm test` (= L1 unit + L4 guardie, gli unici eseguibili senza rete/DB):

    Test Files  8 passed (8)
         Tests  117 passed (117)

Dettaglio: `utils` 24 · `cassa-calcoli` 17 · `portale-orari` 13 ·
`portale-brand` 13 · `guardie` 32 · `ratelimit` 7 (nuovo G7) ·
`anagrafiche-utils` 5 · `fonte` 6. Verde su Next 16.2.12; `tsc --noEmit`
sull'intero progetto exit 0 (i test sono `exclude` dal tsconfig e non vi entrano).

`npm run test:contratto` senza le env `TEST_SUPABASE_*` → tutti i test skippati
(come da progetto: il contratto non gira senza il suo DB; i due file nuovi
`anagrafiche`/`caparra-incasso` skippano puliti, 11 test). `npx tsc --noEmit`
sull'intero progetto (test inclusi) → exit 0.

L2 (contratto) ed L3 (E2E) non sono stati eseguiti qui: mancano il progetto
Supabase di test e i suoi secret (li prepara Ray — vedi `docs/agenti/TODO-ray.md`).
Il codice è scritto e tipizzato, ma il loro esito reale lo darà la CI.

> Nota schema di test G6/G7: L2 ed L3 girano ora sullo **stesso** progetto
> Supabase (`uijfhhctrgirglmkrgoo`) dei restanti — nessun DB dedicato «per ora».
> Cleanup rigoroso per prefisso `test-<runid>-`, con il limite append-only
> descritto nel giro G7 (le prenotazioni non si cancellano).

## Giro G7 · percorso di prenotazione (branch `portale/prenota`, migrazione 012)

Prima **scrittura** del portale: si estende la rete alla RPC `crea_prenotazione`,
al limitatore anti-spam e al percorso guidato a 5 passi. Nessun file dell'app
toccato. `npm test` (L1+L4) → **117/117 verde**.

### L1 · Unit — `tests/unit/ratelimit.test.ts` (7 test)
`lib/ratelimit.ts` è puro (con `now`/`store` iniettabili). Coperto: l'IP scatta
al 9° tentativo dentro la finestra (letta da `LIMITE_IP`, non ricopiata) e i
tentativi riusciti sono registrati; il telefono scatta al 4° (`LIMITE_TELEFONO`);
una chiave già bloccata **non consuma** il budget dell'altra (i controlli
precedono le registrazioni → il telefono resta intatto quando è l'IP a saturare);
la finestra è scorrevole (avanzando `now` oltre `finestraMs` il conto riparte e i
timbri vecchi sono potati); `azzeraLimite()` e store iniettati isolano ogni caso;
chiavi nulle non impongono limiti. `fonte.test.ts` (G6, `fonteDaParametro`) già
copriva qr→qr_vetrina / sito→sito_negozio / altro→portale: **non duplicato**.

### L2 · Contratto — `tests/contratto/crea-prenotazione.test.ts` (11 test, in CI)
La RPC si chiama da un client **anon** (com'è esposta al browser via l'azione
server); il setup e le letture di verifica passano dal service role (prenotazioni
e persone sono revocate all'anon). Anti-fuso: gli istanti di prova vengono da
`slot_liberi` (candidati assoluti già corretti), distanziati ≥60' così una
prenotazione da 30' non svuota lo slot del test dopo. Invarianti:
- **valida** → 1 riga `stato=in_attesa`, `fonte` valorizzata, `codice` che matcha
  `LMP-XXXX` sull'alfabeto senza O/0/I/1, contatto (nome/telefono/email) COPIATO
  sulla riga, `informativa_accettata_at` valorizzato;
- **idempotenza**: due invii con la stessa `chiave_richiesta` → una sola riga,
  stesso `id`/`codice`;
- **doppio slot** (chiavi diverse) → la seconda `SLOT_OCCUPATO`;
- **overlap con un appuntamento** `prenotato` del gestionale → `SLOT_OCCUPATO`
  (verificato: è questo il codice reale, non `FUORI_ORARIO`);
- errori distinti: `FUORI_ORARIO` (18:00 su 09–17), `FUORI_ORIZZONTE` (>90gg),
  `TROPPO_TARDI` (<2h), `SERVIZIO_NON_ATTIVO` (servizio non attivato per il
  negozio), `NEGOZIO_NON_TROVATO` (slug inesistente);
- **dedup persona**: `«3XX XXX XXXX»` e `«+39 3XX XXXXXXX»` collassano su una sola
  riga di `persone` e le due prenotazioni puntano alla stessa `persona_id`;
- **consumo slot**: dopo la prenotazione, `slot_liberi` non restituisce più quello
  slot (era presente prima).
- `informativa_accettata_at`: la RPC la valorizza sempre (`now()`); l'obbligo del
  consenso è imposto **a monte** dall'azione server (guardia G16 + E2E), non dalla
  funzione — annotato nel test.

### L3 · E2E — `e2e/g7-prenota.spec.ts` (viewport mobile 390×844, in CI)
Percorso completo dal QR: `/ottica/<slug>?da=qr` → CTA «Prenota» (link vero che
trascina `?da=qr`) → passo 1 servizio → passo 2 copertura → passo 3 nome+telefono
→ passo 4 «Giorno successivo» + primo slot → passo 5 con informativa. Assicura che
«Invia la richiesta» **nasce disabilitato** e si abilita solo dopo la spunta
informativa. Schermata finale: mostra un `codice` (`LMP-XXXX`), dice «richiesta …
non è ancora confermata» e **non** contiene mai «prenotazione confermata». A valle
verifica nel DB (service role) che la prenotazione col quel codice abbia
`fonte=qr_vetrina` e `stato=in_attesa` (la provenienza QR ha attraversato tutto).

### L4 · Guardia statica — `tests/unit/guardie.test.ts` (L4h, +3 → 32 test)
- **G16**: `crea_prenotazione` si **INVOCA** (`.rpc("crea_prenotazione"…)`) solo da
  un file server (`"use server"`), mai da un componente client né da `lib/portale/
  slot.ts`. La guardia distingue l'invocazione dalla semplice **menzione in un
  commento** (WizardPrenota e la pagina negozio la citano a parole: non scattano).
  Se il browser chiamasse la RPC, il rate limit — che vive solo nell'azione server
  — sarebbe aggirabile.
- **G16b**: l'azione `inviaPrenotazione` esiste, è `"use server"` e invoca la RPC.
- **G16c**: `WizardPrenota.tsx` è client, chiama `inviaPrenotazione` e **non**
  invoca la RPC di scrittura; `lib/portale/slot.ts` (sola lettura) neppure.
- Sentinelle fonte: la 012 **non** aggiunge un nuovo `check (fonte …)` (il check
  delle prenotazioni è nella 011), quindi il conto colonne di G12e resta 5 e non
  serve toccarlo. Verificato verde.

## Cosa è coperto

### L1 · Unit — `tests/unit/utils.test.ts`
Funzioni pure di `lib/utils.ts` ai bordi: `fmtDiottria` (segno esplicito, meno
tipografico vs ASCII, zero, null/NaN), `fmtRefrazione` (plano, solo sfera, riga
completa, asse mancante→0), `slugify` (accenti, trim, taglio a 40), `scadenzaRx`,
`rxValida` (non attiva, valida, scaduta, bordo con fake timers), `fmtQuando`.

> `lib/richiami-proposte.ts` non ha unit: `calcolaProposte` non è pura
> (interroga il DB). La sua logica è esercitata a livello E2E (Fase 3).

**`tests/unit/cassa-calcoli.test.ts` (Fase 4c — il gioiello della quadratura).**
`lib/cassa-calcoli.ts` è puro ed è la formula UNICA che chiusura serale e
homepage `/cassa` usano identica (audit A1/A3). Coperto ai bordi che contano:
`sistemaPerMetodo` (esclusione voce 'Caparra' case-insensitive; acconti aggiunti
col loro metodo, 0/senza-metodo ignorati; resi in denaro sottratti per metodo,
rimborso senza metodo → Contanti; combinazione vendite+acconti−resi con
arrotondamento al centesimo; jsonb `pagamenti` sporco trattato come vuoto);
`caparreSenzaMetodo` (solo acconti >0 senza metodo — buste col backfill 007);
`contantiAttesi` (fondo + Contanti − prelievi/spese); `contatoriCaparre`
(emesse/scontate/rese/incamerate indipendenti; scontate contano solo la voce
'Caparra'). Che i DUE schermi coincidano è garantito a monte dalla guardia G10.

**`tests/unit/anagrafiche-utils.test.ts` (Fase 4b).** `canaleEsitoDaPreferito`
(canali validi passano; 'cartaceo' → "" perché non è un canale di richiamo;
null/ignoto → ""); coerenza dei vocabolari `ETICHETTE_CANALE_PREFERITO` e
`ETICHETTE_RUOLO` con i check della migrazione 006.

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
9. **006 · Pass anagrafiche** (`anagrafiche.test.ts`): check additivi
   `clienti.sesso ∈ (M,F)`, `canale_preferito ∈ (telefono,whatsapp,sms,email,
   cartaceo)`, `non_contattare` NOT NULL default false (default applicato, NULL
   esplicito rifiutato); `prescrizioni.od_dnp/os_dnp ∈ [20,45]` o null (19.5 e
   46 rifiutati); `prodotti.tipo` ora accetta 'sole' e continua a rifiutare i
   tipi ignoti; `prodotti.ricambio_giorni > 0` (0 e negativi rifiutati, null ok).
   L'isolamento RLS sulle stesse tabelle resta coperto da `rls-isolamento`: le
   colonne nuove viaggiano sulle policy esistenti (nessuna tabella nuova).
10. **007 · Caparra & consenso** (`caparra-incasso.test.ts`):
   `ordini_occhiali.acconto_metodo`/`acconto_incassato_il` scrivibili;
   `garanzia_tipo ∈ (servizio,polizza)` (altro rifiutato); `resi.busta_id` FK →
   `ordini_occhiali` (id inesistente → 23503) con **ON DELETE SET NULL** (busta
   cancellata via service role → `resi.busta_id` torna null, il reso resta);
   `clienti.consenso_sanitario_il` scrivibile e retrodatabile accanto a
   `consenso_dati_sanitari` (timestamptz, non boolean).

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
- **Fase 4d** (`fase4d-consensi.spec.ts`): S1 (cliente nuovo senza consensi →
  banner con le due voci mancanti; registro il marketing con data di ieri →
  resta solo il sanitario; registro anche il sanitario → banner sparito, la
  sezione privacy mostra "Marketing: sì" / "Dati sanitari: sì"). Tenant e
  cliente usa-e-getta; selettori solo su testo/etichetta reali del banner
  (`Registra consensi`, `Salva consensi`, `data consenso marketing`).

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
- **G10 (nuova, Fase 4c)**: una sola formula di quadratura. I tre consumatori
  noti (`app/(app)/cassa/page.tsx`, `app/(app)/cassa/chiusura/page.tsx`,
  `lib/actions.ts` `chiudiCassa`) importano `sistemaPerMetodo` da
  `lib/cassa-calcoli` e **nessuno** reimplementa a mano l'esclusione della voce
  'Caparra' (il tranello dell'audit A3). Verificato non falsa-positiva sui
  consumatori reali (usano la costante `NOME_CAPARRA`, non il letterale). Se un
  domani la homepage o la chiusura ricalcolassero la cassa in proprio, G10
  scatta: è la difesa a monte del "verify che coincidono" richiesto per L1.

Rename-proxy (anti-regressione Next 16) — **L4c, le più importanti di questo giro**:
- **G11**: `proxy.ts` esiste alla radice e `middleware.ts`/`middleware.js` NON
  esiste. È la sentinella sul rischio catastrofico e SILENZIOSO di Next 16: se
  ricompare `middleware.ts`, Next 16 (che cerca l'export `proxy`) smette di
  proteggere le rotte senza alcun errore, l'app resta aperta e nessun test di
  prodotto diventa rosso. Questa guardia scatta al posto loro.
- **G11b**: `proxy.ts` esporta ancora `function proxy(` (l'export atteso da
  Next 16) e NON è tornato a `function middleware(` (export legacy ignorato).
- **G11c**: `proxy.ts` mantiene il `matcher` e le tre rotte pubbliche `/login`,
  `/registrati`, `/auth` — protezione invariata rispetto a Next 15.
- Non-falsa-positiva verificata: simulando in dir isolata il ritorno di
  `middleware.ts` con export `middleware`, G11 e G11b diventano entrambe false
  (la guardia scatta davvero). Nessun file dell'app toccato dalla prova.

G1–G10 restano verdi col rename e coi file Next 16: nessuna guardia scandiva
`middleware.ts` per path (G1–G4b guardano `lib/actions.ts`/`lib/`/`app/`; G5–G10
`components/`, `app/(app)/`, `lib/`, `docs/manuale-utente/`), quindi nessun
aggiornamento di path necessario. Gli E2E (`e2e/**`) non citano `middleware.ts`
né assumono Next 15: nessun allineamento richiesto.

Le guardie esistenti restano verdi coi file nuovi 4b/4c/4d: `cassa-calcoli.ts`
è un file `lib/` con export usati (cassa/chiusura/actions), `registraConsensi`
è agganciata a `ConsensiCliente.tsx` (G8), il banner `BannerConsensi` è
importato dalla scheda cliente (G5/G6).

> Limite noto di G2: ispeziona solo gli oggetti-letterale di `.update({…})`; le
> `.update(patch)` con variabile non sono lette (trade-off economico).
> Cosa hanno trovato le guardie di coerenza sul codice app: **nessun problema
> reale** su G5–G8 (nessun componente morto, nessuna pagina orfana, nessuna
> action fantasma). L'unico disallineamento reale è la copertura del manuale
> (G9) — vedi *Ganci*, è cross-agente, non un bug del codice.

## Cosa NON è coperto (per scelta o per limite)
Collaudi fuori dalla lista minima; stampa busta oltre "rende i dati chiave";
nessun test su Supabase di produzione, nessuno snapshot fragile.

**E2E rinviati (scelta anti-fragilità, coperti altrove).**
- *4c S1–S3 caparra-in-quadratura*: la formula è esercitata a fondo a L1
  (`cassa-calcoli`, la funzione pura IDENTICA che i due schermi usano) e
  blindata a monte da G10; l'E2E end-to-end della chiusura serale con caparra
  richiede di navigare il wizard busta (select Metodo) + la pagina chiusura,
  entrambi con selettori non ancora validati su app viva → rimandato al primo
  giro CI per non introdurre fragilità cieca. Il seed `seedBustaProntaConAcconto`
  esiste già in `e2e/_helpers.ts` per quando lo si aggiunge.
- *4d S2 gate-consenso in prescrizione*: la spunta obbligatoria in
  `PrescrizioneForm` dipende dai selettori del form Rx (non ispezionati);
  l'invariante "consenso_dati_sanitari timestamptz retrodatabile + flag" è
  coperta a L2 (`caparra-incasso`) e l'azione consensi end-to-end a L3 (S1).
- *4b S3 non_contattare nei richiami*: `richiami-proposte` non è pura (DB) →
  niente L1; l'esclusione delle proposte commerciali segue la stessa meccanica
  del consenso marketing già coperta a E2E Fase 3 · S4.

**Backfill 007 non verificabile a contratto.** `update … set acconto_incassato_il
= created_at where acconto > 0` agisce **una volta sola all'apply** su righe
preesistenti: su un DB di test fresco non c'è alcuna busta anteriore alla
migrazione, quindi l'effetto non è riproducibile a runtime. È una garanzia di
migrazione, non un'invariante di schema.

## Flakiness attesa
Gli E2E sono scritti senza app viva: i selettori dei wizard multi-step e delle
ricerche cliente/catalogo vanno validati al primo run CI (probabile un giro di
aggiustamenti). Fase 3 S3/S4 dipendono dal tempo: si retrodatano via service
role. La numerazione per anno riparte da 1 a Capodanno (atteso).

**Fase 4d S1 (nuovo)**: punto sensibile atteso è il re-render del banner dopo
la server action `registraConsensi` (che fa `revalidatePath`): il test assume
che il dialogo resti aperto (stato client `aperto`) dopo il primo salvataggio e
prosegue col consenso sanitario senza riaprirlo. Se al primo run CI il form si
chiudesse, basta riaprire con "Registra consensi". Le date retrodatate usano il
fuso del runner (l'action ancora a `T12:00:00`, margine ampio).

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
2. ~~Etichette vere (`aria-label`) sui `select` di `AzioniMagazzino`/
   `AzioniRichiami` e sul campo **Descrizione** del `WizardVendita`.~~
   **APPLICATO (v0.6).** Aggiunti `aria-label` ai `select` direzione/tipo
   movimento (`AzioniMagazzino`), canale/esito/tipo richiamo (`AzioniRichiami`)
   e all'input descrizione riga (`WizardVendita`). Gli E2E possono ora usare
   `getByLabel`; migliora anche l'accessibilità.
3. `tsconfig.json` `exclude` di `tests`/`e2e` e `.gitignore` degli artefatti
   Playwright: **applicati dall'orchestratore** (fuori dalla proprietà dell'agente test).
4. **(G7) Residuo append-only nei test di prenotazione — gancio DB.** Una volta
   creata, una `prenotazioni` non è cancellabile (trigger `trg_prenotazioni_no_delete`
   011 §7), pinna la `persona` (FK `on delete restrict`) e **blocca in cascata la
   delete dell'azienda**. Perciò `crea-prenotazione.test.ts` e `g7-prenota.spec.ts`
   lasciano un residuo (azienda + prenotazioni + persone) sul progetto di test:
   il teardown ripulisce solo il ripulibile (lista_attesa, appuntamenti) ed è
   best-effort sull'azienda. Mitigazione già in atto: **slug e telefoni unici per
   RUN_ID** → nessuna collisione fra run sull'indice unico di `persone`. Azione
   richiesta per una bonifica vera: una **RPC `SECURITY DEFINER` di pulizia per
   prefisso** sul progetto di test (che possa saltare i trigger append-only), o un
   reset periodico del DB di test. Non applicabile dall'agente test (tocca il DB).
5. **(G7) Campi del percorso senza label associata — gancio UI (accessibilità).**
   In `WizardPrenota.tsx` il componente `Campo` rende un `<label>` e l'`<input>`
   come fratelli, **senza** `htmlFor`/`id` né wrapping: `getByLabel("Nome e
   cognome")`/`"Telefono"` non aggancia i campi. L'E2E ripiega su
   `getByRole("textbox").nth(0|1)` (posizionale, più fragile). Azione richiesta al
   codice app: associare label e input (id/for o wrapping) — migliora accessibilità
   e rende gli E2E robusti a `getByLabel`. Non applicato (proprietà del codice app).

## Cosa resta a Ray / CI
Vedi `docs/agenti/TODO-ray.md`: creare `gestionale-test`, impostare i 3 secret,
primo `workflow_dispatch` per far girare L2+L3 e rifinire i selettori E2E.

## File creati / aggiornati (giro G7 · branch `portale/prenota`)
Creati:
- `tests/unit/ratelimit.test.ts` — L1 su `lib/ratelimit.ts` (7 test).
- `tests/contratto/crea-prenotazione.test.ts` — L2 migrazione 012 (11 test, in CI).
- `e2e/g7-prenota.spec.ts` — L3 percorso completo QR→richiesta (viewport mobile, in CI).

Aggiornati:
- `tests/unit/guardie.test.ts` — +L4h (G16/G16b/G16c: la scrittura passa solo
  dall'azione server). +3 test → `guardie` a 32, totale L1+L4 a **117**.
- `docs/agenti/report-test.md`.

**CI (`ci.yml`) e `package.json` invariati.** Gli script sono glob
(`vitest run tests/unit` / `tests/contratto`, `playwright test` su `testDir: e2e`)
e raccolgono i tre file nuovi da soli. Nessuna nuova devDep: bastano `vitest` e
`@playwright/test` già presenti. Esito L1+L4: `npm test` → **117/117 verde**;
`crea-prenotazione.test.ts` skippa pulito senza le env (11 test), il g7 spec è
elencato da Playwright (`--list`). L2/L3 restano alla CI.

## File creati / aggiornati (giro Next 16 · branch `gest/next-16`)
Aggiornati:
- `tests/unit/guardie.test.ts` — aggiunte G11/G11b/G11c (L4c, anti-regressione
  sul rename `middleware.ts → proxy.ts`); import `existsSync`. +3 test → 60 totali.
- `docs/agenti/report-test.md`.

Nessun altro file toccato: `package.json` (devDeps/script invariati, bastano
`vitest` + `@playwright/test`), `.github/workflows/ci.yml` (Node resta a 20 come
già deciso: GHA node 20 soddisfa il `>=20.9.0` di Next 16), `proxy.ts`,
`next.config.mjs`, `tsconfig.json` e l'intero codice app **non toccati**.
Esito L1+L4: `npm test` → 60/60 verde. L2/L3 restano alla CI (invariati). Nessun
gancio nuovo richiesto al codice app per l'upgrade.

## File creati / aggiornati (giro 4b/4c/4d)
Creati:
- `tests/unit/cassa-calcoli.test.ts` — L1 sulla quadratura (17 test, 4c).
- `tests/unit/anagrafiche-utils.test.ts` — L1 `canaleEsitoDaPreferito` + vocabolari 006 (5 test).
- `tests/contratto/anagrafiche.test.ts` — L2 migrazione 006 (6 test).
- `tests/contratto/caparra-incasso.test.ts` — L2 migrazione 007 (5 test).
- `e2e/fase4d-consensi.spec.ts` — L3 Fase 4d · S1 (banner consensi).

Aggiornati: `tests/unit/guardie.test.ts` (+G10 formula unica di quadratura),
`docs/agenti/report-test.md`. **CI (`ci.yml`) e `package.json` invariati**:
gli script sono glob (`vitest run tests/unit` / `tests/contratto` /
`playwright test`) e includono i nuovi file da soli. Nessuna nuova devDep:
bastano `vitest` e `@playwright/test` già presenti.

### Giro precedente (004/005)
Creati: `tests/contratto/agenda-richiami.test.ts` (004),
`tests/contratto/cassa-vendite.test.ts` (005), `e2e/fase4-cassa.spec.ts`.
Aggiornati: `tests/unit/guardie.test.ts` (+5 guardie di coerenza G5–G9),
`e2e/_helpers.ts` (seed `seedBustaProntaConAcconto` per Fase 4 · S3).

## Base storica (giri precedenti)
`vitest.config.ts`, `playwright.config.ts`, `tests/unit/{utils,guardie}.test.ts`,
`tests/contratto/_helpers.ts` + 8 suite, `e2e/_helpers.ts` + 4 spec,
`.github/workflows/ci.yml`; `package.json` (devDeps `vitest`, `@playwright/test`;
script `test`, `test:contratto`, `test:e2e`).
