*Aggiornato a: v0.5.1 (Fase 4b)*

# Magazzino

## A cosa serve

Il **Magazzino** è il tuo catalogo con le giacenze: cosa hai, quanto ne hai,
cosa hai messo da parte per un cliente. La giacenza non si scrive mai a mano:
cambia solo registrando i movimenti (un carico, uno scarico, una rettifica),
così resta sempre la storia di com'è arrivata a quel numero.

Il modulo ha tre schede in alto: **Prodotti**, **Movimenti**, **Fermi**.

## I gesti di ogni giorno

### Creare un prodotto

1. In **Magazzino**, scheda **Prodotti**, premi **"Nuovo prodotto"**.
2. Scegli il **Tipo**: Lente a contatto, Soluzione, Montatura, **Occhiale da
   sole**, Lente oftalmica, Accessorio o Servizio.
3. Metti **Marca** e **Nome** (il nome è obbligatorio, es. "Acuvue Oasys
   1-Day 30pz").
4. Se vuoi, aggiungi lo **SKU / barcode** (il codice EAN/UPC, uno per
   prodotto) e il **Fornitore**.
5. In base al tipo compaiono i campi dedicati (vedi sotto: LAC, montature e
   occhiali da sole).
6. Imposta **Prezzo (€)** (obbligatorio), eventuale **Costo (€)** e la **Scorta
   minima** (0 = nessun avviso).
7. Premi **"Crea prodotto"**.

La **giacenza non è nel form**: un prodotto nuovo parte da zero e cresce con i
carichi.

### I campi delle lenti a contatto

Quando il tipo è **Lente a contatto** compaiono i campi dedicati: **Raggio
(BC)**, **Diametro (DIA)**, **Confezione** (es. "×6") e il **Ricambio**. Il
ricambio dice ogni quanto la lente va cambiata — **Giornaliere**,
**Quindicinali**, **Mensili**, **Trimestrali** — e serve a VISTA per stimare
quando il cliente sta finendo la scorta, così i Richiami sanno quando
proporlo.

### I campi delle montature e degli occhiali da sole

Per una **Montatura** o un **Occhiale da sole** compili i parametri della
montatura: **Calibro (mm)**, **Ponte (mm)**, **Asta (mm)**, il colore in due
campi (**Colore — codice** e **Colore — nome**) e il **Materiale** (es.
Acetato). Il **calibro** poi lo ritrovi accanto al nome nella lista prodotti e
nella scheda: così distingui a colpo d'occhio due montature uguali di calibro
diverso.

### Caricare la merce da una bolla

Quando arriva un pacco, apri la scheda del prodotto e premi **"Carico da
bolla"**:

1. Scrivi il **N° bolla**.
2. Metti la **Q.tà in bolla** (quella scritta sul documento).
3. Metti la **Q.tà contata** (quella che hai davvero contato aprendo il
   pacco). Se non tocchi questo campo, VISTA la considera uguale alla bolla.
4. Premi **"Registra carico"**.

VISTA registra un **carico** pari alla quantità in bolla. Se il contato è
diverso, aggiunge da solo una **rettifica** con la differenza e la nota
"Differenza da bolla…". Così la giacenza rispecchia quello che hai davvero, e
la discrepanza resta scritta nero su bianco.

### Le rettifiche e gli altri movimenti

Sempre dalla scheda del prodotto:

- **"Rettifica"** — per correggere la giacenza: scegli la direzione (aumenta
  o diminuisci), la quantità e un **motivo** (obbligatorio).
- **"Altro movimento"** — per uno **Scarico**, un **Reso a fornitore**, un
  **Danno / smaltimento** o un **Uso interno**: scegli il tipo, la quantità e
  il riferimento o motivo.

Nella scheda del prodotto vedi sempre tre numeri: **giacenza**, quanto è
**impegnata** (i fermi attivi) e quanto è **disponibile**.

### Mettere da parte per un cliente (i fermi)

Un fermo è la merce "messa da parte": non esce dal magazzino, ma è impegnata
per qualcuno. Dalla scheda del prodotto premi **"Nuovo fermo"**:

1. Cerca e scegli il **cliente**.
2. Metti la **quantità** (non più di quella disponibile) e la **scadenza**
   (proposta a +14 giorni).
3. Premi **"Metti da parte"**.

La giacenza non cambia, ma la disponibile cala. Quando il cliente ritira,
dalla scheda del prodotto (o dalla scheda **Fermi**) premi **"Segna
ritirato"**: solo ora la merce esce con uno scarico. Se il cliente rinuncia,
premi **"Annulla"** e la merce torna disponibile senza movimenti.

### Leggere i movimenti

La scheda **Movimenti** è il libro giornale del magazzino: ogni carico, ogni
scarico, in ordine di tempo, con quantità (verde se entra, rossa se esce),
riferimento e chi lo ha fatto. Non si modifica: si legge. Puoi filtrare per
tipo con le pastiglie in alto.

## Casi particolari

- **Le lenti a contatto colorate senza gradazione.** Le LAC puramente
  estetiche (colorate, di carnevale, senza correzione) **non** vanno create
  come "Lente a contatto": creale come **Accessorio**. Le LAC graduate sono
  dispositivi medici e vanno al 4%; quelle solo estetiche no, vanno al 22% e
  senza dispositivo medico. Creandole come accessorio, in vendita escono
  subito con l'aliquota giusta.
- **Sotto scorta.** Se un prodotto attivo ha una scorta minima e la giacenza
  scende a quel livello o sotto, compare tra i **"Sotto scorta"**: lo vedi nel
  contatore in cima al Magazzino, con il filtro apposito e con un avviso nella
  Dashboard.
- **L'errore si corregge, non si cancella.** Un movimento sbagliato non si
  cancella e non si riscrive: fai una **rettifica** di segno opposto. La storia
  resta tutta e il conto torna giusto. È voluto: il magazzino deve raccontare
  la verità di com'è andata.
- **Disattivare un prodotto.** I prodotti non si eliminano: si **disattivano**
  (dalla modifica, togliendo la spunta "Prodotto attivo"). Sparisce dalle
  ricerche di default e da "Da catalogo", ma resta nei movimenti e lo ritrovi
  col filtro **"Disattivati"**. Puoi disattivarlo anche se ha ancora giacenza
  o fermi: VISTA avvisa, non blocca.
- **Quando la giacenza scende da sola.** La merce esce dal magazzino senza che
  tu scriva niente in due casi: quando consegni un ordine di lenti a contatto
  con righe **"Da catalogo"**, e quando incassi un ordine dalla cassa con
  **"Consegna e incassa"**. In entrambi i casi lo scarico avviene una volta
  sola, con il numero dell'ordine come riferimento (vedi i capitoli Ordini LAC
  e Cassa).

## Se qualcosa non torna

- **"Il nome del prodotto è obbligatorio."** Manca il nome: compilalo.
- **"SKU già in uso su un altro prodotto."** Quel codice è già assegnato:
  controlla di non aver duplicato il prodotto, o usa un altro SKU.
- **"La quantità in bolla dev'essere almeno 1."** / **"La quantità contata non
  può essere negativa."** Correggi i numeri del carico.
- **"La rettifica richiede un motivo."** Scrivi perché stai correggendo.
- **"Disponibili solo N pezzi da fermare."** Stai cercando di mettere da parte
  più merce di quella libera: riduci la quantità.
- **"Fermo già ritirato."** (o annullato) Qualcuno ha già chiuso quel fermo:
  ricarica la pagina.
