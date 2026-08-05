# Ramo 6 · `design/scrivania`

Portata dal prototipo, **revisione 2** (`limpidia-oggi.html`). Il prototipo è **riferimento
visivo, non sorgente** (consegna §2): quello che segue è cosa ho preso, cosa ho
corretto, e cosa non si può costruire finché qualcuno non decide.

---

## 1 · L'idea, che è giusta e va detto

La dashboard di oggi mostra **quanto**: quattro numeri e gli ultimi cinque
clienti. La Scrivania mostra **cosa fare adesso**, in ordine, con il motivo
accanto. È la differenza fra un cruscotto e un banco, ed è la cosa più utile
uscita finora da tutta la consegna.

Tre pezzi sono particolarmente buoni e li ho tenuti tali e quali:

- **«Il tempo che hai davanti prima che arrivi»** invece di «prossimo
  appuntamento fra 58 minuti». Dice a cosa serve il numero.
- **L'allerta dentro la scheda del prossimo cliente**: «le sue lenti non sono
  arrivate, meglio sentirli prima che lui esca di casa». Non è un avviso, è un
  consiglio con dentro il perché.
- **La copia dello stato vuoto**: «Il primo di domani è alle 09:30, Elena
  Marchetti. Il pomeriggio è libero: quattordici clienti aspettano un
  richiamo.» È esattamente la regola di `DS-01 §5.3` applicata bene.

---

## 2 · Gli errori, corretti

### 2.1 · Tre token su quattro non sono quelli di DS-01

| var del prototipo | valore | cos'è davvero |
|---|---|---|
| `--carta` | `#F7F4F3` | è **`neutro-50`**, non `carta` (`#F9EFEA`) |
| `--inchiostro` | `#12100F` | è **`neutro-950`**, non `inchiostro` (`#1D1511`) |
| `--mono` | `ui-monospace, Menlo` | DS-01 §3 dice **JetBrains Mono** |

Non è pignoleria: `#F7F4F3` è un grigio neutro, `#F9EFEA` è ambra spentissima
alla tinta del marchio. **È il meccanismo della coerenza di tutto il sistema**
(`DS-01 §1.1`), e una schermata che lo abbandona si stacca dalle altre ventitré
in un modo che si sente senza saperlo spiegare. Corretti: uso le classi
Tailwind, non variabili CSS nuove.

### 2.2 · La pelle è quella sbagliata

`DS-01 §2` sceglie **«Carta + Netta»**: raggio **5px ovunque, anche sui
pulsanti**, **nessuna ombra**, filetti veri da 1px.

Il prototipo ha `--r-carta:14px`, `--r-tasto:10px`, e **due ombre** sulla scheda
del prossimo appuntamento (`0 1px 2px` più `0 8px 22px -14px`), più una sul
cassetto. Corretto: raggio 5, zero ombre. La scheda del prossimo appuntamento si
distingue lo stesso — è l'unica col bordo `linea` pieno invece che `linea-lieve`.

### 2.3 · L'ambra compare tre volte, il massimo è due

Regola (`PIANO-RAMI §4`): **azione principale e voce attiva, non di più.**
Nel prototipo: il tasto «Nuovo», la voce di navigazione attiva, **e** il link
«Vedi l'agenda completa →» in `ambra-600` semibold. Corretto: il link diventa
inchiostro sottolineato. Non è un'azione principale, è una porta.

Stessa correzione sul filetto di «adesso» nella giornata: inchiostro, non ambra.

### 2.4 · Due contrasti sotto soglia

