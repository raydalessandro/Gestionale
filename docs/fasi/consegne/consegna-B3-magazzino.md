# CONSEGNA · B3 — Catalogo & Magazzino

*Consegna auto-assemblata dall’esecutrice il 14/08/2026. È il primo file della busta `era2/B3-magazzino` dopo il preliminare ordinato dalla regia. L’applicazione avviene esclusivamente sul progetto Supabase di TEST, tramite la strada che registra; nessun merge e nessuna scrittura in produzione.*

## 0 · RITO D’APERTURA — concluso

Sono stati letti integralmente `docs/fasi/mandato-manus.md`, `docs/README.md`, `docs/fasi/piano-era2.md` e `docs/fasi/modulo-M3-magazzino.md`, incluse l’Annotazione 1 del §10 e le risposte finali del §11-bis. Sono state inoltre lette le sezioni §4 e §7 di `docs/fasi/modulo-M5-lac.md`, richiamate espressamente dal piano per `lac_modelli`, `prodotti.modello_id` e la funzione di producibilità.

La base verificata è `main` al commit `5e4e212`, dopo B2; la prima migrazione B3 è pertanto `025_`. Il preliminare P è concluso: la mappa è stata rigenerata da schema e migrazioni fino a `024_prescrizioni.sql`, e la grammatica dati è risultata valida. L’addendum di regia B3-1 sana il debito B2 classificando `prescrizioni_lac` come **FATTO**, specie di `prescrizioni`; entrambi gli artefatti sono nel commit preliminare `6d41a3a`.

Il rito verifica come **conforme** l’inferenza prescritta: il DDL LAC è in M5 §4, ma il piano assegna espressamente a B3 `lac_modelli`, `prodotti.modello_id` e la funzione pura di producibilità. L’inferenza è dunque: *precedente scritto piano §B3 + richiamo esplicito a M5 §4/§7: DDL e test LAC assegnati a B3*. Non costituisce fermata. Restano esclusi `prove_lac`, campioni e il flusso prove, assegnati al filone Y/M5; la lettura C5 dei fermi resta B7.

Prima di ogni rifattorizzazione del wizard LAC, B3 riattiva lo scenario S4 in `e2e/fase2-magazzino.spec.ts`, lo esegue in CI e legge il trace Playwright. La diagnosi S0 ha escluso di attribuire il timeout a «pezzi mancanti»: si corregge soltanto la causa misurata, codice o test.

## 1 · Contesto

B3 costruisce il catalogo LAC per famiglie e il magazzino operativo dell’ottica. Introduce il ricevimento delle bolle come confronto con la merce fisica, il carico parziale ed eccessivo, gli scarichi motivati e la pratica difetto; completa inoltre le istantanee economiche necessarie perché le letture di magazzino ragionino per impostazione predefinita sul costo.

Il lavoro avviene ora perché B1 fornisce l’helper permessi per le rettifiche riservate a titolare/responsabile e B2 fornisce `prescrizioni_lac`, da cui B3 eredita un fatto clinico per occhio senza toccarne semantica, vincoli o flussi.

## 2 · Spec, decisioni e verità di riferimento

| Fonte | Parti applicate in B3 |
|---|---|
| `docs/fasi/modulo-M3-magazzino.md` | §1–§4, flussi f3a–f3f, §7, scenari S1–S7, §10 Annotazione 1 e §11-bis |
| `docs/fasi/modulo-M5-lac.md` | §4 per `lac_modelli`, `prodotti.modello_id`, variante on-demand e producibilità; §7 per vincoli e TDD della funzione pura |
| `docs/fasi/piano-era2.md` | Patto operativo, B3, template consegna, DoD e divieti |
| `docs/fasi/mandato-manus.md` | Test-only, additive-only, migrazioni registrate, CI, fermate, branch e merge |
| `docs/fasi/S0-verita.md` | Diagnosi misurata del timeout «Da catalogo» e obbligo di trace E2E S4 prima del refactoring |
| Regia su Notion, decisione B3-1 | `prescrizioni_lac` è FATTO; il debito B2 è sanato nel preliminare B3. La validazione bloccante e il relativo passo CI sono scope Opus, esclusi da questa busta |

## 3 · Migrazione

**`025_catalogo_magazzino.sql`** viene applicata esclusivamente tramite la strada che registra e include il proprio `insert into _infra_migrazioni … on conflict do nothing`, secondo la guardia G21f. La migrazione è additive-only su dati e nomi.

