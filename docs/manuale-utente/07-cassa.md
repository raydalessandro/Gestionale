*Aggiornato a: v0.5 (Fase 4)*

# Cassa e vendite

## A cosa serve

Qui i soldi diventano dati. La **Cassa** registra le vendite, incassa alla
consegna di buste e ordini, gestisce i resi e le caparre, e a fine giornata ti
fa quadrare i conti. La trovi nella barra come **Cassa**.

Una cosa da tenere a mente da subito: **VISTA non è la stampante fiscale**. Lo
scontrino (il documento commerciale) e la fattura li emette il tuo
registratore telematico, come sempre. VISTA registra la vendita, tiene i suoi
riferimenti e ti aiuta con la quadratura serale. Non parla con la stampante e
non manda niente al Sistema TS: salva solo i dati che servono a te.

## La pagina Cassa

Appena entri vedi la giornata a colpo d'occhio: tre numeri grandi
(**Incasso di oggi**, **Vendite**, **Contanti attesi** nel cassetto), i
**Totali per metodo**, l'elenco delle **Vendite di oggi** e i **Movimenti di
cassa**. In alto i bottoni **"Vendita veloce"**, **"Chiudi la giornata"** e
l'ingranaggio delle impostazioni.

## I gesti di ogni giorno

### La vendita veloce

1. Premi **"Vendita veloce"**.
2. **Cliente** — cercalo e selezionalo, oppure lascia vuoto: la vendita sarà
   "Non associato" (va benissimo per il cliente di passaggio).
3. **Righe** — per ogni cosa che vendi metti la descrizione, la quantità, il
   prezzo e l'eventuale sconto. Scegli l'**aliquota** (IVA 4%, IVA 22%, oppure
   Esente / fuori campo) e, se è un dispositivo medico, spunta **"Dispositivo
   medico (DM)"**. Per aggiungere righe usa **"Aggiungi riga"**; per pescare un
   prodotto dal tuo magazzino usa **"Da catalogo"**: descrizione, prezzo,
   aliquota e DM si compilano da soli.
4. **Pagamenti** — scegli il metodo e l'importo. Puoi spezzare l'incasso su più
   metodi con **"Aggiungi"**. Sui **contanti** puoi scrivere quanto ti ha
   **Consegnato** il cliente: VISTA ti mostra il **resto** (ma salva sempre
   l'importo dovuto, non il consegnato).
5. La somma dei pagamenti deve fare esattamente il totale: sotto vedi
   "Pagato X su Y" che diventa verde e dice **"quadra"** quando torna. Finché
   non quadra, il bottone di salvataggio resta spento.
6. Se ti serve, apri **"+ Documento fiscale e opzioni"** per scrivere il
   **N° documento (RT)**, la data, il numero di fattura o il codice fiscale del
   cliente. Premi **"Registra vendita"**.

### Le aliquote, in breve

VISTA propone l'aliquota giusta in base al tipo di prodotto (lenti e lenti a
contatto al 4% con DM, montature e soluzioni al 22%, i servizi al 22%), ma
resta sempre modificabile a mano. Sul dettaglio della vendita, accanto al
totale, leggi **"di cui IVA"**: conta solo le righe al 4% e al 22%, non le
esenti.

### Consegnare e incassare un ordine

Quando il modulo Cassa è attivo, sulla busta **pronta** (o sull'ordine LAC
**arrivato**) il bottone di consegna diventa **"Consegna e incassa"**. Ti porta
alla vendita con le righe già composte:

- per una **busta**: montatura, lenti e — se valorizzata — la garanzia, con le
  aliquote giuste (un occhiale completo va tutto al 4%, perché il prodotto
  finito è l'ausilio);
- per un **ordine LAC**: le righe dell'ordine con i loro prodotti.

Il punto importante: **la vendita è per l'intero valore**, non per il saldo. La
caparra già versata entra come un pagamento chiamato **"Caparra"**, già
compilato con l'acconto. Tu aggiungi il pagamento del resto (per esempio
Mastercard) fino a far quadrare il totale, e premi **"Consegna e incassa"**.
In un colpo solo VISTA crea la vendita, segna l'ordine consegnato e scarica il
magazzino una volta sola. Lo scontrino che batti alla stampante è per il totale
pieno; la caparra vi compare come importo già coperto.

### I movimenti di cassa

