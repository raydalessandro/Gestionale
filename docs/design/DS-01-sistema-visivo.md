# DS-01 · Sistema visivo Limpidia

> Documento di decisione. Stessa forma di `ID-01-identita.md`.
> Percorso proposto: `docs/decisioni/DS-01-sistema-visivo.md`
> Stato: **deciso** salvo la sezione 9, che elenca ciò che manca.

---

## 0 · La cosa da sapere prima di tutto

Il marchio è **uno solo: Limpidia**. «VISTA» era un nome di comodo per
cominciare e va tolto ovunque — README, wordmark della Sidebar, firma dei
documenti.

Il colore del marchio è `#B4551A`. Tutto il resto del sistema è **derivato**
da quel valore, non affiancato ad esso.

---

## 1 · Colore

### 1.1 · Come è costruito

Il seme `#B4551A` convertito in OKLCH dà **L 0.559 · C 0.141 · h 47.5°**.
Da lì:

- la rampa ambra ha undici passi a luminosità perceptualmente uniforme, e il
  passo **500 è esattamente il colore del marchio**, non un valore vicino;
- i grigi sono **alla stessa tinta (47.5°) con croma 0.01**. Non sono grigi
  neutri: sono ambra spentissima. È il meccanismo della coerenza.

Nel pacchetto marchio l'inchiostro sta a 78° e la carta a 106°: tre tinte
diverse. Impercettibile su un logo, incoerente su cinquanta schermate. Qui
sono riportate tutte a 47.5°.

### 1.2 · I token

```ts
// tailwind.config.ts
colors: {
  carta:      "#F9EFEA",   // fondo pagina — "Sabbia"
  inchiostro: "#1D1511",   // testo — "inchiostro caldo"
  superficie: "#FFFFFF",   // schede ed elenchi
  linea:      "#D7D4D2",
  soft:       "#625B58",
  faint:      "#9D9693",

  ambra: { 50:"#FEF3ED", 100:"#FAE2D7", 200:"#F7CAB4", 300:"#EFA783",
           400:"#D87C4C", 500:"#B4551A", 600:"#963F00", 700:"#732E00",
           800:"#4F1D00", 900:"#371100", 950:"#230700" },

  neutro: { 50:"#F7F4F3", 100:"#EAE7E6", 200:"#D7D4D2", 300:"#BFB9B7",
            400:"#9D9693", 500:"#79736F", 600:"#625B58", 700:"#4A4442",
            800:"#312C2B", 900:"#211D1C", 950:"#12100F" },

  verde: { 50:"#EFF7F3", 100:"#DBEDE4", 500:"#2E8666", 600:"#0C6E4F", 700:"#00533A" },
  blu:   { 50:"#F1F6FB", 100:"#DEE9F5", 500:"#4878A8", 600:"#31608E", 700:"#1E4870" },
  rosso: { 50:"#FEF1F2", 100:"#FCE0E2", 500:"#B74B5E", 600:"#9B3348", 700:"#7A1E33" },
}
```

**Cosa sparisce:** `ottone` in tutte le sue forme, e la famiglia `ambra` come
colore di stato.

### 1.3 · Le regole non negoziabili

| Regola | Perché |
|---|---|
| **L'ambra è solo azione e marchio.** Mai uno stato. | Altrimenti «premi qui» e «aspetta» sono lo stesso colore. |
| **Si colora il lavoro da fare, non lo stato in sé.** | Preventivo e Consegnata sono grigi: non chiedono niente a nessuno. |
| **Su fondo scuro l'ambra del marchio non si usa.** | `#B4551A` su `#12100F` dà 3.84, sotto soglia. Serve `ambra-300` (6.9). |
| **`neutro-500` non porta testo.** | 4.27 su carta, sotto soglia. Solo bordi e icone. |
| **Nessuna informazione critica viaggia sul colore da sola.** | Ambra e rosso hanno contrasto reciproco 1.02: per un daltonico deutan sono lo stesso colore. Un errore porta sempre anche icona e filetto. |

### 1.4 · Riassegnazione degli stati

| Stato | Colore | Nota |
|---|---|---|
| Preventivo · Da ordinare | neutro-200 / neutro-700 | non è cominciato |
| In lavorazione · Ordinato | blu-100 / blu-700 | in corso, non tocca a te |
| Pronta · Arrivato | verde-100 / verde-700 | **il più visibile**: è il momento in cui si incassa |
| Consegnata | neutro-100 / neutro-600 | finita, si toglie di mezzo |
| In ritardo | rosso-100 / rosso-700 | l'unico vero allarme |
| Annullata | neutro-100 / neutro-500 | esiste, non pesa |

Le mappe in `STATI_BUSTA` e `STATI_LAC` vanno riscritte di conseguenza. È una
modifica meccanica ma tocca molte schermate: merita un branch suo con le
guardie che passano.

