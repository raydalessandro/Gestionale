*Aggiornato a: v0.5.1 (Fase 4b)*

# Agenda e Richiami

## A cosa serve

Qui il gestionale smette di registrare e comincia a farti succedere le cose.
L'**Agenda** tiene gli appuntamenti del giorno: controlli della vista,
consegne, ritiri, prime applicazioni di lenti a contatto. I **Richiami** sono
la coda dei clienti da chiamare al momento giusto: la busta pronta che non
ritirano, le lenti a contatto che stanno per finire, la misura in scadenza.

Sono due moduli distinti nella barra: **Agenda** e **Richiami**.

---

# Agenda

## I gesti di ogni giorno

### Guardare la giornata

Apri **Agenda**: vedi il giorno di oggi con tutti gli appuntamenti in ordine
d'orario. Ogni riga mostra l'ora d'inizio e di fine, il tipo, il cliente (o
"Impegno interno" se non è collegato a nessuno), con chi è l'appuntamento e il
riferimento (numero busta o ordine, se c'è).

Per spostarti nei giorni usa le frecce **←** e **→** in alto; il bottone
**"Oggi"** ti riporta al giorno corrente.

### Fissare un appuntamento

1. Premi **"Nuovo appuntamento"**.
2. **Cliente** — cercalo per nome o cognome e selezionalo. È facoltativo:
   senza cliente stai segnando un impegno interno (una riunione, una consegna
   del fornitore).
3. **Tipo** — scegli tra Controllo vista, Consegna, Ritiro LAC, Prima
   applicazione LAC, Altro.
4. **Con chi** — chi in negozio segue l'appuntamento (di default sei tu).
5. **Giorno** e **Ora**. La **Durata** è di 20 minuti, ma la cambi a passi di
   5 (da 5 a 240).
6. Se vuoi, aggiungi un **Riferimento** (il numero di una busta o di un
   ordine) e delle **Note**. Premi **"Salva appuntamento"**.

### Chiudere un appuntamento

Sugli appuntamenti ancora **"Prenotato"** hai tre bottoni:

- **"Completato"** — il cliente è venuto e l'avete fatto.
- **"Non presentato"** — non si è presentato. Il no-show è un dato, resta
  scritto (badge ambra), e in fondo alla giornata trovi il contatore
  "N completati · N non presentati".
- **"Annulla"** — l'appuntamento salta.

Una volta chiuso, l'appuntamento non ha più azioni: è la sua storia.

## Casi particolari

- **Due appuntamenti sovrapposti.** Più persone lavorano in parallelo, quindi
  VISTA non ti blocca. Ma se **la stessa persona** ha due appuntamenti che si
  accavallano, accanto compare un pallino ambra con la scritta "Si sovrappone":
  un avviso, non un divieto.
- **Fissa ritiro dagli ordini.** Quando una busta è **pronta** o un ordine di
  lenti a contatto è **arrivato**, nella scheda dell'ordine trovi **"Fissa
  ritiro"**. Ti porta al nuovo appuntamento già compilato: cliente, tipo
  (Consegna per le buste, Ritiro LAC per le lenti) e numero dell'ordine nel
  riferimento. Ti resta solo da scegliere giorno e ora.
- **Giornata libera.** Se non c'è niente, la pagina lo dice e ti offre subito
  **"Nuovo appuntamento"**.

## Se qualcosa non torna

- **"Servono data e ora."** / **"Data o ora non valide."** Compila entrambi i
  campi con valori validi.
- **"La durata dev'essere tra 5 e 240 minuti."** Correggi la durata.
- **"Nessuna azione: appuntamento completato / mancato / annullato."** Hai
  provato a chiudere un appuntamento già chiuso. Ricarica la pagina: i bottoni
  compaiono solo su quelli ancora prenotati.
- **"Appuntamento non salvato: …"** Qualcosa è andato storto nel salvataggio:
  riprova.

---

# Richiami

## A cosa serve

La coda che porta i clienti in negozio. Aprendo **Richiami** trovi tre
sezioni: cosa devi fare oggi, cosa il negozio ti propone da solo guardando i
dati, e lo storico di quello che hai già lavorato.

VISTA non manda messaggi al posto tuo. Prepara la telefonata e il messaggio
WhatsApp già scritto: tu controlli e invii.

## I gesti di ogni giorno

### La coda "Da fare"

In cima c'è **"Da fare"**: i richiami che hai messo in programma per oggi o per
i giorni passati. Ogni riga mostra il tipo, il cliente col telefono, il
riferimento e — dove ha senso — il valore in gioco (per esempio il saldo di una
busta pronta). Se un richiamo è in ritardo, lo vedi segnato "scaduto da N gg".

I richiami dei prossimi sette giorni compaiono sotto, nel sottogruppo
**"In arrivo (entro 7 giorni)"**.

Per lavorare un richiamo:

- Premi **"Chiama"** per aprire il telefono, o **"WhatsApp"** per aprire una
  chat con un messaggio già pronto (diverso per ogni motivo).
- Poi premi **"Registra esito"**: scegli il **Canale** (Telefono, WhatsApp,
  SMS, Email, Di persona) e l'**Esito** (Appuntamento fissato, Da richiamare,
  Non risponde, Non interessato, Gestito). Se il cliente ha un **canale
  preferito** nella sua scheda, il Canale è già proposto su quello, così non
  devi ricordartelo. Se c'è un valore te lo trova già compilato, e puoi
  aggiungere una nota. Premi **"Salva esito"**.

