# Modulo M8 — Cassa · Spec (verifica ROVESCIATA + racconto della liturgia)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. Nata come verifica-sui-dati, diventata spec piena
col racconto di Ray (vendita veloce, regola del CF, sconti, liturgia di
chiusura con parametri). La paura iniziale era fondata prima di FI-01:
ora la cassa è il modulo più LEGGERO — i gesti pesanti sono ponti già
specificati altrove, il fiscale pesante è MF.*

## 0 · Fonti
Fotografia a contratto (04/08): `vendite` (doc_numero/doc_data,
cf_cliente, opposizione_ts, iva_totale, pagamenti jsonb, emessa/
annullata) · `movimenti_cassa` (con `incamero_caparra`!) · `resi` (due
tipi, 8 causali con `modifica_wo`) · `chiusure_cassa` (versamento
calcolato, z_numero, una-per-giorno) · `metodi_pagamento` (7 tipi,
`caparra` incluso) — più il racconto di Ray (04/08) e i sigilli
M1/M3/M4/M5, FI-01, AR-01.

## 1 · Il modulo in una pagina
La cassa registra fatti e non pensa: la caparra e il saldo sono PONTI
di M4, il reso e la catena del difettoso vivono in M3/M4, gli sconti
TRACCIATI (assicurazioni, convenzioni, promo) si mettono SEMPRE in
fase d'ordine — «mai in cassa» — dove resta solo lo sconto libero per
gestire i momenti. La vendita veloce è un ordine che il sistema genera
da solo; la regola del CF è l'unica cosa tecnica da sapere; la
chiusura è una liturgia con la distinta dei tagli e lo split
intelligente. Il fiscale profondo (pareggio mensile, RT, verifiche) è
MF.

## 2 · Vocabolario (quasi tutto a contratto)
- **Metodi, movimenti, causali, stati**: quelli vivi (fonti §0) —
  nessuna modifica.