---

## 2 · Superficie e forma

Pelle scelta: **Carta + Netta**.

```
fondo pagina    carta      #F9EFEA
schede          bianco     #FFFFFF   ← il dato si solleva senza ombre
raggio          5px        ovunque, anche sui pulsanti
ombre           nessuna
filetti         1px linea, veri
```

Il meccanismo: **pagina tinta, schede bianche**. È così che la pagina si
riempie senza appesantirsi, e non servono ombre.

**Alto contrasto** (corpo maggiorato, filetti 1.5px) non è una pelle
alternativa: è un'**impostazione del negozio**. Costa poco adesso e molto fra
due anni.

---

## 3 · Tipografia

| Dove | Display | Testo | Numeri |
|---|---|---|---|
| Gestionale | Fraunces 600 | Sora | JetBrains Mono |
| Portale | Fraunces 600 | Figtree | JetBrains Mono |

I codici busta, le diottrie e gli importi sono **sempre** in mono con cifre
tabellari: si leggono in colonna e si confrontano.

> Aperto: il portale in produzione usa Gabarito. Vedi §9.

---

## 4 · Struttura del gestionale

**La postazione è un tablet.** Da qui discende tutto:

- bersaglio minimo **48px**;
- **nessuna etichetta rivelata al passaggio del mouse** — l'hover non esiste;
- 8px minimo fra due bersagli;
- il tablet in orizzontale ha larghezza in abbondanza e altezza scarsa:
  **la colonna costa poco, ogni fascia orizzontale costa il doppio.**

### 4.1 · Il guscio (variante X3)

```
┌──────────────┬────────────────────────────────────────┐
│  Limpidia    │  [ cerca ]  [Trova cliente] [Vendita]  │
│              ├────────────────────────────────────────┤
│ ┌──────────┐ │  ← riga contestuale, SOLO con una      │
│ │ Nuova    │ │    scheda aperta. Altrimenti assente.  │
│ │ busta    │ │                                        │
│ └──────────┘ │                                        │
│              │                                        │
│  Oggi        │           contenuto                    │
│  Ordini      │                                        │
│  Magazzino   │                                        │
│  Agenda      │                                        │
│  Richiami    │                                        │
│  Cassa       │                                        │
│              │                                        │
│  Ottica …    │                                        │
└──────────────┴────────────────────────────────────────┘
   212px
```

Decisioni dentro questa struttura:

- **Sei moduli, non sette.** *Clienti* esce dalla colonna: si raggiunge
  cercando un cognome, mai scorrendo un elenco. Vive nella ricerca e nel
  pulsante «Trova cliente».
- **«Nuova busta» è grande e sta nella colonna**, le altre due azioni sono
  piccole accanto alla ricerca. Non sono la stessa cosa: una apre una
  lavorazione da quattrocento euro, l'altra batte uno scontrino da dodici.
- **Niente fascia della giornata in testata**: i numeri vivono dentro *Oggi*.
- **La riga contestuale non è una barra, è una memoria.** Compare con una
  scheda aperta e sparisce quando si chiude. Risolve il guasto più costoso del
  banco: il telefono che squilla a metà di una busta.
- **F2 / F3 / F9 restano attivi** se c'è la tastiera agganciata. Non costano
  spazio e regalano ai veterani di FOCUS l'unico pezzo di memoria che conta
  davvero.

### 4.2 · I quattro modelli

Le ventiquattro schermate del gestionale sono quasi tutte declinazioni di
quattro modelli. Vanno disegnati una volta bene:

1. **Elenco denso** — tabella su monitor, schede sotto i 900px. **Lo stato sta
   sempre in alto a destra in entrambe le forme**: è l'unica cosa che si cerca
   da lontano e non deve mai cambiare posto.
2. **Scheda di dettaglio** — intestazione fissa, corpo a sezioni, azioni in basso.
3. **Procedura guidata** — passi tutti visibili, si torna indietro.
4. **Foglio di stampa** — A4, niente colore, marchio in nero.

---

## 5 · Le cinque famiglie di segni

Questa è la parte più facile da sbagliare: **sono cinque famiglie diverse e non
vanno mescolate.** Ognuna ha una misura, un peso e un posto.

| Famiglia | Riquadro | Tratto | Densità | Dove |
|---|---|---|---|---|
| **Icone da interfaccia** (60) | 24 | 1.75 | — | gestionale, 16–24px |
| **Icone emblematiche** (12) | 48 | 1.6 | 5.8–15.1% | sezioni servizi, 40–56px |
| **Emblemi di sezione** (6) | 96 | 1.8 + 0.9 | 6.4–9.1% | pagina commerciale, 80–140px |
| **Pittogrammi da stampa** (6) | 96 | ≥2.2 | 10–14% | carta, ~20mm |
| **Figure vuote** (7) | 120 | 1.8 | 2.9–6.2% | elenchi senza dati, ~112px |