Se scegli esito **"Appuntamento fissato"**, dopo il salvataggio VISTA ti porta
in agenda già compilata, pronto a fissare l'orario.

### Le "Proposte dal negozio"

Sotto la coda, VISTA calcola da solo — guardando i tuoi dati in questo
momento, senza nessuna procedura da avviare — chi vale la pena richiamare.
Ci sono cinque motivi:

1. **Sollecito ritiro** — una busta pronta (o un ordine LAC arrivato) che il
   cliente non ha ancora ritirato, non avvisato o avvisato da più di 3 giorni.
   Come valore mostra il saldo da incassare.
2. **Promessa in ritardo** — una busta ancora in lavorazione o arrivata, la
   cui data promessa è già passata: è il momento di avvisare il cliente.
3. **LAC in esaurimento** — un cliente a cui hai consegnato lenti a contatto
   circa 70-100 giorni fa e che non ha riordinato: probabilmente sta finendo
   la scorta.
4. **Controllo vista in scadenza** — una prescrizione attiva che scade entro
   30 giorni (o appena scaduta), per un cliente che non ha già un controllo
   fissato.
5. **Fermo in scadenza** — un articolo messo da parte per un cliente che sta
   per scadere.

Ogni proposta ha due bottoni:

- **"Registra esito"** — se chiami subito: registra in un colpo solo la
  telefonata e il suo esito, creando il richiamo già lavorato.
- **"Pianifica"** — se vuoi rimandare: scegli il giorno in **"Da fare il"** e
  premi **"Metti in coda"**. Il richiamo finisce nella coda "Da fare".

### Un richiamo a mano

Premi **"Nuovo richiamo"** in alto: scegli il cliente, il tipo (di default
"Richiamo"), il giorno, un riferimento e una nota. Premi **"Crea richiamo"**.

### Lo "Storico"

In fondo trovi gli ultimi richiami lavorati: quando, tipo, cliente, canale,
esito, valore e chi li ha fatti. È in sola lettura: la storia dei tentativi
resta tutta.

## Casi particolari

- **Chi non vuole essere disturbato resta fuori dalle offerte.** Sollecito
  ritiro, Promessa in ritardo e Fermo in scadenza sono contatti operativi: il
  cliente aspetta la sua merce, quindi te li proponiamo sempre. **LAC in
  esaurimento** e **Controllo vista** sono invece contatti commerciali:
  compaiono **solo** per i clienti che hanno dato il consenso marketing e che
  non hanno la spunta **"Non contattare per promozioni"**. Se qualcuno resta
  escluso, in testa alla sezione leggi una riga sobria che conta le proposte
  commerciali nascoste. Togli o rimetti il consenso (o la spunta "Non
  contattare") dalla scheda cliente e le proposte spariscono o ricompaiono.
- **Il badge "Non contattare" sulle proposte operative.** Un cliente con "Non
  contattare" resta comunque tra le proposte operative (aspetta la sua merce),
  ma accanto vedi il segnalino "Non contattare": ti ricorda di tenere la
  telefonata sul pezzo, senza infilarci offerte.
- **Richiamare non è fallire.** Se registri esito "Da richiamare", il tentativo
  resta nello storico e ti compare sotto un bottone **"Ripianifica"**: premilo,
  ti propone già la data fra tre giorni (puoi cambiarla) e con un clic rimette
  quel cliente in coda. Nasce un nuovo richiamo, con lo stesso riferimento e
  valore di quello vecchio; la riga di oggi non si tocca, resta nello storico.
  In alternativa puoi sempre crearne uno da zero con "Nuovo richiamo" o
  "Pianifica" da una proposta: ogni tentativo è una riga a sé.
- **La proposta non si ripresenta.** Appena registri l'esito o pianifichi un
  richiamo, quella proposta smette di comparire, così non richiami due volte la
  stessa persona. Se dopo un po' di tempo la situazione è ancora aperta,
  tornerà a proporsi.
- **Niente da richiamare.** Se la coda è vuota, la pagina te lo dice:
  "Niente da richiamare oggi. Buon lavoro."

## Se qualcosa non torna

- **"Scegli il canale del contatto."** / **"Scegli l'esito."** Nel registrare
  un esito devi scegliere sia come hai contattato il cliente sia com'è andata.
- **"Questo richiamo è già stato lavorato."** Stai provando a registrare
  l'esito su un richiamo che ha già il suo. Ricarica la pagina.
- **"Seleziona un cliente."** Un richiamo a mano vuole sempre un cliente.
- **"Richiamo non salvato: …"** / **"Esito non salvato: …"** Qualcosa è andato
  storto: riprova.
