# Ramo 1 · `design/token-e-icone`

Primo dei nove. Non cambia una sola schermata di proposito: cambia il vocabolario
sotto, così tutti i rami successivi hanno di che parlare.

---

## Cosa contiene

1. **`tailwind.config.ts`** — palette Limpidia completa, derivata in OKLCH da `#B4551A`
2. **`components/Icone.tsx`** — 60 icone proprietarie, sostituiscono `lucide-react`

---

## 1 · I token

Il file allegato è **completo e sostituisce quello attuale**. Cosa cambia davvero:

| prima | dopo | perché |
|---|---|---|
| `ottone #A67C42` | `ambra-500 #B4551A` | un marchio, un accento. L'ottone era di un prodotto che non esiste più |
| `carta #FAF7F2` | `carta #F9EFEA` | stessa tinta del marchio (47.5°), non un beige a caso |
| `inchiostro #1C1714` | `inchiostro #1D1511` | idem: prima stava a 78°, i grigi litigavano con l'ambra |
| `ambra #C98A2B` (stato) | **eliminato come stato** | non può esistere uno stato dello stesso colore dell'azione |
| `lim-*` valori propri | stessi valori del gestionale | i nomi restano per non rompere le pagine, i valori si unificano |
| raggi Tailwind normali | tutto a 5px | è la pelle «Netta» scelta: strumento, non applicazione |

### La riassegnazione degli stati

L'unica modifica che tocca la logica visiva delle pipeline. La regola: **si colora il
lavoro da fare, non lo stato in sé.**

| stato | prima | dopo | perché |
|---|---|---|---|
| Preventivo / da ordinare | ambra | **grigio** | non è ancora cominciato, non chiede niente |
| In lavorazione / ordinato | ambra | **blu** | in corso, ma non tocca a te |
| Pronta / arrivato | verde | **verde** | è il momento in cui si chiama il cliente |
| Consegnata | verde | **grigio** | è finita: deve togliersi di mezzo |
| In ritardo / annullata | rosso | **rosso** | l'unico vero allarme |

Cinque pastiglie colorate in una tabella sono rumore. Due lo sono molto meno.

---

## 2 · La migrazione, misurata

Ho contato sul repo al commit `347dd4c`:

- **86 occorrenze di `ottone`** in **35 file** — `bg-ottone` 19, `text-ottone-scuro` 17,
  `bg-ottone-scuro` 17, `border-ottone` 13, `bg-ottone-soft` 13, `text-ottone` 6,
  `ring-ottone-soft` 1
- **24 occorrenze di `ambra`** usata come stato, in **12 file**
- **`lucide-react` importato in 22 file**

### Sostituzioni meccaniche (si fanno con find/replace)

```
bg-ottone-soft   →  bg-ambra-50
bg-ottone-scuro  →  bg-ambra-700
bg-ottone        →  bg-ambra-500
text-ottone-scuro→  text-ambra-700
text-ottone      →  text-ambra-600      ← 600, non 500: sul chiaro il 500 fa 4.6
border-ottone    →  border-ambra-500
ring-ottone-soft →  ring-ambra-100
```

Una sola trappola: **`text-ottone` diventa `text-ambra-600`, non 500.** L'ambra 500 come
testo su carta sta a 4.6 — passa per il testo grande e non per quello piccolo. Il 600
sta a 6.17 e passa sempre.

### Sostituzioni da guardare a occhio (12 file)

Le occorrenze di `ambra` come stato **non** si possono sostituire in automatico: bisogna
capire caso per caso se quella pastiglia significa «in lavorazione» (→ blu) o «preventivo»
(→ grigio). Sono ventiquattro punti in dodici file, mezz'ora di lavoro attento.

Attenzione a due file in particolare:
- **`components/ui.tsx`** — è il primitivo, quindi ci passa tutto
- **`app/(app)/agenda/page.tsx`** — la pastiglia «In attesa» di G8 è ottone per scelta
  esplicita; nel nuovo sistema una richiesta in attesa è **verde**, perché è un ricavo
  che aspetta una risposta, non un lavoro in corso

---

## 3 · Le icone

`Icone.tsx` espone la stessa firma già in uso sul portale:

```tsx
import { Icona } from "@/components/Icone";
<Icona nome="occhiale" size={17} />
```

60 icone in otto gruppi. Otto sono di ottica pura — occhiale, sole, occhio, lente,
progressiva, lente a contatto, forottero, montaggio — e **non esistono in nessuna
libreria**: sono il motivo per cui il set va disegnato invece che installato.

Tratto **1.75** su riquadro 24: lucide sta a 2, il portale a 1.7. A 17px il 2 impasta la
montatura e il forottero, l'1.7 sparisce sui monitor sbiaditi.

