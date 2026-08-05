# limpidia · docs — punto d'attacco per l'agente esecutore

*Sei Opus (o un altro agente) collegato per l'Era 2: la codifica a
spec congelate. Questo file ti orienta in 2 minuti. La regola sovrana:
non colmare MAI un'ambiguità da solo — fermati e segnala.*

## La gerarchia della verità
1. **Le spec sigillate** — `docs/fasi/modulo-M1…M10-*.md`. Sono IL
   CONTRATTO. Non si riaprono: ogni deroga è un'annotazione datata nel
   §10 della spec. Se codice e spec divergono, ha ragione la spec.
2. **Il piano** — `docs/fasi/piano-era2.md`: il patto operativo, il
   template della consegna (col RITO D'APERTURA, punto 0), le buste
   S0→B9 in ordine di dipendenza, le fasi X/Y/Z.
3. **I contratti B1** — `docs/fasi/contratti-B1.md`: anonimizzazione
   (mappa campo→trasformazione), helper permessi (fail-closed),
   invarianti consensi, relazioni. Parte integrante della busta B1.
4. **Le regole consultabili** — `docs/regole/`: `grammatica-dati.json`
   (le sei classi: FATTO, STATO, ANAGRAFE, REGISTRO, PROIEZIONE,
   ISTANTANEA), `permessi.json` (la matrice: policy, non pietra),
   `ponte-chiave.json` (i gemelli +/−).
5. **Le decisioni** — `docs/decisioni/`: AR-01 (i tre canali e lo
   schedario delle stranezze), FI-01 (la fiscalità è modulo di
   confine), VP-01 (le viste-portale definer NON si «linterano»).
6. **La mappa** — `docs/mappa-db.md`: fotografia del database.
   Dopo OGNI migrazione: `scripts/db-locale.sh` + `scripts/mappa-db.py`
   la rigenerano e VALIDANO contro le regole. Fa parte del DoD.
7. **La storia** — `docs/fasi/passata-coerenza.md` (chiusura Era 1 +
   delta di contratto) e `docs/fasi/archivio/` (Era 0-1: contesto,
   NON autoritativo).

## Le consegne
Vivono in `docs/fasi/consegne/` (una per busta, dal template del
piano). Il tuo primo gesto su ogni consegna è il **rito d'apertura**:
leggi le spec citate, verifica la consegna contro di esse, verbalizza
in descrizione PR («Verifica spec: conforme» o l'elenco delle
differenze — e in quel caso ti fermi).

## Le sei regole che non si negoziano
1. **Bug protocol**: prima le spec — se l'errore viene da lì si
   correggono loro e poi il codice; se no, codice E spec.
2. **Additive-only** sul DB: mai rename, mai drop; le voci si
   deprecano in lettura. Migrazioni SOLO dalla strada che registra.
3. **La CI è il cancello**: verde o non si merge. PR piccole.
4. **Test per nome**: TDD prima (funzioni/logica), contract sulle
   migrazioni, E2E sugli scenari S della spec — nominati, mai
   inventati. Flaky → quarantena con issue.
5. **Errori tenant**: sulle tabelle con trg_tenant aspettati SEMPRE
   `23514`, mai `23503`.
6. **VP-01**: le 4 viste del portale restano definer. Il lint non si
   «risolve».

## L'ordine di marcia
S0 (bonifica e verità) → B1 → (B2 ‖ B6) → B3 → B4 → B5 → B7 → B8 →
B9 (collaudo/C0). Fuori busta: X riassetto/merge · Y innesti della
collega (UI-home, Applicazione) · Z fiscalità coi commercialisti.
Il pannello di controllo umano è `docs/fasi/era2.html`.
