# Consegna design · piano dei rami (rev. 2)

Aggiornato dopo la lettura del repo al commit `347dd4c` — *G8 · Le richieste dentro
l'agenda*. **Sostituisce la revisione 1**, che era stata scritta su uno stato più vecchio
e in tre punti diceva cose sbagliate.

Riferimento di processo: `consegna-design-modo-di-lavorare.md`.
Nessun ramo tocca `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx`.

---

## 0 · Cosa avevo sbagliato

Lo scrivo per primo perché cambia il resto.

**Il percorso di prenotazione non è a cinque passi. Sono due percorsi.** La 017 ha
introdotto i servizi di tipo *richiesta* — niente durata, niente slot — con un ramo a
**tre passi** (Servizio → Dettagli → Invia) accanto a quello a cinque. Nella fase c'è
scritto testualmente che è stata fatta prima del design «perché chi disegna il 5-passi e
poi scopre che ne esiste uno a 3 rifarebbe il lavoro». Io il 5-passi l'ho disegnato senza
saperlo.

**Il danno però è piccolo, e per un motivo fortunato:** l'anello di avanzamento che ho
messo negli emblemi è una frazione, non una tacca fissa. Sul ramo corto diventa un terzo,
due terzi, cerchio chiuso. E i cinque emblemi disegnati contengono già i tre che servono —
*servizio*, *dati*, *conferma*. Il ramo a tre passi **non richiede disegni nuovi**, solo
tre valori diversi dell'anello.

**G8 esiste già.** Nella revisione 1 chiedevo uno stato «da guardare» per le prenotazioni:
esisteva dalla migrazione 013 (`appuntamenti.stato` include `in_attesa`) e la 018 ha chiuso
il giro. Chiedevo anche di decidere se una richiesta occupa lo slot subito: è già deciso —
lo occupa, e il rifiuto lo libera da sé. **Quel documento dati era per metà obsoleto.**

**La pagina negozio ha due gruppi, non uno.** «Servizi su appuntamento» con durata e griglia
slot, e «Serve altro? Ti rispondiamo entro 24 ore» senza slot. Nei miei mockup c'era un
elenco solo. E il catalogo ha **13 servizi**, non i tre che avevo messo.

---

## 1 · Quello che il repo sta già aspettando

Dalla fase G8, testuale:

> Riuso dei token e delle classi esistenti (`PillStatoApp`, palette ottone/ambra,
> `Badge`/`tintaFonte`): **nessuno stile nuovo — l'aspetto verrà sostituito da una passata
> di design già preparata.**

Quindi c'è una consegna precisa che aspetta, ed è la più urgente di tutte: **la striscia
delle richieste in sospeso e le righe `in_attesa` dentro l'agenda.**

Una nota su dove sta. Nella tavola 08 avevo argomentato che l'inbox andasse nella barra
scura accanto all'utente, perché «non è un posto dove vai, è una cosa che arriva». Voi
l'avete messa **dentro l'agenda, sopra la navigazione**. Ci ho ripensato e avete ragione
voi: l'agenda è una sola, e una richiesta si accetta guardando il giorno in cui cadrebbe —
separarla dal calendario avrebbe costretto a due schermate per un gesto solo. Adatto il
disegno alla vostra collocazione, non il contrario.

---

## 2 · I rami, in ordine

| # | Ramo | Tipo | Contiene | Dipende da |
|---|------|------|----------|------------|
| 1 | `design/token-e-icone` | A | scale `ambra2-*` e `neutro-*` **additive**, `components/Icone.tsx` (60 icone) | — |
| 2 | `design/componenti-base` | A | scatole, tendine, pulsanti, campi, `PillStatoApp`, `Badge`, tabella/schede | 1 |
| 3 | **`design/agenda-richieste`** | A | **la passata che G8 aspetta**: striscia sospesi, righe `in_attesa`, azioni Accetta/Rifiuta, «Prendi come cliente» | 1, 2 |
| 4 | `design/guscio-gestionale` | A | colonna a sei voci, ricerca, riga contestuale; sostituisce `Sidebar.tsx` | 1, 2 |
| 5 | `design/figure-vuote` | A + C | sette figure vuote e la loro copy | 2 · doc dati |
| 6 | `design/portale-ristile` | A | ristilizzazione pagina negozio (**due gruppi**) e `WizardPrenota` (**due rami, 5 e 3 passi**) | 1, 2 |
| 7 | `design/emblemi` | A | emblemi di sezione, dei passi, pittogrammi da stampa, incisioni in `public/marchio/` | 1 |
| 8 | `design/home` | B | pagina commerciale, sei sezioni | 7 |
| 9 | `design/marchio-asset` | A | `public/marchio/**`, favicon, `opengraph-image.tsx` | — |

**Il 3 è salito in cima** rispetto alla revisione 1: è l'unico che qualcuno sta aspettando
davvero. Il 9 resta indipendente e chiude un debito vostro già annotato.

---

## 3 · Cosa manca ancora al disegno

Cose emerse dalla lettura del repo che **non ho disegnato** e che vanno fatte nel ramo 3 o 6.

**«Prendi come cliente».** La 018 introduce l'atto che trasforma chi ha prenotato dal
portale in un cliente del negozio, con una biforcazione vera: `cliente_per_telefono`
**propone di collegare** un cliente esistente invece di creare un doppione. È una scelta a
tre vie — collega questo / creane uno nuovo / non ora — ed è il momento in cui il portale
diventa clientela. Merita una schermata pensata, non un menù a tendina.

**Il catalogo a 13 servizi.** Nei mockup ne mostravo tre. Con tredici divisi in due gruppi
la pagina negozio cambia proporzioni: va rivisto se le righe grandi da 60px reggono, o se il
gruppo «richieste» vuole una forma più compatta.

**Le sale (fase 014).** L'appuntamento appartiene a una sala, non al negozio. Un negozio con
due salette ha un'agenda a due colonne. Nei miei disegni l'agenda è una colonna sola: va
verificato se serve la vista affiancata, ed è una domanda che va fatta a un ottico con due
sale, non decisa a tavolino.

---

## 4 · Regole che valgono per tutti i rami

Invariate dalla revisione 1, le riporto perché servono.

**Colore.** L'ambra compare due volte per schermata al massimo: azione principale e voce
attiva. Non è mai uno stato. Su fondo scuro `ambra2-300`, mai il 500 (fa 3.84, sotto soglia).
I token si **aggiungono**: `ottone` e `lim-*` restano dove sono e non si toccano.

**Movimento.** Solo `transform`, `opacity`, `stroke-dashoffset`. Mai `cx`, `cy`, `r`, `x1`,
`x2` — WebKit non li muove e falliscono in silenzio su iPhone. Mai un `<g>` dentro un
`<clipPath>`. Sempre `prefers-reduced-motion`.

**Dove si spendono le firme.** Incisioni, emblemi grandi e animazioni del logotipo stanno sul
portale, sulla pagina commerciale e sulla carta. Dentro il gestionale no: le uniche due
ammesse sono il diaframma di attesa e il pulsare degli elenchi.

**Tablet.** Bersaglio minimo 48px, nessuna etichetta dietro un passaggio del mouse, 8px fra
due bersagli.

**Carta.** Pittogrammi stampati sempre in nero: le stampanti da negozio sono monocromatiche.
