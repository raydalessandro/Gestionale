# Revisione procedure VISTA Gestionale — audit dei manuali (Fasi 1–4)

*Redatto il 14/07/2026, sui manuali v0.5, incrociati con: `lib/actions.ts`,
le pagine `/cassa`, `lib/richiami-proposte.ts`, `docs/dominio-fiscale.md`,
`docs/dominio-cassa-documenti.md`, spec `fase-4-cassa.md`, migrazione 002.*

**Metodo.** Ogni procedura del manuale è stata verificata su tre assi:
coerenza interna tra capitoli, coerenza col codice reale (le procedure
descrivono davvero ciò che il software fa?), coerenza con le regole
fiscali/legali distillate nei file di dominio. Dove manuale e codice
combaciano ma il *processo* ha un buco, il finding è di processo (tocca
spec/codice), non di documentazione.

**Esito in una riga.** L'impianto regge: stati guardati, storia immutabile,
doppio incasso protetto con rollback, aliquote per tipo di lavoro corrette,
incamero/restituzione caparra mutuamente esclusivi. I problemi veri sono
concentrati in un punto solo: **il denaro della caparra all'ingresso**, che
oggi è invisibile alla cassa e squadra la chiusura per costruzione. Il resto
sono rifiniture, note fiscali e testo del manuale rimasto indietro di una fase.

---

## A · Trovati — incoerenze di processo (toccano codice o spec)

### A1 · La caparra in ingresso non esiste per la cassa — *il finding centrale*

Quando apri una busta e incassi l'acconto, VISTA salva **solo il numero**
(`ordini_occhiali.acconto`): niente metodo di pagamento, niente movimento,
niente data d'incasso distinta. Conseguenze a catena, tutte verificate:

- **La quadratura serale squadra per costruzione.** Il "sistema Contanti"
  della chiusura somma solo pagamenti delle vendite − resi
  (`chiudiCassa`, actions.ts:1796-1806). La caparra incassata oggi in
  contanti è nel cassetto ma non nel sistema → ogni giorno con caparre in
  contanti l'ottico vede rosso e deve inventare una causale. Il modello
  reale di catena fa l'opposto (dominio-cassa-documenti §4: *"il totale
  della tabella pagamenti = vendite + caparre emesse + attese: è
  l'equazione di quadratura"*) e la ricevuta caparra vera stampa il
  **metodo reale** del versamento (§3).
- **"Contanti attesi" in homepage è impreciso** per lo stesso motivo (vedi
  anche A3).
- **"Restituisci solo quanto è stato davvero incassato"** (manuale 07,
  Restituire una caparra) è una promessa che il sistema non può mantenere:
  `annullaBustaConRestituzione` rimborsa sempre `acconto` pieno
  (actions.ts:1728). VISTA non sa quanto è stato *davvero* versato perché
  non lo registra.
- Il contatore "caparre emesse" è ancorato a `created_at` della busta
  (dichiarato come approssimazione in spec §3.2): una busta nata preventivo
  e confermata giorni dopo conta la caparra nel giorno sbagliato.

**Proposta** (additiva, in stile migrazioni): su `ordini_occhiali` due campi
`acconto_metodo` + `acconto_incassato_il`, compilati alla creazione/conferma;
la chiusura somma le caparre incassate del giorno nel sistema-per-metodo; la
ricevuta caparra stampa il metodo (come il documento reale); il contatore
"emesse" si ancora a `acconto_incassato_il`. In un colpo si sistemano
quadratura, homepage, ricevuta, contatore e restituzione.

### A2 · Manca il contatore caparre "Rese" in chiusura

Il documento reale prescrive **quattro** contatori (dominio §4: *Emesse ·
Scontate · Rese · Incamerate*); codice e manuale ne hanno tre (manuale 07,
blocco 4: "emesse, scalate, incamerate"). Le restituzioni finiscono nei resi
per metodo (quindi la quadratura torna) ma il blocco caparre non le mostra:
chi confronta col report di catena non ritrova il quadro. Fix piccolo:
`chiudiCassa` conta i resi con nota/origine "restituzione caparra" del giorno.

### A3 · "Contanti attesi" (homepage) e chiusura calcolano diversamente

