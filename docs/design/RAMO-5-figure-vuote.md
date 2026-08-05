# Ramo 5 · `design/figure-vuote`

Tipo **A + C**: le figure e la copy si consegnano finite, ma il messaggio giusto
in tre casi su quattro dipende da un dato che oggi la pagina non ha. Vedi §5.

Dipende dai rami 1 e 2 (usa `Vuoto`, la scala `neutro-*`, `verde-500`, `rosso-500`).

---

## 1 · Cosa contiene

| file | cosa |
|---|---|
| `components/FigureVuote.tsx` | **nuovo.** Le sette figure e i quattro toni |
| `app/(app)/error.tsx` | **nuovo.** Il confine d'errore del gruppo: è dove vive la settima figura |
| `components/ui.tsx` | una prop **aggiunta** a `Button`: `onClick`. Nessuna tolta |
| 6 pagine | la figura passata a `Vuoto` e la copy riscritta |

---

## 2 · Le sette figure

Sono la **quinta delle cinque famiglie di segni** di `DS-01 §5`, e non sono
icone ingrandite: riquadro 120 invece di 24, tratto 1.8, uso a ~112px. A quella
misura il tratto 1.75 delle icone diventa un filo e il disegno si smaglia.

| figura | tono | dove |
|---|---|---|
| `clienti` | invito | archivio clienti vuoto · dashboard senza clienti |
| `ordini` | invito | nessuna busta, nessun ordine LAC |
| `magazzino` | invito | catalogo senza prodotti |
| `agenda` | invito | giornata senza appuntamenti |
| `fatto` | **conferma** | «Niente da richiamare oggi» |
| `cerca` | **correzione** | la ricerca non ha trovato (clienti, ordini, magazzino) |
| `guasto` | **guasto** | `app/(app)/error.tsx` |

## 3 · I quattro toni, che sono il punto

Questa è la parte facile da sbagliare: **due elenchi vuoti su quattro sono
buone notizie**, e non devono sembrare tristi.

| tono | contorno | colore | vuol dire |
|---|---|---|---|
| **Invito** | tratteggiato | neutro | non hai cominciato |
| **Conferma** | pieno | verde | hai finito |
| **Correzione** | misto | neutro | ho cercato, non ho trovato |
| **Guasto** | pieno | rosso | si è rotto qualcosa |

**Nessuna usa l'ambra.** L'azione è il pulsante sotto la figura: se il disegno
fosse ambra competerebbe col suo stesso pulsante.

**Il contorno dice il tono prima del colore.** Chi non distingue verde da rosso
legge lo stesso «non cominciato» da un tratteggio — è la regola di `DS-01 §1.3`
sull'informazione che non viaggia mai sul colore da sola.

Tre note sui disegni:

- **`cerca` — il misto è letterale, non decorativo.** Il manico della lente è
  **pieno** perché la ricerca è avvenuta davvero; il cerchio è **tratteggiato**
  perché dentro non c'è niente. Dice «ho cercato e non ho trovato», che è
  un'altra cosa da «non hai ancora cominciato» — ed è la distinzione che rende
  utili quattro toni invece di uno.
- **`magazzino` è uno scaffale con tre ripiani e nulla sopra.** Il vuoto è
  letterale: si vede lo spazio libero, non l'assenza di un disegno.
- **`guasto` sono i due punti del marchio con l'asse spezzato**, e le due metà
  sfalsate. Limpidia è il tratto che unisce: quando il collegamento cade, il
  tratto si rompe. È l'unico posto del sistema in cui la firma viene usata al
  contrario, ed è il motivo per cui funziona.

**Il tono non è una prop.** Ogni figura porta il suo dentro di sé: `fatto` è
verde sempre, `guasto` è rosso sempre. Se il tono fosse scegliibile da fuori,
prima o poi qualcuno metterebbe un catalogo vuoto in rosso, e i quattro toni
smetterebbero di voler dire qualcosa.

## 4 · La copy conta più del disegno

Uno stato vuoto non dice «nessun risultato»: dice **quando smetterà di essere
vuoto, e con quanti**. Le sei riscritte:

| dove | prima | dopo |
|---|---|---|
| Clienti · ricerca | «Nessun risultato» | «Nessuno con questo nome» — *la ricerca prende anche pezzi di cognome* |
| Clienti · vuoto | «bastano nome e cognome» | + *da lì partono prescrizioni, buste e richiami* |
| Agenda | «Nessun appuntamento per questo giorno.» | + *le richieste dal portale compaiono qui sopra, nella striscia* |
| Magazzino · filtro | «Cambia ricerca o filtro.» | «Il catalogo ha dei prodotti, ma nessuno che corrisponda» |
| Ordini · vuoto | «Apri la prima busta lavoro» | + *con la numerazione che si assegna da sé* |
| Richiami · da fare | «Niente da richiamare oggi. Buon lavoro.» | + *i controlli a dodici mesi entrano in lista da soli* |

