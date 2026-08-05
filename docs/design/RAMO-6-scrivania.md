# Ramo 6 · `design/scrivania`

Portata dal prototipo `scrivania-ipad.html`. Il prototipo è **riferimento
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

## 4 · Il conflitto vero: due gusci diversi

Questo va risolto prima di andare avanti, perché **le due cose non possono
stare insieme.**

| | ramo 4 (`Guscio.tsx`, già consegnato) | prototipo Scrivania |
|---|---|---|
| navigazione | **colonna** a sinistra, 212px | **barra orizzontale** in cima, 62px |
| voci | **sei** — Clienti fuori | **sette** — Clienti dentro |
| nome della prima | «Oggi» | «Scrivania» |
| azione grande | «Nuova busta», nella colonna | «Nuovo», nella barra |

E `DS-01 §4.1` è esplicito su tutti e quattro i punti, dalla parte del ramo 4:
sei moduli, colonna a sinistra, «la colonna costa poco, ogni fascia orizzontale
costa il doppio». Su un iPad in orizzontale l'altezza è la risorsa scarsa, e la
barra ne prende 62px su ogni schermata.

Anche il **nome della prima voce** ha ormai tre versioni: `Dashboard` nel
registro (`lib/modules.ts`), «Oggi» nel guscio, «Scrivania» nel prototipo.
Vanno ridotte a una.

**Nel ramo non ho toccato il guscio.** La Scrivania è contenuto: sta dentro
qualunque guscio, e oggi sta dentro quello del ramo 4. Se vince la barra
orizzontale, il ramo 4 si rifà — ma è una decisione, non una svista, e non la
prendo dentro un commit.

---

## 5 · Cosa contiene il ramo, e cosa no

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

## 6 · Prima della PR

- [x] `npx tsc --noEmit` verde · `npm test` verde (142) · `next build` verde
- [x] Nessun file in `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx` toccato
- [x] Nessuna lettura di dati aggiunta
- [x] Ambra due volte per schermata, contrasti verificati, raggio 5, zero ombre
- [ ] **La decisione del §4 (colonna o barra) prima di andare avanti**
- [ ] Anteprima guardata da iPad in orizzontale — non l'ho potuta guardare