`app/(app)/cassa/page.tsx:42`: `fondo + contantiVendite − prelieviSpese`.
Mancano i **resi rimborsati in contanti** (che la chiusura invece sottrae) e
le restituzioni caparra. Giorno con un reso contanti da 50 €: il numero
grande in homepage è 50 € più alto del cassetto vero, la sera la chiusura
invece torna. Due formule per lo stesso concetto = sfiducia dell'utente nel
numero. Allineare la homepage alla formula della chiusura (e, con A1, a
entrambe aggiungere le caparre).

### A4 · Annullo vendita: rientro magazzino cieco e nessun guardrail temporale

`annullaVendita` (actions.ts:1461-1489) fa **sempre** il carico di rientro
per ogni riga con prodotto, ma non tocca l'ordine collegato. Il manuale lo
documenta fedelmente ("l'ordine resta consegnato… il magazzino torna
indietro in automatico") — ed è proprio questo il problema: se annullo la
vendita di una consegna, la merce è **in mano al cliente** ma la giacenza
rientra → giacenza fantasma. Per la vendita libera il rientro automatico è
giusto; per la vendita da ordine andrebbe **chiesto** (come già si fa nel
reso, dove le righe che rientrano si spuntano).

Secondo buco: nessun blocco né avviso per annulli **dopo la chiusura** o su
**vendite di giorni passati**. La chiusura salva un riepilogo congelato: un
annullo postumo la rende non più riconciliabile coi dati vivi, e i contanti
resi al cliente oggi per una vendita di ieri non lasciano traccia nella
giornata odierna. Regola semplice da spec: annullo consentito solo su
vendite di oggi e a giornata non chiusa; oltre, la strada è il **reso** (che
è già il messaggio implicito del manuale — basta renderlo un vincolo).

### A5 · Riallineamento su giornata già chiusa: la vendita sparisce dalle quadrature

Il manuale promette "la vendita comparirà nella giornata giusta". Vero per
la lista, ma se quella giornata era **già chiusa** la vendita non entrerà
mai in nessuna quadratura (la chiusura passata è congelata, quella di oggi
filtra per `data_vendita`). Legittimo come design — il riallineamento
documenta a posteriori — ma va detto: un avviso in UI ("questa giornata è
già chiusa: la vendita resterà fuori dalle quadrature") e una riga nel
manuale evitano la caccia al centesimo mesi dopo.

### A6 · `consenso_dati_sanitari`: esiste a DB, invisibile ovunque

La migrazione 002 ha aggiunto il campo su `clienti` (commento in migrazione:
"privacy dati medici ≠ marketing") ma **nessuna UI lo compila, nessuna
azione lo legge, il manuale non lo nomina**. Intanto le prescrizioni — dati
relativi alla salute, categoria particolare ex art. 9 GDPR — si registrano
senza raccolta documentata del consenso esplicito. Due strade, entrambe
legittime ma da scegliere: (a) esporre la spunta nel form cliente accanto al
consenso marketing e documentarla nel manuale (cap. Clienti); (b) fondare il
trattamento su un'altra base (esecuzione del contratto/fini di cura) e
scriverlo nel dominio + informativa. Oggi siamo nel limbo peggiore: il campo
suggerisce la strada (a) ma non la percorre. Correlato e più ampio: manca in
tutto il manuale una procedura per la **richiesta di cancellazione** di un
cliente ("non si cancella mai niente" convive col GDPR solo con una
procedura di anonimizzazione che preservi i documenti fiscali decennali —
candidata a fase futura, ma da mettere a roadmap esplicitamente).

### A7 · La montatura della busta non scarica mai il magazzino

Nella busta la montatura è testo libero (marca/modello), senza `prodotto_id`
→ alla consegna dell'occhiale completo `movimentiDaRighe` salta la riga
(actions.ts: `if (!r.prodotto_id) continue`). Ma le montature a stock sono
il caso tipico dell'ottico: oggi ogni occhiale completo consegnato lascia la
giacenza montature ferma, e la promessa del cap. Magazzino ("la giacenza non
si scrive mai a mano") si incrina proprio sul prodotto a più alta rotazione
di valore. Proposta: bottone "Da catalogo" anche nel passo Montatura della
VenditaGuidata/busta, con `prodotto_id` che viaggia fino alle righe della
vendita di consegna. (Nota positiva: per gli ordini LAC il giro è già
perfetto — righe con prodotto, scarico una volta sola, niente doppio scarico
tra i due percorsi di consegna: verificato.)

---

## B · Fiscale e normativo

### B1 · Garanzia a 22% fisso: giusto per il servizio, sbagliato per la polizza

La vendita da busta propone l'extra/garanzia a IVA 22 (vendita/nuova
page.tsx:56). Corretto se la garanzia è un **servizio interno** del negozio;
ma se è una **polizza assicurativa di terzi** il documento reale osservato
la marca natura **EE = Esclusa**, fuori campo IVA (dominio-cassa-documenti
§1 — caso ERGO/Otticare). L'aliquota è editabile a mano e "esente" esiste
già nel sistema, quindi niente blocco: ma il default può indurre l'errore
opposto (22% su un'operazione esente = IVA versata a vuoto). Minimo: una
riga nel manuale ("se la tua garanzia è una polizza di compagnia, cambia
l'aliquota in Esente"). Meglio: tipizzare la garanzia in busta
(servizio/polizza) e derivarne l'aliquota.

### B2 · "Tracciabile (utile alla detraibilità)": frase che fuorvia proprio l'ottico

Manuale 07, Impostazioni. Per i **dispositivi medici** (codice spesa AD —
cioè quasi tutto ciò che l'ottico vende: occhiali, lenti, LAC graduate) la
detrazione spetta **anche in contanti** (dominio-fiscale §1). Solo le AA
richiedono il tracciato. Detta così, la frase può convincere il negozio che
il cliente perda la detrazione pagando cash gli occhiali — falso, e
un'informazione sbagliata data al banco è un danno commerciale. Riscrivere:
"utile per le spese che richiedono pagamento tracciato; per i dispositivi
medici la detrazione vale anche in contanti".

### B3 · Note minori

- **LAC estetiche**: il default 4%+DM per tipo `lac` è giusto per le
  correttive; le colorate puramente estetiche vanno al 22% senza AD
  (dominio-fiscale §2). Una riga nel manuale Magazzino ("crea le estetiche
  come accessorio, non come LAC") chiude il buco senza codice.
- **Giornata contabile = giorno UTC** (`chiudiCassa` usa
  `toISOString().slice(0,10)`): per un negozio che chiude alle 19:30 è
  irrilevante, ma un riallineamento registrato a mezzanotte passata può
  cadere nel giorno inatteso. Nota tecnica da annotare in spec, non urgente.

---

## C · Miglioramenti proposti (con gli occhi sui concorrenti)

### C1 · Riprogrammare un appuntamento — il gesto che manca in Agenda

`eventoAppuntamento` conosce solo completato/mancato/annullato; il manuale
infatti non documenta lo spostamento. Ma "posso venire domani invece?" è
**la** telefonata più frequente che un'agenda riceve: oggi la risposta è
annulla-e-ricrea ricompilando tutto. Un bottone "Riprogramma" (annulla +
nuovo precompilato, sul pattern di "Fissa ritiro") è poco codice e molta
qualità percepita.

### C2 · La finestra LAC 70–100 giorni perde i clienti in silenzio

`lib/richiami-proposte.ts:126`: superato il giorno 100 senza riordino, il
cliente esce dalla coda **per sempre**, senza che nessuno lo sappia. È
l'opposto della filosofia del modulo ("il livello ricavi"). Proposte: una
seconda finestra "LAC — cliente perso" (100–365 gg, tono diverso: win-back)
oppure la proposta che non decade finché non lavorata. E un dettaglio da
verificare: la finestra dovrebbe partire dalla **data di consegna** (quando
il cliente ha le lenti in mano), non dal `created_at` dell'ordine — su
ordini che restano "ordinati" una settimana la differenza sposta il
richiamo di una settimana.

### C3 · Export "Sistema TS-ready" — il differenziatore a costo quasi zero

VISTA salva già tutto quel che serve: CF, flag DM per riga, tracciabile,
opposizione, data. L'obbligo d'invio è dell'ottico **dal 2016**, oggi
annuale entro il 31 gennaio (dominio-fiscale §1) — e per l'indipendente è
la corvée di gennaio. Un **export CSV/riepilogo "spese sanitarie
dell'anno"** (documenti con CF, non opposti, importi per codice AD/AA) si
può fare *prima* della fase fiscale vera (che farà i tracciati/invii): dà
subito un motivo di adozione e prepara il terreno. Nessun incumbent lo
regala nel piano base.

### C4 · Richiamo "Fondo Est ≥ 1,5 D" — l'asso già annotato nel dominio

Lo segno qui perché il momento buono è la Fase 5, ma i dati ci sono **già
adesso** (storico Rx per occhio): VISTA può accorgersi da solo quando un
cliente matura la variazione che dà diritto al nuovo rimborso prima dei 36
mesi (dominio-fiscale §4). Tipo di proposta `fondo_est_visus`: nessun
gestionale lo fa, ed è esattamente la narrativa "richiami che generano
ricavi" di MIDO.

### C5 · Fermi scaduti: renderli visibili

Il fermo scaduto resta rosso in lista e genera la proposta di richiamo, ma
la giacenza resta **impegnata a oltranza** se nessuno agisce: disponibile
eroso in silenzio. Basta un contatore "fermi scaduti: N" nei contatori del
Magazzino/Dashboard per chiudere il giro (niente auto-annullo: decidere è
dell'ottico, vedere è del software).

### C6 · Nota transitoria in attesa di A1

Finché la caparra non entra in quadratura, il manuale della chiusura può
dire la verità operativa: "se oggi hai incassato caparre in contanti, lo
scarto positivo che vedi è normale: scrivi 'caparre di oggi' come causale".
Brutale ma onesto — meglio di un rosso inspiegato la prima sera.

---

## D · Manuale — testo rimasto indietro di una fase (solo editing)

1. **Cap. 04 · Far avanzare la busta, passo 4**: descrive "Consegna →
   Conferma consegna" senza menzionare che con la Cassa attiva il bottone
   diventa **"Consegna e incassa"** (il cap. 07 ha la nota inversa; chi
   legge solo Buste non lo scopre). Stessa sezione, *Acconto e saldo*: "lo
   scontrino… arriverà con il modulo Cassa" — il futuro è arrivato, la
   frase no. Il capitolo è fermo a v0.3: merita il giro di aggiornamento a
   v0.5 dell'agente manuali.
2. **Cap. 05 · Ordini LAC dal catalogo**: "alla consegna la giacenza scende
   in automatico" — vero in entrambi i percorsi, ma citare anche il
   percorso via "Consegna e incassa" chiude il cerchio.
3. **Cap. 00 · Il primo accesso**: "il tuo nome… quando ispezioni una busta
   o registri un movimento di magazzino" → ora firma anche vendite,
   chiusure, richiami: genericizzare ("resta scritto su tutto quello che
   registri").
4. **Glossario · Stato**: per gli ordini LAC la catena non include
   "avvisato" (giusto: è un'annotazione con data, non uno stato), ma il
   cap. 03 lo presenta come passo 3 della sequenza. Una parentesi nel
   glossario — "l'avviso al cliente è un'annotazione, non cambia lo stato"
   — evita la domanda al banco.
5. **Cap. 07 · Impostazioni**: la frase sulla tracciabilità (vedi B2).

---

## Cosa NON ho trovato (verificato e sano)

Vale la pena dirlo, perché è la spina dorsale: transizioni di stato tutte
guardate lato server con rollback sulla consegna concorrente ("l'ordine è
cambiato di stato, riprova" — testato il percorso); doppio incasso impedito
sia da pre-check sia da vincolo unico (23505); numerazioni race-safe via
RPC; incamero e restituzione caparra mutuamente esclusivi
(`caparra_incamerata_il` controllato in entrambe); aliquote per tipo di
lavoro conformi al dominio (solo_montatura → 22, completo → 4 anche sulla
montatura, soluzione → 22 con DM: la finezza "detraibilità e aliquota sono
assi indipendenti" è rispettata); sconto come importo di riga come da
decisione vincolante; resi esterni pre-VISTA previsti (ottimo per
l'adozione); distinzione contatti operativi vs marketing nel cap. Richiami
ineccepibile sul piano GDPR.

## Priorità suggerite

**Prima del collaudo cassa con gli ottici**: A1 (la prima chiusura vera con
una caparra in contanti squadra e brucia fiducia), A3, A4 (almeno il
guardrail temporale), D1. **Nel giro successivo**: A2, A5, A6 (decisione,
poi poco codice), B1, B2, C1. **A roadmap**: A7, C2, C3, C5, procedura
anonimizzazione GDPR. C4 resta l'asso per la Fase 5.
