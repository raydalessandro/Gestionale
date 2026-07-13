# Fase 4 — Cassa & Vendite (v0.5) · Specifica di codifica

Qui i soldi diventano dati. Stessa disciplina delle fasi precedenti: questa
spec è la fonte di verità; dove tace si sceglie la via più semplice coerente
col repo, dove parla non si devia.

## 0 · Prima di scrivere una riga

Leggere, in quest'ordine: `README.md` (contratto) ·
`docs/dominio-cassa-documenti.md` (**anatomia dei documenti reali: dove
questa spec e quel documento dicono la stessa cosa, quel documento è il
perché**) · `docs/dominio-ottica.md` §5 (resi), §6 (caparre), §9-bis
(giornata contabile) · `docs/dominio-fiscale.md` §2–3 (aliquote, RT) ·
`supabase/migrazioni/005_cassa_vendite.sql` · il codice delle fasi 1–3 per i
pattern (wizard, azioni evento, ricerca cliente, route di stampa, moduli).

**Stato di partenza garantito**: 005 applicata; `lib/database.types.ts`
(`MetodoPagamentoRow`, `VenditaRow`, `RigaVendita`, `PagamentoVendita`,
`ResoRow`, `ChiusuraCassaRow`, `MovimentoCassaRow`) e `lib/utils.ts`
(`ETICHETTE_ALIQUOTA`, `ETICHETTE_CAUSALI_RESO`, `TIPI_MOVIMENTO_CASSA`,
`STATI_VENDITA`) già allineati. Disallineamenti evidenti → correggere i
tipi, segnalarlo nel commit, non toccare la migrazione.

Convenzioni tecniche: identiche (§0 Fase 1). Nessuna nuova dipendenza.

## 1 · Obiettivo e perimetro

**Dentro**: modulo Cassa — vendita veloce (anche anonima), incasso alla
consegna di buste e ordini LAC (caparra scalata, scontrino per l'intero
valore), annullo vendita, resi con causale, incameramento caparra, movimenti
di cassa (petty cash e cassaforte), **chiusura di giornata** a quattro
blocchi con squadri dichiarati, storico chiusure, impostazioni metodi di
pagamento, ricevuta caparra stampabile col testo legale.

**Fuori** (non costruire nemmeno gli attacchi): pilotare il registratore
telematico o stampare documenti fiscali, fattura elettronica/SdI, invio al
Sistema TS (si salvano SOLO i campi che lo preparano), lotteria degli
scontrini, gestione saldi gift card (Gift Card è solo un nome di metodo),
multi-postazione/multi-cassa, corrispettivi XML.

## 2 · Regole di dominio vincolanti

1. **VISTA non è la stampante fiscale.** Il documento fiscale lo emette
   l'RT del negozio; VISTA registra la vendita con i suoi riferimenti
   (`doc_numero` nel formato Z-progressivo, `doc_data`, eventuale
   `fattura_numero`) e fa la quadratura serale. Nessuna riga di codice
   prova a parlare con una stampante.
2. **Aliquota per riga**: `'4' | '22' | 'esente'` + flag `dm` per riga.
   Default per tipo prodotto da catalogo: `lac`/`lente` → 4 + DM ·
   `montatura` → 22 + DM · `soluzione` → 22 + DM · `servizio` → 22 ·
   `accessorio` → 22. La riga resta sempre modificabile a mano.