Nel riquadro **Movimenti di cassa** premi **"Registra movimento"** per segnare
un prelievo dal cassetto, una spesa di negozio, un versamento in cassaforte o
in banca. Servono l'importo e un **motivo** (obbligatorio). I movimenti non si
modificano e non si cancellano: se sbagli, registri un movimento contrario.

### Annullare una vendita

Dal dettaglio di una vendita ancora **emessa** premi **"Annulla vendita"**,
scrivi il **motivo** e conferma con **"Conferma annullo"**. Il magazzino torna
indietro in automatico. Attenzione: se la vendita era legata a un ordine,
l'ordine **resta consegnato** — l'annullo della vendita non lo riporta
indietro. Gestisci l'eventuale reso a parte.

### Registrare un reso

Sempre dal dettaglio della vendita, premi **"Registra reso"**:

1. Scegli il tipo: **"Reso con rimborso (denaro)"** se restituisci soldi,
   **"Reso gestionale (nessun rimborso)"** se è solo una sistemazione.
2. Scegli la **Causale** (Soddisfatti o rimborsati, Errore di check-up, Errore
   ricetta esterna, Mancato adattamento progressive, Modifica dell'ordine,
   Insoddisfazione estetica, Insoddisfazione funzionalità, Difetto di
   fabbricazione) e l'**importo**.
3. Se è un reso con rimborso, scegli il **metodo di rimborso**: entra nella
   quadratura di sera.
4. Spunta le **righe che rientrano a magazzino**: quelle tornano in giacenza
   con un carico di rientro.
5. Metti numero e data del documento di reso, premi **"Registra reso"**.

Il reso è un documento suo (numero tipo `RE-…`): la vendita resta emessa, col
reso collegato sotto. Tutti i resi si ritrovano in **Cassa → Resi**; da lì con
**"Nuovo reso"** registri anche il reso di una vendita fatta prima di VISTA
(serve il numero e la data del documento d'origine).

## Le caparre

### Incamerare una caparra

Se un cliente non ritira mai l'ordine, sulla busta (non consegnata, con un
acconto) trovi **"Incamera caparra"**. La conferma ti ricorda la trafila: due
mesi dalla data promessa e tentativi di avviso documentati — il software ti
avvisa, non ti blocca. Premi **"Conferma incameramento"**: parte un movimento
di cassa dedicato, la busta passa ad **annullata** con nota, e la ricevuta
caparra resta ristampabile con la clausola dei due mesi.

### Restituire una caparra

Se invece il cliente rinuncia e vuoi rendergli l'acconto, sulla stessa busta
c'è **"Annulla e restituisci caparra"**: scegli la causale e il metodo con cui
rimborsi, poi **"Restituisci e annulla"**. VISTA crea un reso in denaro e
annulla la busta, tutto insieme. Restituisci **solo quanto è stato davvero
incassato**: se una parte della caparra non era mai stata versata, quella non
genera nessun movimento.

### I documenti da stampare

- **"Ricevuta caparra"** — dalla scheda della busta con un acconto. È un
  documento gestionale (non fiscale): elenca l'ordine a valore pieno, la
  caparra versata, quanto resta "in attesa di pagamento" e il testo legale
  della caparra confirmatoria con la clausola dei due mesi.
- **"Quietanza"** — dal dettaglio di un reso di restituzione caparra. Stampa
  due copie: quella per il cliente col testo di quietanza e la firma, e quella
  per il negozio con la doppia firma (cliente e dipendente).

## La chiusura della giornata

A fine giornata premi **"Chiudi la giornata"**. C'è una chiusura sola per
giorno. Sono quattro blocchi, con i valori di sistema già calcolati:

1. **Conta per metodo** — per ogni metodo usato oggi VISTA mostra il totale di
   sistema; tu scrivi il **dichiarato** (quello che hai contato davvero) e vedi
   la **differenza** colorata: verde se torna, ambra fino a 5 centesimi (sono
   arrotondamenti, si tollerano), rossa oltre. Sui contanti conti tutto il
   cassetto, **fondo compreso**. Se lo scarto supera i 5 centesimi, VISTA ti
   chiede una **causale**: senza, non chiude.
2. **Confronto col registratore (Z)** — scrivi il **N° azzeramento Z** e, per
   ogni aliquota (4%, 22%, esente), il totale letto dallo scontrino di
   chiusura. A fianco vedi il totale di sistema e la differenza. (Il dato lo
   trovi sul Z report, sezione IVA–Nature.)
