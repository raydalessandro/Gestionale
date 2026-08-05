# Dati che servono al design · caso C (rev. 2)

Riscritto dopo la lettura del repo al commit `347dd4c`. **La revisione 1 era per metà
obsoleta**: chiedeva cose già costruite. Qui restano solo le voci ancora aperte, e in
fondo c'è l'elenco di quelle ritirate, con il motivo.

Dove il dato manca, nei rami metto **valori finti evidenti**, sempre con gli stessi nomi:
Marchetti Elena, `BL-2026-0141`, Ottica Aurora.

---

## 1 · I quattro numeri della giornata

**Dove si vede.** Schermata «Oggi», quattro pastiglie in cima.

**Cosa serve.** Quattro conteggi sul negozio corrente e la data di oggi:

| voce | conteggio | colore |
|------|-----------|--------|
| In ritardo | buste con consegna prevista passata, stato diverso da consegnata | rosso |
| Pronte | buste in stato *pronta* non ancora consegnate | verde |
| Appuntamenti | appuntamenti di oggi | blu |
| Richieste | `appuntamenti.stato = 'in_attesa'` da oggi in avanti | verde |

**Forma.** Quattro interi. Non servono elenchi.

**Esempio.** `{ inRitardo: 1, pronte: 3, appuntamenti: 4, richieste: 2 }`

**Nota.** Il quarto ora è derivabile: la stessa lettura che alimenta la striscia dei
sospesi in `app/(app)/agenda/page.tsx`. Serve solo esporne il conteggio anche fuori
dall'agenda.

---

## 2 · Perché un elenco è vuoto

**Dove si vede.** Le sette figure vuote.

**Cosa serve.** Il messaggio giusto è diverso in ogni caso, ma oggi un elenco vuoto è
indistinguibile da un altro:

| situazione | messaggio | come si riconosce |
|---|---|---|
| Non ha ancora cominciato | «La prima si crea da qui» | zero righe **e** nessun filtro |
| Ha finito tutto | «Nessun richiamo questa settimana» | zero righe nel periodo, ma esistono fuori |
| La ricerca non ha trovato | «Prova con meno lettere» | zero righe **con** filtro o ricerca |
| Guasto | «Il collegamento è caduto» | la lettura è fallita |

**Forma.** Due valori oltre alle righe: se c'è un filtro o una ricerca attiva, e se
l'elenco è vuoto in assoluto o solo nel periodo guardato.

**Esempio.** `{ righe: [], filtroAttivo: false, vuotoInAssoluto: true }`

**Perché conta.** «Nessun risultato» su una schermata vuota solo perché è lunedì fa sembrare
rotto un prodotto che funziona. È il primo giorno di un ottico nuovo.

---

## 3 · Il prossimo gruppo di richiami

**Dove si vede.** Figura vuota dei richiami: «Il prossimo gruppo matura lunedì 3 agosto:
sono undici clienti».

**Forma.** `{ prossimaData: "2026-08-03", quanti: 11 }`, oppure `null`.

**Se costa, si toglie.** Senza il dato la frase diventa «I controlli a dodici mesi entrano
in lista da soli», che funziona lo stesso. Con il numero però l'ottico smette di
ricontrollare a mano, ed è tutto il punto del modulo.

---

## 4 · La scheda aperta al banco

**Dove si vede.** La riga contestuale: «al banco ora: Marchetti Elena · BL-2026-0141».

**Forma.** Può stare tutto sul client, non serve database: un identificativo e un'etichetta,
tenuti finché non si preme «Chiudi scheda».

**Esempio.** `{ tipo: "busta", id: "…", etichetta: "Marchetti Elena · BL-2026-0141" }`

**Nota.** Tocca il comportamento, non lo stile. Il ramo 4 lo può consegnare spento.

---

## 5 · Due domande, non due dati

Non chiedono niente al database: chiedono una decisione.

**5.1 · Le sale.** Con la fase 014 l'appuntamento appartiene a una sala. Un negozio con due
salette ha un'agenda a due colonne — nei miei disegni ce n'è una sola. Prima di disegnare
la vista affiancata vorrei sapere **quanti dei negozi in collaudo hanno più di una sala**.
Se sono zero, la colonna singola resta e la vista a sale si fa quando serve.

**5.2 · Il catalogo a tredici.** Nei mockup della pagina negozio mostravo tre servizi; ora
sono tredici in due gruppi. Le righe grandi da 60px con tredici voci fanno una pagina molto
lunga. Vorrei sapere **quanti servizi attiva in media un negozio**: se sono quattro o cinque
la forma attuale regge, se sono dieci il gruppo «richieste» va compattato.

---

## 6 · Il telefono della richiesta in sospeso

**Dove si vede.** La striscia dei sospesi in cima all'agenda, sotto il nome di chi
ha prenotato. Il componente `StrisciaRichieste` lo accetta già: `telefono` è
facoltativo e se manca non si vede niente.

**Perché serve.** Spesso l'ottico non vuole accettare: vuole chiamare e chiedere —
«guardi, sabato alle 9:30 ho già una consegna, le va bene alle 10?». Senza il
numero deve aprire il giorno, aprire la scheda, tornare indietro, e a quel punto
ha perso il filo. È l'unica voce di caso C dei rami 1–3.