`--faint:#9D9693` su bianco fa **2.8 : 1**. Il prototipo lo usa come **testo**
in due punti: `.fascia.finita` (l'ora e il nome degli appuntamenti già passati)
e `.fascia.pausa .corpo` a 12px. Corretti a `neutro-500` e `soft`.

`faint` resta dov'era giusto: le icone e la freccia, che non sono testo.

### 2.5 · Il carattere è quello del portale

Il prototipo carica **Gabarito + Figtree**, che `DS-01 §3` assegna al
**portale**. Il gestionale usa Fraunces + Sora. Ho usato lo stack del
gestionale (`f-serif`, `font-ui`, `font-mono`).

**Questa è una decisione, non un errore mio da correggere in silenzio.** Se la
Scrivania deve avere i caratteri del portale, allora è tutto il gestionale a
doverli avere, e `DS-01 §3` va riscritto. Vedi §4.

### 2.6 · Cose piccole

- **`aria-pressed` sulle spunte del cassetto.** `aria-pressed` è per i pulsanti
  a due stati; una lista di cose da spuntare è `role="checkbox"` +
  `aria-checked`. Con `aria-pressed` uno screen reader dice «premuto» invece di
  «selezionato».
- **Il cassetto non trattiene il fuoco e non lo restituisce** alla chiusura.
  Ha `role="dialog" aria-modal="true"`, che *promette* un fuoco intrappolato che
  non c'è: con una tastiera agganciata si esce dal pannello tabulando.
- **`viewport-fit=cover` senza `env(safe-area-inset-*)`**: su iPad il fondo
  delle due colonne finisce sotto la barra di sistema.
- **`height:calc(100% - 96px)`** dove 96 = 34 (barra di prova) + 62 (barra
  applicazione). Quando la barra di prova esce dal prodotto, il numero è
  sbagliato e nessuno se ne accorge finché non si scrolla.
- **`.cerca` è un `<div>` con dentro del testo**, non un campo. Ovvio in un
  mockup, ma nel prodotto è un `<form>` GET — come nel guscio del ramo 4.

Nel ramo queste non esistono più: i componenti sono React e il cassetto non
l'ho portato (vedi §5).

---

## 3 · Cosa non si può costruire: manca il dato

Ho controllato nello schema. Tre blocchi su sei hanno un fondamento vero, tre no.

### Si può fare oggi ✓

- **«Ordini urgenti · promessa a rischio»** — `ordini_occhiali.data_promessa`
  esiste. Confrontarla con oggi dà l'elenco.
- **«Da avvisare»** — `avvisato_il` esiste su buste e ordini LAC. «Pronta e non
  ancora avvisato» è una query.
- **«La tua giornata»** — è l'agenda, e c'è tutta, sale e operatori compresi.

### Non si può fare ✗

- **«Arrivati oggi».** Il blocco presuppone una **bolla del fornitore con N
  colli da spuntare uno per uno** («bolla n. 4471 · quattro pezzi attesi»,
  «2 montature su 3 · una manca», «non nel pacco»). Nello schema **non c'è
  nessuna tabella di bolle, colli o DDT**: ho cercato. Gli ordini hanno
  `da_ordinare → ordinato → arrivato → consegnato` e basta — un ordine arriva o
  non arriva, non arriva *parzialmente dentro un pacco insieme ad altri tre*.
  **È il pezzo di prodotto più grosso dell'intero prototipo, ed è nuovo.**
- **«sentito il 01/08» e «non risponde».** Presuppongono un **registro dei
  contatti**: quando ho scritto al cliente, quando ho sollecitato il fornitore,
  cosa hanno risposto. `avvisato_il` è un timestamp singolo, non una storia.
- **Le durate («~4 min», «~6 min») e l'ordine dei suggerimenti.** Non c'è niente
  da cui derivarli. Vedi il paragrafo qui sotto, perché non è solo un dato che
  manca.

### Una cosa su cui vorrei rispondesse Ray, non io

**«Cosa puoi fare adesso» è un elenco ordinato con dei tempi stimati, e
«Inizia dalla prima» chiede di fidarsi di quell'ordine.**

Il paletto 1 dice «nessuna classifica» degli ottici, e questo non sono ottici —
ma il meccanismo è identico: **un punteggio invisibile che decide cosa conta
di più.** Se l'ordine sbaglia due volte di fila, l'ottico smette di guardarlo e
il blocco diventa rumore in cima alla schermata più importante.

La versione onesta la conosciamo già: **niente punteggio, solo un criterio
scritto** — «prima chi ti aspetta oggi, poi chi aspetta da più giorni». Una
riga sotto il titolo che dice come sono ordinati vale più di qualunque
euristica. Le durate invece le toglierei finché non c'è un modo di misurarle:
«~4 min» inventato è una promessa che il prodotto non può mantenere.

Non l'ho deciso io: nel ramo le durate ci sono, come nel prototipo, e sono
segnate come finte.

---

## 4 · La revisione 2 · cosa ha chiuso e cosa resta

Il secondo prototipo (`limpidia-oggi.html`) corregge **quasi tutto** quello
che avevo elencato nel §2. Lo scrivo per intero perché è la parte utile:

| §2 | nella revisione 2 |
|---|---|
| token sbagliati | **corretti**: `carta #F9EFEA`, `inchiostro #1D1511`, tutta la rampa neutra |
| pelle 14/10px e due ombre | **corretta**: `--r:5px`, zero ombre |
| caratteri del portale | **corretti**: Fraunces + Sora + JetBrains Mono |
| il conflitto del guscio | **chiuso**: colonna a 212px, sei moduli, Clienti fuori, «Oggi» |
| la riga contestuale mancante | **c'è**, ed è disegnata bene |

E aggiunge due cose che non c'erano, su cui ha ragione e che ho adottato:

**La colonna è bianca, non scura.** Al banco si sta davanti a questo schermo
otto ore, e una fascia scura alta quanto la finestra è un peso che si paga
tutto il giorno. C'è anche un guadagno tecnico: su bianco la voce attiva può
usare `ambra-50`/`ambra-700` (**9.08**), mentre su fondo scuro l'ambra del
marchio era vietata e serviva `ambra-300`.

**La barra in cima non c'è più.** Ricerca e azioni sono scese nella colonna.
Sparisce l'unica fascia orizzontale — 62px restituiti a ogni schermata, e su
un tablet in orizzontale l'altezza è la risorsa scarsa. È il ragionamento di
`DS-01 §4.1` portato fino in fondo, più di quanto l'avessi fatto io nel ramo 4.

### Cosa resta da correggere

**`faint` come testo, in tre punti.** È l'unico errore del §2 sopravvissuto,
ed è lo stesso di prima:

| dove | contrasto | serve |
|---|---|---|
| `.voce.finita` — ora e nome degli appuntamenti passati | **2.91** | 4.5 |
| `.voce.pausa` — le righe di apertura e chiusura, 11.5px | **2.91** | 4.5 |
| `.trova` — l'etichetta «Cerca cliente o busta» | **2.57** | 4.5 |

Nel ramo: `neutro-500` (4.67) per quello che va spento, `soft` (6.65) per la
ricerca — che non è un segnaposto, è l'etichetta di un bersaglio.

**Le due opacità della riga contestuale passano, ma di poco.** `ambra-700` al
75% su `ambra-50` fa **4.82** su un corpo di 9.5px; l'80% fa 5.49. Sono legali.
Ho messo il colore pieno lo stesso (**9.08**): non c'era niente da guadagnare a
stare sul filo.

**Tre cose non toccate dalla revisione**, tutte già nel §2.6: `aria-pressed`
sulle caselle di spunta invece di `role="checkbox"`; il cassetto con
`aria-modal="true"` ma **senza fuoco intrappolato né ritorno del fuoco** — una
promessa che il codice non mantiene; `viewport-fit=cover` senza
`env(safe-area-inset-*)`.

**Una nuova, e va detta perché è una trappola di implementazione.**
«Adesso sono le 08:02» in testata: **un orologio reso dal server è già
sbagliato quando la pagina arriva**, e con la cache di Next resta sbagliato per
minuti. O è client, o non c'è. Nel ramo è dentro l'anteprima, quindi finto come
tutto il resto, e c'è il commento che lo dice.

### L'ambra è tre volte, e stavolta è una scelta

«Nuova busta», la voce attiva, **e tutta la riga contestuale** — fondo
`ambra-50`, bordo `ambra-200`, testo `ambra-700`. È la superficie ambra più
grande dello schermo, ed è una terza. La regola dice due.

Regge per un motivo solo, e lo scrivo perché va verificato al collaudo e non a
tavolino: **la riga contestuale non c'è quasi mai.** Senza una scheda aperta le
ambre sono due; quando compare, è perché è successo qualcosa che merita di
essere la cosa più visibile della pagina. Se al banco si scopre che resta su
per mezza giornata — e può succedere, basta dimenticarsi di chiudere — allora
è ambra permanente su uno stato, cioè esattamente ciò che la regola vieta.
Spegnerla a `neutro-100` è una riga.

## 5 · Il conflitto del guscio · CHIUSO

**La revisione 2 dà ragione al ramo 4 su tutti e quattro i punti**, e la
questione si chiude qui. Colonna a 212px, sei moduli, Clienti fuori, e la prima
voce si chiama **«Oggi»**.

Resta una cosa sola, minima: `lib/modules.ts` chiama ancora quel modulo
`Dashboard`. Il guscio lo rinomina con una mappa di due righe perché `lib/` è
fuori perimetro. **Quando qualcuno rinomina il registro, la mappa `NOMI` si
toglie, non si aggiorna.**

## 6 · Com'era il conflitto, per memoria

La revisione 1 aveva una **barra orizzontale con sette voci e Clienti dentro**;
il ramo 4 una **colonna con sei e Clienti fuori**. Non potevano stare insieme, e
l'avevo lasciato aperto invece di deciderlo dentro un commit. La revisione 2 ha
scelto la colonna. Lo lascio scritto perché è il tipo di divergenza che ricapita
ogni volta che un prototipo e un ramo camminano in parallelo: **il costo di
lasciarla aperta è stato zero, quello di indovinare sarebbe stato un ramo da
rifare.**

## 7 · Cosa contiene il ramo, e cosa no

| file | cosa |
|---|---|
| `components/Scrivania.tsx` | **nuovo.** I sei blocchi, presentazionali: prendono props, non leggono niente |
| `app/(app)/scrivania/page.tsx` | **nuovo.** Anteprima di disegno con i dati finti del prototipo |

**L'anteprima non è una schermata del prodotto**, e ha un nastro rosso in cima
che lo dice. La rotta non è collegata da nessuna parte — non è nella colonna,
non è in `lib/modules.ts`, ci si arriva solo scrivendola — ed è `noindex`.
Serve a guardare la Scrivania sull'anteprima Vercel **senza scrivere una sola
lettura di dati**, che sarebbe fuori perimetro. Quando i componenti saranno
alimentati, **quel file si cancella, non si aggiorna.**

**Non ho portato il cassetto laterale** («Controlla arrivi», «Avvisa i
clienti»). Due motivi, entrambi seri: il primo dei due pannelli lavora su
bolle e colli che non esistono (§3), e un cassetto modale fatto bene vuole
fuoco intrappolato, ritorno del fuoco, `inert` sul fondo e la gestione di
Escape — è un componente suo, non un pezzo di questa passata. Il secondo
pannello (WhatsApp a più clienti) invece è quasi tutto costruibile: `waLink`
e `messaggioRichiamo` esistono già in `OrdiniUI` e `lib/utils`.

## 8 · Prima della PR

- [x] `npx tsc --noEmit` verde · `npm test` verde (142) · `next build` verde
- [x] Nessun file in `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx` toccato
- [x] Nessuna lettura di dati aggiunta
- [x] Ambra due volte per schermata, contrasti verificati, raggio 5, zero ombre
- [x] La decisione sul guscio: **chiusa dalla revisione 2**, vince la colonna
- [ ] Anteprima guardata da iPad in orizzontale — non l'ho potuta guardare