### 5.1 · Icone da interfaccia

File pronto: `components/Icone.tsx`. Sostituisce `lucide-react`, che esce da
`package.json`.

```tsx
<Icona nome="occhiale" size={17} />
```

Grammatica: riquadro 24, area viva 2–22, tratto **1.75**, estremi tondi,
`currentColor`, nessun riempimento tranne i punti che citano il marchio.

Il tratto 1.75 è una scelta misurata: a 2 (lucide) le icone ottiche si
impastano a 17px, a 1.7 spariscono sui monitor sbiaditi da banco.

**Costo da mettere in conto:** lucide ha mille icone, questo set ne ha
sessanta. La sessantunesima va **disegnata** seguendo le regole, non presa
altrove, o in sei mesi il set si sporca.

### 5.2 · La firma, e dove si spende

I **due punti su un asse** compaiono in tutto il sistema. La regola è che siano
**rari**, e c'è una scoperta che li giustifica: nel logotipo vero i cinque punti
sono **i puntini delle lettere**. La firma non è un'astrazione applicata al
marchio — era già dentro il marchio.

Dove si spende:

- marcatore della voce attiva nella barra;
- cinque icone su sessanta, dove i due punti *sono* la cosa rappresentata
  (`prescrizione`, `forottero`, `occhiale`, `agenda`, `tre-punti`);
- sigilli, filetti e piede di pagina;
- **e al contrario nel guasto**: due punti con l'asse spezzato. Limpidia è il
  tratto che unisce, quindi quando il collegamento cade il tratto si rompe.

### 5.3 · Figure vuote — quattro toni, non uno

| Tono | Contorno | Colore | Esempio |
|---|---|---|---|
| **Invito** — non hai cominciato | tratteggiato | neutro | «Nessuna busta, per ora» |
| **Conferma** — hai finito | pieno | verde | «Nessun richiamo questa settimana» |
| **Correzione** — non ho trovato | misto | neutro | «Nessun cliente con questo nome» |
| **Guasto** | pieno | rosso | «Il collegamento è caduto» |

Due su quattro sono **buone notizie** e non devono sembrare tristi. Nessuna usa
l'ambra: l'azione è il pulsante sotto, non la figura.

**La copy conta più del disegno.** Uno stato vuoto non dice «nessun
risultato»: dice quando smetterà di essere vuoto e con quanti. «Il prossimo
gruppo matura lunedì 3 agosto: sono undici clienti.»

---

## 6 · Movimento

### 6.1 · Le regole di prodotto

| Dove | Durata | Cosa |
|---|---|---|
| Gestionale | ≤110 ms | solo conferma che è successo qualcosa |
| Portale | 240 ms | sfocato → nitido, alla prima comparsa |
| Marchio | 720 ms | una volta per pagina, mai due |

**Niente scivola: le cose vanno a fuoco.** È l'unica animazione che questo
marchio può rivendicare, ed è anche una scelta pratica — la sfocatura costa, e
per questo non entra mai nel gestionale.

Nel gestionale passano **due sole animazioni**: il diaframma di attesa e il
pulsare degli elenchi in caricamento. Entrambe occupano un posto che sarebbe
comunque occupato da qualcosa.

Sul portale, **una firma per pagina**. Nel percorso di prenotazione la messa a
fuoco è spesa solo sulla schermata di conferma.

### 6.2 · Le regole tecniche — leggere, costa tre giri di lavoro

Su SVG si animano **solo `transform`, `opacity` e `stroke-dashoffset`.**

- ❌ **Mai `cx`, `cy`, `r`, `x1`, `x2`, `y1`, `y2`.** Sono proprietà
  geometriche SVG2: Chrome e Firefox le animano, **WebKit no, e senza dare
  errore.** Su iPhone l'animazione semplicemente non parte. Se serve muovere un
  cerchio, si sposta un `<g>` che lo contiene.
- ❌ **Mai un `<g>` dentro `<clipPath>`.** Non è ammesso dalla specifica, i
  browser lo ignorano in silenzio e il ritaglio diventa **vuoto**: sparisce
  tutto il contenuto ritagliato. Se serve muovere un ritaglio, si muove il
  gruppo che lo porta e si contro-trasla il contenuto all'interno.
- ⚠️ **La sfocatura come filtro SVG (`feGaussianBlur`), non come filtro CSS**
  sui gruppi: è più prevedibile fra i browser.
- Dichiarare sempre `transform-box` e `transform-origin` sugli elementi SVG.
- `prefers-reduced-motion` va rispettato ovunque: chi lo imposta vede lo stato
  finale, fermo.

---

## 7 · Portale negozio

Pubblico opposto al gestionale: **telefono in verticale, tenuto con una mano,
visto una volta nella vita.**

