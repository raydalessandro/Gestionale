# CONSEGNA · S0 + B1 — Bonifica e Fondamenta (due PR distinte)

*Prima consegna dell'Era 2, scritta da Claude il 05/08. Da B2 in poi
le consegne le assembla l'esecutore (template nel piano §«La
consegna»), questa è anche il collaudo del formato. **Due PR: prima
S0, poi B1.***

## 0 · RITO D'APERTURA (obbligatorio, prima di ogni riga di codice)
Leggi INTEGRALMENTE: `docs/README.md` · `docs/fasi/piano-era2.md`
(patto + S0 + B1) · `docs/fasi/modulo-M1-anagrafiche.md` ·
`docs/fasi/contratti-B1.md` (**parte integrante di questa consegna:
i quattro contratti C1-C4 si applicano alla lettera**) ·
`docs/regole/permessi.json` · `docs/decisioni/VP-01-viste-portale.md`.
Verifica questa consegna contro le spec: ogni mancanza o differenza →
FERMATI e segnala (file, §, cosa). Verbale in descrizione PR:
«Verifica spec: conforme» oppure l'elenco.

## 1 · Contesto
S0 mette in sicurezza e fotografa la verità (i rilievi della mappa
giro-2); B1 pianta le fondamenta che TUTTE le buste successive usano:
consensi, relazioni, registri, parametri e l'helper dei permessi.

## 2 · Spec di riferimento (congelate)
M1 (tutta; gli scenari sono nel §8) · contratti-B1.md (C1-C4) · piano
§S0/§B1 · per contesto: AR-01, FI-01, VP-01, grammatica-dati.json.

## 3 · Migrazioni (SOLO dalla strada che registra)
**`020_bonifica.sql`** — idempotente, sistema ENTRAMBI gli ambienti:
(a) `_riparazioni_dati`: `enable row level security` + `revoke all`
da `anon` e `authenticated` (resta il service role — il segnaposto
019 non deve essere cancellabile); (b) igiene: `revoke all` su TUTTE
le tabelle di `public` da `anon` (le 4 viste-portale NON sono tabelle
e mantengono i loro grant — VP-01); (c) `revoke execute` da `anon`
sulle tre funzioni trigger (`assicura_coerenza_tenant`,
`crea_sala_default`, `assegna_sala_appuntamento`); (d) la policy di
`risorse` ricreata IDENTICA ma su `authenticated`; (e)
`_infra_migrazioni`: `create table if not exists` (stessa struttura
di test) + backfill 001→020 `on conflict do nothing` — così la
stessa migrazione allinea test E produzione.
**`021_fondamenta.sql`** — DDL dai §4 di M1/M2/M10 + contratti:
`consensi` (con `prescrizione_id` e i CHECK del contratto C3) ·
`clienti_relazioni` (check anti-self + **unique index funzionale**
`least/greatest` sui tipi familiari — C4) · `oculisti` (M2 §4) ·
`parametri` (M10 §4) · `assicurazioni` minimo (id, nome, attivo;
seed riga «NESSUNA») · `clienti` additive: `assicurazione_id`,
`azienda_convenzionata_id` (FK clienti), `dati_fatturazione jsonb`,
`consenso_marketing boolean default false`, `consenso_canali text[]`,
`anonimizzato_il timestamptz` · trigger tenant + RLS + policy
`authenticated` sulle tabelle nuove (lo standard delle esistenti).

## 4 · Azioni e funzioni
- **`lib/permessi.ts` — l'helper `richiedi(permesso)`**: contratto C2
  ALLA LETTERA (tabella fail-closed completa, tenant verificato,
  ritorna {utente_id, azienda_id, ruolo}). OGNI azione nuova lo
  chiama in testa. Le azioni non leggono mai permessi.json da sole.
- **Consensi**: `registra_consenso(cliente, tipo, canali?, modalita,
  prescrizione_id?)` e `revoca_marketing(cliente)` — con la
  transazione-con-lock del contratto C3 (la cache è l'ultimo commit).
- **Relazioni**: `crea_relazione(a, b, tipo)` /
  `elimina_relazione(id)` con le guardie C4 (self vietato, guardia di
  coppia nei due versi, errore `gia_in_relazione` con la riga).
- **`anonimizza_cliente(id)`**: la mappa C1 campo-per-campo, UNA
  transazione, permesso `anonimizzazione`. Campo non in mappa →
  fermarsi.
- **`e_minorenne(cf)`**: funzione PURA che estrae la data di nascita
  dal CF (per la proposta-tutore di M1 f1a.7).
- **Oculisti**: `crea_oculista_al_volo(nome, ...)` (M2 f2a).
- **Parametri**: lettura/scrittura con permesso `parametri_negozio`.
- **UI**: il minimo funzionale perché gli E2E di M1 girino (scheda
  cliente con mastro consensi e popup-firma, relazioni). Niente
  estetica: arriva con gli innesti.

## 5 · Test OBBLIGATORI
**Contract** (sulle migrazioni): i 5 inserimenti-che-devono-fallire
dei CHECK consensi (C3) · doppia relazione nei due versi → fallisce ·
self → fallisce · RLS attiva su `_riparazioni_dati` e anon che non
legge `clienti`.
**TDD unit**: gli 8 casi della tabella C2 (uno per riga) · `e_minorenne`
(CF validi, il giorno del 18° compleanno, CF malformato) · la GARA dei
consensi (due transazioni concorrenti → cache = ultimo commit) · la
mappa C1 (ogni campo della lista: prima/dopo).
**E2E Playwright, per nome dal §8 di M1**: S1 · S2 · S3 · S4 · S5 ·
S6 (S7 è cross-modulo: si collauda in B5 — annotato in spec).
**Baseline**: la suite esistente resta verde.

## 6 · DoD (per ciascuna PR)
Rito verbalizzato in descrizione PR · CI verde · `scripts/mappa-db.py`
rigenerata e regole valide · **S0 produce `docs/fasi/S0-verita.md`**
con gli esiti: `negozi_servizi.attivo` esiste? · righe per-occhio in
`ordini_lac`? · diagnosi del timeout wizard «Da catalogo» (file e
riga, conferma o smentita dell'ipotesi pezzi-mancanti) · censimento
dei `fixme` e2e · zero modifiche fuori scope · migrazioni nel registro.

## 7 · Divieti
Mai «risolvere» il lint delle viste-portale (VP-01) · no rename/drop ·
no fix drive-by · no dipendenze npm nuove senza nota in PR · niente
UI oltre il minimo degli E2E · gli errori tenant sono `23514`, mai
gestire `23503`.
