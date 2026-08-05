# AR-01 · I tre canali e i ponti — il banco prepara, i confini eseguono

*Decisa il 29/07/2026, distillata dall'esperienza decennale di Ray sul
modello di catena. È la mappa che viene prima dei moduli: ogni spec
dell'Era 1 dichiara in quale canale vive e quali ponti attraversa.*

## La mappa, per controparte

| Canale | Controparte | Natura dei fatti | Nella grammatica |
|---|---|---|---|
| **Magazzino** | negozio ↔ **fornitore** | movimenti di MERCE (carichi, scarichi, resi a fornitore, rettifiche, rottamazioni) | FATTI di merce |
| **Banco** (gestionale generale) | il negozio **con sé stesso** | **prepara, non muove**: ordini, buste, prescrizioni, agenda, accordi | STATO GUIDATO + ANAGRAFE |
| **Cassa** | negozio ↔ **cliente** | movimenti di DENARO e DOCUMENTI (vendite, caparre, resi cliente, chiusure) | FATTI di denaro |

**La legge del banco**: il gestionale generale tendenzialmente non
esegue movimenti — li prepara. La busta è un accordo che matura; la
merce esce e il denaro entra solo quando l'accordo attraversa un ponte.

**Postilla di visione (29/07, dal racconto M1)**: il banco si costellerà
di PWA sottili e QR sopra le STESSE primitive — «il gestionale lo apre
poco l'ottico». Il DB e le azioni sono il prodotto; le superfici sono
molte e leggere (pattern già provato con l'MCP operatore).

## I ponti sanzionati (gli unici passaggi tra canali)

1. **Consegna e incassa** (banco → cassa): l'accordo diventa documento,
   il saldo entra. In catena è il click «consegna» che ti porta di là:
   l'unico varco nel muro.
2. **Consegna → scarico** (banco → magazzino): la merce preparata esce,
   sempre via movimenti (mai a mano).
3. **La caparra** vive già nel canale fiscale: lo scontrino la riporta,
   l'incamero è incasso. Il GESTO resta nel form busta (4c); il canale
   sotto diventerà MF.
4. **I resi sono DUE gesti, non uno**: il reso CLIENTE è cassa (il
   cliente riporta, esce documento); il reso a FORNITORE è magazzino
   (il negozio rende, niente scontrino). Quando la stessa scatola
   difettosa li attraversa entrambi, sono comunque due fatti in due
   canali — vedi «la catena del difettoso» qui sotto.

## Gli sconti: due canali, una tassonomia

- **Sconto-accordo** (banco): il prezzo pattuito col cliente in fase di
  vendita/ordine. I codici sono NUMERICI, per offerta/prodotto/campagna,
  quasi-permanenti (durano anni), e sono soprattutto **classificatori
  della vendita** — pacchetti, convenzioni, assicurazioni, discrezionali:
  la catena li usa per i KPI perché il codice dice *che tipo di vendita
  è*. Grammatica: REGISTRO di codici + ISTANTANEA sulla riga.
- **Sconto-di-cassa**: allineamenti di prezzo durante i movimenti di
  cassa, vive sul documento.
- **Universali**: per definizione (errore prezzo, sconto speciale),
  validi in entrambi i mondi.
- **Destinazione**: il registro dei codici si disegna INSIEME alle
  convenzioni/assicurazioni (discorso unico, come indicato da Ray) —
  spec M8 per il meccanismo, modulo convenzioni per la tassonomia
  completa, M9 per i KPI che la leggono.

## Le regole della cassa

- **Tutto ciò che la cassa scrive esce in documento** dalla stampante
  fiscale (vendita, caparra, reso: comunque finisci, esci sullo
  scontrino). Le eccezioni esatte (prelievi, spese, la chiusura stessa)
  si acclarano nella spec M8 — la regola si scolpisce lì nella sua forma
  definitiva.
- **Chiunque sta in cassa**: il muro di catena non è un ruolo, è il
  perimetro del canale. Il nostro confine è architetturale (modulo), non
  di sessione: niente logout-teatro da replicare.
- Stranezze: vedi lo **Schedario del non-copiare** in fondo.
- (spostata nello schedario) il reso per-riga
  obbligatorio (una confezione LAC = un reso; scontrino mai reso intero,
  salvo l'ordine di lavorazione). Il core tiene la granularità flessibile
  (i fatti per riga ci sono già); se è un vincolo della stampante, lo
  imporrà MF all'emissione — non il core.

## La catena del difettoso — opportunità di prodotto

Occhiale venduto → difettoso → il cliente lo riporta (reso cassa) → il
negozio lo rende (reso fornitore): in catena questa sequenza costa «ore
di riflessione e chiamate ai colleghi» per azzeccare i movimenti di
giacenza. limpidia la fa diventare **un gesto guidato** che orchestra i
due canali nell'ordine giusto e mostra le giacenze prima/dopo. Conto
aperto in lista unica → spec M3 + M8 (intreccio dichiarato).

## Schedario delle stranezze di catena (il non-copiare)

Pezze del loro software che NON diventano nostro design:
1. **Email fittizia aziendale** (e varianti improvvisate dagli
   operatori): pezza per un sistema che non regge il senza-email. Da
   noi il vuoto è legittimo (M1); nessun import dei loro dati, quindi
   nessuna normalizzazione da prevedere.
2. **Reso per-riga obbligatorio** (una confezione = un reso): se è un
   vincolo della stampante lo imporrà MF all'emissione; il core tiene la
   granularità flessibile.
3. **Scontrino a 0 per contare le prescrizioni** (e attribuire i
   check-up a chi era loggato in cassa, non a chi ha visitato): pezza
   per un software che conta solo coi documenti. Da noi il FATTO è il
   conteggio: la Rx registra l'esaminatore, i KPI leggono quello (M2).
4. **Ricerca LAC per diametro+raggio** («due parametri che quasi
   nessuno conosce»): chiavi da fornitore portate al banco. Da noi la
   ricerca è umana — famiglia, marca, filtri — e i listini si
   ingeriscono via AI (M2→M3/M5).
5. **Cliente sintetico «Non,Associato»**: in catena un cliente
   finto con nome umano che inquina anagrafiche e report. Da noi
   (DEFINITIVO 04/08 sera, spec M8): NIENTE anagrafica, nemmeno di
   sistema — le vendite veloci sono VENDITE SEMPLICI della giornata
   con cliente vuoto, elencate per giorno, e la funzione nativa
   «recupera e associa» (per scontrino o data) le aggancia DOPO a una
   scheda vera. La loro mancanza è la nostra funzione.

## Il rapporto con FI-01

Questa mappa CONFERMA il modulo di confine: la catena stessa vive con
una cassa segregata la cui unica uscita è il documento. La differenza
nostra: in catena cassa ed emissione sono fuse; noi teniamo M8
(registrare i fatti) separato da MF (emettere) — vedi l'addendum in
FI-01 sullo scontrino in tempo reale.
