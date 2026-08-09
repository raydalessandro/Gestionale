# Ramo 6 · la Scrivania

Prototipo di riferimento: **`limpidia-oggi.html`**, ed è l'unico. Una versione
precedente esisteva e non c'è più: le sue divergenze le ha chiuse il prototipo
stesso e non le riporto, perché un documento che racconta due disegni costringe
chi legge a capire quale dei due vale.

Misure, pesi e colori del ramo sono quelli del prototipo. Quello che segue è
solo ciò che ho **cambiato sopra**, e ciò che **non si può costruire**.

---

## 1 · L'idea

La dashboard di oggi mostra **quanto**: quattro numeri e gli ultimi cinque
clienti. La Scrivania mostra **cosa fare adesso**, in ordine, con il motivo
accanto. È la differenza fra un cruscotto e un banco.

Tre pezzi sono particolarmente buoni e sono passati intatti:

- **«Il tempo che hai davanti prima che arrivi»** invece di «prossimo
  appuntamento fra 58 minuti». Dice a cosa serve il numero.
- **L'allerta dentro la scheda del prossimo cliente**: «le sue lenti non sono
  arrivate, meglio sentirli prima che lui esca di casa». Non è un avviso, è un
  consiglio con dentro il perché.
- **La copy dello stato vuoto**: «Il primo di domani è alle 09:30, Elena
  Marchetti. Il pomeriggio è libero: quattordici clienti aspettano un
  richiamo.» È la regola di `DS-01 §5.3` applicata bene — uno stato vuoto dice
  quando smetterà di essere vuoto, e con quanti.

Il prototipo porta anche due decisioni sul guscio che ho adottato, e che vanno
oltre quello che avevo fatto nel ramo 4.

**La colonna è bianca, non scura.** Al banco si sta davanti a questo schermo
otto ore, e una fascia scura alta quanto la finestra è un peso che si paga
tutto il giorno. C'è anche un guadagno tecnico: su bianco la voce attiva usa
`ambra-50`/`ambra-700` (**9.08**), mentre su fondo scuro l'ambra del marchio
era vietata e serviva `ambra-300`.

**La barra in cima non c'è.** Ricerca e azioni stanno nella colonna, e sparisce
l'unica fascia orizzontale: 62px restituiti a ogni schermata. Su un tablet in
orizzontale l'altezza è la risorsa scarsa — è il ragionamento di `DS-01 §4.1`
portato fino in fondo.

La navigazione è quindi **una colonna a 212px con sei moduli**, Clienti fuori,
prima voce **«Oggi»**. Resta una cosa minima: `lib/modules.ts` chiama ancora
quel modulo `Dashboard`, e il guscio lo rinomina con una mappa di due righe
perché `lib/` è fuori perimetro. **Quando il registro viene rinominato, la mappa
`NOMI` si toglie, non si aggiorna.**

---

## 2 · Cosa contiene il ramo

| file | cosa |
|---|---|
| `components/Guscio.tsx` | colonna bianca, ricerca dentro, `RigaContestuale` |
| `components/Scrivania.tsx` | i sei blocchi, presentazionali: prendono props, non leggono niente |
| `app/(app)/scrivania/page.tsx` | anteprima di disegno, dati finti dichiarati |

**L'anteprima non è una schermata del prodotto.** Ha un nastro rosso in cima che
lo dice, è `noindex`, non è collegata da nessuna parte — non sta nella colonna,
non è in `lib/modules.ts`, ci si arriva solo scrivendola. Serve a guardare la
Scrivania sull'anteprima Vercel **senza scrivere una sola lettura di dati**, che
sarebbe fuori perimetro. Quando i componenti saranno alimentati, **quel file si
cancella, non si aggiorna.**

---

## 3 · Le correzioni applicate sopra il prototipo

### 3.1 · `faint` come testo, in tre punti

`#9D9693` su bianco fa **2.91 : 1**. Il prototipo lo usa come *testo*:

| dove | contrasto | nel ramo |
|---|---|---|
| ora e nome degli appuntamenti già passati | 2.91 | `neutro-500` (4.67) |
| le righe di apertura e chiusura, 11.5px | 2.91 | `soft` (6.65) |
| l'etichetta «Cerca cliente o busta» | 2.57 | `soft` (6.65) |

L'ultima non è un segnaposto: è **l'etichetta di un bersaglio da 48px**, la
seconda cosa che si legge nella colonna. `faint` resta dov'era giusto — le
icone e la freccia, che non sono testo.

### 3.2 · Le due opacità della riga contestuale

`ambra-700` al 75% su `ambra-50` fa **4.82** su un corpo di 9.5px; all'80% fa
5.49. Passano entrambe. Ho messo il colore pieno lo stesso — **9.08** — perché
non c'era niente da guadagnare a stare sul filo con del testo di nove pixel e
mezzo.

### 3.3 · «Adesso sono le 08:02»

**Un orologio reso dal server è già sbagliato quando la pagina arriva**, e con
la cache di Next resta sbagliato per minuti. O è client, o non c'è. Nel ramo sta
dentro l'anteprima, quindi è finto come tutto il resto, e il commento lo dice.

### 3.4 · La figura nello stato vuoto

Il prototipo usa l'icona dell'agenda a 30px in `verde-500`, e ha ragione:
`DS-01 §5.3` prescrive figure vuote da 120 di riquadro a ~112px, ma quella
misura è per **un elenco senza dati**. Qui è una scheda piccola con dentro una
buona notizia, e 112px di disegno ne occuperebbero metà. Ho seguito il
prototipo. È una deroga consapevole, non una dimenticanza.

