# Decisione ID-01 · Il modello di identità

**Stato**: decisa · **Blocca**: G6 e tutto ciò che scrive prenotazioni
**Da leggere prima di**: toccare `persone`, `prenotazioni`, `clienti`

---

## La domanda

Maria inquadra il QR di Ottica Rossi e prenota una visita. Fra otto mesi prenota da Ottica Bianchi, in un'altra zona. Fra due anni torna da Rossi.

Chi è Maria, per il sistema? E chi possiede il dato che la riguarda?

---

## La distinzione che scioglie tutto

Il nodo non è tecnico, è concettuale. Ci sono **due cose diverse** che sembrano una sola:

**La proprietà del dato — non si sposta mai.**
Il cliente che Rossi ha creato, con le sue prescrizioni, i suoi ordini, le sue vendite, resta di Rossi per sempre. Anche quando quella persona va da Bianchi. Rossi continua a vederlo, continua a vedere lo storico fatto da lui, continua a poterlo chiamare — perché è **suo** cliente, nel suo database, con la sua base giuridica.

**Il riferimento commerciale — si sposta.**
Un puntatore, uno solo, che dice «adesso questa persona fa capo a Bianchi». Governa **soltanto** le comunicazioni che partono da noi o che noi intermediamo.

Separate così, il problema sparisce: **nessun ottico perde niente.** Rossi non perde il cliente, non perde lo storico, non perde il diritto di scrivergli dal proprio gestionale. Perde solo l'essere il negozio attraverso cui *noi* instradiamo. È molto meno di quanto sembrasse, ed è per questo che il modello regge.

---

## Il modello

Tre entità, due proprietari.

| Entità | Di chi è | Cosa contiene |
|---|---|---|
| `persone` | **Limpidia** | Una riga per essere umano. Nessun `azienda_id` |
| `clienti` | **Il negozio** | Invariata. `azienda_id` + RLS come oggi |
| `prenotazioni` | Limpidia, per conto del negozio | Porta `persona_id`, `azienda_id`, e `cliente_id` che resta vuoto finché l'ottico non accetta |

Non è sovra-ingegneria: sono **due titolari del trattamento diversi**, con due basi giuridiche diverse. Noi rispondiamo di `persone`, l'ottico risponde dei suoi `clienti`. La forma delle tabelle rispecchia la realtà legale.

---

## Le cinque regole decise

### 1 · La persona nasce alla prima prenotazione, senza account

Nessuna password, nessuna registrazione, nessuna riga in `auth.users`. La persona scrive nome e telefono, il sistema trova o crea la riga in silenzio.

Una colonna `auth_user_id` nullable resta pronta per quando ci sarà l'area personale. Creare un utente di autenticazione per ogni prenotazione appesantirebbe tutto per una funzione che non esiste ancora.

### 2 · L'identificatore è il telefono, normalizzato

In Italia, con questa clientela, l'email spesso manca o è sbagliata; il numero c'è sempre. Va normalizzato in formato internazionale **prima** di confrontarlo, o `340 1234567`, `+393401234567` e `3401234567` diventano tre persone diverse. Email facoltativa.

### 3 · Il legame persona ↔ cliente lo crea il negozio, all'accettazione

Mai automatico, mai fra negozi diversi. L'ottico accetta la prenotazione, riconosce la persona o la crea come cliente nuovo, e in quel momento `cliente_id` si riempie.

**Nessuna tabella ponte**: il legame vive già dentro `prenotazioni`. La domanda «questa persona è già mia cliente?» si risponde interrogando le proprie prenotazioni.

### 4 · Chi prenota per un altro non diventa un'altra persona

Il caso «la mamma prenota per sé e per la figlia» si risolve con un campo `per_conto_di` sulla prenotazione: una persona, due prenotazioni, con scritto sopra chi è il paziente. Non si creano identità finte. Sarà l'ottico, in accettazione, a creare due clienti distinti se serve.

*(Questo chiude anche ID-04.)*

### 5 · Il riferimento si sposta per atto esplicito, non per automatismo

Il negozio ha un pulsante — **«acquisisci cliente»** — disponibile sulla scheda di una persona che ha una prenotazione **già accettata** con lui. Chi lo preme si prende una responsabilità, e resta scritto chi è stato.

**Vincolo di accesso**: senza quella prenotazione accettata il pulsante non esiste. Altrimenti diventa un modo per rivendicare chiunque, e il primo che se ne accorge lo usa.

