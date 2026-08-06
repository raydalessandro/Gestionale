# Contratti di implementazione B1 (hardening pass, 05/08)

*Nati dall'audit esterno del 05/08 («i problemi trovati non sono buchi
concettuali: sono punti in cui devi IMPEDIRE all'agente di colmare
autonomamente un'ambiguità»). Questo file è PARTE della busta B1: si
copia dentro la consegna. Regola sovrana, valida per tutti e quattro:
**implementare SOLO secondo questi contratti; nessuna decisione
autonoma; caso non contemplato → ci si ferma e si segnala (rito
d'apertura, punto 0).***

## C1 · Contratto ANONIMIZZAZIONE (azione `anonimizza_cliente`)
**Principio**: i FATTI aziendali (vendite, ordini, movimenti, resi,
bolle, chiusure) restano integri e leggibili; sparisce la
RICONOSCIBILITÀ della persona. Esecuzione in UNA transazione;
permesso: solo titolare/responsabile (riga `anonimizzazione` in
permessi.json); conferma forte in UI (f1e.2: «possibile, non
comodissima»).

**La mappa campo → trasformazione (esaustiva; campo non in mappa =
fermarsi e segnalare):**
- `clienti`: nome → 'Cliente' · cognome → 'Anonimizzato-' + primi 8
  dell'id · cf, data_nascita, sesso → NULL · email, cellulare,
  telefono_casa, telefono_lavoro → NULL · via, cap, citta, provincia,
  nazione (+ scala/appartamento) → NULL · note → NULL ·
  dati_fatturazione → NULL · canale_preferito → NULL ·
  assicurazione_id, azienda_convenzionata_id → NULL · cache consensi
  (consenso_marketing, consenso_canali, consenso_dati_sanitari,
  consenso_sanitario_il) → false / NULL · secondo_nome → NULL ·
  tutore_legale (testo legacy, deprecato) → NULL (identifica un TERZO
  per nome) · lingua → NULL · tags → vuoto · **non_contattare → TRUE**
  · **fonte → RESTA** (statistica aziendale, non identifica) ·
  **anonimizzato_il → now()** (colonna additive B1: esclude da
  ricerche, code, letture clienti).
- `consensi` (mastro): le righe SI CONSERVANO (fatti storici su
  identità ormai anonima) · documento_ref → NULL (e il file firmato,
  quando l'archivio esisterà, si elimina: nota FUTURO).
- `clienti_relazioni`: DELETE di ogni riga che tocca il cliente (la
  relazione de-anonimizza per prossimità: «padre di X»).
- `prescrizioni` (+ future prescrizioni_lac/prove): SI CONSERVANO
  agganciate all'id anonimo (dato clinico non più riconducibile) ·
  tutti i campi note/testo libero → NULL (possono contenere
  riferimenti personali).
- `appuntamenti`, `prenotazioni`, `richiami`: si conservano · note →
  NULL · la riga `persone` collegata: email → 'anon-'+id+'@invalid' ·
  nome → **'Anonimo'** (costante: il NOT NULL si rispetta, l'identità
  sparisce; «cognome» non esiste su questa tabella — voce corretta il
  05/08) · **telefono_grezzo → NULL** (l'anonimo ESCE dalla dedup: il
  NULL non partecipa all'indice unico; se il vincolo è NOT NULL, la
  migrazione lo ALLENTA — modifica di vincolo, lecita, non è un drop).
  **Ratifica 05/08 (checkpoint B1)**: sul DB reale `telefono_normalizzato`
  è colonna GENERATA e `normalizza(NULL)` = '' → il solo NULL non
  bastava (il secondo anonimo collideva col primo). Chiuso con
  **unicità PARZIALE** — l'indice morde solo sui telefoni veri —
  dentro la modifica-di-vincolo già sancita qui sopra. La dedup dei
  numeri reali resta identica. (Misurato, non supposto: è il metodo.)
  **Ratifica 06/08 (rilievo 1 dell'agente-test, chiuso)**: la mappa
  qui sopra non veniva eseguita affatto. `persone` ha RLS attiva
  **senza policy** (ID-01, 011) e `anonimizza_cliente` è `security
  invoker`: quell'UPDATE, fatto da un utente autenticato, non trovava
  righe e passava **in silenzio** — l'anonimizzazione rispondeva
  «fatto» lasciando in piedi nome, email e telefono. La parte-persone
  vive ora in `anonimizza_persone_del_cliente`, **unica `security
  definer` della 021**, chiamata dalla principale che resta invoker.
  Una definer scavalca la RLS e con lei il tenant: qui il tenant lo
  tiene una **guardia esplicita** dentro la funzione — azienda dal JWT
  del chiamante (mai da un argomento, che sarebbe scavalcabile
  chiamando la RPC fuori dall'azione) e cliente della propria azienda,
  con lo stesso `CLIENTE_NON_TROVATO` che dà il cliente inesistente.
  Sorvegliata da G25b/G25c/G25d e da un caso di contratto che punta la
  RPC dritta, come farebbe un altro negozio che conosce l'id.
  **Resta aperto, e non è stato deciso qui**: `persone` è del PORTALE e
  non ha `azienda_id` — la stessa riga può essere collegata a
  prenotazioni di negozi diversi (la dedup sul telefono è globale), e
  anonimizzare la sbianca anche per l'altro negozio. Prima era un
  non-problema solo perché l'UPDATE non passava; ora la domanda è vera
  ed è in `TODO-regia.md`.
- `ordini_occhiali` / `ordini_lac`: SI CONSERVANO (fatti + istantanee
  Rx) · note → NULL · canale_contatto → NULL (è un recapito).
- `beni_in_custodia`: si conserva; descrizione resta (è dell'oggetto).
- `vendite`: INTATTE nei fatti fiscali (doc_numero, doc_data, importi,
  IVA, pagamenti) · **cf_cliente → NULL** (il registro fiscale legale
  vive nei corrispettivi/RT, non qui; verifica finale coi
  commercialisti in MF — eventuale retention diversa sarà annotata).
- `movimenti_*`, `resi`, `bolle_attese`, `pratiche_difetto`,
  `chiusure_cassa`: INTATTI (non contengono identità del cliente
  oltre i riferimenti, che ora puntano a un anonimo).
- `utenti`: FUORI SCOPE (operatori, non clienti).

**Regola generale (05/08, per i campi che emergeranno)**: i
quasi-identificatori e i testi liberi → NULL · le cache di consenso →
false/NULL · i flag operativi si spengono IN SENSO RESTRITTIVO
(non_contattare→true) · i dati statistici non personali (fonte,
timestamps di sistema) → restano. Il dubbio resta dubbio: ci si ferma.
**Test richiesti**: unit sulla mappa (ogni campo della lista, prima/
dopo) · E2E = M1 S6 («anonimizzato, fatti fiscali intatti») + query di
controllo: nessun campo personale ≠ NULL sul cliente anonimo, vendite
e ordini ancora leggibili con importi e numeri.

## C2 · Contratto HELPER PERMESSI (`richiedi(permesso)`)
**Collocazione**: in TESTA a ogni server action (l'enforcement è
nell'azione — la UI che nasconde bottoni è cortesia, MAI sicurezza).
**Fonte**: `docs/regole/permessi.json` caricato dal build/deploy (mai
da fonti mutabili a runtime); cache in memoria lecita.
**Comportamento — FAIL CLOSED, tabella esaustiva** (se qualcosa non
torna: NEGATO, mai «provo»):
- non autenticato → NEGATO `non_autenticato`
- autenticato ma senza riga in `utenti` → NEGATO `profilo_mancante`
- `utenti.attivo = false` → NEGATO `utente_disattivato`
- ruolo non presente in permessi.json → NEGATO `ruolo_sconosciuto`
- permesso non presente nella matrice → NEGATO `permesso_inesistente`
  (MAI default-allow sui permessi nuovi)
- `matrice[permesso][ruolo] ≠ true` → NEGATO `non_autorizzato`
- errore di caricamento/parse della policy → NEGATO
  `policy_non_disponibile` + log d'allarme
- **tenant**: l'helper restituisce l'`azienda_id` VERIFICATA
  dell'utente; ogni query dell'azione filtra su quella; risorsa di
  altra azienda → NEGATO `tenant_violato`
- chiamata diretta dell'action (API, script, senza UI) → identica in
  tutto: l'helper non distingue il chiamante.
**Esito**: ritorna il contesto verificato {utente_id, azienda_id,
ruolo} oppure lancia; le azioni non leggono MAI permessi.json da sole.
**Test richiesti**: unit = una riga per ogni caso della tabella · E2E
= M10 S1 (addetto → rettifica negata con garbo) e S5 (policy cambiata
→ effetto senza migrazioni).

## C3 · Contratto CONSENSI (invarianti del mastro)
**Vincoli a DB (CHECK nella migrazione B1):**
- `tipo='dati_sanitari'` ⇒ `prescrizione_id NOT NULL` e `canali NULL`
- `tipo='marketing'` ⇒ `prescrizione_id NULL`
- `azione='dato'` e tipo marketing ⇒ `canali` non vuoto e ⊆
  {email, cellulare, cartaceo}; `modalita NOT NULL`
- `azione='revocato'` ⇒ `canali NULL` (la revoca è totale per tipo;
  modalita facoltativa: il tasto è gesto operativo).
**La cache** (colonne su clienti) vale SOLO per il marketing:
`consenso_marketing` + `consenso_canali` = proiezione dell'**ultimo
evento COMMESSO** di tipo marketing. Per `dati_sanitari` NESSUNA
cache: si legge dal mastro per prescrizione.
**Concorrenza (la semantica dell'«ultima riga»)**: la scrittura passa
da UN'azione che, NELLA STESSA TRANSAZIONE, (1) prende il lock della
riga cliente (`select … for update`), (2) inserisce l'evento, (3)
aggiorna la cache. Due eventi simultanei si serializzano dal lock: la
cache riflette l'ultimo commit, per costruzione — niente confronti di
timestamp, niente pareggi possibili.
**Retrodatazione: NON esiste (ratifica 05/08)** — il mastro registra
FATTI al presente; `avvenuto_il` è il momento della registrazione,
sempre. Il caso vero «firma cartacea di ieri, caricata oggi»: si
registra OGGI, `modalita='penna'`, nota libera. Un eventuale
`dichiarato_il` informativo sarà additive futuro e MAI letto dalla
cache (romperebbe la semantica del lock).
**Altre regole**: due `dato` consecutivi = lecito (aggiorna i canali)
· la revoca non punta a una riga: vale per il tipo · la cache non si
scrive MAI direttamente (solo l'azione del mastro).
**Test**: unit su ogni CHECK (inserimenti che devono fallire) · unit
di gara (due transazioni concorrenti → cache = ultimo commit) · E2E =
M1 S2 (due firme, il mastro mostra due righe, la cache l'ultima) e S3
(revoca: commerciali fermi subito).

## C4 · Contratto RELAZIONI (una riga, mai le inverse)
- La relazione è UNA riga fisica; **le inverse non si materializzano
  MAI** (la lettura nei due versi è dell'azione/query, non del dato).
- `cliente_id = relativo_id` → VIETATO (`relazione_con_se_stesso`),
  anche a DB: `check (cliente_id <> relativo_id)`.
- **Guardia di coppia**: prima di inserire (A,B,tipo-familiare),
  l'azione verifica che NON esista ALCUNA riga familiare tra A e B in
  QUALUNQUE verso → se esiste: errore `gia_in_relazione` mostrando la
  riga esistente. (Una coppia = al più UNA relazione familiare; il
  `tutore_legale` è categoria a parte e può coesistere.)
- **Blindatura a DB**: unique index funzionale
  `(azienda_id, least(cliente_id,relativo_id),
  greatest(cliente_id,relativo_id))` limitato ai tipi familiari —
  così nemmeno un bug dell'azione può creare la doppia.
- Lettura inversa: fratello/sorella simmetrici per natura; per
  padre/madre/figlio l'etichetta inversa è derivata a video
  («genitore di» / «figlio di») — MAI scritta.
**Test**: unit (self vietato; doppia in entrambi i versi vietata;
tutore+padre coesistono) · E2E = M1: relazione letta dai due lati con
una sola riga a DB.
