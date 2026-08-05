# Modulo M6 — Agenda & Prenotazioni · Spec (bozza a metodo ROVESCIATO)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. Il modulo PIÙ RICCO del corpus — ed è già VIVO:
G6-G8 in produzione (portale a 3 passi, QR misurato, agenda unica,
sale, richieste), stati a contratto, e2e verdi. Qui non si trascrive la
catena: è roba NOSTRA — la spec fotografa il costruito e propone le
scelte restanti, che sono di gusto («cosa vogliamo»), non di
correttezza. DB quasi intoccato: additive minimi, nessuna tabella
nuova.*

## 0 · Fonti
Migrazioni 010→019 (orari, prenotazioni, crea_prenotazione, agenda
unica, sale, richieste, prendi-come-cliente, fuso) · portale vivo
(/ottica/[slug], prenota ?passo, ?da=qr → fonte 009) ·
`regole/grammatica-dati.json` (binari già classificati) · conti: §12
tassonomia, C1 riprogramma, gemelli disdetta e servizio-ritirato,
incastro-8 (visita→Rx), punto 16 (futuro), gap manuale cap. 06 · M4
f4g (il servizio «prova LAC» tra i prenotabili — parere 04/08).

## 1 · Il modulo in una pagina
Una sola agenda, due porte: il **portale** è la porta del cliente
(prenota in 3 passi, dal QR in vetrina alla conferma; la fonte si
misura da sola), il **banco** è la porta dell'operatore (appuntamenti,
blocchi, sale, richieste). Le prenotazioni entrano `in_attesa`, il
banco accetta, l'agenda unica mostra tutto. Ciò che manca è poco e
nostro: la tassonomia che fa parlare portale e ottico (§12), il
riprogramma, la disdetta del cliente, il ponte visita→Rx. È il modulo
del LANCIO (l'agenda gratuita): ogni scelta qui è anche commerciale.

## 2 · Vocabolario (in gran parte GIÀ A CONTRATTO)
- Stati appuntamenti: `in_attesa → prenotato → (completato | mancato |
  annullato)` ✓ vivo. Prenotazioni: `in_attesa → (accettata |
  rifiutata)`, `accettata → annullata` ✓ vivo. Lista d'attesa:
  `in_attesa → avvisata → chiusa` ✓ vivo.
- Tipi servizio: `prenotabile` · `a_richiesta` (017) ✓ vivo.
- **DECISIONE §12 — la tassonomia ponte [DECISA il 04/08 · 11-bis.1]**: ogni servizio
  del registro guadagna un `tipo_visita` interno FACOLTATIVO —
  `check_up` · `applicazione_lac` · `controllo_lac` ·
  `consegna_ritiro` · `generico` — così il portale parla al cliente
  («Controllo della vista») e l'agenda parla all'ottico (il tipo). Una
  colonna, un registro, zero tabelle. La semina del negozio propone i
  servizi base INCLUSA la «Prova lenti a contatto» (l'esca del
  percorso alto-valore, M4 f4g).

## 3 · I flussi (quasi tutti FOTOGRAFATI dal vivo)
### f6a · Prenotazione dal portale — VIVO ✓
Tre passi, slot da orari−blocchi−sale, `in_attesa` → il banco accetta/
rifiuta; `?da=qr` misura la fonte. (Il cap. 06 del manuale non
documenta ancora le richieste in agenda: nota all'agente-manuali.)
### f6b · Appuntamento dal banco — VIVO ✓
### f6c · Riprogramma (C1) — DEFINITO (04/08)
Due lati, un principio: «non è un dato che ci serve nello storico —
deve essere COMODO per l'ottico». **Dal banco**: «sposta» = un gesto
(sotto: annulla+ricrea con `riprogrammato_da` — il legame serve solo a
MOSTRARE il cambio, nessuna lettura storica prevista). **Dal portale**:
il cliente chiede il CAMBIO DATA dal link firmato → nasce una nuova
prenotazione `in_attesa` legata alla vecchia — e l'ottico VEDE dal suo
portale che quel cliente aveva già fissato e sta chiedendo di
spostare.
### f6d · Disdetta del cliente — DEFINITA (04/08)
Link firmato nel messaggio di conferma (id+firma: azione, non colonna),
niente account. **Finestra: LIBERA** — si può annullare anche
all'ultimo («non siamo sul campo, non conosciamo gli edge; un limite =
limitare il servizio»). E la parte che conta: la visita annullata NON
sparisce — **resta visibile in giornata come "eliminata"**, così
l'ottico lo SA e può richiamare il cliente per capire il perché —
«non solo dirgli che è annullata: dargli gli strumenti per MANTENERE
il cliente». **Priorità dichiarata**: dentro la prima era di
produzione del portale — poco codice, effetto wow.
**Nota di lancio (fuori dal software)**: nei primi mesi, a OGNI
interazione del cliente col portale, NOI chiamiamo l'ottico e gli
raccontiamo cos'è successo — non ci affidiamo solo a ciò che vede.
### f6e · No-show — VIVO ✓ (`mancato`) + lettura win-back → M7.
### f6f · Blocchi, ferie, sale — VIVO ✓
### f6g · Servizio ritirato dall'offerta — gemello, quasi vivo
Il registro si spegne (`attivo=false` su negozi_servizi): sparisce dal
portale, la storia resta. [Verifica colonna in Era 2; additive se
manca.]
### f6h · Il ponte visita→Rx — DECISO (04/08, 11-ter: si costruisce
SUBITO; l'incastro-8, finalmente esistente)
Appuntamento `completato` con `tipo_visita` clinico → scorciatoia
**«Apri Rx»** precompilata: cliente, origine `check_up`, esaminatore =
l'operatore assegnato SE il suo ruolo visita (M2/M10) — altrimenti
vuoto da scegliere. Lettura + scorciatoia: zero obblighi, zero
scritture automatiche.
### f6i · Richieste (017) — VIVO ✓
### (futuro dichiarato) Il controllo programmato dell'Applicazione
scriverà appuntamenti — senso unico modulo→agenda (punto 16).

## 4 · I dati (quasi NULLA — il punto di Ray: core ma non DB-centrale)
```sql
-- servizi (additive):        tipo_visita text  -- registro §12, facoltativo
-- appuntamenti (additive):   riprogrammato_da uuid references appuntamenti
-- prenotazioni (additive):   riprogramma_di uuid references prenotazioni  -- il cambio-data chiesto dal cliente
-- negozi_servizi:            attivo boolean (se già assente)
-- Disdetta: NESSUNA colonna — link firmato = orchestrazione nelle azioni.
-- Nessuna tabella nuova.
```
**Incastri**: fonte prenotazioni → misurazione (009/M9) · mancato →
win-back (M7) · tipo_visita clinico → «Apri Rx» (M2) · prova-LAC nel
seed → semina negozio (M10 §11) · lista d'attesa ← disdetta (§11.5) ·
Applicazione → agenda (futuro, senso unico).

## 7 · Test (contratto)
Contract: colonne additive (tipo_visita, riprogrammato_da,
riprogramma_di) coi loro vincoli. Unit: firma dei link (valida ·
scaduta · manomessa → rifiuto). E2E: S1-S6 per nome. Ereditati: la
suite G resta il pavimento (verde obbligatorio). Rimandati: nessuno.

## 6 · I conti che questo modulo salda
§12 tassonomia → DECISA in §2 (11-bis.1) · C1
riprogramma → f6c (progettato) · gemello disdetta → f6d (progettato) ·
gemello servizio-ritirato → f6g · incastro-8 → f6h (progettato) · gap
manuale cap. 06 → nota all'agente-manuali.

## 8 · Collaudo S1..Sn (bozza)
S1 QR in vetrina → prenota in 3 passi → banco accetta → agenda unica ·
S2 «posso domani?» → un gesto, storia legata, fonte ereditata · S3 il
cliente disdice dal link → slot libero, banco avvisato, [lista
d'attesa: §11.5] · S4 prova-LAC prenotata → completata → «Apri Rx»
precompilata con l'ottico giusto · S5 servizio ritirato → sparito dal
portale, storico intatto · S6 no-show → mancato → il win-back M7 lo
vede.

## 9 · Camminata — verbale
**04/08 · risposte di Ray** (1·2·3·5) integrate. **Check repo dello
stesso giorno**: il lato ottico ESISTE al minimo funzionante —
`app/(app)/agenda` + `AzioniAgenda` (accetta/rifiuta) reggono il giro
completo; le fasi G9-G13 (agenda evoluta) sono specificate FUORI repo,
presso l'altro agente: corsia poi CONFLUITA (vedi §10). Chiuso da 11-ter; sigillo apposto.

## 11-bis · Risposte (04/08)
1. **Tassonomia** ✓ — e la `consegna_ritiro` CONFERMATA col suo
   perché: di solito il ritiro è a discrezione del cliente, ma la
   prenotabilità «crea servizio» — serenità al cliente («arrivo e sono
   seguito») e all'ottico («quel progressivo rognoso: so quando viene,
   mi preparo»). Facoltativa, mai obbligatoria.
2. **Riprogramma** ✓ ridefinito: nessun valore storico — comodità
   operativa; dal portale è una RICHIESTA DI CAMBIO che l'ottico vede
   (f6c). [Check G9-G13: vedi §9.]
3. **Disdetta** ✓ libera, anche all'ultimo; la visita eliminata resta
   visibile in giornata + strumenti per richiamare; priorità prima
   era; concierge nostro nei primi mesi (f6d).
5. **Lista d'attesa** ✓ PROPONE al banco, decide l'ottico — «l'ottica
   non è il SSN: hai più capacità di visite di quante ne fai, e
   praticamente mai un cliente sposta perché s'è liberato un posto».

## 11-ter · La quarta, chiusa (04/08)
4. **«Apri Rx»: si costruisce SUBITO** — colonna e bottone insieme.
   «Rimandarci qualcosa per venti minuti di lavoro non ha senso» — e
   soprattutto: l'agenda è LA PRIMA PARTE che esce in produzione (il
   lancio, prima ancora del gestionale completo), quindi il ponte
   opera già lì. Collocazione: prima era del portale, con la disdetta
   visibile (f6d).

**M6 è COMPLETA e SIGILLATA** (04/08).

## 10 · Congelamento
**Annotazione 1 · 04/08 (audit)** — il §9 citava la corsia G9-G13
«presso l'altro agente, intatta»: SUPERATO la sera stessa — la corsia è
CONFLUITA nell'agenda del gestionale (passata-coerenza, punto G); le
novità M6 vivono nel piano unico (busta B6).