Niente regola automatica del tipo «l'ultimo che l'ha toccata»: fra un anno nessuno saprebbe rispondere a «perché questa persona risulta di Bianchi?».

**Struttura richiesta:**

- `persone.ottico_di_riferimento` — `azienda_id` nullable
- `persone_riferimento_registro` — in sola aggiunta: persona, da quale azienda, a quale azienda, quando, chi ha premuto, quale prenotazione lo autorizzava

Il registro non è un lusso: è l'unica cosa che permette di rispondere a quella domanda fra un anno.

---

## Cosa vede chi

| | La persona | Il negozio | Limpidia |
|---|---|---|---|
| Le proprie prenotazioni, su tutta la rete | **sì** | no | sì |
| Le prenotazioni fatte presso quel negozio | sì | **sì** | sì |
| Le prenotazioni presso altri negozi | sì (sono sue) | **mai** | sì |
| I clienti del negozio | — | **solo i propri** | no, per policy |
| Lo storico vendite | proprio, per negozio | **solo il proprio** | vedi sotto |

**Il negozio non interroga mai `persone`.** Legge soltanto le proprie tabelle. La tentazione, fra sei mesi, sarà «mostriamo all'ottico che il suo cliente va anche altrove»: è la riga che non si attraversa. Se la attraversiamo una volta, la promessa su cui si vende tutto il progetto è finita.

### Prenotazioni e vendite non sono la stessa categoria

- **Le prenotazioni sono nostre per costruzione.** Passano da noi, le generiamo noi. Possiamo mostrarle alla persona su tutta la rete senza chiedere niente a nessuno
- **Le vendite sono del negozio.** Vivono nelle sue tabelle. Ospitare il database non ci dà il diritto di usarle, e il primo ottico che chiede «perché vedete i miei incassi?» ha ragione

Quindi alla persona, in versione uno, si promette lo **storico delle prenotazioni e delle visite** su tutta la rete. Lo storico vendite multi-negozio diventa possibile **solo se ogni negozio pubblica un riassunto**: è un accordo di rete, non una funzione del software.

**Da non promettere prima di allora**, né sul portale né in negozio.

---

## Come si dice all'ottico

La frase precisa, perché quella approssimativa si sgretola alla prima verifica:

> «Sei l'unico a cui instradiamo le comunicazioni che partono da Limpidia per questa persona, e quelle escono col tuo nome.»

**Non**: «sei l'unico che gli può scrivere». Se quella persona era già cliente di un altro negozio da una visita precedente, quel negozio ce l'ha nel proprio database, con il proprio consenso, e può continuare a scrivergli. Sono fatti suoi e non li governiamo.

E il pulsante **non crea il consenso**: se la persona non ha dato il consenso commerciale non parte niente lo stesso. Il consenso vive sul record cliente del negozio, gestito dalla fase 4d.

---

## Le prenotazioni non si cancellano mai

Le date delle prenotazioni sono la materia prima dei richiami: «è passato un anno dall'ultimo controllo della vista». Una disdetta **cambia stato**, non elimina la riga. Nessuna cancellazione fisica, mai — salvo richiesta di cancellazione dell'interessato, che è un'altra procedura e va gestita a parte.

---

## Cosa non costruiamo adesso

- L'instradamento vero delle comunicazioni e i richiami di rete: hanno senso quando ci sono negozi veri, oggi ne abbiamo zero
- Il pop-up «vuoi diventare cliente di questo ottico?» durante la prenotazione: è una scelta di interfaccia, si decide dopo
- Lo storico vendite di rete: richiede l'accordo di rete
- L'area personale della persona: più avanti, e lontano dal portale

**La struttura sì, la politica dopo.** Le colonne e il registro nascono ora perché aggiungerli dopo significa migrare dati vivi; le regole di comportamento si affinano mentre il gestionale cresce.

---

## Conseguenze per G6

Le tabelle da creare nella migrazione del portale:

- `persone` — identificatore telefono normalizzato, email facoltativa, `auth_user_id` nullable, `ottico_di_riferimento` nullable
- `prenotazioni` — `persona_id`, `azienda_id`, `cliente_id` nullable, `per_conto_di`, servizio, `inizio`, durata, stato, `fonte`
- `persone_riferimento_registro` — in sola aggiunta
- `lista_attesa` — dal prototipo v2-1

Con le regole già note: RLS su tutte, revoca esplicita di `select` ad `anon` su tutte, trigger di coerenza tenant dove ci sono FK, e il negozio che non raggiunge mai `persone`.