La differenza che conta è la quarta riga. «Cambia ricerca o filtro» lascia
credere che il magazzino sia vuoto; **«il catalogo ha dei prodotti, ma nessuno
che corrisponda» dice che il prodotto c'è e lo stai nascondendo tu.** È lo
stesso elenco vuoto e sono due giornate diverse.

## 5 · Caso C — il dato che manca

Vedi `dati-mancanti.md §2`: oggi **un elenco vuoto è indistinguibile da un
altro**. Le pagine sanno se c'è un filtro attivo (`q`, `stato`, `filtro`) e
tanto è bastato per separare *invito* da *correzione*. Non sanno la terza cosa:
**se l'elenco è vuoto in assoluto o solo nel periodo guardato.**

È la differenza fra «non hai ancora cominciato» e «questa settimana hai finito»
— fra il tono *invito* e il tono *conferma*, cioè fra far sentire un negozio
indietro e fargli sentire che è in pari.

Serve un valore in più accanto alle righe: `{ vuotoInAssoluto: boolean }`.
Dov'è più evidente è il **magazzino**, che oggi mostra sempre l'invito anche a
chi ha quattrocento prodotti e un filtro stretto.

E per i richiami, la frase migliore l'abbiamo già scritta in `DS-01 §5.3` ma
non la possiamo dire: **«Il prossimo gruppo matura lunedì 3 agosto: sono undici
clienti.»** Serve `{ prossimaData, quanti }` — è la voce §3 di `dati-mancanti`.
Senza, la frase resta quella generica che c'è adesso, che funziona ma non fa
smettere l'ottico di ricontrollare a mano.

## 6 · Due cose che ho fatto e che vanno viste

**`app/(app)/error.tsx` è nuovo, ed è l'unico file nuovo sotto `app/(app)/`.**
Lo dichiaro perché il perimetro dice di non riscrivere le pagine. Questo non
riscrive niente: è il confine d'errore del gruppo, e oggi **non esiste** — quando
una lettura fallisce compare la schermata predefinita di Next, che parla inglese
e non assomiglia al gestionale. Non tocca dati e non cambia flussi: si accende
solo quando qualcosa è già andato storto. **Se non lo volete, si cancella il file
e tutto torna com'era.** Senza, la settima figura non ha un posto dove vivere.

**`Button` ha una prop in più: `onClick`.** Nessuna tolta — è facoltativa e i
cinquanta chiamanti esistenti non se ne accorgono. Serviva perché senza
`onClick` un componente client non può usare `Button`, e infatti **oggi non lo
usa nessuno**: `AzioniAgenda`, `AzioniOrdine`, `AzioniMagazzino` e gli altri si
riscrivono le classi del pulsante a mano, ciascuno le sue. Quello è il costo
vero, e questa prop è il primo passo per toglierlo — non è lavoro di questo ramo.

## 7 · Dove NON ho messo una figura, di proposito

Gli elenchi vuoti nel gestionale sono quattordici; le figure sono in sei.

Gli altri otto — movimenti di magazzino, fermi, chiusure di cassa, resi, storico
richiami, metodi di pagamento, prescrizioni nella scheda cliente, vendite del
giorno — sono **elenchi secondari dentro pagine che hanno già contenuto**. Una
figura da 112px lì dentro non conforta nessuno: allontana il resto della pagina
e fa sembrare un problema una sezione che è semplicemente vuota.

`DS-01 §5.3` lo dice esplicitamente e `Vuoto` è costruito per questo: se la
`figura` manca, **lo spazio non viene occupato**. Uno schermo vuoto non va
decorato per forza.

## 8 · Prima della PR

- [x] `npx tsc --noEmit` verde · `npm test` verde (142) · `next build` verde
- [x] Nessun file in `supabase/`, `lib/`, `proxy.ts`, `app/layout.tsx` toccato
- [x] Nessuna figura usa l'ambra
- [x] Ogni tono si distingue anche senza colore (tratteggio / pieno / misto)
- [ ] Le sei copy **vanno lette da un ottico, non approvate in una revisione di
      codice**: sono la parte del ramo che si giudica ad alta voce
- [ ] Anteprima da telefono — non l'ho potuta guardare
