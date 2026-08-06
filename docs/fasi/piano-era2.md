# Piano Era 2 — La codifica a spec congelate (il contratto operativo)

*Scritto il 04/08/2026 sera, a dieci sigilli apposti, col contesto
fresco della campagna. Questo documento È il piano: le buste si
consegnano a Opus una alla volta, la CI è il cancello, le spec sono il
riferimento vivo. Il riassetto del repo e il merge su GitHub sono la
FASE X (dedicata, dopo): qui non si spreca contesto a girare.*

## 0 · Il patto operativo
- **Chi fa cosa**: Claude prepara le buste (questo piano → consegne) e
  revisiona; **Opus codifica** da busta via PR; Ray fa regia e merge;
  **la CI è il cancello** — verde o non si entra.
- **Le spec sono il contratto**: congelate; ogni deroga è
  un'annotazione §10 datata, mai una riapertura.
- **Le default privileges sono CHIUSE (dalla 021, decisione 05/08)**:
  tabelle E funzioni nuove nascono senza grant ad anon/PUBLIC; le
  viste-portale ricevono grant ESPLICITO (VP-01). La 020 era la
  fotografia, questa è l'invariante. Perimetro (05/08): copre gli
  oggetti delle NOSTRE migrazioni — quelli degli strumenti interni
  Supabase (supabase_admin) restano fuori: la strada-che-registra
  rende il residuo teorico; l'eventuale cintura dal dashboard è a
  discrezione della regia.
- **Errori di tenant**: sulle tabelle con `trg_tenant` il codice si
  aspetta SEMPRE `23514` (mai `23503`): il trigger parla prima delle
  FK, che restano rete di fondo. Nessun ramo di gestione su 23503.
- **Additive-only sul DB**: niente rename, niente drop; le voci si
  deprecano in lettura; le mappe di migrazione (es. stati ordini) sono
  additive.
- **IL PROTOCOLLO DEL BUG** (regola di Ray, permanente): trovato un
  bug → si guardano PRIMA le spec. L'errore viene dalle spec? Si
  correggono loro, poi il codice. Non viene da lì? Si corregge il
  codice E si aggiorna la spec perché non ricapiti. Le spec crescono
  con noi.
- **Il patto dei test**: ogni busta porta TDD (unit sulle funzioni e
  sulla logica delle azioni, scritti PRIMA), test di contratto sulle
  migrazioni (vincoli/check), E2E Playwright sugli scenari S della
  spec (nominati, non inventati). Flaky → quarantena con issue, mai
  skip silenziosi. *Voce dichiarata per il futuro (apprendimento di
  Ray): i test del CONTESTO — ambiente, integrazioni, produzione — si
  aggiungeranno col tempo; per ora il perimetro è il nostro software.*

## Chi scrive le consegne (deciso il 05/08)
La S0+B1 la scrive Claude (i contratti sono appena nati). **Da B2 in
poi la consegna la ASSEMBLA L'ESECUTORE** dal template qui sotto,
usando piano+spec: è il PRIMO file della PR (in `docs/fasi/consegne/`),
prima del codice — così la regia la vede dal telefono. Claude fa
revisione ai checkpoint. Valvola: se il rito segnala differenze due
volte nella stessa busta, quella consegna torna a Claude.

