# Ramo 4 · `design/guscio-gestionale`

Il guscio è la variante **X3** di `DS-01 §4.1`. È l'unica cosa che si vede su
tutte e ventiquattro le schermate, quindi è anche l'unico posto dove un errore
si paga ventiquattro volte.

Dipende dai rami 1 e 2. Sostituisce `components/Sidebar.tsx`, che sparisce.

---

## 1 · Cosa contiene

| file | cosa |
|---|---|
| `components/Guscio.tsx` | **nuovo.** Colonna, barra, e lo spazio della riga contestuale |
| `components/Sidebar.tsx` | **eliminato** |
| `components/Icone.tsx` | otto icone in più: 68 in tutto |
| `app/(app)/layout.tsx` | due righe: `<Sidebar>` diventa `<Guscio>` che avvolge il contenuto |
| 21 file in `app/` e `components/` | ogni import di `lucide-react` sostituito con `Icona` |
| `package.json` | **`lucide-react` esce.** Zero import rimasti |

---

## 2 · La forma, e da dove viene

```
┌──────────────┬────────────────────────────────────────┐
│  limpidia ··  │  [ cerca F3 ] [Trova cliente] [Vendita]│
│              ├────────────────────────────────────────┤
│ ┌──────────┐ │  ← lo spazio della riga contestuale     │
│ │+ Nuova   │ │    (vuoto in questo ramo, vedi §5)      │
│ │  busta F2│ │                                        │
│ └──────────┘ │                                        │
│  Oggi     ·· │                                        │
│  Ordini      │             contenuto                  │
│  Magazzino   │                                        │
│  Agenda      │                                        │
│  Richiami    │                                        │
│  Cassa       │                                        │
│              │                                        │
│  Ottica …    │                                        │
│  Anna · Esci │                                        │
└──────────────┴────────────────────────────────────────┘
   212px
```

**La postazione è un tablet in orizzontale**, e da lì discende tutto: larghezza
in abbondanza, altezza scarsa. **La colonna costa poco, ogni fascia orizzontale
costa il doppio.** Di fasce ce n'è una sola, e non porta numeri — i numeri della
giornata vivono dentro *Oggi*, che è il posto dove si va a leggerli.

Bersagli a **48px** e non 44 come nei primitivi: qui si preme in piedi, con un
cliente davanti. 8px fra due bersagli. **Nessuna etichetta rivelata dal
passaggio del mouse**: su un tablet l'hover non esiste, e una parola o è scritta
o non c'è.

## 3 · Le decisioni dentro la struttura

**Sei moduli, non sette.** *Clienti* esce dalla colonna. Un cliente si raggiunge
cercando un cognome, mai scorrendo un elenco di quattromila: vive nella ricerca
e nel pulsante «Trova cliente», che sono due gesti veri. La rotta `/clienti`
resta esattamente dov'era e resta raggiungibile — il pulsante ci porta.

**`lib/modules.ts` non l'ho toccato**: è fuori perimetro ed è la fonte unica
delle rotte, quella su cui poggiano le guardie G7 e G9. Il guscio decide solo
*come si presenta*: quali voci vanno in colonna (`IN_COLONNA`) e con che nome
(`NOMI`). Sono due costanti di dieci righe in cima al file.

Una conseguenza da guardare: **«Dashboard» diventa «Oggi» nel guscio ma resta
«Dashboard» nel registro.** «Dashboard» è la parola di chi scrive software;
«Oggi» è la parola di chi apre il gestionale alle nove per sapere cosa lo
aspetta. Se siete d'accordo, il rinomino vero va fatto in `lib/modules.ts` da
qualcuno che ci può mettere le mani, e allora la mappa `NOMI` **si toglie, non
si aggiorna**.

**«Nuova busta» è grande e sta nella colonna**, le altre due azioni sono piccole
accanto alla ricerca. Non sono la stessa cosa: una apre una lavorazione da
quattrocento euro, l'altra batte uno scontrino da dodici.

**F2 / F3 / F9 restano attivi** se c'è la tastiera agganciata. Non costano
spazio e regalano ai veterani di FOCUS l'unico pezzo di memoria muscolare che
conta. Non sostituiscono niente: ogni tasto ha il suo bersaglio scritto in
chiaro a due centimetri di distanza, e la sigla è stampata sul bersaglio.

**Il marcatore della voce attiva sono i due punti del marchio**, e stanno a
destra. A sinistra ci sono le icone, e due segni sullo stesso bordo si leggono
come uno solo. Su fondo scuro sono `ambra-300`: `ambra-500` su `neutro-950` fa
3.84, sotto soglia.

