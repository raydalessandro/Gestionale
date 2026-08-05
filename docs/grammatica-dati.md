# La grammatica dei dati — le sei classi di limpidia

*Scritta la notte del 28/07/2026, per navigare l'Era 1. Non è teoria
importata: è il nome dato a come questa base è GIÀ costruita, più le
regole per non tradirla. Fonti nobili per chi vuole approfondire: CQS/CQRS
(separazione comandi-letture), event sourcing («i contabili non usano la
gomma»), macchine a stati, aggregati DDD. Qui: la versione da banco.*

## Le sei classi

Ogni tabella, ogni colonna, ogni passo di flusso appartiene a UNA di
queste classi. Nelle spec dell'Era 1 la classe si dichiara sempre.

### 1 · FATTO — si scrive, rimane per sempre
L'evento accaduto: non si corregge, semmai si CONTRO-scrive (annullo
tracciato, rettifica con segno). *In casa*: movimenti di magazzino,
vendite emesse, chiusure, resi, movimenti di cassa, il consenso datato
(la data È il fatto), le prenotazioni ricevute.
**Regola**: append-only; niente UPDATE che riscrive la storia; il tempo
del fatto è il tempo di business (quando è successo al banco), non il
`created_at` tecnico.

### 2 · STATO GUIDATO — si scrive qualcosa che cambia, ma su binari
L'entità con un ciclo di vita: cambia, però solo lungo transizioni
ammesse. *In casa*: buste, ordini LAC, appuntamenti, prenotazioni,
fermi.
**Regola**: mappa delle transizioni nel contratto; stato riletto prima
di scrivere; le righe modificate si verificano (niente no-op silenziosi);
ogni transizione importante lascia un FATTO o una data accanto a sé
(`data_consegna`, `caparra_incamerata_il`).

### 3 · ANAGRAFE — si modifica liberamente, conta il presente
La descrizione corrente delle cose: clienti, prodotti (nome, prezzo di
listino, parametri), orari, sale.
**Regola**: modificabile senza rimorsi — MA proprio per questo nessun
FATTO può *puntare* a un'anagrafe per un valore che domani cambierà:
quel valore si fotografa (→ classe 6).

### 4 · REGISTRO — il vocabolario, cambia lentissimo
Le liste di riferimento: metodi di pagamento, servizi, causali, ruoli,
tipi. *In casa*: sono per lo più check-constraint (vocabolario nel DB) o
tabelle con `attivo`.
**Regola**: le voci si spengono, non si cancellano; ampliare è additivo,
rinominare è vietato (i fatti vecchi le citano).

### 5 · PROIEZIONE — si legge, e si può sempre ricostruire
Il derivato: giacenza (cache dai movimenti), contanti attesi, contatori
di dashboard, code dei richiami, qualunque KPI.
**Regola**: MAI sorgente di verità; formula UNICA condivisa tra le
superfici che la mostrano (lezione della cassa); ricostruibile dai fatti
in ogni momento — se non lo è, manca un fatto o un'istantanea, e il
problema è a monte. Le proiezioni *analitiche* (dashboard) si
costruiscono quando si vuole; le proiezioni *operative* (numeri su cui
l'operatore agisce: cassetto atteso, disponibile) hanno la formula
sigillata in spec insieme al flusso che le usa.

### 6 · ISTANTANEA — il ponte tra scrittura e lettura
Il valore copiato DENTRO un fatto nel momento in cui accade, perché
domani l'anagrafe sarà diversa: prezzo di riga nella vendita, metodo e
data della caparra, DNP sulla busta, il futuro `valore_unitario` sugli
smaltimenti.
**Regola**: si decide nel racconto, mai dopo — un'istantanea non
scattata è persa per sempre, retroattivamente inconoscibile.

## L'incastro maschio-femmina

**Una lettura può consumare soltanto FATTI e ISTANTANEE** (le proiezioni
sono a loro volta fatte di quelli). Se una lettura futura non trova
l'incastro, non si aggiusta la lettura: mancava il maschio nella
scrittura. Da qui le due domande fisse del contro-interrogatorio, per
ogni flusso che scrive:

1. *«Cosa dovrà essere leggibile, un giorno, da questo gesto?»*
2. *«Cosa fotografo adesso perché domani sarà diverso?»*

E la regola rossa già incisa in C0: le letture possono vivere sul
fronte; **denaro e giacenza si muovono solo lato server**.

## Dove vive la logica (la storia che Ray ha intuito giusta)

Anni '80-'90: logica nel database. Anni 2000: esodo nel codice
applicativo (il DB era il ferro costoso, gli app server scalavano).
Oggi: l'inversione — Postgres come piattaforma di integrità (vincoli,
RLS, trigger, funzioni), ed è la scommessa su cui è costruita Supabase.
**La nostra riga di confine**: l'INTEGRITÀ vive nel DB (vocabolari,
transizioni difendibili, tenant, numerazioni, cache di giacenza);
l'ORCHESTRAZIONE vive nelle azioni (comporre passi, parlare con
l'utente); la PRESENTAZIONE vive nel fronte. Quando un dubbio chiede
«dove lo metto?», si risponde con la classe: i FATTI e i loro guardiani
stanno in basso, i racconti in mezzo, i pixel in alto.


## Il ponte con La Chiave (confermato il 29/07)

Dalla *Grammatica delle Cose* (l'Atlante dei 72 stati — Ray D'Alessandro,
EAR Lab · Spirale Editrice) questo progetto prende in prestito DUE
strumenti, e solo quelli, per il metodo dell'Era 1:

1. **La domanda del gemello** — terza domanda fissa del
   contro-interrogatorio: *ogni gesto + ha il suo gesto −, gestito o
   escluso per iscritto?* Il registro vivo delle coppie è in
   `docs/regole/ponte-chiave.json` (con i «da verificare» già trovati:
   revoca dei consensi, disdetta dal portale, riprogramma, rettifica
   clinica, uscita di un utente, anonimizzazione).
2. **La scala di gravità 1·3·6·9** (modo · asse · polo · attributo) come
   misura di ogni modifica nelle camminate: il costo è il livello più
   profondo toccato; il cambio d'attributo (9) non si fa in corsa — che
   è il nostro «vocabolario intoccabile» detto in astratto.

**Interfaccia a senso unico**: La Chiave parla al metodo, il metodo alla
grammatica, la grammatica al database. Le sigle Σ non entrano mai nel
DB, nel codice o nelle migrazioni. Le regole consultabili «sopra il
database» vivono in `docs/regole/` (JSON descrittivi: fotografano il
contratto; in conflitto vince il DB).