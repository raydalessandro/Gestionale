# Dominio ottica — distillato dai manuali operativi di catena

Questo documento condensa ciò che abbiamo imparato dai manuali operativi retail
di una grande catena ottica italiana (2022–2026): vocabolario, flussi, regole
fiscali e operative. Serve a due cose: **validare il contratto** (schema.sql)
e **guidare i moduli in arrivo** (v0.2 Ordini & Buste, v0.3 Magazzino/Agenda,
v0.4 Cassa, poi fiscale).

> ⚠️ **I PDF sorgente sono materiale interno riservato: non vanno committati
> in questo repo né ridistribuiti.** Qui dentro c'è solo la distillazione in
> parole nostre, al livello di prassi di settore.

---

## 1 · Vocabolario di catena → vocabolario VISTA

| Catena | VISTA | Nota |
|---|---|---|
| WO (Work Order) | `ordini_occhiali` (busta lavoro) | Il numero WO **non cambia mai**: si modifica, non si cancella |
| Caparra | `acconto` | Fiscalmente è *caparra confirmatoria* (vedi §6) |
| Complete Pair / Job | busta "occhiale completo" | montatura + lenti |
| Frame To Come (FTC) | montatura in arrivo / del cliente | il laboratorio riceve la montatura dopo |
| Lens Only | solo lenti | |
| Solo Frame | solo montatura | esiste come WO a sé |
| Rendi | reso (denaro) | reso vero, senza nuova vendita |
| Scambio | cambio merce | solo sole non graduato e accessori; il resto = reso + nuova vendita |
| Reso Gestionale | reso con riordino | il reso che porta a una nuova vendita |
| Remake | rilavorazione | pre o post consegna, stesso numero d'ordine |
| Lista Caparre | coda buste con acconto aperto | la vista operativa quotidiana |
| Vendita veloce | vendita senza anagrafica | banco: sole, liquidi, accessori |

---

## 2 · Prescrizioni

Il flusso di catena conferma il nostro modello e aggiunge tre cose:

**Origini più ricche.** In inserimento dati la catena distingue quattro
origini: *check-up interno*, *ricetta esterna* (medico oculista), *lenti del
cliente* (valori letti al frontifocometro dall'occhiale in uso) e *plano*.
Le prime due le abbiamo (`origine interna|esterna`); "lenti del cliente" è uno
scenario reale anche per l'indipendente → proposta v0.2 in §10.

**Mai cancellare, solo disattivare.** Una prescrizione non si elimina mai:
si marca *inattiva* (manualmente quando arriva una Rx più recente, o in
automatico alla scadenza). La scadenza di default è **12 mesi** dalla
creazione — identico al nostro `validita_mesi default 12`. ✓

**Consenso dati sanitari ≠ consenso marketing.** Alla registrazione della
prescrizione la catena raccoglie un consenso privacy *specifico per i dati
medici* (firma cartacea o digitale). Noi oggi abbiamo solo
`consenso_marketing`: il consenso al trattamento dei dati sanitari va
tracciato a parte (§10).

Dettagli utili: la lista dei medici oculisti esterni è curata e
disambiguata per studio/città (per noi oggi basta `esaminatore` testo, un
domani tabella `medici` quando arriverà l'alleanza con gli studi — vedi §7,
Tagliando). Lo stato del cliente come *paziente* è "nuovo / accertato".
Per una vendita si "seleziona" una prescrizione attiva dallo storico.

## 3 · Busta lavoro (ordini occhiali)

**Tipo di lavoro.** Il sistema classifica automaticamente il job in
Complete Job / Frame To Come / Lens Only (e Solo Frame) dopo un check di
fattibilità montatura+lenti+misurazioni. È un attributo che ci manca (§10).

**Misurazioni.** Presa parametri con strumenti digitali quando possibile,
inserimento manuale sempre ammesso ma con **motivo della misurazione
manuale** dichiarato; il sistema **valida i range** e segnala in rosso i
valori fuori intervallo suggerendo quelli corretti. Per la v0.2: validazione
UI dei range DNP/altezze, non solo i check DB.

**Arrivo ≠ pronta: c'è l'ispezione.** All'arrivo dal laboratorio l'ordine è
"ricevuto"; si registra un'**ispezione** (chi l'ha fatta, quando) e solo se
il prodotto è perfetto si procede. Se è sbagliato/danneggiato **non** si
ispeziona: si fa subito il remake (stesso numero d'ordine). Va verificato
**entro 24h dall'arrivo**, per anticipare il cliente in caso di problemi.

**Modifica vs cancellazione.** Il WO si *modifica* (motivi di negozio,
richiesta cliente, annullo del laboratorio, remake pre-consegna) e il numero
resta; si *cancella* solo su richiesta di annullamento del cliente.

**Il viaggio del cliente** (la loro versione industriale del nostro
Recall+app): conferma ordine il mattino dopo → monitoraggio stato → avviso
arrivo (24h dopo l'arrivo effettivo) → **prenotazione del ritiro su slot da
20 minuti nell'agenda dell'ottico** → consegna. Più due automatismi
proattivi: **verifica dello stato 2 giorni prima della data promessa** e, per
ritardi critici (>10gg oltre il lead time), chiamata + gesto di scuse
(gift card). Tutta roba che VISTA può dare all'indipendente via app
white-label + Recall + Agenda.

## 4 · Caparre (acconti)

Prassi di catena: caparra **al 30% del valore** su ogni vendita da busta.
Regole operative che valgono oro:

La caparra si prende **solo il giorno della creazione dell'ordine** (niente
caparre differite). Gli ordini con caparra aperta vivono in una **Lista
Caparre** dedicata: è da lì che si fa la consegna. Se il cliente non ritira,
la prassi è: dopo **2 mesi** si avvia l'incameramento — prima **3 tentativi
telefonici**, poi **raccomandata A/R**, e trascorsi **10 giorni** dalla
ricevuta di ritorno la caparra si incamera. Se il cliente rinuncia prima, si
rende la caparra dalla stessa lista (ricevuta non fiscale di reso caparra).

Per il regime fiscale della caparra vedi §6 — è il punto più delicato.

## 5 · Resi, scambi, garanzie

**Finestre di reso** ("soddisfatti o rimborsati", prodotto integro,
scontrino alla mano): occhiale da vista completo **60 giorni**; sole, LAC e
liquidi, accessori **30 giorni**. LAC con confezione aperta: a discrezione
del responsabile.

**Causali di reso** (tassonomia completa, post-consegna):

| Famiglia | Causale | Quando |
|---|---|---|
| Reso denaro | Soddisfatti o rimborsati | rimborso senza riordino |
| Reso gestionale | Errore check-up | refrazione/centrature sbagliate dal negozio |
| Reso gestionale | Errore ricetta | ricetta del medico non idonea |
| Reso gestionale | Mancato adattamento progressive | si passa al monofocale |
| Reso gestionale | Modifica WO | **solo resi fittizi** (riemissione documenti: CF, garanzia dimenticata); mai se si sostituisce prodotto |
| Reso gestionale | Insoddisfazione — estetica | AR troppo evidente, spessori, colorazione, montatura che non piace |
| Reso gestionale | Insoddisfazione — funzionalità | fastidi visivi con parametri corretti, calzata |
| Reso gestionale | Difetto di fabbricazione | AR difettoso, vizi non da uso scorretto, segni di ventose |

Regola dura sul Complete Pair: **si rende tutto o niente** (mai solo lenti o
solo montatura di un occhiale completo). Il reso produce nota di credito +
dichiarazione di reso firmata dal cliente; lo scontrino originale si
trattiene. Rimborsi oltre soglia contanti (o cassetto scarico) → bonifico.

**Remake**: previsto per *difetto di fabbricazione* o *errore costruzione
lente*; pre-consegna si inserisce un ordine remake prima di consegnare
(numero invariato), con motivo a più livelli di dettaglio e documento di
remake nel pacco di reso al laboratorio. Esiste anche il remake post-consegna.

**Garanzie**: quella **di legge è 24 mesi** (+2 dalla scoperta del vizio per
il reclamo), rimedio preferito la sostituzione, in subordine il rimborso; nei
casi dubbi si passa da perizia (esclusi cattivo uso e danno accidentale). Le
garanzie *commerciali/assicurative* vendute a listino sono un servizio a
parte: **si attivano solo alla consegna** del WO e richiedono anagrafica
completa (nome, cognome, **codice fiscale, indirizzo completo**) — il nostro
schema clienti li ha tutti. ✓

## 6 · Fiscale (per la fase futura, ma da sapere ORA)

Tre regole che condizionano il design di Cassa:

1. **IVA 4% sull'occhiale completo da vista con ricetta** (montatura + lenti
   oftalmiche + montaggio: ausilio medico ad aliquota agevolata), mentre
   **garanzie e servizi viaggiano al 22%**, e il sole non graduato pure. Un
   WO consegnato genera quindi uno scontrino a **doppia aliquota**.
