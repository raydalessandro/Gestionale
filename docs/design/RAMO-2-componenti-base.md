# Ramo 2 · `design/componenti-base`

Sostituisce l'aspetto dei primitivi senza toccare una sola firma. Cinquanta file
importano da `components/ui.tsx`: se cambia l'interfaccia, si ferma tutto.

---

## Cosa contiene

**`components/ui.tsx`** — riscritto. Verificato:

- **10 export su 10 conservati**, nessuno perso
- **firme identiche** su tutti e dieci
- **le sei chiavi di `badgeTinte` conservate**, incluse `ottone` e `ambra` che
  `TINTE_FONTE` usa: toglierle avrebbe fermato la compilazione dentro il file stesso

Aggiunti cinque componenti che servono ai rami successivi: `Elenco`, `Riga`,
`Tendina`, `VoceTendina`, `Filetto`.

---

## Cosa cambia a vista

| | prima | dopo |
|---|---|---|
| Spigoli | 12–16px | **5px** ovunque |
| Ombre | `shadow-[0_1px_2px…]` sulle Card | **nessuna** |
| Accento | ottone | **ambra-500** |
| Errore | bordo su quattro lati | **filetto a sinistra**, si legge per primo |
| Etichette dei campi | maiuscoletto | **mono**, 10px, spaziato |
| Altezza minima | libera | **44px** su pulsanti e campi |
| Testo dei campi | `text-sm` (14px) | **`text-base`** (16px) |

Le ultime due sono per il tablet, e la seconda ha una ragione tecnica oltre che
di leggibilità: **su iOS un campo con testo sotto i 16px fa zoomare la pagina
appena lo tocchi.** È il tipo di difetto che al banco fa perdere dieci secondi
ogni volta e che nessuno riesce a spiegare.

---

## Due scelte da discutere

### Le pastiglie di fonte

`TINTE_FONTE` decide il colore della provenienza. Le fonti **non sono stati**, e in
un elenco di trenta buste trenta pastiglie colorate sono rumore. Quindi restano
quasi tutte neutre, e **solo quelle che arrivano dal canale Limpidia** — `app`,
`qr_vetrina`, `sito_negozio`, `portale` — portano l'ambra. Lì la pastiglia dice
«questa te l'abbiamo portata noi», ed è l'unica volta in cui l'ambra come
provenienza vale quello che costa.

`convenzione` era ottone: l'ho messa neutra. Se per voi una convenzione va
distinta a colpo d'occhio, ditemelo: è una riga.

### Il segnaposto nella tendina

La voce scelta è marcata dai **due punti del marchio**, non da una spunta. È
l'unico posto dell'interfaccia in cui la firma fa un lavoro funzionale invece che
decorativo — la stessa scelta del marcatore nella colonna.

---

## Quello che questo ramo NON può fare

**I colori delle pipeline stanno in `lib/utils.ts`**, come hex scritti a mano
dentro `STATI_LAC`, `STATI_BUSTA`, `STATI_APPUNTAMENTO`. `lib/` è fuori perimetro,
quindi la riassegnazione degli stati **non è in questo ramo**. La lascio pronta
qui sotto: è un copia-incolla, e la fate voi.