- **LA REGOLA DEL CF** (l'unica tecnica da sapere): CF inserito
  **PRIMA del pagamento** → il sistema CREA LA SCHEDA (prefill M1,
  popup consenso) e associa l'ordine; CF inserito **DOPO il
  pagamento** → solo scontrino parlante (`vendite.cf_cliente`),
  NESSUNA scheda — per chi vuole la detrazione senza registrarsi.
- **Le vendite semplici della giornata** (definitivo 04/08, coerenza
  A): la vendita veloce senza CF-prima resta una **VENDITA con le sue
  righe, cliente VUOTO** — mai `ordini_*`, mai la catena di
  laboratorio, mai numeri O/M/L/C, e NIENTE anagrafica fittizia
  (nemmeno di sistema). Ogni giornata ha il suo elenco «Vendita
  veloce». **Funzione nativa «recupera e associa»**: per n° scontrino
  o per giorno, una vendita si aggancia DOPO a un'anagrafica
  (esistente o creata lì con la liturgia M1) — il gestionale di catena
  non lo sa fare (annulli e rifai): la loro mancanza è la nostra
  funzione. Il valore dichiarato: portare il cliente-veloce a
  diventare una scheda contattabile.
- **Sconto di cassa = LIBERO**: percentuale O importo (−50€, −100€…
  fino a ZERO) — «lasciamoli in libertà». Gli sconti-classificatore
  (assicurazione/convenzione/promo) vivono in TESTATA ORDINE (M4):
  correzione del 04/08.
- **Fondo cassa**: 300€ (parametro per negozio) · **tolleranza ±20€**
  · **versamento SEMPRE tondo** (parte da 321+): la moneta resta ferma
  in cassa — mai il balletto serale di catena.
- **Apri/chiudi negozio**: due gesti fiscali leggeri che incorniciano
  la giornata (verifica fiscale → MF).

## 3 · I flussi

### f8a · Vendita veloce — raccontato ◐
UPC + sconto → invio → **«Vuoi inserire il codice fiscale?»** —
SÌ (prima) → scheda creata dal CF (M1: prefill, popup consenso), la
vendita si associa a lei; NO → **vendita semplice della giornata**
(cliente vuoto), associabile dopo. Sotto, una VENDITA con le sue
righe — il sistema sa già cos'è dal prodotto → cassa per il
pagamento. La cassa
resta leggera: la logica la fa il sistema.

### f8b · CF dopo il pagamento — raccontato ◐
Sulla vendita non associata: il CF si aggiunge DOPO (scontrino
parlante per la detrazione LAC), nessuna scheda, nessun consenso da
chiedere. [`cf_cliente` esiste già.]

### f8c · Pagamento — a contratto ✓
Metodi multipli (jsonb), la `caparra` come metodo al saldo,
`incamero_caparra` per il cliente che sparisce (movimento già
previsto). Sconto libero di cassa prima di chiudere (fino a zero).

### f8d · Caparra e saldo — PONTI (M4) ✓ dedotto
### f8e · Reso cliente e catena del difettoso — (M3/M4) ✓ dedotto
Righe jsonb → resi parziali possibili; la causale unica viaggia.

### f8f · La liturgia di chiusura — raccontata ◐ (la memoria di Ray)
1. «Chiusura cassa» → **distinta dei TAGLI** (1c…2€, 5€…): non il
   totale a calcolatrice — così il sistema SA le monete.
2. Confronto contanti contati ↔ teorico; **POS**: tracciato ↔
   effettivo, l'ottico stampa i totali dal POS fisico e verifica A
   VISTA; corregge se serve.
3. Differenza? Si chiude CON la differenza (se vera, è vera; se
   sbagliata → f8g).
4. **Split**: fondo a 300±20, versamento TONDO da 321 in su, calcolato
   sui tagli reali (le monete restano).
5. «Chiudi negozio» (la mattina era partita con «Apri negozio»).

### f8g · La chiusura sbagliata — il principio ◐
**Non si corregge: se ne fa un'altra che corregge** — l'ammanco del 17
pareggia con l'eccedenza del 18; la dichiarazione di pareggio a
chiusura mese è territorio MF. Nessuna riapertura, mai.

## 4 · I dati (ABBOZZI minimi — non si applica in Era 1)
```sql
-- chiusure_cassa (additive):
--   distinta jsonb            -- i tagli contati {«0.01»:n, …, «50»:n}
--   aperto_il timestamptz, aperto_da uuid      -- «Apri negozio»
--   negozio_chiuso_il timestamptz              -- «Chiudi negozio»
-- (superato il 04/08: NIENTE scheda di sistema — cliente_id resta
--  NULL sulle vendite semplici; azione nativa «associa a scheda»
--  scrive il cliente_id dopo, per scontrino o giorno)
-- Parametri (fondo=300, tolleranza=20): registro per negozio → M10.
-- Nessuna tabella nuova.
```
**Incastri**: regola-CF ↔ nascita al volo (M1, i due rami già
previsti: qui il SELETTORE è il momento) · sconti tracciati → testata
ordine (M4, correzione incisa) · incamero ↔ reso-da-caparra (M4 f4e) ·
pareggio mensile, RT, verifica apri/chiudi → MF · fixme e2e cassa →
riscritti in Era 2.

## 6 · I conti che questo modulo salda
Cancello sconti → SPOSTATO a M4 (correzione) · scheda di sistema →
schedario voce 5 risolta · liturgia+split → f8f (il difetto di catena
evitato) · principio contro-scrittura → f8g · apri/chiudi negozio →
inserito, verifica MF.

## 8 · Collaudo S1..Sn (bozza)
S1 veloce+CF-prima: scheda nasce col popup, ordine associato, cassa ·
S2 veloce senza CF → vendita semplice della giornata, cliente vuoto;
nessuna coda la vede; domani la recupero dal n° scontrino e la
associo alla scheda ·
S3 CF-dopo: scontrino parlante, zero schede · S4 sconto libero a zero:
passa · S5 chiusura: distinta tagli, POS a vista, 381,80 → versa 80
tondo? no: versa fino a fondo 300±20 in pezzi reali, cifra tonda ·
S6 ammanco il 17 → eccedenza il 18, il mese pareggia (MF) · S7 apri
negozio la mattina, chiudi la sera: la giornata è incorniciata.

## 7 · Test (contratto)
Contract: `chiusure_cassa` additive (distinta, aperto/chiuso). Unit:
split sui tagli (tabella di casi: 381,80→tondo con fondo 300±20;
319→nessun versamento; monete che non tornano) · la regola del CF come
selettore (prima=scheda, dopo=solo cf). E2E: S1-S7 per nome.
Rimandati: RT, pareggio mensile, verifiche fiscali → MF.

## 9 · Camminata — verbale
04/08: racconto di Ray integrato (vendita veloce, regola CF, sconti,
liturgia con parametri, principio fiscale, apri/chiudi). Edge case
residui: dichiarati «già gestiti con escamotage» nel sistema — nulla
da specificare ora, comodità dopo. Le finezze «da cassa davanti» si
sono SVUOTATE. Sigillo apposto il 04/08.

## 11 · Residue (piccole)
1. ✓ RISOLTA (04/08): niente scheda — «Vendita veloce» resta il nome
   dell'ELENCO giornaliero delle vendite semplici.
2. Chi può aprire/chiudere negozio e cassa → matrice ruoli (M10).
3. Fondo e tolleranza come parametri per negozio → casa in M10.

## 10 · Congelamento
**Annotazione 1 · 04/08 (audit)** — §1 e §6 conservavano la dizione
pre-coerenza-A («la vendita veloce è un ordine», «scheda di sistema»):
FA FEDE il §2 — vendite semplici della giornata, cliente vuoto, niente
scheda, mai ordini_*.