Cinque icone contengono i due punti del marchio, e solo perché lì i due punti **sono** la
cosa rappresentata: `prescrizione` (i centri ottici sulla riga OD/OS), `forottero` (le
lastrine sull'asse), `occhiale` (le lenti sul ponte), `agenda` (due giorni segnati),
`tre-punti`. Nelle altre cinquantacinque non compaiono.

### Il costo, dichiarato

Lucide ha più di mille icone, questo set ne ha sessanta. Il giorno che serve «duplica riga»
non c'è e va disegnata seguendo le regole scritte in testa al file — non presa altrove, o
in sei mesi il set si sporca. È un costo vero e va accettato sapendolo.

Due non le ho fatte apposta: **tessera sanitaria** e **voucher convenzione**. Arrivano con
la fase fiscale e la fase 5, e meritano un significato preciso invece di riciclare «sconto».

---

## 4 · Prima della PR

- [ ] Parte da `main` aggiornato
- [ ] Nessun file in `supabase/` o `lib/` toccato
- [ ] `lucide-react` fuori da `package.json` **solo quando l'ultimo import è sparito**
- [ ] Le 24 occorrenze di `ambra`-stato riviste una per una, non in automatico
- [ ] L'anteprima guardata **da telefono**
- [ ] Il commento di ritorno, entrambe le voci

---

## 5 · Come sono state risolte, una per una

Le sostituzioni meccaniche del §2 sono state applicate tali e quali (89 occorrenze,
35 file: erano 86 più `divide-ottone`, che nel conteggio mancava). Restano le
occorrenze da guardare a occhio. Qui c'è la decisione presa su ognuna, così la
revisione è una lettura e non un'archeologia.

La regola applicata è una sola, in tre righe:

- **l'ambra resta** solo dove il segno è un'**azione** — un link o un pulsante;
- **blu** dove il segno è un'**avvertenza informativa**: dice com'è andata, non
  chiede di premere niente;
- **grigio** dove non chiede niente **e** non informa di niente di nuovo.

| dove | prima | dopo | perché |
|---|---|---|---|
| `WizardChiusura` · scarto ≤ 5 cent | `text-ambra` | `text-neutro-700` | è tolleranza di cassa: esiste, non pesa. Esatto resta verde, oltre resta rosso |
| `WizardChiusura` · caparre senza metodo | `text-ambra` | `text-blu-700` | dice che quel denaro è fuori dal conteggio per metodo: informa, non allarma |
| `AzioniVendita` · nota «vendita da un ordine» | `text-ambra` | `text-blu-700` | idem |
| `cassa/vendite/[id]` · «giornata già chiusa» | riquadro ambra | filetto blu a sinistra | stessa forma dell'errore, colore diverso: si legge per primo e non urla |
| `WizardVendita` · «giornata già chiusa» | riquadro ambra | filetto blu a sinistra | idem |
| `cassa/vendite/[id]` · pastiglia «Riallineamento» | `tinta="ambra"` | `tinta="blu"` | è una provenienza eccezionale del documento, non un guasto |
| `cassa/resi` e `resi/[id]` · «Rimborso» | `tinta="ambra"` | `tinta="blu"` | denaro che esce è una fase, non un allarme |
| `richiami` · tipo di richiamo (×3) | `tinta="ottone"` | `tinta="neutro"` | è una categoria. Trenta pastiglie colorate in un elenco sono rumore |
| `clienti/[id]` · «Tutore: …» | `tinta="ottone"` | `tinta="neutro"` | anagrafica. Il testo si spiega da sé, il colore non aggiunge niente |
| `PrescrizioneCard` · «Ricetta esterna» | `tinta="ottone"` | `tinta="blu"` | provenienza informativa: la prescrizione non l'hai fatta tu |
| `ui.tsx` · `TINTE_FONTE.convenzione` | `"ottone"` | `"neutro"` | una convenzione non arriva dal canale Limpidia. Se la volete distinta a colpo d'occhio è una riga |
| `agenda` · pallino «si sovrappone» | `bg-ambra` | `bg-rosso-500` | due appuntamenti sulla stessa ora è l'unico vero guasto della schermata. Il `title` c'era già: il colore non viaggia da solo |
| `dashboard` · sotto scorta, richiami da fare | riquadro ambra | **resta ambra**, al 700 su 50 | sono `<Link>`: l'ambra è l'azione, e questi portano da qualche parte |
| `clienti/[id]` · articoli fermati | riquadro ambra | **resta ambra**, al 700 su 50 | idem |
| `ui.tsx` · `badgeTinte.ambra` | `bg-ambra-soft text-ambra` | `bg-ambra-50 text-ambra-700` | il 500 su ambra-soft sta a 4.7 e il testo della pastiglia è 12px: il 700 sta a 9.1 |

Una fuori elenco, e va dichiarata perché non è una sostituzione di token.
**La striscia delle richieste in sospeso in `app/(app)/agenda/page.tsx` è passata
da ottone a verde**, insieme al fondo delle righe `in_attesa`. Non l'ho lasciata
ambra per coerenza con la regola: una richiesta dal portale è la stessa cosa di
una busta pronta — qualcuno aspetta che tu faccia una mossa. È un cambio di
`className`, il blocco è rimasto quello di G8; **il ramo 3 lo sostituisce con un
componente.** Se non ci fosse stata, il ramo 1 da solo avrebbe lasciato in pagina
una striscia dello stesso colore del pulsante «Nuovo appuntamento» che le sta sopra.

### Il passo 200 aggiunto a verde, blu e rosso

Non era nel documento originale. Serve ai filetti: il 100 su bianco non si vede e
il 500 su bianco è un bordo che urla. **Non porta mai testo** — è solo `border-*`.
Valori: `verde-200 #BFDFD1`, `blu-200 #C2D7EB`, `rosso-200 #F5C3C8`.

---

## 6 · Cosa non fa questo ramo

Non ristiliza niente. Dopo il merge le schermate saranno **le stesse di prima ma ambra
invece che ottone**, con qualche pastiglia di stato diversa. Il guscio, le scatole e le
figure arrivano dai rami 2, 3 e 4.

Se dopo il merge qualcosa sembra sbagliato, è il ramo 2 che manca — non un errore qui.