**Non serve nessuna migrazione.** La colonna esiste: `prenotazioni.contatto_telefono`,
ed è già letta venti righe più su nella stessa pagina, per le prenotazioni del
giorno. Manca solo nella lettura delle **sospese**, che sono una query diversa.

**La modifica, per intero** — `app/(app)/agenda/page.tsx`, una parola:

```diff
   const { data: prenSosp } = sospIds.length
     ? await supabase
         .from("prenotazioni")
-        .select("appuntamento_id, contatto_nome, servizio_codice")
+        .select("appuntamento_id, contatto_nome, contatto_telefono, servizio_codice")
         .in("appuntamento_id", sospIds)
     : { data: [] };
```

e poi, nel `map` che costruisce le richieste, una riga:

```diff
             cliente: pr?.contatto_nome ?? "Senza nome",
+            telefono: pr?.contatto_telefono,
```

**Perché non l'ho fatta io.** È una lettura di dati, e le letture sono fuori dal
perimetro di chi fa design (consegna §2). La lascio scritta invece che applicata:
è la regola, e il costo di applicarla è trenta secondi.

---

## 7 · La Scrivania (ramo 6)

Tre blocchi su sei della Scrivania hanno un fondamento nello schema. Tre no, e
sono elencati qui. Il dettaglio è in `RAMO-6-scrivania.md §3`.

### 7.1 · La bolla del fornitore — è prodotto nuovo, non un campo

**Dove si vede.** Il blocco «Arrivati oggi», e il cassetto «Controlla arrivi».

**Cosa presuppone.** Che una consegna del fornitore sia **una cosa**: bolla
n. 4471, quattro pezzi attesi, arrivata alle 07:40, dentro tre ordini di clienti
più due pezzi da esposizione — e che si spunti riga per riga, lasciando in
attesa quello che manca.

**Cosa c'è oggi.** Niente di tutto questo. `ordini_lac` e `ordini_occhiali`
hanno uno stato per ordine (`da_ordinare → ordinato → arrivato → consegnato`).
Un ordine arriva o non arriva; non arriva **parzialmente dentro un pacco
insieme ad altri tre**. Nello schema non esistono bolle, colli né DDT.

**Perché lo segnalo così.** Non è un campo mancante: è **un pezzo di prodotto
nuovo**, con una tabella, uno stato per riga e un flusso di verifica. Vale la
pena farlo — «cosa è arrivato stamattina e per chi» è la domanda delle 8 del
mattino in ogni negozio — ma è una fase, non una prop.

**Nel frattempo** il blocco esiste nell'anteprima con dati finti dichiarati.

### 7.2 · Il registro dei contatti

**Dove si vede.** «sentito il 01/08», «non risponde», «scritto il 03/08».

**Cosa c'è oggi.** `avvisato_il` su buste e ordini LAC: **un timestamp
singolo**, che dice *se* e *quando* hai avvisato, non quante volte, con che
mezzo, né se hanno risposto.

**Forma minima.** Una riga per contatto: `{ documento, quando, canale, esito }`
con esito fra `inviato · risposto · nessuna risposta`. Basta questo per
«non risponde», che è l'informazione che cambia il gesto — se non risponde ai
messaggi lo chiami, e non gli riscrivi.

### 7.3 · Le durate e l'ordine dei suggerimenti

**Dove si vede.** «Cosa puoi fare adesso»: «~4 min», e l'ordine delle cinque voci.

**Non chiedo un dato: chiedo di togliere una stima inventata.** Non c'è niente
nello schema da cui derivare «~4 min», e un tempo inventato è una promessa che
il prodotto non mantiene. Sull'ordine vale il ragionamento del paletto 1: un
punteggio invisibile che decide cosa conta di più, se sbaglia due volte, fa
smettere l'ottico di guardare il blocco più importante della schermata.

**La versione senza dati nuovi**, che secondo me è anche la migliore: niente
punteggio, un criterio **scritto sotto il titolo** — «prima chi ti aspetta oggi,
poi chi aspetta da più giorni». Una riga di testo vale più di qualunque
euristica, perché si può contestare.

---

## 8 · Ritirate dalla revisione 1

- **«Serve uno stato *da guardare* per le prenotazioni».** Esisteva dalla 013:
  `appuntamenti.stato` include `in_attesa`. Chiedevo una cosa già fatta.
- **«Va deciso se una richiesta occupa lo slot subito».** Già deciso e implementato:
  lo occupa, e `rifiutaRichiesta` lo rimette in `slot_liberi` da sé. La mia ipotesi era
  giusta ma la domanda era inutile.
- **«G8 non esiste, l'ho disegnato ma non costruito».** Esiste dal commit `347dd4c`.

---

## 9 · Cosa non ho chiesto, di proposito

- Nessuna coordinata, nessuna distanza — paletto 4.
- Nessun punteggio né ordinamento per rilevanza — paletto 1.
- Nessun prezzo: la sezione «Quanto costa» della pagina commerciale ha l'emblema e il
  titolo, e **nessuna cifra** — paletto 2.
- Nessuna tabella nuova inventata.