Crea `public.lac_modelli` come anagrafe della famiglia LAC, con fornitore, nome, tipologia, sottotipo, geometria, durata, pezzi per confezione, BC/DIA disponibili, schema parametri, griglia di producibilità e mappa UPC. Estende `prodotti` con `modello_id` per conservare la variante come prodotto reale soltanto quando serve allo stock fisico, senza alterare il contratto di giacenza.

Introduce le bolle attese e relative righe, compresi stato, dati del documento, quantità attesa e caricata, chiusura manuale con data e nota. Il modello consente carichi parziali ed eccessivi; una bolla attesa resta uno stato/confronto e **non** muove mai quantità, costo, prezzo o giacenza. Quei fatti passano esclusivamente dai movimenti di magazzino reali.

Completa il registro `causali` con il carattere economico `recupera_costo`, estende i movimenti con le istantanee `valore_costo` e `valore_prezzo`, e crea la pratica difetto con prodotto/UPC, riferimento, proprietà, foto, fornitore, stato, esito e chiusura. Le letture B3 predefinite ragionano sul costo; nessuna politica fiscale MF viene anticipata.

## 4 · Azioni, funzioni e superfici

La producibilità è una **funzione pura**, senza I/O: confronta i parametri della riga con la griglia del modello e restituisce un avviso informativo, mai un blocco. Le varianti LAC nascono on-demand dalla famiglia e dalla mappa UPC esclusivamente per stock fisico, vendita veloce o carico scorte.

Il ricevimento consente di confrontare bolla fisica e attesa, registrare righe parziali o in eccesso e chiudere manualmente le differenze motivate. Gli scarichi richiedono causale e valori doppi; il reso a fornitore recupera il costo secondo causale, mentre danno e smaltimento lo perdono. L’inventario è guidato per department, marchio e SKU; le rettifiche ± passano dall’helper B1 e sono accessibili solo a titolare/responsabile.

La superficie B3 comprende anche lista differenze e chiudi-bolla, pratica difetto con riferimento foto, variante-on-demand e pannello di **codifica-famiglia**. Il pannello è costruito in forma riusabile per l’innesto B4, senza implementare il flusso ordine B4 né prove LAC.

## 5 · Test obbligatori

| Livello | Copertura obbligatoria |
|---|---|
| TDD unit | Producibilità pura: step 0,25/0,50, cilindri, limiti inclusi/esclusi e fuori-range come avviso; valori costo/prezzo doppi e loro semantica economica |
| Contratto migrazione | Vincoli `lac_modelli` su durata e unicità; collegamento `prodotti.modello_id`; righe bolla parziali/eccessive; bolla senza effetti su valori/giacenza; causali e `recupera_costo`; pratica difetto e coerenza tenant con errore `23514` ove applicabile |
| E2E Playwright | M3 S1, S2, S3, S4, S5, S6 e S7, per nome e senza sostituzioni inventate |
| Diagnosi E2E pre-refactoring | `e2e/fase2-magazzino.spec.ts` S4: rimozione del `fixme`, esecuzione in CI e lettura del trace prima di scegliere qualsiasi correzione |
| Esclusioni dichiarate | `prove_lac`, campioni e conferma da prova appartengono a Y/M5; C5 e lettura fermi appartengono a B7; ordini e trigger di bolla lato M4 restano fuori B3 salvo le interfacce dati dichiarate |

## 6 · Definition of Done

Il rito d’apertura è verbalizzato nel log Notion e nella descrizione della PR. La PR contiene il preliminare B3-1, questa consegna, una migrazione `025_` registrata, test completi, mappa DB rigenerata e regole valide, CI verde e nessuna modifica fuori scope.

La descrizione della PR riporta i tre pezzi: verbale del rito con differenze motivate, verità misurate e punti caldi del diff. Riporta inoltre la riga: **«addendum di regia: debito B2 sanato (classificazione `prescrizioni_lac`)»** e l’inferenza diretta M5→B3 sopra verbalizzata. La chiusura aggiunge l’allineamento finale con agente-test, agente-manuali e documentazione di fase.

## 7 · Divieti

Sono vietati rename e drop di dati, nomi, colonne o tabelle; modifiche a produzione; SQL manuale sul dashboard; dipendenze npm nuove; modifiche a CI, guardie o a `scripts/mappa-db.py`; fix drive-by; UI oltre gli scenari B3; modifiche a prove LAC, campioni, flussi prova, letture C5 o flussi ordine B4. Le quattro viste-portale definer non si toccano e gli errori tenant previsti restano `23514`, mai `23503`.

Sono inoltre vietati interventi sulla validazione bloccante della grammatica e sul relativo passo CI: sono scope esplicitamente assegnato a Opus e verranno gestiti da Opus al proprio merge.
