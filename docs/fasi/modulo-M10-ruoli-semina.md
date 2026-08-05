# Modulo M10 — Ruoli & Semina · Spec (bozza a metodo ROVESCIATO)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. Racconto di Ray integrato. Fotografia d'oro: la
colonna `utenti.ruolo` esiste GIÀ a contratto coi quattro valori esatti
(titolare · responsabile · ottico · addetto) — zero migrazioni per i
ruoli. Questo modulo ha due mestieri: la MATRICE (chi può cosa, come
POLICY di piattaforma modificabile) e la SEMINA (la nascita del negozio
che pianta tutti i semi raccolti nella campagna).*

## 0 · Fonti
Racconto di Ray (04/08) · mappa-db: `utenti.ruolo` vivo, `utente_id`
firmato su richiami/movimenti/chiusure/resi/vendite ✓ · i semi sparsi
nei sigilli: suffisso «-NNN» (M4), servizi base con Prova-LAC (M6),
tarature richiami (M7), fondo cassa 300±20 e scheda di sistema (M8),
TABO default (M2), matrice esaminatore (M2).

## 1 · Il modulo in una pagina
Coi privati la piramide è corta: **titolare e responsabile condividono
la stessa policy** («se lasci il negozio a qualcuno, quello deve
gestirlo al posto tuo») — tutto. **Ottico e addetto** fanno il lavoro
vero — vendite, bolle (carico E correzione), resi, ordini — perché
«non ha senso limitarli: sono movimenti che devono potersi gestire»;
il blocco è UNO: le rettifiche d'inventario (solo titolare/
responsabile — e il modulo inventario si ricostruirà a parte). La
matrice è **policy, non pietra**: vive in un JSON consultabile e la
cambiamo noi senza toccare il core («ci dicono "vorremmo che
l'addetto possa fare questo" → cambiamo la policy, non c'è problema»).
La **dashboard è UGUALE per tutti** — la trasparenza del negozio
privato: «è giusto e normale che tutti vedano la stessa; quella roba
[viste segrete] entra nelle catene con gli area manager — e pure loro
vedono gli stessi dati, solo di più negozi». E siccome ognuno si logga,
**il sistema firma tutto**: si risale a chi ha fatto cosa — «non per
punirlo, ma per capire» — e le vendite per persona diventano lettura
(M9): chi non vende si vede, poi l'ottico se lo gestisce.

## 2 · Vocabolario
- **Ruoli** (a contratto ✓): `titolare` · `responsabile` (STESSA
  policy: due voci per sapere CHI è il titolare, un solo insieme di
  permessi) · `ottico` · `addetto` (etichetta a video: «addetto
  vendita»).
- **Policy di piattaforma**: la matrice vive in
  `docs/regole/permessi.json` (consultabile, versionata); enforcement
  NELLE AZIONI (la grammatica: orchestrazione nelle azioni) — mai
  hardcode sparso, mai migrazioni per cambiarla.
- **Due meccanismi di configurazione — regola dichiarata (04/08)**:
  registri STRUTTURATI per le cose con forma (tarature, causali);
  `parametri` chiave/valore per gli scalari (fondo, tolleranza,
  notazione). Mai mischiare.
- **Firma** = `utente_id` sui fatti (già ovunque a contratto).
- **Semina** = la checklist di nascita del negozio.

## 3 · I flussi

### f10a · Login e firma — VIVO ✓
Ognuno entra col suo utente; i fatti portano la firma. Uso dichiarato:
capire i casini (giacenze, bolle, carichi) e leggere le vendite per
persona.

### f10b · La matrice v1 — raccontata ◐ (policy in JSON)
TUTTI (i 4 ruoli): vendite · resi · carico bolle · **modifica bolle
sbagliate** · scarichi con causale · ordini · anagrafiche e consensi ·
agenda. SOLO titolare/responsabile: **rettifiche d'inventario** (unico
blocco chiesto) · parametri di negozio · tarature richiami · servizi
del portale · gestione utenti. **Apertura E chiusura: TUTTI** — «apre il primo che arriva, chiude
l'ultimo che se ne va: roba quotidiana per chiunque lavori in negozio».
**«Chi visita» NON è un permesso**: è il FILTRO della lista esaminatori
sulla Rx (tit/resp/ottico — l'addetto non ha l'abilitazione, ma «a
livello permessi non cambia nulla»: ottico e addetto sono identici in
matrice). La matrice completa: `docs/regole/permessi.json` — con UN
solo blocco vero: le rettifiche d'inventario.

