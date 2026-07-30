# Ramo 3 · `design/agenda-richieste`

La passata che la fase G8 aspetta. Dal documento di fase, testuale:

> Riuso dei token e delle classi esistenti (`PillStatoApp`, palette ottone/ambra,
> `Badge`/`tintaFonte`): **nessuno stile nuovo — l'aspetto verrà sostituito da una
> passata di design già preparata.**

---

## File

| file | cosa |
|---|---|
| `components/AzioniAgenda.tsx` | **sostituisce** quello esistente. Logica intatta, aspetto e comportamento di scoperta nuovi |
| `components/StrisciaRichieste.tsx` | **nuovo**. La striscia dei sospesi, estratta dalla pagina |

Dipende dai rami 1 e 2: usa `Icona`, `Errore`, e le scale `verde-*` e `ambra-*`.

---

## La sola modifica alla pagina

`app/(app)/agenda/page.tsx` — si sostituisce il blocco inline della striscia con
il componente. Nient'altro cambia: né le letture, né la logica, né il resto della
pagina.

```tsx
import { StrisciaRichieste } from "@/components/StrisciaRichieste";

// al posto del <section> con i colori dell'ottone:
<StrisciaRichieste richieste={sospese} />
```

Il componente si aspetta per ogni richiesta: `id`, `inizio` (ISO), `giorno`,
`giornoEtichetta`, `servizio`, `cliente`, e `telefono` (facoltativo). I primi
sei la pagina li ha già; **il telefono va aggiunto alla select** — vedi sotto.

---

## Cosa cambia, e perché

### 1 · Da ottone a verde

Nel codice attuale c'è scritto che l'ottone serviva «per saltare all'occhio».
L'ottone non esiste più, e la sostituzione giusta non è l'ambra: **una richiesta
in attesa è la stessa identica cosa di una busta pronta** — qualcuno aspetta che
tu faccia una mossa. Stesso significato, stesso colore.

L'ambra resta all'azione principale del negozio (`Nuova busta`) e non compete.

### 2 · Il campo «motivo» non è più sempre in vista

Prima ogni riga in attesa portava una casella di testo vuota, e ogni riga
prenotata pure. Nel caso normale resta vuota: è rumore su una schermata che si
guarda di sfuggita fra un cliente e l'altro.

Adesso: `Rifiuta` è un pulsante con la sola icona. Premendolo la riga si apre e
compare il campo con `autofocus`, più `Rifiuta` e un tasto per lasciar perdere.
Stessa `<form>`, stesso `name="motivo"`, stessa azione server: **cambia quando
si vede, non cosa fa.**

Idem per `Annulla` sugli appuntamenti prenotati.

### 3 · Bersagli a 44px

La postazione è un tablet. Le righe si alzano di qualche pixel, ed è il prezzo
giusto: `Accetta` e `Rifiuta` sono azioni che cambiano l'agenda di un cliente
vero, e non devono poter essere premute per sbaglio con il bordo del dito.

### 4 · «Prendi come cliente» in formato F2

Tre riquadri separati, e sulla consigliata un **filetto ambra da 3px sul bordo
sinistro**. Niente fondo pieno: la scelta giusta va letta, non toccata per
riflesso — collegare la scheda di un altro è un errore che si scopre mesi dopo.

Provate in pagina intera anche le righe nude (F6, senza riquadri): più eleganti,
e scartate per una ragione pratica. **Su un tablet le righe attaccate si
toccano fra loro** e il dito prende quella sbagliata. Tre bersagli distinti
valgono più dell'eleganza quando la conseguenza è un doppione in archivio.

Il filetto a sinistra è lo stesso segno dell'errore e della riga in attesa in
agenda: sempre a sinistra, sempre a dire «guarda qui prima». Tornare a F6 è una
riga di `className` in `SceltaRiga`, commentata nel file.

C'è anche una terza via che prima non esisteva: **«Non ora»**. Al banco c'è un
cliente che aspetta, e obbligare a decidere subito su un possibile doppione è il
modo migliore per far creare schede sbagliate. L'appuntamento resta valido.

---

## Un dato da aggiungere alla select (caso C)

La striscia mostra il telefono sotto il nome. Non è un vezzo: **spesso l'ottico
non vuole accettare, vuole chiamare e chiedere** — «guardi, sabato alle 9:30 ho
già una consegna, le va bene alle 10?». Senza il numero deve aprire la scheda,
tornare indietro, e a quel punto ha perso il filo.

Serve che la lettura delle sospese porti anche il telefono della prenotazione.
Se è costoso o se il dato non c'è, il componente funziona lo stesso: `telefono`
è facoltativo e se manca non si vede niente.

---

## Cosa NON ho fatto, di proposito

**Accetta e Rifiuta non sono nella striscia.** Si potrebbero mettere e si
risparmierebbe una navigazione — l'avevo proposto. Ma per decidere se accettare
bisogna vedere **se quell'ora è già occupata da qualcos'altro**, e quello si vede
solo aprendo il giorno. La striscia è un indice, non un banco di lavoro.

**Le righe in attesa restano nella sequenza oraria del giorno**, non raccolte in
cima. Stesso motivo: la posizione nell'orario *è* l'informazione che serve per
decidere. Si distinguono con un filetto verde a sinistra e il fondo appena tinto.

**Non ho toccato `PillStatoApp`.** Prende i colori da `STATI_APPUNTAMENTO` in
`lib/utils.ts`, che è fuori perimetro. La riassegnazione — `in_attesa` da ottone
a verde — è pronta da incollare in `RAMO-2-componenti-base.md`. **Finché non la
applicate, la pastiglia resta ottone mentre la striscia è verde**: è l'unico
punto in cui i due rami si vedono disallineati.

---

## Prima della PR

- [ ] Rami 1 e 2 già dentro
- [ ] `npx tsc --noEmit` verde
- [ ] Le guardie passano: `tests/unit/guardie.test.ts` controlla che
      `AzioniAgenda.tsx` continui a passare da `prendiComeCliente` (G19b)
- [ ] `tests/contratto/prendi-cliente.test.ts` verde
- [ ] Provato **da tablet**: accettare, rifiutare con motivo, rifiutare e
      lasciar perdere, prendere come cliente in tutte e tre le vie
- [ ] `lib/` e `supabase/` non toccati
- [ ] Commento di ritorno, entrambe le voci