2. **La caparra confirmatoria non genera scontrino.** Alla ricezione si
   emette solo una ricevuta di cortesia non fiscale; **l'unico scontrino
   fiscale, per l'intero valore, si emette alla consegna**. (Anche una
   "caparra a saldo" anticipata non autorizza lo scontrino prima della
   consegna della merce.)
3. **Fattura elettronica a privati**: codice destinatario `0000000`, CF del
   cliente obbligatorio. La catena chiede sempre fattura *prima* di chiudere
   il pagamento.

**Procedura di emergenza** (cassa giù): si scontrina col tastierino della
cassa fiscale o, in estremo, si registra sul **registro dei corrispettivi**
cartaceo; al ripristino si reinseriscono le vendite a sistema *scollegati
dalla stampante fiscale*. Durante il fault: niente caparre, WO annotato a
mano e inserito dopo come "in attesa di pagamento". → VISTA dovrà avere la
sua paginetta "procedure di emergenza": è maturità operativa che
l'indipendente riconosce.

## 7 · Convenzioni, assicurazioni sanitarie, alleanza con gli oculisti

Qui i manuali **confermano parola per parola la meccanica della gara
voucher** del nostro modulo Convenzioni: la catena ha un portale dove
monitora i **voucher scaricati** dagli assicurati, con nome e telefono del
cliente, "per gestire in maniera efficace la recall dello stesso e tracciare
l'esito della pratica (acquisto / non acquisto)". È esattamente il nostro
`stato da_contattare → vinto|perso` con esito. ✓

**Ciclo di vita della pratica assicurativa** (gestione diretta): attivazione
con caricamento documenti obbligatori → attesa **esito PIC** (presa in
carico) → emissione e caricamento **fattura** → **liquidazione**. Il cliente
paga solo franchigia/scoperto/eccedenza massimale; il resto lo incassa il
negozio dal fondo. Requisiti d'ingresso del cliente: **ricetta oculistica che
attesti il "cambio visus"** + documento autorizzativo della compagnia (o
check-up in negozio che produce il certificato, se il piano lo consente).
Prassi: caparra dall'assicurato solo contanti/assegni; al saldo, metodo di
pagamento "assicurazione"; ordine marcato come assicurativo fin dal vassoio.

**Convenzioni aziendali** (welfare): sono un'altra meccanica — sconti
permanenti per dipendenti e familiari via **coupon con codice sconto**
(portali welfare tipo Corporate Benefits), codice "bruciato" in cassa che
applica gli sconti automaticamente. → nella nostra tassonomia demo
(`voucher | rimborsuale | fattura_azienda | diretta`) va aggiunta la
meccanica `sconto_coupon`.

**Tagliando oculista** — la versione industrializzata dell'alleanza
ottico↔oculista che avevamo già intuito per Fondo Est: il negozio segnala
oculisti convenzionati (solo attività privata), **prenota la visita
telefonando allo studio col cliente presente**, il cliente paga la visita al
medico, e riceve uno sconto (fino a 100€) sull'occhiale completo **entro 1
mese** dal tagliando; nominale, max 4/anno, cumulabile. Nessun denaro passa
tra negozio e medico. → candidata meccanica per Boutique/acquisizione.

**Abbonamenti**: la catena vende piani triennali occhiali (3 paia/3 anni a
voucher, con o senza rinnovo automatico, conguaglio in gift card) e
soprattutto un **abbonamento LAC a fornitura trimestrale** (giornaliere/
quindicinali/mensili), con data di addebito scelta dal cliente tra il 5 e il
20 del mese = data massima di consegna della fornitura. → il nostro Recall
"LAC in esaurimento" ha un fratello maggiore naturale: `ordini_lac`
ricorrenti. Da tenere per la roadmap.

## 8 · LAC e magazzino (per v0.3)

Distinzioni operative sui prodotti LAC: **anagraficati per singolo UPC**
(ordine diretto), **codici generici** a parametri variabili (ordine con
parametri), **lenti di costruzione** su misura, e **campioni** (prima
applicazione LAC: si registra comunque, a valore zero). La prima
applicazione LAC è un evento tracciato a sé, legato alla prescrizione.

