# Fase 014 — Le sale

La 013 aveva lasciato `risorsa_id` nullable con il vincolo su
`coalesce(risorsa_id, azienda_id)`: funzionava, ma era una **cucitura** — finché
nessuno la valorizzava, il negozio con due salette non esisteva.

Portarla a livello vero costa poco **oggi**, perché tocca gli stessi due pezzi
che la 013 ha appena riscritto — il vincolo di esclusione e `slot_liberi`. Fra
tre mesi lo stesso lavoro si farebbe su appuntamenti veri, con le sale da
riempire su negozi in produzione e la terza riscrittura di quella funzione.

**Il concetto:** l'appuntamento non è del negozio, è di una **sala**; la sala è
del negozio. Con una sala sola il comportamento resta identico a oggi.

Solo SQL (migrazione 014). Nessuna interfaccia.

## Cosa fa la 014

### 1 · Tabella `risorse` (le sale)
`id, azienda_id (FK), nome, ordine (default 1), attiva (default true), created_at`.
RLS «della propria azienda» come le altre tabelle del negozio, `revoke select
from anon`: l'anonimo non le vede mai — ci arriva solo `slot_liberi`, che è
`security definer`.

### 2 · Ogni negozio ne ha almeno una, sempre
Riempimento: una `'Sala 1'` per **ogni** azienda esistente (idempotente). E un
**trigger `after insert on aziende`**, non dentro `crea_azienda_con_titolare`: un
negozio deve avere la sua sala **qualunque strada** abbia usato per nascere —
registrazione, seed, script, inserimento a mano in collaudo. Coprire una funzione
sola lascerebbe il negozio nato altrove senza agenda e con un errore
incomprensibile.

### 3 · `appuntamenti.risorsa_id` diventa obbligatoria
Backfill delle righe esistenti con la sala predefinita (ordine minimo) del loro
negozio; poi la FK verso `risorse` e `set not null`. La coppia
`(risorsa_id → risorse)` entra nel **trigger di coerenza tenant** della 008: la
sala dev'essere dello stesso negozio dell'appuntamento.

**Decisione (fuori dal testo della consegna, ma necessaria):** l'agenda del
gestionale (`lib/actions.ts`) crea appuntamenti manuali **senza** passare la
sala. Un `NOT NULL` secco avrebbe rotto la creazione manuale — e non potevo
toccare `lib/actions.ts`. Quindi un **trigger `before insert`**
(`assegna_sala_appuntamento`) assegna la sala quando manca: la prima sala attiva
**libera** in quell'intervallo, poi (se piene) la prima attiva. È la stessa
filosofia del §2 — «il trigger, non la funzione»: copre ogni strada, non una
sola. `crea_prenotazione` valorizza già `risorsa_id`, quindi lì il trigger non
interviene. La scelta della sala in un'interfaccia dedicata è una consegna futura.

### 4 · Il vincolo, senza più `coalesce`
`exclude using gist (azienda_id with =, risorsa_id with =,
appuntamento_intervallo(inizio, durata_minuti) with &&) where (stato in
('in_attesa','prenotato','completato'))`. **Sostituisce** quello della 013 (con
`coalesce`), non lo affianca.

### 5 · `slot_liberi` cambia domanda
Non più «libero se non si sovrappone a niente», ma **«libero se almeno una sala
attiva è libera»** in quell'intervallo. Continua a restituire **soltanto gli
orari**: la sala non riguarda chi prenota, e non deve poterla scegliere — sarebbe
solo un modo per far finire qualcuno nella saletta sbagliata.

### 6 · `crea_prenotazione` assegna la sala
Sotto il lock che c'è già: la **prima sala attiva libera** in quell'intervallo,
ordinata per `ordine` poi `id` — deterministica, non casuale. Se non ce n'è
nessuna, l'errore resta `SLOT_OCCUPATO`. Il resto — idempotenza, lock, codice,
copia del contatto — non si tocca. Sparisce il vecchio pre-controllo «un
appuntamento qualsiasi si sovrappone»: con più sale rifiutava anche quando
un'altra sala era libera.

## Limite noto

`blocchi_slot` e `chiusure` restano **per negozio**: chiudere un orario lo chiude
per **tutte** le sale. Con una sala è invisibile; con due è una semplificazione
consapevole. Il blocco per singola sala, quando servirà, sarà una consegna a sé.

## Verifica sul DB (dry-run, non persistito)

`BEGIN … ROLLBACK` sul DB reale, tutti i casi della consegna:
- **una sala**: due appuntamenti sovrapposti respinti (identico a prima); un
  appuntamento manuale senza sala riceve `Sala 1` dal trigger;
- **due sale**: due appuntamenti in parallelo su sale diverse ammessi, il terzo
  respinto;
- `slot_liberi` **offre** lo slot con una sala libera, **lo nasconde** con
  entrambe occupate;
- una sala `attiva=false` **non conta**;
- un'azienda inserita **dopo** la migrazione riceve la sua sala dal trigger;
- un appuntamento con la sala di **un altro negozio** è respinto dalla coerenza
  tenant (SQLSTATE 23514);
- riempimento e DDL **idempotenti** (girati due volte di fila).

## Nella PR — quanto richiesto

1. **Sale create dal riempimento:** **2** (una per ognuna delle **2** aziende del DB).
2. **Righe di `appuntamenti` toccate:** **8** (tutte quelle esistenti, riempite
   con la sala predefinita del loro negozio).
3. **Vincolo con `coalesce`:** **sostituito**, non affiancato — la 014 fa
   `drop constraint if exists appuntamenti_niente_sovrapposizioni` e lo ricrea
   per-`risorsa_id`.

## Criterio di accettazione

Ogni appuntamento sta in una sala, ogni negozio ha almeno una sala, e per aprire
la seconda poltrona di un negozio basterà inserire una riga — senza migrazioni,
senza riscrivere il calcolo degli slot, senza toccare l'agenda.