3. **Cassaforte** — **Fondo apertura** (già proposto da ieri), **Contanti
   contati** e **Fondo che resta** nel cassetto. VISTA calcola il **Versamento**
   e ti mostra il **saldo della cassaforte** dopo il versamento.
4. **Caparre del giorno** — i contatori (emesse, scalate, incamerate) e uno
   spazio per le **Note**.

Premi **"Chiudi la giornata"**: VISTA rifà tutti i conti da solo (i valori di
sistema del blocco 1 e 2 li ricalcola, non si fida di quelli mostrati) e salva.
Le chiusure passate si consultano in **Cassa → Chiusure**.

## Le impostazioni: i metodi di pagamento

Dall'ingranaggio in alto arrivi a **Metodi di pagamento**. La prima volta, se
non ne hai, premi **"Crea i metodi di base"**: Contanti, Bancomat, Mastercard,
Visa, Bonifico, Gift Card, Assicurazione e **Caparra**. Poi con **"Nuovo
metodo"** ne aggiungi altri.

Ogni metodo si può attivare o disattivare (mai cancellare) e ordinare; la
spunta **"tracciabile"** distingue i pagamenti tracciati (utile alla
detraibilità): solo i contanti non lo sono. Il metodo **Caparra** fa eccezione:
serve al flusso di consegna e non si può disattivare né togliere.

## Casi particolari

- **Vendita anonima.** Lasciare il cliente vuoto è legittimo: esce come
  "Non associato". Il codice fiscale e l'opposizione al Sistema TS li scrivi
  solo quando servono (fattura, rimborsi), e comunque VISTA non trasmette
  niente da sola.
- **Il riallineamento dopo un guasto.** Se la cassa era in blocco e hai emesso
  un documento a mano, apri **"+ Documento fiscale e opzioni"** e spunta
  **"Vendita di riallineamento (emergenza)"**: è l'unico modo per datare una
  vendita nel passato, e richiede numero e data del documento emesso a mano. La
  vendita comparirà nella giornata giusta, non in quella di oggi.
- **Doppio incasso.** Non puoi incassare due volte lo stesso ordine: se ci
  provi, VISTA te lo dice.
- **Consegna senza cassa.** Se il modulo Cassa non è attivo, la consegna di
  buste e ordini funziona esattamente come prima: il bottone resta "Consegna",
  senza passare dalla vendita.

## Se qualcosa non torna

- **"I pagamenti (X) non coprono il totale (Y)."** La somma dei pagamenti non
  fa il totale: aggiusta gli importi finché scrive "quadra".
- **"Aggiungi almeno una riga."** / **"Ogni riga deve avere una descrizione."**
  / **"Quantità non valida."** / **"Prezzo non valido."** Sistema la riga
  segnalata.
- **"Il riallineamento richiede numero e data del documento."** Hai acceso il
  riallineamento senza compilare il documento emesso a mano.
- **"Questo ordine ha già una vendita."** L'ordine è già stato incassato: non
  si incassa due volte.
- **"La busta non è pronta (stato …)."** / **"L'ordine non è arrivato
  (stato …)."** / **"Consegna non riuscita: l'ordine è cambiato di stato,
  riprova."** Lo stato dell'ordine è cambiato nel frattempo: ricarica la scheda.
- **"La vendita è già annullata."** / **"Indica un motivo per l'annullo."**
  L'annullo vuole un motivo, e non si annulla due volte.
- **"Scegli una causale."** / **"L'importo del reso dev'essere positivo."** /
  **"Indica il metodo con cui rimborsi."** / **"Per un reso di vendita esterna
  servono numero e data del documento d'origine."** Completa il reso coi campi
  mancanti.
- **"Busta già consegnata: non si incamera."** / **"Caparra già incamerata."**
  / **"Non c'è caparra da incamerare."** L'incameramento vale solo su una busta
  non consegnata con un acconto ancora aperto.
- **"Il motivo è obbligatorio."** / **"L'importo dev'essere positivo."** Un
  movimento di cassa vuole sempre importo e motivo.
- **"Serve una causale per lo scarto su "…" (… €)."** In chiusura, uno scarto
  oltre i 5 centesimi va spiegato con una causale.
- **"La giornata di oggi è già stata chiusa."** Esiste già una chiusura per
  oggi: la trovi con "Chiusura di oggi ✓".
- **"Serve il nome del metodo."** / **"Esiste già un metodo con questo nome."**
  Nel creare un metodo di pagamento serve un nome, e dev'essere diverso dagli
  altri.
