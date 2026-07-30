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

## 6 · Ritirate dalla revisione 1

- **«Serve uno stato *da guardare* per le prenotazioni».** Esisteva dalla 013:
  `appuntamenti.stato` include `in_attesa`. Chiedevo una cosa già fatta.
- **«Va deciso se una richiesta occupa lo slot subito».** Già deciso e implementato:
  lo occupa, e `rifiutaRichiesta` lo rimette in `slot_liberi` da sé. La mia ipotesi era
  giusta ma la domanda era inutile.
- **«G8 non esiste, l'ho disegnato ma non costruito».** Esiste dal commit `347dd4c`.

---

## 7 · Cosa non ho chiesto, di proposito

- Nessuna coordinata, nessuna distanza — paletto 4.
- Nessun punteggio né ordinamento per rilevanza — paletto 1.
- Nessun prezzo: la sezione «Quanto costa» della pagina commerciale ha l'emblema e il
  titolo, e **nessuna cifra** — paletto 2.
- Nessuna tabella nuova inventata.