- La pagina negozio **prenota**, non si limita a presentare. Un sito vetrina ce
  l'hanno già tutti; la promessa commerciale è l'agenda che si riempie.
- Accanto alla prenotazione ci sono **Chiama** e **Indicazioni**. Nascondere il
  numero per forzare la prenotazione è la furbizia che fa perdere fiducia — e
  la clientela vera di un ottico è anziana.
- **Il pulsante ripete sempre la scelta fatta**: «Continua con le 9:30», mai
  «Avanti».
- **La riga sulla privacy non è un adempimento, è la promessa**, e va detta
  nel momento in cui si lascia il numero: «Ottica Rossi non ti manderà
  pubblicità.»
- Percorso a cinque passi, **emblema su tutte e cinque**: l'anello esterno è
  l'avanzamento (1/5 … cerchio chiuso). L'emblema resta una **prop** del
  componente passo, così si può togliere senza toccare i componenti.

Regole del materiale da vetrina:

1. Il QR porta **sempre e solo** su `/ottica/<slug>`. Mai su un elenco dove ci
   sono anche gli altri.
2. Il nome del negozio è **più grande** della firma limpidia in ogni pezzo
   stampato. Su un vetro altrui il rapporto di grandezza è il contratto.
3. La firma limpidia sul materiale del negozio è **nera, mai ambra**.

---

## 8 · Carta stampata

**Cade la trama, resta la figura.** Gli emblemi da schermo hanno tacche a 0.7 e
opacità 0.35: su una fotocopia spariscono o si impastano.

- tratto minimo **2.2** (≈0.5 mm a 20 mm di misura d'uso);
- **nessun grigio, nessuna opacità sotto 1.0**;
- i documenti si riconoscono **dalla sagoma**, perché in un cassetto se ne vede
  l'angolo;
- **tutto in nero.** Le stampanti da negozio sono quasi tutte monocromatiche, e
  un pittogramma pensato a colori che esce grigio è peggio di uno pensato in
  nero.

Verificato simulando la fotocopia: l'inchiostro guadagna dal 6 al 26%, quindi
gli spazi interni sono più larghi del necessario. Calibrati sul vettoriale, in
copia si chiuderebbero.

---

## 9 · Cosa manca ancora

| # | Questione | Chi decide |
|---|---|---|
| 1 | **Lingua delle icone**: il set originale o la variante *compasso e riga* (solo cerchi, archi e rette a 0/45/90°). Va scelta prima di scrivere il componente: dopo è una modifica su ogni schermata. | Shery |
| 2 | **Carattere del portale**: unificare su Fraunces o tenere Gabarito, che è in produzione. È una migrazione, non un ritocco. | Shery + Ray |
| 3 | **Token `lim-*`**: a marchio unico sono un doppione, ma sono online sulle pagine negozio. Unificare adesso o dopo il gestionale? | Ray |
| 4 | **«Trova cliente»** deve aprire anche l'elenco completo? Cercare un cliente e sfogliare l'archivio sono due gesti diversi, e il secondo non ha più una porta propria. | collaudo |
| 5 | **Colonna a destra** invece che a sinistra: ergonomicamente migliore per un destrimano su tablet, spiazzante per chi arriva da trent'anni di FOCUS. Da mettere davanti a due ottici e guardarli. | collaudo |
| 6 | **Altezza del guscio**: 88px sempre occupati. Su un portatile da 13" in retrobottega si sente. Il piano dei moduli si assottiglia quando si scorre? | Ray |

---

## 10 · Contesto di mercato, per le scelte future

- Il leader italiano è **FOCUS di Bludata**: oltre trent'anni, ~4.300 centri
  ottici, e **FOCUS 10 è dichiarato compatibile con Windows XP, Vista e 7**.
  Applicazione da scrivania; il cloud è annunciato come percorso.
- La navigazione tipica del settore è ancora un **menu annidato in stile
  Windows** (*Archivi ▸ Manutenzione ▸ Fornitori*).
- Gli ottici hanno decenni di memoria muscolare: un'ottica racconta di usare lo
  stesso fornitore dal 1994, quando era in DOS, e che la difficoltà del
  passaggio al web non è stata il software ma **riabituarsi a un'interfaccia
  diversa**.
- La critica più citata dai consulenti di settore non riguarda le funzioni:
  **dashboard caotiche piene di comandi che nessuno usa**, e una curva di
  apprendimento che diventa un problema quando entra personale nuovo.

Da qui la scelta di fondo: **posizione fissa e parola sempre scritta.** Il
veterano punta a memoria, la nuova assunta legge — e la parola non rallenta chi
non la legge. È l'unico punto di tutto il sistema in cui servire due pubblici
non costa niente.

---

*Spirale Editrice · sistema visivo Limpidia*
