# Dominio cassa — anatomia dei documenti reali

Distillato da 17 fotografie di documenti veri usciti dalla cassa fiscale di
un negozio di catena (luglio 2026): fatture, documenti commerciali, ricevute
caparra, report di chiusura, Z report, chiusura POS, menù comandi del
registratore. È la **fonte primaria della Fase 4**: dove questo documento
parla, la spec obbedisce.

---

## 1 · Documento commerciale (lo "scontrino" RT)

Struttura osservata:
- Testata: insegna, ragione sociale, indirizzo, P.IVA.
- **Righe**: descrizione articolo (+ codice UPC/EAN sotto) · aliquota IVA ·
  prezzo. **Gli sconti e le promo sono righe negative** agganciate
  all'articolo, col codice promo nella descrizione (es. `1848-INVITO ALLA
  PREVENZIONE −100,00`, `6686-3+1 LAC DAILY −17,00`). Le righe LAC sono
  **per occhio** (`[OD Lenti a contatto]` / `[OS …]`).
- Ogni riga di dispositivo medico è marcata **`DM (*)`**, con legenda a piè:
  "(*) Dispositivo medico con marcatura CE" → è il gancio del codice spesa
  **AD** per il Sistema TS.
- Aliquote osservate sul campo: occhiale completo (montatura, lenti,
  `Mounting` cioè montaggio) → **4%** riga per riga; sole non graduato →
  **22%**; soluzione LAC → **22% ma con flag DM** (dispositivo medico E
  aliquota ordinaria: i due piani sono indipendenti); **polizza
  assicurativa (ERGO/Otticare) → natura `EE = Esclusa`** (fuori campo IVA:
  operazione assicurativa) — NON 22%.
- Totali: `TOTALE COMPLESSIVO` · `di cui IVA` · pagamenti · `Resto` (il
  contante gestisce il resto: pagato 60, resto 10, importo 50).
- **`Sconto a pagare`**: è così che l'RT rappresenta gli importi già coperti
  prima (caparra versata, credito abbonamento, gift card): riducono il
  pagato di oggi senza essere un incasso odierno. Nel "Dettaglio forme di
  pagamento" compaiono comunque con la loro etichetta (es. `&TE vista 2.0
  780,00` + `Mastercard 185,00`).
- **`C.F. Cliente`** stampato sul documento quando serve (Sistema TS).
- Identificativi: `DOCUMENTO N. 1405-0006` = **azzeramento(Z)-progressivo**
  del giorno, + matricola RT (`99IEC011227`), data/ora, negozio, cassa,
  **venditore e cassiere distinti**, cliente (o **"Non Associato"** per la
  vendita veloce anonima).
- Edge visti dal vero: `CANALE: Mastercard * MODALITÀ OFFLINE *` (POS
  offline), `Mastercard (non integ.)` (POS non integrato, digitazione
  manuale), lotteria scontrini non disponibile per errore server AdE,
  contributo CONAI in calce, ristampa da DGFE che produce a sua volta un
  numero documento.

## 2 · Fattura

- Emessa **contestualmente al documento commerciale e lo referenzia**
  (`Documento commerciale: 0006/99IEC011227` = doc n./matricola RT).
- Cliente con **Codice Identificativo `0000000`** (SDI privati) + CF.
- **Porta i dati della prescrizione** in testata (OD/OS: sfera, cilindro,
  asse, addizione, prisma): è la "fattura parlante" che serve ai rimborsi
  dei fondi. → La nostra fattura/il nostro documento di consegna deve poter
  incorporare la Rx.
- Righe con: ID articolo, prezzo unitario, quantità, **importo sconto**,
  aliquota, importo imposta, importo — e flag `(*DM)`.
- Riepilogo finale **per aliquota** (imponibile, imposta, totale) +
  pagamenti (`Mastercard` + `Caparra`) + `Totale finale`.
- Doppia numerazione: numero transazione (progressivo di cassa) e numero
  documento strutturato `AAAA + negozio + progressivo` (es.
  `2026·14971·00648`).

## 3 · Ricevuta caparra (documento gestionale NON fiscale)

- Intestata all'ordine: **"Ordine per: <cliente>" + `Sales Order`**
  (il numero del WO/busta).
- Elenca **tutte le righe dell'ordine a valore pieno** (con promo come righe
  negative), poi: `Totale` dell'ordine · pagamento della caparra (metodo
  reale: carta/contanti) · **`In attesa di pagamento`** = totale − caparra.
- **Il testo legale stampato** (da riprodurre nel nostro modulo):
  ricevuta dell'importo *"a titolo di caparra confirmatoria ai sensi
  dell'art. 1385 c.c., non soggetto a IVA ai sensi dell'art. 2 DPR
  633/1972 (R.M. 19/5/1977 n. 411673)"*; clausola: *"trascorsi due mesi
  dalla data di emissione senza che gli occhiali siano stati ritirati, la
  caparra versata verrà trattenuta"*; nota: *"la marca da bollo, se dovuta,
  è applicata sulla copia del cliente"* (ricevute non fiscali sopra
  ~€77,47 → bollo €2). "Copia del Cliente" in calce, tipo transazione
  "Vendita", conteggio articoli.

## 3-bis · Documento di reso / storno (Modifica WO con caparra restituita)

Dalle foto del 13/07 (copia negozio termica firmata + copia cliente, che di
norma esce su A4 con lo stesso contenuto):

- Stessa testata delle vendite, con banner RISTAMPA; "Ordine per: <cliente>"
  + `Sales Order` (il WO).
- **Righe speculari alla vendita, in negativo**: prezzo pieno −370,00 →
  importo −260,28 (netto sconto), con la promo stornata come **riga
  positiva** (`23226-OC RB M SUPERIOR BLU +109,72`): lo storno rifà la
  vendita al contrario, sconti compresi. Causale in chiaro su ogni riga
  ("Modifica WO"), tag `[LENS]`/`[FRAME]`/`[ERGO_WARRANTY]`, specifiche
  lente elencate.
- Ogni riga porta un blocco **`Rientro`** — Negozio · Data · Scontrino ·
  Cassa — che punta al documento d'ORIGINE, riga per riga.
- Totali: `Totale −414,00` · **`In attesa di pagamento −214,00`**
  (annullamento contabile del residuo mai incassato, col Sales Order) ·
  **`Contanti −200,00`** (rimborso di ciò che era stato davvero versato:
  la caparra) · `Resto 0,00`. **Il rimborso segue i soldi veri.**
- `CALCOLO ART. RESI = 3`.
- **Copia Negozio**: DUE firme (Firma Cliente · Firma Dipendente), resta in
  negozio. **Copia del Cliente**: testo di **quietanza** — "DICHIARO di
  ricevere dalla società <ragione sociale> … la restituzione della caparra
  rilasciata in questo negozio" — con **Firma per quietanza**.
- La ristampa genera propri numeri documento (serie del giorno).

## 4 · Report "Vendite giornaliere e cassa" (3 pagine — il modello della chiusura)

**Pag. 1 — Riepilogo**: Vendite (lorde sconti) · Resi · **Ribassi**
(negativi) · TotalTax → Totale; poi per modalità: Vendite/Rimborsi/
Incassato/Prelevato; conteggi transazioni e annulli. (Nota di realtà: il
totale documenti e il totale pagamenti differivano di 3 centesimi —
**gli arrotondamenti esistono**, il software deve tollerarli e mostrarli.)

**Pag. 2 — il cuore**:
- **Confronto Totali per aliquota**: per ciascuna aliquota (Ridotta 4% /
  Standard 22%): Totale **Stampante** (dal Z) vs Totale **Cassetto**
  (gestionale) lordo e netto, imposta, e colonna **Differenza
  Stampante/Cassetto** che deve fare 0,00.
- **Caparra — quattro contatori del giorno**: `Emesse` · `Scontate`
  (applicate a vendite) · `Rese` (restituite) · `Incamerate`.
- **Modalità di pagamento a due livelli**: Tipo (Carte di Credito/Debito ·
  Contanti · Varie) → Descrizione (**per circuito**: Bancomat, Mastercard,
  Visa; Gift Card; **"In attesa di pagamento"** come pseudo-metodo). Il
  totale di questa tabella = vendite + caparre emesse + attese: è
  l'equazione di quadratura in numeri.
- **Riepilogo Conteggio**: per ogni metodo, `Somma Dichiarata` (contata) vs
  `Somma Sistema` vs `Eccedente/Mancante`. I contanti dichiarati includono
  il **fondo cassa (€300)**.

**Pag. 3 — Deposito Cassaforte**: fondo cassa in apertura · deposito
manuale · totale contanti nel cassetto · **fondo cassa in chiusura** ·
**deposito in cassaforte** (= contanti − fondo) · **TOTALE CONTANTE IN
CASSAFORTE** (saldo progressivo della cassaforte!).

## 5 · Z report del registratore (chiusura giornaliera RT)

Totale giorno vendite/omaggi/resi/annullamenti + **gran totali storici**
progressivi; sezione **IVA–Nature** per aliquota (ammontare, imposta,
corrispettivo) — è la controparte del "Confronto Totali"; totali per
`PAGATO CONTANTI` / `PAGATO ELETTRONICO` / **`SCONTO A PAGARE`** (le
coperture: gift card, caparre, crediti); **`NUMERO AZZERAMENTI`** (il
progressivo Z che compone il numero documento); documenti da inviare/oltre
3 giorni; stato memoria fiscale e DGFE; esito **trasmissione telematica
corrispettivi** con ricevuta dedicata (`ESITO OK`). Il POS produce la sua
**chiusura per circuito** (Mastercard/Visa/Bancomat, `TOTALE POS = TOTALE
HOST`): è il pezzo che alimenta il "dichiarato" delle carte.

## 6 · Comandi del registratore visti dal gestionale

Dal menù "Stampante fiscale" del sistema di catena: Stampa X Report ·
Stampa Z Report · Controlli validità lotteria · Reimposta stampante ·
Sincronizza ora · **Sincronizza aliquote IVA** · **Comparazione aliquote** ·
Imposta testata/logo · Apri/Chiudi cassetto · **Annulla scontrino fiscale**;
più "Ristampa ultima fattura o **nota di accredito**" e una **Modalità
Training**. → Non è il perimetro della Fase 4 (noi registriamo e quadriamo,
non pilotiamo l'RT), ma è il vocabolario dell'eventuale integrazione futura.

## 7 · Cosa ne discende per VISTA (decisioni vincolanti)

1. **VISTA non è la stampante fiscale.** In Fase 4 il gestionale registra la
   vendita coi riferimenti del documento emesso dall'RT (numero Z-progr.,
   data) e fa la quadratura; l'RT resta sovrano del fiscale.
2. **Aliquota per riga** con tre valori: `4` · `22` · `esente` (polizze).
   **Flag DM per riga** (→ codice spesa AD del Sistema TS in fase fiscale).
3. **Sconti come importo di riga** (il documento li mostra come righe
   negative; noi li teniamo sul rigo, la stampa li esplode).
4. **La caparra al saldo è un metodo di pagamento** ("Sconto a pagare" lato
   RT): la vendita di consegna è per l'INTERO valore, coi pagamenti
   `Caparra` + metodi odierni.
5. **La chiusura ha quattro blocchi**: conteggio per metodo (dichiarato vs
   sistema, per circuito), confronto per aliquota col Z, contatori caparre,
   cassaforte (fondo/versamento/saldo progressivo). Gli squadri si
   dichiarano con causale; gli arrotondamenti da centesimi si tollerano e
   si vedono.
6. **CF cliente e "Non Associato"** convivono: vendita veloce anonima
   legittima, CF quando serve TS/fattura.
7. **Il reso di un ordine con caparra** storna l'intero valore ma rimborsa
   SOLO l'incassato (col suo metodo reale); il residuo mai versato si
   chiude come "in attesa", senza movimenti di denaro. Il nostro stampato:
   quietanza di restituzione sulla copia cliente, doppia firma su quella
   del negozio.