---

## 4 · Cosa resta aperto

Tre cose stanno nel cassetto laterale, che **non ho portato** (§6). Le scrivo
perché quando il cassetto si farà si ripresentano tali e quali.

- **`aria-pressed` sulle caselle di spunta.** `aria-pressed` è per i pulsanti a
  due stati; una lista di cose da spuntare vuole `role="checkbox"` +
  `aria-checked`. Con `aria-pressed` uno screen reader dice «premuto» invece di
  «selezionato».
- **Il cassetto ha `role="dialog" aria-modal="true"` senza fuoco intrappolato
  né ritorno del fuoco.** È peggio che non averlo: `aria-modal` **promette** che
  dietro non si può andare, e invece con una tastiera agganciata si tabula
  fuori. Serve anche `inert` sul fondo.
- **`viewport-fit=cover` senza `env(safe-area-inset-*)`**: su iPad il fondo
  delle due colonne finisce sotto la barra di sistema.

### E una che è una scelta, non un errore

**L'ambra compare tre volte**: «Nuova busta», la voce attiva, e tutta la riga
contestuale — che è la superficie ambra più grande dello schermo. La regola
(`PIANO-RAMI §4`) dice due.

Regge per un motivo solo, e va verificato al banco e non a tavolino: **la riga
contestuale non c'è quasi mai.** Senza una scheda aperta le ambre sono due;
quando compare è perché è successo qualcosa che merita di essere la cosa più
visibile della pagina. Ma se al collaudo si scopre che resta su per mezza
giornata — e basta dimenticarsi di chiuderla — allora è **ambra permanente su
uno stato**, cioè esattamente ciò che la regola vieta. Spegnerla a `neutro-100`
è una riga.

---

## 5 · Cosa non si può costruire: manca il dato

Tre blocchi su sei hanno un fondamento nello schema, tre no. Il dettaglio è in
`dati-mancanti.md §7`.

### Si può fare oggi ✓

- **«Ordini urgenti · promessa a rischio»** — `ordini_occhiali.data_promessa`
  esiste; confrontarla con oggi dà l'elenco.
- **«Da avvisare»** — `avvisato_il` esiste su buste e ordini LAC.
- **«La tua giornata»** — è l'agenda, e c'è tutta, sale e operatori compresi.

### Non si può fare ✗

- **«Arrivati oggi».** Presuppone una **bolla del fornitore con N colli da
  spuntare uno per uno** («bolla n. 4471 · quattro pezzi attesi», «2 montature
  su 3 · una manca», «non nel pacco»). Nello schema **non esistono bolle, colli
  né DDT**: ho cercato. Un ordine arriva o non arriva, non arriva *parzialmente
  dentro un pacco insieme ad altri tre*. **È un pezzo di prodotto nuovo, non un
  campo** — e vale la pena farlo, perché «cosa è arrivato stamattina e per chi»
  è la domanda delle otto in ogni negozio.
- **«sentito il 01/08», «non risponde».** Serve un registro dei contatti.
  `avvisato_il` è un timestamp singolo, non una storia.

### Una decisione, non un dato

**«Cosa puoi fare adesso» è un elenco ordinato con tempi stimati, e «Inizia
dalla prima» chiede di fidarsi di quell'ordine.**

Il paletto 1 dice «nessuna classifica» e parla di ottici, non di attività — ma
il meccanismo è identico: **un punteggio invisibile che decide cosa conta di
più.** Se sbaglia due volte di fila, l'ottico smette di guardare il blocco più
importante della schermata, e da lì in poi è rumore in cima alla pagina.

La versione onesta non chiede nessun dato nuovo: **niente punteggio, un criterio
scritto sotto il titolo** — «prima chi ti aspetta oggi, poi chi aspetta da più
giorni». Una riga che si può contestare vale più di qualunque euristica. Le
durate invece le toglierei finché non c'è modo di misurarle: «~4 min» inventato
è una promessa che il prodotto non mantiene.

Nel ramo ci sono come nel prototipo, e sono segnate come finte.

---

## 6 · Il cassetto, che non ho portato

I due pannelli laterali («Controlla arrivi», «Avvisa i clienti») non sono nel
ramo, per due motivi separati.

Il primo lavora su **bolle e colli che non esistono** (§5). Il secondo è quasi
tutto costruibile — `waLink` e `messaggioRichiamo` esistono già in `OrdiniUI` e
`lib/utils` — ma un cassetto modale fatto bene vuole fuoco intrappolato, ritorno
del fuoco, `inert` sul fondo e la gestione di Escape: **è un componente suo, non
un pezzo di questa passata.** Farlo male è peggio che non farlo, perché
`aria-modal` promette qualcosa che poi non mantiene.

---

## 7 · Prima della PR

- [x] `npx tsc --noEmit` verde · `npm test` verde (142) · `next build` verde
- [x] Nessun file in `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx` toccato
- [x] Nessuna lettura di dati aggiunta
- [x] Misure, pesi e colori allineati al prototipo
- [x] Contrasti verificati: nessun testo sotto 4.5
- [ ] **Le durate e l'ordine dei suggerimenti** (§5) — è una decisione, non mia
- [ ] **La riga contestuale in ambra** (§4) — da guardare al banco
- [ ] Anteprima da iPad in orizzontale — non l'ho potuta guardare