## Il template della CONSEGNA (ogni busta è fatta così)
0. **RITO D'APERTURA — il cancello di Opus (proposta di Ray,
   04/08)**: PRIMA di scrivere codice, Opus legge le spec citate al
   punto 2 e verifica la consegna contro di esse; ogni mancanza o
   differenza → SI FERMA e segnala (file, §, cosa manca/differisce).
   Il verbale del rito va nella DESCRIZIONE della PR («Verifica spec:
   conforme» oppure l'elenco). La segnalazione non è un fallimento: è
   il cancello che funziona.
1. **Contesto** (2 righe: cosa e perché ora).
2. **Spec di riferimento** (file + §, CONGELATE — copiate in busta).
3. **Migrazioni** da scrivere (nomi file `0NN_*.sql` + DDL dal §4).
4. **Azioni/funzioni** (elenco con firme e regole).
5. **Test OBBLIGATORI**: TDD (casi elencati) · contratto · E2E (gli S
   della spec, per nome).
6. **DoD**: rito d'apertura verbalizzato in PR · CI verde · `scripts/mappa-db.py` rigenerata e regole
   `docs/regole/` valide · zero modifiche fuori scope · §10 se deroga.
7-bis. **La descrizione della PR = «i tre pezzi»** (il formato del
   checkpoint, codificato il 05/08): (1) il verbale del rito con le
   differenze MOTIVATE · (2) le verità MISURATE (mai supposte) · (3) i
   punti caldi del diff, dove la revisione spende bene i token. La
   chiusura di busta aggiunge l'allineamento finale: agente-test,
   agente-manuali, doc di fase.
7. **Divieti**: mai «risolvere» il lint sulle 4 viste-portale definer
   (decisione VP-01: sono il portale) · no rename/drop · no fix drive-by · no UI oltre lo
   scope · no npm nuovi senza nota.

## S0 · Bonifica e verità (la prima busta, piccola — PRIMA di tutto)
**FIX IMMEDIATI — migrazione `020_bonifica` (dai rilievi della mappa
giro-2, 05/08):** (a) `_riparazioni_dati`: **enable RLS + revoke
all da anon e authenticated** (resta solo il service role) — il
segnaposto della 019 non deve essere cancellabile: chi lo toglie
ri-arma lo slittamento di 2 ore degli appuntamenti da banco; (b)
igiene grant: revoke SELECT ad anon sulle 16 tabelle pre-008 e revoke
EXECUTE ad anon sulle tre funzioni trigger (assicura_coerenza_tenant,
crea_sala_default, assegna_sala_appuntamento) — oggi la RLS salva, ma
«sei a una politica distratta dal buco»; (c) la politica di `risorse`
ricreata su `authenticated` (unica riga fuori riga dello schema); (d)
`_infra_migrazioni`: riallineata in test (016→019) e CREATA+backfillata
in produzione — **regola permanente: le migrazioni passano SOLO dalla
strada che registra** (via connettore/script, mai a mano dal
dashboard).
Verifiche sui fatti: `negozi_servizi.attivo` esiste? · `ordini_lac` ha
le righe per occhio (serve alla copertura ÷2)? · **diagnosi del
timeout** wizard LAC «Da catalogo» (leggere il codice: conferma
dell'ipotesi pezzi-mancanti) · censimento dei `fixme` e2e · baseline
CI verde · mappa-db rigenerata. Output: `docs/fasi/S0-verita.md` con
gli esiti — le buste a valle si adattano SOLO qui, non a metà corsa.

## Le buste, in ordine di dipendenza (migrazioni → azioni → superfici)
**B1 · Fondamenta** — migrazioni: `consensi` (+prescrizione_id per il
sanitario) · `clienti_relazioni` (granulari simmetriche) · `oculisti`
· `parametri` · registro `assicurazioni` MINIMO (id, nome, attivo +
voce NESSUNA) · clienti additive (assicurazione_id,
azienda_convenzionata_id, dati_fatturazione jsonb, consenso_canali
cache) · `clienti.anonimizzato_il` · CHECK consensi e unique-index
relazioni (da contratti C3/C4) · **helper permessi** (enforcement `permessi.json`
nelle azioni: nasce qui perché tutte le buste dopo lo usano).
Azioni: mastro consensi con cache su clienti, popup-firma infra,
relazioni lette nei due versi, proposta-tutore da CF minorenne,
revoca dal tasto (cache spenta, operativi leciti), **eliminazione
definitiva protetta** (anonimizzazione che preserva i fatti fiscali —
«possibile, non comodissima»).
**In TESTA alla 021 (esito S0, sì di Ray+Claude 05/08)**: `ALTER
DEFAULT PRIVILEGES` — revoke ad anon sulle TABELLE future e a
PUBLIC/anon sulle FUNZIONI future (la gemella del buco EXECUTE
trovato dal rito). **`docs/fasi/contratti-B1.md` è PARTE della
busta** (si copia dentro):
C1 anonimizzazione con mappa campo→trasformazione · C2 helper
fail-closed (tabella esaustiva) · C3 invarianti consensi (CHECK +
lock transazionale: la cache è l'ultimo commit, mai gare) · C4
relazioni (una riga, guardia di coppia, unique-index funzionale).
TDD: cache-coerenza, simmetria, CF-parser. E2E: M1 S1-S6.

**B2 · Prescrizioni** — migrazione grossa additive su `prescrizioni`
(sezioni scheda-unica, scadenza sticky, tipologie con mista E office,
prisma valore+base, notazione, speciali, invariati, appaiamento,
ADD/visus per occhio, oculista_id, derivata_da) + `prescrizioni_lac`.
**Funzioni PURE delle conversioni** (intermedio = L+ADD/2 · office =
L+ADD senza intermedio · vertice oltre ±4,00) con tabelle di casi TDD
complete. Azioni: scheda unica, consenso sanitario per-Rx inline,
rettifica a due vie, plano-che-richiama, oculista al volo, «Salva e
chiudi / Salva e crea ordine» (il secondo è uno stub-ponte: il
trasferimento pieno vive in B4). **Nota attivazioni**: NESSUNA tabella
— l'ordine È l'attivazione (f2x definitivo: tipo+Rx-istantanea+data);
la lettura «quali tipologie ha aperto» è una PROIEZIONE sugli ordini;
il «modulo a parte» futuro, se vorrà materializzare, sarà additive
allora [conferma di Ray in audit].
E2E: M2 S1-S12 (selezione).

**B3 · Catalogo & Magazzino** — migrazioni: `lac_modelli`
(producibilità+upc_mappa) · `prodotti.modello_id` · `bolle_attese`+
righe (+chiusa_il/nota) · `pratiche_difetto` · registro `causali`
(recupera_costo) · `movimenti`: valore_costo+valore_prezzo.
Funzione producibilità (pura, avviso mai blocco). Azioni: ricevimento
con parziale/eccesso, lista-differenze e chiudi-bolla, scarichi con
causale e valori, pratiche difetto con foto-ref, inventario guidato
(rettifiche solo tit/resp via helper B1), variante-on-demand,
pannello **codifica-famiglia** (riusabile dal flusso ordine B4). I
FERMI sono già vivi a contratto: qui solo verifica, la lettura C5 va
in B7.
TDD: producibilità (griglia step), valori doppi. E2E: M3 S1-S7.

**B4 · Ordini & Laboratorio** — migrazioni: `ordini_occhiali` additive
(tipo_ordine, provenienza a 3, prezzo_pieno, sconto_pct, centrature,
dati_montatura, canale_contatto, rx_generata_id ON DELETE SET NULL,
rx_modificata_a_mano, **tipologia_visione** — l'ISTANTANEA queryable
del dettaglio scelto (monofocale_lontano/…/progressiva/office):
requisito di Ray 04/08, «chi ha la Rx progressiva» deve leggersi
piatto dal DB — stati nuovi con mappa additive) ·
`beni_in_custodia` · registro `lavorazioni` (seed: montaggio;
espandibile) · RPC numerazione estesa (LETTERA+«-NNN»).
Azioni: flusso maestro (9 passi), salva/conferma, **trigger
bolla-attesa alla conferma fiscale**, scarico ALLA CONSEGNA (chiude
A7), catena stati un-click mai-indietro, custodia col foglio,
annullo/reso con lo spartiacque, Ripeti-LAC + «stessa tipologia»
(+occhiali SOLO se generalizza in due righe), bollino soggettività
(proiezione), precedenza fonti LAC, **stampa del preventivo**
dall'ordine salvato, ricezione di «Salva e crea ordine» (prefill dalla
scheda B2). E2E: M4 S1-S9 + **TEST DI LETTURA obbligatorio**: la proiezione
«attivazioni» (per cliente: tipologie aperte, con date) risponde
SENZA tabelle dedicate — è il nutrimento della dashboard futura.

**B5 · Cassa** — migrazioni: `chiusure_cassa` additive (distinta
tagli, aperto_il/da, negozio_chiuso_il). Azioni: vendita veloce con
LA REGOLA DEL CF (prima→scheda via B1; dopo→cf_cliente), **vendite
semplici della giornata + «recupera e associa»** (per scontrino/
giorno), sconto libero fino a zero, liturgia chiusura con split sui
tagli (300±20, versamento tondo), apri/chiudi negozio, incamero
caparra, stampa della ricevuta caparra (la presa doc è a contratto),
tolleranza di quadratura (i 5 centesimi) → `parametri` (rilievo:
la politica esce dal codice). E2E: M8 S1-S7. (RT/fiscale profondo: NO — è MF.)

**B6 · Agenda evoluta** ⚡ *PARALLELIZZABILE dopo B1 (dipendenze
minime) — ed è la PRIMA ERA del portale: priorità di lancio.* —
migrazioni: `servizi.tipo_visita` · `appuntamenti.riprogrammato_da` ·
`prenotazioni.riprogramma_di` · (`negozi_servizi.attivo` ESISTE — verificato in S0: niente da
aggiungere). Azioni: riprogramma dal banco, **link firmati** (disdetta
libera + richiesta cambio), **visita eliminata visibile in giornata**
(l'effetto wow), «Apri Rx» (colonna+bottone), lista d'attesa che
propone, tassonomia nel seed, `slot_liberi` che legge passo/anticipo/
orizzonte da `parametri` (default = i valori attuali 15min/2h/90gg —
rilievo: politica di negozio scritta nel database). E2E: M6 S1-S6.

**B7 · Richiami** — migrazione: `tarature_richiami` (+ voce esito
`da_spostare` additive). Il motore = CODE come proiezioni (query/
viste): controllo_vista (gerarchia Rx→prenotazione, gate consenso
marketing, solo la DATA), lac_esaurimento (copertura ÷2 + anticipo — **esito S0**: gli occhi
vivono nel JSONB delle righe, da spacchettare; le righe legacy con
occhio NULLO si trattano da BILATERALI, ÷2, il caso peggiore
prudente),
win-back (copertura superata + mancati), sollecito ritiro, fermi.
Gesto del richiamo con esiti. TDD: copertura (i due occhi!), gate
consenso. E2E: M7 S1-S7.

**B8 · Semina & letture** — la semina guidata (f10d: servizi con
Prova-LAC, metodi, tarature, parametri 300/20, department, contatori
«-NNN», TABO, QR pronto) · filtro esaminatori · letture per-operatore
minime (M9-esterna, prima pietra). E2E: M10 S1-S6 (S1 dei permessi
gira già dalle buste precedenti via helper B1).

**B9 · Collaudo (M11) & C0** — la suite S COMPLETA cross-modulo come
E2E finale (inclusa la ri-verifica della lettura-attivazioni) · fixme riscritti sui flussi nuovi · mappa-db + regole
validate · lista unica: saldo dei conti · verbale C0 → fine Era 2.

## Le fasi fuori-busta
**X · Riassetto repo & merge su GitHub** (sessione dedicata di Claude,
DOPO il piano consegnato: riorganizzare docs/, controllare conflitti
con documenti di progetto esistenti, PR ordinata su main).
**Y · Innesti modulari**: la UI-home della collega (in arrivo → si
aggancia in B4/B6 come materiale §5) · il filone Applicazione+Anamnesi
(separata sede, si monta quando pronto: legge/scrive solo l'output).
**Z · MF** a gestionale codato, coi commercialisti: pareggio mensile,
RT, varianti fattura minore, verifica apri/chiudi, trattamento
rotture — «solo l'ultima parte», senza riaprire nulla.

## Ordine di marcia consigliato
S0 → B1 → (B2 ‖ B6) → B3 → B4 → B5 → B7 → B8 → B9 → X → Z (Y quando
arriva). Ogni busta: PR piccole, CI verde, mappa rigenerata. Se una
verifica S0 sposta qualcosa, si aggiorna QUI e nelle buste a valle —
una volta, per iscritto.


## Audit di copertura spec→piano (04/08 sera, su richiesta di Ray)
Dieci spec rilette PER INTERO dal disco (non dalla memoria: le
compattazioni erano tre). Esito: **il piano copriva il 95%**; le
quattro assenze trovate sono state AGGIUNTE sopra (anonimizzazione e
registro-assicurazioni in B1, lavorazioni e stampa-preventivo in B4,
ricevuta-caparra in B5, fermi-nota e pannello-famiglia in B3, ponte
Salva-e-crea B2↔B4). Cinque refusi interni nelle spec sigillate (testo
pre-correzione sopravvissuto accanto al nuovo) chiusi con
**annotazioni §10 datate** — il congelamento che lavora: M2 (office
assente dal commento DDL), M4 (§6 citava lo scarico-alla-caparra), M5
(bullet doppio e un puntatore), M6 (§9 citava la corsia G9-G13 poi
confluita), M8 (§1/§6 con la dizione pre-vendite-semplici), M10 (la
scheda di sistema nella semina, decaduta). **Decisione CHIUSA (Ray, 04/08 sera)**: attivazioni senza tabella ✓
— col REQUISITO di lettura («assicuriamoci di poterlo fare in lettura
dal DB: nutriranno la futura dashboard»): garantito in B4 con
`tipologia_visione` istantanea + test di lettura obbligatorio, e
ri-verificato in B9. Audit al 100%. Il RITO
D'APERTURA di Opus è nel template (punto 0) con verbale in PR.

**Audit esterno (ChatGPT, 05/08) — recepito**: verdetto «piano valido,
non rifarlo»; i 4 blocker 🔴 chiusi coi contratti (contratti-B1.md);
passata editoriale 🟠 eseguita (DRAFT/PROPOSTA eliminati dalle
sigillate, §7 Test uniformata su M5-M10, M1-S7 annotato
cross-modulo). Il rischio residuo indicato — «una decisione presa non
sempre espressa in modo abbastanza rigido per l'agente» — è
esattamente ciò che i contratti e il rito d'apertura chiudono.

**Mappa giro-2 (05/08) incrociata — rilievi recepiti**: il
«da-chiudere-subito» e le tre igiene → `020_bonifica` in S0 · le due
decisioni-non-scritte → scritte (VP-01 per le viste; contratto 23514
nel patto) · le politiche-nel-database → `parametri` (B5/B6) · la
cassa-non-percorsa si chiude con B5 (i cinque E2E fermi apposta) · le
garanzie-a-trigger su prenotazioni: note, coerenti con M6 · il
registro-riferimenti alimentato: rilievo G8 CHIUSO ✓. Prod e test a
impronte identiche: la baseline è pulita.