### f10c · La dashboard unica + le letture per persona — raccontata ◐
Stessa vista per tutti («al massimo cambia un po' la visualizzazione,
non lavoriamoci troppo»). Le letture firmate alimentano M9-esterna:
vendite per operatore («se qualcuno è a zero e gli altri fanno il
fatturato, si sa — poi se gestisce il back office ok, sennò l'ottico
deciderà»).

### f10d · LA SEMINA — assemblata ◐ (i semi della campagna, tutti qui)
Alla nascita del negozio, in un gesto guidato:
azienda + utenti coi ruoli → **suffisso «-NNN»** nei contatori (la
numerazione parlante di M4, l'identità di rete) → **servizi base** col
`tipo_visita` mappato, INCLUSA la «Prova lenti a contatto» (M6) →
metodi di pagamento base → **tarature richiami** default (M7) →
**parametri cassa** (fondo 300, tolleranza 20 — M8) → notazione
**TABO** default (M2) → department merceologici (M3) → la **scheda di
sistema «Vendita veloce»** (M8) → QR del portale pronto da stampare.
Dieci minuti, e il negozio è in piedi.

### f10e · Cambio di policy — raccontato ◐
Le ottiche chiedono → noi aggiorniamo `permessi.json` → deploy. Niente
migrazioni, niente release del core: «è questione di policy».

## 4 · I dati (quasi NULLA)
```sql
-- utenti.ruolo: ESISTE ✓ coi 4 valori — nessuna modifica.
create table public.parametri (            -- REGISTRO chiave/valore
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  chiave text not null,                    -- 'fondo_cassa','tolleranza_versamento','notazione_default',…
  valore jsonb not null,
  unique (azienda_id, chiave)
);
-- La matrice NON va a DB: docs/regole/permessi.json + azioni.
```
**Incastri**: esaminatore ← matrice (M2) · M8 §11.2-3 → qui (chiusura,
parametri) · vendite per operatore → M9 · suffisso ← contatori (M4) ·
semina ← tutti i sigilli.

## 7 · Test (contratto)
Contract: `parametri` (unique per chiave). Unit: helper permessi —
TUTTA la tabella fail-closed del contratto C2 (contratti-B1.md) ·
semina idempotente (rilanciata, non duplica). E2E: S1-S6 per nome
(S1 e S5 girano di fatto già dalle buste precedenti, via helper B1).

## 6 · I conti che questo modulo salda
Suffisso negozio (M4) ✓ · servizi+Prova-LAC (M6) ✓ · tarature (M7) ✓ ·
fondo/tolleranza e scheda di sistema (M8) ✓ · TABO (M2) ✓ · matrice
esaminatore (M2) → §11.1 · ruoli-interfacce (concetto tardivo della
lista) → f10b/f10c.

## 8 · Collaudo S1..Sn (bozza)
S1 l'addetto tenta una rettifica d'inventario → negato con garbo, il
resto del suo lavoro fila · S2 il titolare fuori sede si logga → vede
tutto come il responsabile · S3 semina di un'ottica nuova → dieci
minuti, QR in mano, Prova-LAC già prenotabile · S4 vendite per
operatore leggibili, con la firma su ogni fatto · S5 cambiamo la
policy (l'addetto ora può X) → zero migrazioni · S6 chi ha caricato
quella bolla sbagliata? La firma risponde — per capire.

## 9 · Camminata — verbale
04/08: racconto di Ray integrato (piramide corta, un solo blocco,
policy non pietra, dashboard unica, firma per capire). Attende la
camminata coi moduli completati.

## 11-bis · Risposte (04/08) — M10 COMPLETA
1. **Esaminatore** ✓ tit/resp/ottico selezionabili — ma è un FILTRO,
   non un permesso: ottico e addetto hanno gli stessi permessi
   d'azione; la differenza vive solo nella scelta di chi ha fatto la
   visita. Il titolare di solito È ottico.
2. **Apertura/chiusura** ✓ TUTTI: apre il primo, chiude l'ultimo.
3. **Due voci** ✓ — al 99% coincidono, ma così il titolare può
   DELEGARE un secondo responsabile quando vuole.

Sigillo apposto il 04/08.

## 10 · Congelamento
**Annotazione 1 · 04/08 (audit)** — la voce «scheda di sistema
Vendita veloce» in semina (f10d) e in §0 DECADE (coerenza A): nessun
seme al suo posto — l'elenco delle vendite semplici è una lettura, non
un oggetto da seminare.
