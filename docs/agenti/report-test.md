# Report — Agente Test & CI

Aggiornato: 2026-07-26 · Fasi coperte: 1, 2, 3, 4 (v0.1–v0.5) + interfasi
**4b/4c/4d**; portale **G3–G6** (vocabolario fonte, pagina negozio, orari/servizi,
slot) e ora **G7 · percorso di prenotazione** (branch `portale/prenota`,
migrazione **012 · crea_prenotazione**). La copertura G7 è descritta in fondo
(«giro G7»); questo cappello resta al giro Next 16.

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