3. **Aliquote alla consegna busta**, guidate da `tipo_lavoro`:
   `occhiale_completo` → montatura, lenti e montaggio TUTTI al 4% (il
   prodotto finito è l'ausilio) · `solo_lenti` e `montatura_cliente` →
   lenti (e montaggio) al 4% · `solo_montatura` → 22%. La **garanzia**, se
   valorizzata sulla busta, diventa una riga con default 22% e opzione
   `esente` (le polizze assicurative sono fuori campo: sull'RT escono come
   natura EE).
4. **La vendita di consegna è per l'INTERO valore.** La caparra già versata
   entra come pagamento `{ nome: 'Caparra', importo: acconto }` (lato RT è
   lo "Sconto a pagare"). Vincolo di sempre: **somma pagamenti = totale**;
   il resto esiste solo sui contanti (si registra l'importo dovuto, non il
   consegnato).
5. **Scarico magazzino UNA volta sola.** Alla creazione della vendita, ogni
   riga con `prodotto_id` genera un movimento `scarico` (quantità −q,
   riferimento = numero VE). Quando la consegna di un ordine passa dalla
   cassa (§3.6), lo scarico avviene QUI e non nel vecchio ramo di
   `eventoOrdineLac`; il percorso di consegna senza modulo cassa mantiene
   esattamente il comportamento della Fase 2. Annullo vendita → movimenti
   opposti (`carico`, riferimento "Annullo VE-…"). Reso con righe
   selezionate → `carico` di rientro (riferimento = numero RE).
6. **Numeri solo dalla rpc**: `VE-` per le vendite, `RE-` per i resi, via
   `prossimo_numero` (estesa dalla 005). Mai composti in JS.
7. **Chiusura: una per giorno per azienda** (il DB lo impone). Blocchi:
   (a) quadratura per metodo — sistema (incassi del giorno − rimborsi
   dei resi `denaro`, per metodo di rimborso) vs dichiarato, **causale obbligatoria
   se |differenza| > 0,05 €** (sotto è "arrotondamenti", si mostra e si
   tollera); il confronto contanti avviene al netto del fondo (dichiarato −
   fondo_apertura vs sistema); (b) confronto per aliquota col Z dell'RT;
   (c) contatori caparre del giorno; (d) cassaforte: fondo apertura
   (default: fondo_chiusura dell'ultima chiusura, altrimenti 300),
   contanti contati, fondo che resta → `versamento` lo calcola il DB, e si
   mostra il **saldo cassaforte progressivo** = Σ versamenti delle chiusure
   + Σ movimenti `versamento_cassaforte` − Σ `versamento_banca`.
8. **Movimenti di cassa append-only** con motivo obbligatorio (il DB
   rifiuta modifiche: niente policy di update/delete). L'errore si
   corregge con un movimento contrario, mai riscrivendo.
9. **Incameramento caparra**: disponibile su una busta non consegnata con
   `acconto > 0`. Il dialogo di conferma ricorda la trafila (2 mesi dalla
   promessa, tentativi documentati — il software avvisa, non blocca).
   Effetti atomici: `caparra_incamerata_il = now()` sulla busta + movimento
   `incamero_caparra` (importo = acconto, riferimento = numero busta) +
   busta → `annullata` con nota. La ricevuta caparra stampata porta già la
   clausola dei due mesi (§3.8).
10. **Riallineamento post-emergenza**: `origine = 'riallineamento'` è
    l'UNICO percorso che permette `data_vendita` nel passato, e RICHIEDE
    `doc_numero` + `doc_data` (il documento emesso a mano durante il
    fault). Nessun altro flusso retrodata alcunché.
11. **CF e "Non Associato" convivono**: la vendita veloce anonima è
    legittima; `cf_cliente` e `opposizione_ts` si salvano quando servono
    (fattura, Sistema TS) e NON attivano alcun invio.
12. **Metodo `Caparra`**: seedato con `tipo = 'caparra'`, non eliminabile
    né disattivabile (il flusso consegna lo usa). Gli altri metodi si
    attivano/disattivano liberamente; mai delete (si disattiva).
13. **Restituzione caparra** (lo specchio dell'incameramento, dal documento
    di storno reale): su una busta non consegnata con `acconto > 0` non
    incamerato, accanto all'annullo c'è **"Annulla e restituisci caparra"**:
    crea un reso `denaro` (importo = acconto, causale a scelta con default
    `modifica_wo`, metodo di rimborso reale, `doc_origine_*` = numero
    busta/ricevuta caparra) e porta la busta ad `annullata` con nota, in un
    colpo solo. Il rimborso segue i soldi veri: si restituisce SOLO quanto
    incassato; il residuo mai versato non genera alcun movimento.

## 3 · Pagine e rotte

### 3.1 `lib/modules.ts` e Sidebar
`cassa` → `attivo: true`. Verificare che la Sidebar mappi l'icona
(altrimenti lucide `Banknote`).

### 3.2 `/cassa` — la giornata (server)
- **Tre numeri grandi** in mono: incasso di oggi (vendite `emesse`) ·
  n° vendite · contanti attesi in cassetto (fondo apertura + contanti del
  giorno − prelievi/spese di oggi).
- **Totali per metodo** del giorno (dai `pagamenti` delle vendite emesse,
  raggruppati per nome): riga per metodo con importo mono.
- **Vendite di oggi**: ora · numero VE · cliente (o "Non associato") ·
  totale · badge stato · link al dettaglio. Vuoto: `Vuoto` con CTA.
- **Movimenti di cassa di oggi**: lista + form inline "Registra movimento"
  (tipo da `TIPI_MOVIMENTO_CASSA` tranne `incamero_caparra`, importo,
  motivo obbligatorio, riferimento).
- **Caparre del giorno** (riga sobria): emesse (acconti degli ordini creati
  oggi) · scalate (pagamenti `Caparra` di oggi) · incamerate (movimenti di
  oggi). Approssimazione dichiarata, serve al colpo d'occhio.
- CTA header: "Vendita veloce" (accent) · "Chiudi la giornata" (se non
  esiste chiusura per oggi; altrimenti link "Chiusura di oggi ✓") ·
  ghost "Impostazioni".

### 3.3 `/cassa/vendita/nuova` (client)
Prefill da query: `?busta=<id>` oppure `?lac=<id>` (§3.6), altrimenti
vendita veloce.
- **Cliente**: ricerca live riusata, facoltativa — vuoto = "Non associato".
- **Righe** (editor come il wizard LAC): descrizione* · quantità · prezzo
  unitario* · sconto (importo) · aliquota (select `ETICHETTE_ALIQUOTA`) ·
  toggle DM · bottone **"Da catalogo"** (pattern Fase 2: compila
  descrizione, prezzo, `prodotto_id`, aliquota+DM di default §2.2).
- **Pagamenti**: righe { metodo (select dai `metodi_pagamento` attivi,
  ordinati per `ordine`) · importo }. Riga contanti: campo "Consegnato"
  opzionale che calcola il **resto** a video (si salva il dovuto).
  Validazione: somma pagamenti = totale, live e in action.
- **Documento**: `doc_numero` (placeholder "es. 1405-0006") · `doc_data`
  (default oggi) · `fattura_numero` · `cf_cliente` · toggle `opposizione_ts`
  (hint: "il documento non andrà trasmesso al Sistema TS").
- **Riallineamento**: toggle "Vendita di riallineamento (emergenza)" che
  sblocca `data_vendita` passata e rende obbligatori doc_numero+doc_data
  (§2.10).
- Salva → `creaVendita` → redirect al dettaglio.

### 3.4 `/cassa/vendite/[id]` — dettaglio (server)
Header: numero VE in mono grande, badge stato, quando, chi, cliente.
Righe in tabella (aliquota e DM visibili, sconti sul rigo), totale e "di cui
IVA", pagamenti, riferimenti documento. Azioni su `emessa`:
- **"Annulla vendita"** — motivo obbligatorio (in note), storno magazzino
  §2.5. Su vendita legata a ordine: l'annullo **non** riporta indietro lo
  stato dell'ordine (si segnala nella conferma: "l'ordine resta consegnato;
  gestisci l'eventuale reso o ricreane l'incasso").
- **"Registra reso"** — form: tipo (denaro/gestionale) · causale (select
  `ETICHETTE_CAUSALI_RESO`) · importo (default totale) · **metodo di
  rimborso** (select dai metodi attivi, default Contanti; solo per tipo
  `denaro` — entra nella quadratura serale) · selezione righe
  che rientrano (checkbox su righe con `prodotto_id`) · doc reso
  numero/data · note. Crea il reso RE- e i carichi di rientro. La vendita
  resta `emessa`: il reso è un documento suo.
Sotto: resi collegati, se esistono.

### 3.5 `/cassa/resi` — registro resi (server)
Lista ultimi 50: quando · numero RE · tipo · causale (etichetta) · importo ·
cliente · vendita collegata (link) o doc origine esterno. CTA "Nuovo reso"
per il **reso di vendita esterna** (stessa form del §3.4 ma senza vendita:
obbligatori `doc_origine_numero` + `doc_origine_data`, cliente facoltativo).

### 3.6 Incasso alla consegna (modifica chirurgica alle schede ordine)
Nelle schede busta (stato `pronta`) e ordine LAC (stato `arrivato`):
- se il modulo `cassa` è **attivo**: il bottone di consegna diventa
  **"Consegna e incassa"** → redirect a `/cassa/vendita/nuova?busta=<id>`
  (o `?lac=`). La pagina compone le righe: busta → montatura (marca+modello,
  `prezzo_montatura`), lenti (descrizione, `prezzo_lenti`), garanzia se
  valorizzata (righe con aliquote §2.3; se i prezzi di dettaglio sono a 0 e
  c'è solo `totale`, una riga unica "Occhiale — <numero>"); LAC → le righe
  dell'ordine (con i loro `prodotto_id`). Pagamento `Caparra` precompilato
  con l'acconto (rimovibile solo se acconto 0). Cliente e CF precompilati.
  Al salvataggio `incassaConsegna` fa TUTTO in ordine: crea la vendita
  (`busta_id`/`ordine_lac_id` valorizzato) → transiziona l'ordine a
  consegnato con le STESSE validazioni della Fase 1 (stato riletto dal DB)
  → scarico §2.5. Se la transizione fallisce, niente vendita.
- se il modulo cassa **non** è attivo: tutto resta com'è oggi.
L'indice unico della 005 impedisce il doppio incasso dello stesso ordine:
intercettare 23505 → "Questo ordine ha già una vendita".
- Sulle buste con `acconto > 0` non consegnate: le due azioni speculari
  **"Incamera caparra"** (§2.9) e **"Annulla e restituisci caparra"**
  (§2.13), accanto alle azioni esistenti, ognuna con conferma esplicita.

### 3.7 `/cassa/chiusura` — il rito serale (client, wizard in una pagina)
Se esiste già la chiusura di oggi → redirect al suo dettaglio. Altrimenti,
quattro blocchi nell'ordine, coi valori di sistema precalcolati server-side:
1. **Conta per metodo**: per ogni metodo usato oggi (+ Contanti sempre):
   sistema (mono, readonly) · dichiarato (input) · differenza live con
   colore (verde 0, ambra |≤0,05|, rosso oltre) · causale (input,
   obbligatoria oltre tolleranza). Per i contanti l'input è "contati nel
   cassetto (fondo incluso)" e la differenza usa dichiarato −
   fondo_apertura.
2. **Confronto col registratore**: input `z_numero` + per aliquota (4 · 22
   · esente) il totale della stampante; a fianco il totale di sistema e la
   differenza. Hint: "dal Z report, sezione IVA–Nature".
3. **Cassaforte**: fondo apertura (precompilato §2.7) · contanti contati
   (ripreso dal blocco 1) · fondo che resta in cassetto → versamento
   calcolato a video + saldo cassaforte progressivo dopo il versamento.
4. **Caparre e note**: contatori del giorno (readonly) + note libere.
"Chiudi la giornata" → `chiudiCassa` (ricalcola TUTTO server-side, ignora i
valori di sistema del client) → dettaglio chiusura.

### 3.8 `/cassa/chiusure` e dettaglio — lo storico (server)
Lista: data · incasso · squadro totale (badge rosso se ≠ 0, "±0,0x" grigio
se solo arrotondamenti) · versamento · chi. Dettaglio `[id]`: i quattro
blocchi in sola lettura dal `riepilogo`.

### 3.9 `/cassa/impostazioni` — metodi di pagamento (server + form)
Lista con: nome · tipo · tracciabile (✓/—) · attivo (toggle) · ordine.
"Nuovo metodo" (nome, tipo, tracciabile). Se l'azienda non ha metodi:
stato vuoto con bottone **"Crea i metodi di base"** → `seedMetodiPagamento`:
Contanti (contanti, NON tracciabile) · Bancomat, Mastercard, Visa
(elettronico) · Bonifico (bonifico) · Gift Card (buono) · Assicurazione
(assicurazione) · **Caparra (caparra — non disattivabile, §2.12)**.
Il flusso consegna (§3.6), se non trova metodi, esegue il seed da solo.

### 3.10 Ricevuta caparra stampabile
Route di stampa (pattern della busta, gruppo `(stampa)`):
`/ordini/buste/[id]/caparra` + bottone ghost "Ricevuta caparra" nella scheda
busta quando `acconto > 0`. Contenuto (da `dominio-cassa-documenti.md` §3):
intestazione negozio · "Ordine per: <cliente>" + numero busta · le righe
dell'ordine a valore pieno · Totale · "Caparra versata" · "In attesa di
pagamento" (= totale − acconto) · **il testo legale**: ricevuta a titolo di
caparra confirmatoria ai sensi dell'art. 1385 c.c., non soggetta a IVA ex
art. 2 DPR 633/1972 (R.M. 19/5/1977 n. 411673); clausola dei due mesi per
il mancato ritiro; nota marca da bollo sulla copia del cliente. Data, firma.

### 3.10-bis · Quietanza di restituzione caparra
Dal dettaglio di un reso nato dal §2.13: route di stampa
`/cassa/resi/[id]/quietanza` + bottone ghost "Quietanza". Una pagina, due
blocchi (dal documento reale, `dominio-cassa-documenti.md` §3-bis): **copia
cliente** col testo di quietanza — "Dichiaro di ricevere da <ragione
sociale> la restituzione della caparra rilasciata in questo negozio" — e
Firma per quietanza; **copia negozio** con doppia firma (Firma Cliente ·
Firma Dipendente).

### 3.11 Dashboard
Una riga-link sobria sotto le esistenti: "Incasso di oggi: € X — N vendite →"
(solo se N > 0). Niente nuove card.

## 4 · Server actions (in `lib/actions.ts`)

| Azione | Firma | Note |
|---|---|---|
| `creaVendita` | `(prev, formData)` | parse righe/pagamenti da JSON hidden (pattern wizard); valida §2.2/2.4/2.10; numero via rpc `VE`; iva_totale calcolata dalle righe; scarico §2.5; `cliente_id` opzionale |
| `annullaVendita` | `(id, prev, formData)` | motivo obbligatorio; stato riletto; storno magazzino |
| `creaReso` | `(prev, formData)` | con o senza `vendita_id`; numero via rpc `RE`; carichi di rientro per le righe selezionate; `metodo_rimborso` obbligatorio se `denaro`; se esterna: doc origine obbligatorio |
| `incassaConsegna` | `(tipoOrdine, ordineId, prev, formData)` | §3.6: vendita + transizione + scarico, in quest'ordine, tutto server-side |
| `incameraCaparra` | `(bustaId, prev, formData)` | §2.9, atomica; rifiuta se consegnata o acconto 0 o già incamerata |
| `annullaBustaConRestituzione` | `(bustaId, prev, formData)` | §2.13: reso `denaro` + busta annullata, atomici; stesse guardie dell'incamero |
| `registraMovimentoCassa` | `(prev, formData)` | tipi §3.2 (mai `incamero_caparra` a mano); motivo obbligatorio |
| `chiudiCassa` | `(prev, formData)` | ricalcolo server dei blocchi; causali obbligatorie oltre 0,05; 23505 su (azienda,data) → "Giornata già chiusa" |
| `seedMetodiPagamento` / `creaMetodoPagamento` / `aggiornaMetodoPagamento` | pattern soliti | §3.9; mai delete; Caparra intoccabile |

Tutte con la solita difesa: rilettura dal DB prima di scrivere, errori come
`{ errore }`, `revalidatePath` su `/cassa`, dettaglio, e — dove tocca —
`/ordini`, scheda ordine, `/magazzino`, dashboard.

## 5 · Cosa NON fare

Niente driver di stampa o chiamate a stampanti fiscali. Niente PDF: la
ricevuta caparra è una pagina di stampa come la busta. Niente update/delete
su `movimenti_cassa` (nemmeno "per admin"). Niente scrittura di `giacenza` a
mano (vale sempre). Niente invii TS/SdI. Niente gestione saldi gift card.
Niente modifiche a 001–005 né al vocabolario. Non toccare le fasi 1–3 oltre
ai punti espliciti (§3.6, §3.10, §3.11).

## 6 · Criteri di accettazione

Build verde; tutto usabile a 390px. Somma pagamenti ≠ totale → la vendita
non nasce (client E server). Doppio incasso dello stesso ordine → rifiutato
con messaggio. Consegna via cassa scarica UNA volta; senza cassa il
comportamento Fase 2 è invariato. Annullo storna il magazzino. La chiusura
rifiuta squadri oltre tolleranza senza causale e non si duplica nel giorno.
Il riallineamento è l'unico percorso retrodatabile. La ricevuta caparra
stampa il testo legale completo. Nessuna regressione sulle fasi 1–3.

## 7 · Collaudo manuale (script per gli ottici)

**S1 · La vendita veloce.** Occhiale da sole a cliente di passaggio, nessuna
anagrafica, 158 € al 22%, contanti: consegnati 200 → resto 42 a video.
*Atteso: vendita "Non associato", numero VE, incasso di oggi aggiornato.*

**S2 · LAC dal catalogo, col codice fiscale.** Due confezioni "Da catalogo"
(4% + DM già impostati), CF del cliente, Bancomat. *Atteso: giacenza scesa
di 2, movimento `scarico` col numero VE, CF sul dettaglio.*

**S3 · La consegna con caparra.** Busta `pronta` (occhiale completo 965 €,
acconto 780) → "Consegna e incassa": righe già composte al 4%, garanzia a
parte, pagamento Caparra 780 precompilato + Mastercard 185. *Atteso:
vendita per l'INTERO valore, busta consegnata, un solo scarico; riprovare
l'incasso → "già una vendita".*

**S4 · Il caso scuola delle aliquote.** Vendita mista: soluzione LAC (22% MA
con DM) + polizza/garanzia come riga `esente`. *Atteso: "di cui IVA" conta
solo il 22%, il DM resta spuntato sulla soluzione.*

**S5 · Il riallineamento.** Emergenza di ieri: toggle riallineamento, data
di ieri, doc_numero della ricevuta manuale. *Atteso: senza doc+data non
salva; la vendita compare nella giornata di ieri, non in oggi.*

**S6 · Il reso ha sempre una causale.** Sul S1: reso denaro, "Soddisfatti o
rimborsati", la riga rientra. *Atteso: RE- nel registro, carico di rientro,
vendita ancora `emessa` col reso collegato.*

**S7 · La caparra incamerata.** Busta mai ritirata con acconto: "Incamera
caparra" → conferma con la trafila. *Atteso: movimento `incamero_caparra`,
busta annullata con nota, ricevuta caparra ristampabile con la clausola dei
due mesi.*

**S8 · Il rito serale.** A fine giornata: chiusura con fondo 300, contanti
contati con 1 € di troppo (eccedenza → causale), Z per aliquota che quadra,
versamento e saldo cassaforte. *Atteso: causale pretesa per l'euro, i
centesimi di arrotondamento tollerati e visibili, una sola chiusura per
oggi, storico consultabile.*

**S9 · La caparra restituita.** Busta con acconto 50 €, il cliente rinuncia:
"Annulla e restituisci caparra" → reso `denaro` in contanti, quietanza
stampata (doppia firma sulla copia negozio). *Atteso: busta annullata, RE-
nel registro col metodo di rimborso, e la chiusura serale mostra i contanti
di sistema al netto dei 50 € restituiti.*

**Domande ai tester**: i metodi di base coprono la vostra cassa vera? La
conta per metodo rispecchia come chiudete davvero? Cosa manca nel dettaglio
vendita per fidarvi a buttare il quaderno? Il flusso consegna+incasso è più
veloce o più lento del vostro gesto attuale?

## 8 · Consegna

Commit granulari `feat(cassa): …`, build verde a ogni commit, README:
spuntare la Fase 4. File ammessi: `app/(app)/cassa/**` (nuovo), le route di
stampa (ricevuta caparra, quietanza reso) in `app/(stampa)/…` accanto a quella della busta, componenti
nuovi in `components/`, `app/(app)/ordini/**` (solo §3.6 e §3.10),
`app/(app)/dashboard/page.tsx` (§3.11), `lib/actions.ts`, `lib/modules.ts`,
`components/Sidebar.tsx` (icona se manca).