```ts
// lib/utils.ts — sostituzione dei tre blocchi.
// Regola: si colora il lavoro da fare, non lo stato in sé.
// Chi non chiede niente a nessuno resta grigio.

export const STATI_LAC: StatoPipeline[] = [
  { id: "da_ordinare", label: "Da ordinare",       bg: "#EAE7E6", fg: "#4A4442" },
  { id: "ordinato",    label: "Ordinato",          bg: "#DEE9F5", fg: "#1E4870" },
  { id: "arrivato",    label: "Arrivato · avvisa", bg: "#DBEDE4", fg: "#00533A" },
  { id: "consegnato",  label: "Consegnato",        bg: "#EAE7E6", fg: "#625B58" },
  { id: "annullato",   label: "Annullato",         bg: "#FCE0E2", fg: "#7A1E33" },
];

export const STATI_BUSTA: StatoPipeline[] = [
  { id: "preventivo",  label: "Preventivo",           bg: "#EAE7E6", fg: "#4A4442" },
  { id: "lavorazione", label: "In lavorazione",       bg: "#DEE9F5", fg: "#1E4870" },
  { id: "arrivata",    label: "Arrivata · ispeziona", bg: "#DEE9F5", fg: "#31608E" },
  { id: "pronta",      label: "Pronta · avvisa",      bg: "#DBEDE4", fg: "#00533A" },
  { id: "consegnata",  label: "Consegnata",           bg: "#EAE7E6", fg: "#625B58" },
  { id: "annullata",   label: "Annullata",            bg: "#FCE0E2", fg: "#7A1E33" },
];

export const STATI_APPUNTAMENTO: StatoPipeline[] = [
  // in_attesa: una richiesta dal portale è un ricavo che aspetta risposta,
  // non un lavoro in corso. Verde, come "pronta": tocca a te.
  { id: "in_attesa",   label: "In attesa",      bg: "#DBEDE4", fg: "#00533A" },
  { id: "prenotato",   label: "Prenotato",      bg: "#DEE9F5", fg: "#1E4870" },
  { id: "completato",  label: "Completato",     bg: "#EAE7E6", fg: "#625B58" },
  { id: "mancato",     label: "Non presentato", bg: "#FCE0E2", fg: "#9B3348" },
  { id: "annullato",   label: "Annullato",      bg: "#EAE7E6", fg: "#625B58" },
];
```

**Un quarto blocco che nel pacchetto mancava.** `STATI_FERMO` porta ancora gli hex
dell'ottone (`#EFE4D3` / `#8A6533`) e l'ambra del vecchio sistema. Se non si
sostituisce, dopo il merge di tutti i rami il magazzino resta l'unica schermata
con la palette vecchia:

```ts
export const STATI_FERMO: StatoPipeline[] = [
  // Un fermo attivo è merce in negozio che aspetta una decisione del cliente:
  // è in corso, non tocca a te. Blu, come "in lavorazione".
  { id: "attivo",    label: "Attivo",    bg: "#DEE9F5", fg: "#1E4870" },
  { id: "ritirato",  label: "Ritirato",  bg: "#EAE7E6", fg: "#625B58" },
  { id: "annullato", label: "Annullato", bg: "#EAE7E6", fg: "#79736F" },
];
```

Tre cose da notare negli altri blocchi.

**«Consegnata» perde il verde e diventa grigia.** È finita: deve togliersi di mezzo.
Il verde serve a «Pronta», che è il momento in cui si chiama il cliente e si incassa —
se lo portano anche gli stati finiti, in una tabella non salta più fuori.

**«In attesa» passa da ottone a verde.** La nota nel codice attuale dice che l'ottone
serviva «per saltare all'occhio». Nel sistema nuovo l'ottone non c'è più, e una
richiesta dal portale è esattamente la stessa cosa di una busta pronta: qualcuno
aspetta che tu faccia una mossa.

**«Annullato» esce dal rosso.** Un appuntamento annullato non è un guasto — è una
cosa normale che succede. Il rosso resta per «Non presentato», che invece è un buco
in agenda che qualcuno ha lasciato.

---

## Prima della PR

- [ ] Parte da `main` aggiornato, dopo il ramo 1
- [ ] `npx tsc --noEmit` verde: è la prova che le firme sono intatte
- [ ] Le pagine ristilizzate fanno ancora le stesse cose
- [ ] Anteprima guardata **da telefono e da tablet**
- [ ] `lib/utils.ts` **non** modificato in questo ramo
- [ ] Commento di ritorno, entrambe le voci

---

## Cosa arriva dopo

Il ramo 3 (`design/agenda-richieste`) è quello che G8 sta aspettando, e usa
`Elenco`, `Riga` e `Badge` da qui. Senza questo ramo, quello non si può fare.