**La ricerca è un `form` GET verso `/clienti?q=`.** Funziona senza JavaScript,
e tiene aperta la porta dell'archivio — che è la domanda 4 di `DS-01 §9`:
cercare un cliente e sfogliare l'elenco sono due gesti diversi. Qui il campo fa
il primo e il pulsante «Trova cliente» fa il secondo, senza deciderlo per voi.

**Sotto i 768px la colonna diventa una striscia orizzontale che scorre**, come
faceva la Sidebar. Su un telefono la colonna non ci sta, e mettere le voci
dietro un panino significa nasconderle. «Nuova busta» in quel caso si sposta
nella barra, ed è l'unica ambra della schermata.

## 4 · Le otto icone nuove

Era il costo dichiarato del set proprietario: «la sessantunesima va disegnata
seguendo le regole, non presa altrove, o in sei mesi il set si sporca». Sono
arrivate insieme, tutte per lo stesso motivo — servivano a togliere
`lucide-react` senza lasciare buchi.

| icona | copre | prima era |
|---|---|---|
| `luogo` | l'indirizzo nella scheda cliente | `MapPin` |
| `cliente-nuovo` | «Nuovo cliente» | `UserPlus` |
| `scatola-cerca` | cerca a catalogo dentro i wizard | `PackageSearch` |
| `scatola-piu` | carico di magazzino | `PackagePlus` |
| `agenda-piu` | «fissa un appuntamento» dalle azioni ordine | `CalendarPlus` |
| `segnalibro` | ferma un articolo per un cliente | `BookmarkPlus` |
| `cursori` | rettifica di giacenza | `SlidersHorizontal` |
| `bacchetta` | i template rapidi di prescrizione | `Wand2` |

Le quattro col «più» lo portano **sempre nello stesso angolo**, in basso a
destra, con la stessa croce da 6: così «aggiungi» si legge come una parola sola
su tutte e quattro invece che come quattro disegni diversi.

## 5 · Cosa NON c'è, e perché

**La riga contestuale.** È la parte del guscio che risolve il guasto più costoso
del banco — il telefono che squilla a metà di una busta — e nel disegno è la più
convincente. Non è qui, e non per mancanza di disegno.

Perché funzioni, **ogni pagina di dettaglio deve dire chi ha aperto**: la busta,
il cliente, l'ordine. È una riga di logica dentro `app/(app)/**`, moltiplicata
per otto pagine, e sta fuori dal perimetro di chi fa design. Nel guscio c'è lo
spazio, con il commento che dice cosa ci va; la forma del dato è in
`dati-mancanti.md §4` ed è tutta lato client, nessun database.

**Se volete, questa è la prima cosa da fare dopo il merge**, ed è mezza giornata.

**`STATI_FERMO` e le altre pipeline** restano quelle vecchie finché non si
incolla il blocco del ramo 2 in `lib/utils.ts`.

**«VISTA» nel README e nei documenti.** Il wordmark del guscio adesso dice
`limpidia` — quello era mio. Il `README.md` dice ancora «VISTA Gestionale, il
cuore della suite VISTA», e `DS-01 §0` dice che il nome va tolto **ovunque**.
Non l'ho fatto: rinominare il prodotto nel documento d'ingresso del repo tocca
altre app della suite e non è una decisione che prendo da solo in un ramo di
design. **Va fatta, e va fatta in un ramo suo.**

## 6 · Prima della PR

- [x] Parte dal ramo 2 (che parte dal ramo 1)
- [x] Nessun file in `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx` toccato
- [x] `npx tsc --noEmit` verde · `npm test` verde · `next build` verde
- [x] Zero import di `lucide-react` rimasti, e la dipendenza è fuori da `package.json`
- [x] Le rotte non cambiano: `/clienti` esce dalla colonna ma resta raggiungibile
- [ ] Anteprima guardata **da tablet, in orizzontale** — non l'ho potuta guardare
- [ ] `IN_COLONNA` e `NOMI` sono due decisioni di prodotto travestite da costanti:
      **vanno lette da un ottico**, non approvate in una revisione di codice

## 7 · Una domanda che resta aperta

`DS-01 §9.6`: **l'altezza del guscio.** La barra qui è alta 65px, non 88 come nel
disegno originale — ho tolto la fascia dei numeri, che è quello che la faceva
crescere. Su un portatile da 13" in retrobottega 65px si sentono meno, ma si
sentono. La domanda resta la stessa: **il piano dei moduli si assottiglia quando
si scorre?** Io direi di no — una barra che si muove mentre leggi è peggio di una
barra alta — ma è da guardare su uno schermo vero.