Ricevimento merce: conta colli, riscontro DDT, **firma con riserva** in caso
di anomalia; il carico a sistema è "con conferma quantità" e **le differenze
generano automaticamente un movimento di rettifica** dello stock (niente
rettifiche manuali per gli scostamenti da bolla). Fornitori LAC grandi
(CooperVision, Alcon, J&J, B&L) lavorano in **EDI** con bolla elettronica;
gli altri a ordine d'acquisto. Esistono flussi dedicati per merce difettosa,
ricambi/sostituzioni post-vendita, trasferimenti negozio↔negozio, resi a
fornitore e smaltimento, danni in store: sono la mappa dei
`movimenti_magazzino` di v0.3 (carico, scarico vendita, rettifica,
trasferimento, reso fornitore, danno/smaltimento, uso interno).

## 9 · Ordini ecommerce con ritiro in negozio (per il nostro sito)

Il flusso di catena, tradotto per noi: alla spedizione partono **due mail
(cliente e negozio)** col numero d'ordine; il negozio registra l'arrivo, e se
il cliente non si presenta lo **richiama dopo 3 e dopo 10 giorni**; giacenza
massima **2 settimane**, poi reso al mittente. Reso ecommerce: recesso entro
**30 giorni** dal ritiro, difetti in garanzia di legge 24 mesi; il reso in
negozio è gratuito, con codice di autorizzazione (RMA). → per il nostro
`/sito/[tenant]`: notifica doppia, solleciti 3/10gg automatizzabili in
Recall, campo giacenza.

---

## 10 · Impatti proposti sullo schema (da discutere, DDL in v0.2)

Nessuna di queste modifiche è stata applicata: il contratto v0.1 resta com'è.
Proposte additive, una migrazione `002` quando le confermi:

1. `prescrizioni.origine`: aggiungere `'lenti_precedenti'` (valori letti
   dall'occhiale in uso). *Plano* resta rappresentabile con sfero 0.
2. `prescrizioni.attiva boolean not null default true` — mai cancellare,
   solo disattivare (+ disattivazione automatica a scadenza lato app).
3. `clienti.consenso_dati_sanitari timestamptz` — consenso privacy sui dati
   medici, distinto dal marketing, raccolto alla prima prescrizione.
4. `ordini_occhiali.tipo_lavoro` check
   `('occhiale_completo','solo_lenti','solo_montatura','montatura_cliente')`
   — i job type; `montatura_cliente` è l'FTC dell'indipendente.
5. `ordini_occhiali.stato`: aggiungere `'arrivata'` tra `lavorazione` e
   `pronta` + campi `ispezionata_da uuid`, `ispezionata_il timestamptz` —
   l'arrivo non è "pronta" finché non c'è l'ispezione.
6. `ordini_occhiali`: `caparra_incamerata_il timestamptz` (chiusura busta per
   mancato ritiro, con la trafila solleciti→raccomandata gestita da Recall).
7. Tabella `resi` (v0.2 o v0.4): `ordine_id, tipo ('denaro','gestionale'),
   causale` (tassonomia §5), `note, created_at` — le causali sono il dato che
   fa i report belli.
8. Vocabolario `voucher_convenzioni` (quando arriverà): stati pratica
   `da_contattare → contattato → appuntamento → vinto|perso` e, per la
   gestione diretta, sottostati pratica `attivata → pic_ok → fatturata →
   liquidata`. Meccaniche: `voucher | rimborsuale | fattura_azienda |
   diretta | sconto_coupon`.

## 11 · Automazioni Recall/Agenda suggerite dai manuali

Le regole operative della catena sono un catalogo di automazioni pronte per
VISTA: verifica busta **2 giorni prima della data promessa**; controllo del
prodotto **entro 24h dall'arrivo**; avviso "pronto per il ritiro" con
**prenotazione slot da 20 minuti** in agenda; solleciti mancato ritiro a
**3 e 10 giorni**; avvio incameramento caparra a **2 mesi** (3 telefonate +
raccomandata); scuse proattive per ritardi critici (>10gg). Ognuna di queste,
per un indipendente, oggi vive nella testa del titolare: metterle in VISTA è
esattamente "il livello ricavi sopra qualunque gestionale".
