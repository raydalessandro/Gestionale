*Aggiornato a: v0.5.1 (Fasi 4b–4d)*

# Prescrizioni

## A cosa serve

La prescrizione è la misura del cliente: quella che poi colleghi a una busta o
a un ordine di lenti a contatto. Ogni cliente ha il suo storico. Una
prescrizione non si cancella mai: quando ne arriva una più recente, la vecchia
resta scritta come promemoria.

## I gesti di ogni giorno

### Registrare una prescrizione

Si parte dalla scheda del cliente: apri Laura Bianchi e aggiungi una nuova
prescrizione.

1. Scegli il **Tipo di prescrizione**. È la scelta che guida tutto il resto:
   - **Monofocale — lontano**, **Monofocale — vicino**, **Progressivo**,
     **Bifocale**, **Office** per gli occhiali;
   - **Lenti a contatto (LAC)** per le lenti a contatto.
2. Metti la **Data visita** (di default è oggi).
3. Scegli l'**Origine**:
   - **Rilevata in negozio** — l'hai misurata tu;
   - **Ricetta esterna (oculista)** — porta la ricetta del medico; compare il
     campo **Esaminatore** dove scrivi il nome (es. "Dr. Rossi");
   - **Lenti del cliente (frontifocometro)** — valori letti dall'occhiale che
     il cliente già indossa.
4. Compila la **Refrazione**: per OD e OS scrivi **Sfero**, **Cilindro** e
   **Asse**. Per progressive, bifocali e LAC multifocali aggiungi
   l'**Addizione**.
5. Solo per gli occhiali, sotto la griglia trovi la riga **DNP** (vedi sotto).
6. Controlla la **Validità (mesi)**: di default 12. Passato quel tempo la
   prescrizione risulta scaduta.
7. Premi **"Salva prescrizione"**.

Sotto la griglia trovi sempre un'**anteprima** della misura scritta come la
leggeresti al banco: la usi per un ultimo controllo prima di salvare.

### La DNP (solo occhiali)

Sotto la griglia della refrazione, per le prescrizioni da occhiali, c'è la riga
**DNP** (la distanza naso-pupilla): un valore in millimetri per **OD** e uno
per **OS** (per esempio 31.5). Non è obbligatoria, ma se la compili ti torna
comodo dopo: quando la prescrizione è collegata a una busta, la **busta
stampata** riporta la DNP accanto alla griglia della misura, pronta per il
laboratorio.

### I template rapidi

Sopra la griglia della refrazione ci sono dei pulsanti già pronti:
**Emmetrope**, **Miopia lieve**, **Miopia moderata**, **Ipermetropia**,
**Astigmatismo**. Premine uno e la griglia si riempie con valori tipici, che
poi ritocchi. Fa risparmiare battute quando la misura è vicina a uno standard.

### Il prisma (solo occhiali)

Se serve, apri **"+ Prisma (se serve)"** sotto la refrazione e inserisci per
ciascun occhio l'entità del prisma e la **base** (alto, basso, nasale,
temporale).

### La geometria LAC

Quando scegli **Lenti a contatto (LAC)** compare il riquadro della geometria:
**Raggio (BC)** e **Diametro (DIA)** per OD e OS, già proposti a 8.6 / 14.2.
Sono i valori che poi ritrovi in automatico quando fai un ordine di lenti a
contatto per quel cliente.

## Il consenso ai dati sanitari

La prescrizione contiene dati sulla salute del cliente. La prima volta che ne
registri una per un cliente che non ha ancora dato il consenso ai dati
sanitari, in testa al form compare un riquadro con una spunta obbligatoria:

> Il cliente ha firmato l'informativa e acconsente al trattamento dei dati
> sanitari.

Senza quella spunta non salvi. La metti **una volta sola**: da lì in poi VISTA
non te la richiede più per quel cliente, e la data del consenso resta scritta
nella sua scheda (riquadro Privacy). Se modifichi una vecchia prescrizione di
un cliente che il consenso l'ha già dato, non ti viene chiesto niente.

## Casi particolari

- **Attiva o scaduta.** Una prescrizione entro la sua validità è **valida**;
  oltre, risulta **scaduta**. Quando poi apri una busta o un ordine LAC, VISTA
  ti mostra in evidenza le prescrizioni valide; una scaduta la puoi comunque
  collegare, ma te lo chiede con una conferma.
- **Ricetta esterna.** Se l'origine è la ricetta dell'oculista, ricordati di
  scrivere l'esaminatore: è utile ritrovarlo mesi dopo.
- **Nessuna misura pronta.** Puoi comunque creare una busta o un ordine LAC
  senza prescrizione collegata (vedi i capitoli Ordini LAC e Buste).

## Se qualcosa non torna

- **"L'asse deve essere compreso tra 0 e 180."** Hai scritto un asse fuori
  scala: correggilo e risalva.
- **La spunta del consenso sanitario è obbligatoria.** Se provi a salvare la
  prima prescrizione senza spuntarla, il form non prosegue: raccogli
  l'informativa firmata e metti la spunta.
- **"Salvataggio non riuscito…"** Riprova; se persiste, controlla la
  connessione.
- **"Sessione scaduta: rifai il login."** Rientra e riprendi.
