# Modulo M4 — Ordini & Laboratorio · Spec (bozza dal dettato di Ray)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. Fonte: dettato integrale di Ray (10KB, vocabolario
+ processo + risposte alle frontiere). «Questo modulo praticamente
chiude il gestionale core.» Attesi: la UI-home della collega (annunciata:
la catena di laboratorio in prima schermata, un click per stato) e la
camminata. La «busta» resta il nome fisico da banco; nel sistema il
lessico è ORDINE.*

## 0 · Fonti
Dettato M4 (04/08) · sigilli M1-M3 (incastri pronti: bolla attesa,
attivazioni f2x, centrature espulse dalla Rx, custodia dal punto 15) ·
UI-home collega: ATTESA.

## 1 · Il modulo in una pagina
L'ordine è **l'atto generatore** del core: genera la prescrizione
d'uso (dal convertitore, confermata UNA volta e mai più), genera la
bolla attesa, impegna e scarica la merce di negozio, prende il numero
parlante, fotografa prezzi e canale di contatto. Tre uscite dal
riassunto — preventivo · sospeso senza caparra · conferma — e **il
modulo si ferma alla conferma**: la caparra, la ricevuta e lo scarico
sono il ponte di cassa (AR-01). A valle, la catena di laboratorio è
sequenziale e a un click: non si torna indietro.

## 2 · Vocabolario (DEFINITIVO salvo camminata)
- **Ordine** = generico; poi `occhiali` | `lac`; i **tipi**:
  `occhiale_completo` · `solo_montatura` (IVA 22% — ISTANTANEA di riga
  per MF) · `solo_lof` (LOF = lenti oftalmiche; montatura DEL CLIENTE)
  · `lac`.
- **Provenienza montatura**: `stock_negozio` · `da_laboratorio` (alcuni
  fornitori fanno anche la montatura → bolla attesa COMPLETA di tutte
  le voci) · `del_cliente` (solo_lof → custodia).
- **La Rx generata è IMMUTABILE dopo la conferma**: si genera alla
  scelta del dettaglio (monofocale lontano/vicino, prog, office, LAC…),
  l'ottico la verifica e può modificarla IN QUEL MOMENTO E MAI PIÙ
  («da −1 a −1,50 non cambia nulla, da prog a monofocale cambia la
  generazione: edge case inutili»). Spartiacque: **prima dell'evento
  fiscale** (caparra/fattura) → si CANCELLA l'ordine sbagliato E la sua
  Rx generata, si rifà; **dopo** → RESO + nuovo ordine, il reso resta
  in storico. (Coerente col modello M2: la Rx-d'ordine è figlia
  dell'ordine finché non fiscalizzata.)
- **Numerazione parlante**: `<LETTERA><progressivo>-<negozio>` (es.
  `A0001-123`): la lettera dice il tipo a colpo d'occhio, il
  progressivo è per negozio (via registro contatori/RPC, esteso), il
  suffisso identifica il negozio NELLA RETE (serve a noi: provenienze
  degli ordini). Lettere da assegnare: §11.3.
- **Stati** (la catena, un click, sequenziale): `preventivo` = **ordine
  salvato** (accorpati il 04/08: salvi l'ordine e ne STAMPI il
  preventivo — congelato, zero effetti, niente scadenza automatica: lo
  consulta e lo cancella l'ottico; il contenitore è un recall
  commerciale → lettura M7/M9) · `da_ordinare` (caparra presa) · `ordinato` (flag MANUALE: nessuna
  integrazione fornitori) · `da_chiamare` (arrivato) · `in_consegna`
  (avvisato) · `consegnato` · `annullato`/reso. **Mappa additive dal
  contratto v0.1**: lavorazione→{da_ordinare,ordinato} ·
  arrivata→da_chiamare · pronta→in_consegna (voci vecchie deprecate in
  lettura, mai rimosse).
- **Centrature** (nell'ordine, DOPO il prezzo): per occhio —
  `distanza` · `altezza` · `panto` · `avvolgimento` · `vertex`.
- **Lavorazioni**: `montaggio` (sempre) + altre (registro espandibile).
- **Sconto**: percentuale LIBERA in testata, per ora; prezzo pieno e
  scontato = ISTANTANEE («i dati che servono a fare la fattura»). I
  pacchetti e i codici classificatori (convenzioni/assicurazioni)
  arrivano dopo → M8/convenzioni.

## 3 · I flussi

### f4a · Occhiale completo — raccontato ◐ (il flusso maestro)
1. Tipo ordine → **dettaglio** → la Rx d'uso SI GENERA dal convertitore
   [ISTANTANEA] → conferma dell'ottico (modificabile solo ora) — è
   l'attivazione di f2x che prende corpo.
   **Il bollino di soggettività (04/08)**: se negli ultimi 5 ordini del
   cliente una derivata fu ritoccata a mano, il pannello lo mostra COL
   VALORE («nell'ordine C0012 il vicino fu portato a +2,25») accanto al
   calcolato — proiezione pura dal flag `modificata_a_mano`
   dell'istantanea, zero processi: decide l'ottico.
2. **Montatura**: barcode/UPC o modello (99% battono il barcode; la
   ricerca fine è UI futura) + provenienza (stock_negozio |
   da_laboratorio).
3. **LOF**: il tipo di visione è già noto dalla Rx; filtri UI —
   chiare/sole/fotocromatiche · design (geometria per fornitore) ·
   materiale/indice (1.5→1.74, 1.9 vetro) · trattamenti (antiriflesso,
   indurente, luce blu) · colore — «concettualmente il gestionale
   potrebbe lavorare con un UPC e un listino a fianco»: la sostanza è
   la riga codificata, i filtri arrivano coi listini. Lenti speciali
   (prismi…) si selezionano qui; la verifica di fattibilità fisica è
   feature futura a listini codificati (impostarsi per esserci).
4. **Lavorazioni** (montaggio sempre).
5. **Riassunto col prezzo pieno → sconto %** [ISTANTANEE].
   **Correzione 04/08**: QUI vive il cancello degli sconti TRACCIATI —
   assicurazioni, convenzioni, promo coi loro codici (futuri
   classificatori) si mettono SEMPRE in fase d'ordine, «mai in cassa»
   (in cassa resta solo lo sconto libero per gestire i momenti — M8).
6. DUE uscite (accorpate il 04/08): **salva** (= `preventivo`:
   l'ordine resta lì congelato, stampabile come preventivo, zero
   effetti) · **conferma** ↓
7. **Centrature** [ISTANTANEE] — dopo il prezzo, di proposito: «è
   misurazione tecnica, inutile nel preventivo, non serve prima di
   aver chiuso la vendita col cliente» — + dati montatura
   (auto-compilati se codificata, a mano altrimenti).
8. Riepilogo + note + **canale di contatto per QUESTO ordine**
   [ISTANTANEA: come avvisare all'arrivo].
9. **«Manda in caparra»** → ponte di cassa (AR-01): si incassa,
   ordine → `da_ordinare`, **nasce la bolla attesa** (M3: LOF sempre;
   montatura solo se da_laboratorio; fornitore-anche-montatura → bolla
   completa) — subito, «così l'ottico carica la merce all'arrivo senza
   aspettare la consegna, ed evita di vendere non-caricato» — e si
   stampa la ricevuta. **NIENTE scarico alla caparra** (corretto il
   04/08: non si consegna nulla in quel momento); lo scarico resta
   ALLA CONSEGNA, come da contratto v0.1. **Regola di libertà**: la
   giacenza PUÒ andare negativa — avviso, mai blocco («molti non
   caricano le bolle prima di fatturare: non li obblighiamo»). M4 si
   ferma qui.

### f4b · Solo montatura — dedotto ◐
Niente LOF né centrature obbligatorie; bolla attesa solo se
`da_laboratorio`; IVA 22% in riga.

### f4c · Solo LOF (montatura del cliente) — raccontato ◐ + CUSTODIA
Provenienza `del_cliente`: la montatura NON entra in bolla né in
giacenza — entra in **custodia** [ANAGRAFE/STATO leggero]: registro
beni in custodia con **foglio firmato dello stato dichiarato**
(«graffio sull'asta destra…») — prevenzione del «me l'hai rovinata»
(punto 15, ora ha casa). Dati montatura a mano; centrature normali.

### f4d · Ordine LAC — raccontato ◐ (+ il seme dell'app)
Più semplice: dettaglio → Rx LAC generata e VERIFICATA (le modifiche
soggettive sono più frequenti) → **regola di precedenza delle fonti (04/08)**: (1) se esiste una
DEFINITIVA da Applicazione per quella tipologia (prova confermata
trasferita alla sezione LAC — M2) si usa QUELLA, mostrata come «dalla
prova del 12/07»; (2) altrimenti si genera dal convertitore
(base+vertice) come sempre; (3) più fonti valide → una tendina chiede
all'ottico quale — un gesto, non un processo. La base madre degli
occhiali non si tocca MAI. → filtri (sferica/torica/progressiva
già dalla Rx; il fornitore come filtro: «li conoscono a memoria») →
riassunto+sconto → sospeso o conferma+caparra (le LAC per cliente
l'acconto ce l'hanno sempre — M3). **«Ripeti ordine»** dallo storico:
duplica tutto — è **la base del riordino automatico che tra due anni
il cliente farà dalla sua app col pagamento integrato**: ci si imposta
ora. Se la Rx è stata rigenerata → niente ripeti secco: il sistema
chiede **«stessa tipologia del precedente?»** → stesso tipo, nuove
diottrie, pochi click.

### f4e · Modifica e annullo — raccontato ◐
Lo spartiacque del vocabolario: pre-fiscale → cancella (ordine + Rx
generata, pulito); post-fatturazione → reso + nuovo, storico intatto.
**Il perché fiscale (04/08)**: la caparra EMETTE — annullare l'ordine
perderebbe il movimento della caparra (soldi = fiscale); il reso
preserva tutto. E quei resi-da-caparra sono un TRACCIANTE prezioso:
«al 99% sto generando un reso di LOF — un errore che mi costerà una
seconda coppia»; il motivo si decide nel modulo magazzino al momento
del reso. Il reso di un ordine fatturato fa RIENTRARE in giacenza la
merce dello scontrino; l'eventuale reso al fornitore parte poi dal
magazzino con la causale corretta (la catena del difettoso, in
meccanica). **Futuro dichiarato**: automatizzare reso+ricreazione
percependo in UI una semplice «modifica ordine» — quando saremo
rodati.

### f4f · La catena di laboratorio — raccontata ◐
`da_ordinare` → `ordinato` (click manuale) → `da_chiamare` (arrivato —
dialoga con la bolla caricata di M3) → `in_consegna` (avvisato sul
canale fotografato) → consegna (ponte di cassa: saldo). Un click per
passo, **non si torna indietro**; la UI-home della collega la mostra
tutta in prima schermata [materiale atteso].

### f4g · Applicazione LAC — perimetro DICHIARATO ◐
A sé stante: **niente giacenze, niente fiscalità**. Traccia:
appuntamenti del percorso, diottrie e tipologie PROVATE (≠ generate:
la differenza va tracciata), autonomia del cliente; durata tipica
1–4/5 settimane («oltre, i problemi sono grandi»); solo la lente
decisa diventa acquisto. **Due canali** per generare la Rx LAC —
diretta (>50% dei clienti) o dal percorso (i più alti di valore) — ma
la generazione è SEMPRE la stessa, per semplicità d'uso. Input/output
chiari e fissi → **modulo della collega contattologa**, che lo lavora
in autonomia (fonte: doc integrazione 01/08). Valore dichiarato:
relazione, differenziazione, porto di progressive, upselling.
Portale prenotazioni: NESSUN legame dati (parere in chat 04/08 —
il servizio «prova LAC» esiste nel portale come prenotabile via M6,
l'aggancio è solo cliente+data in agenda).

## 4 · I dati (DDL ABBOZZATO — non si applica in Era 1)
```sql
-- ordini_occhiali (additive):
--   rx_modificata_a_mano boolean default false   -- alimenta il bollino di soggettività
--   tipo_ordine text check (tipo_ordine in ('occhiale_completo','solo_montatura','solo_lof'))
--   provenienza_montatura text check (... in ('stock_negozio','da_laboratorio','del_cliente'))
--   prezzo_pieno numeric, sconto_pct numeric          -- ISTANTANEE (prezzo scontato = derivato mostrato)
--   centrature jsonb   -- {od:{distanza,altezza,panto,avvolgimento,vertex}, os:{…}}
--   dati_montatura jsonb                              -- auto da prodotto o a mano
--   canale_contatto text                              -- ISTANTANEA per l'avviso
--   rx_generata_id uuid references prescrizioni on delete set null
--     -- la Rx d'uso generata: vive con l'ordine finché pre-fiscale (f4e)
--   stato: valori NUOVI additivi ('sospeso','da_ordinare','ordinato','da_chiamare','in_consegna')
--     con mappa dai vecchi (deprecati in lettura)
-- ordini_lac (additive): tipo/dettaglio già; «Ripeti» = funzione di duplicazione
-- Numerazione: estensione RPC prossimo_numero(tipo→LETTERA, negozio→suffisso '-NNN');
--   il suffisso nasce con la semina del negozio (M10 §11)
create table public.beni_in_custodia (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  cliente_id uuid not null references clienti,
  ordine_id uuid references ordini_occhiali,
  descrizione text not null,
  stato_dichiarato text not null,      -- il foglio: com'era quando è entrata
  foglio_ref uuid,                      -- aggancio archivio firme futuro
  presa_il timestamptz not null default now(),
  resa_il timestamptz
);
```
**Incastri**: bolla attesa ← conferma (M3, con la regola
fornitore-anche-montatura) · scarico montatura ← caparra (cassa; nuovo
momento vs v0.1) · attivazioni ← scelta dettaglio (M2 f2x) ·
lenti_cliente copre il progressivo-fatto-altrove (Rx senza ordine) ·
recall-fornitura ← consegna (M7) · IVA di riga → MF · app cliente ←
«Ripeti» (portale, tra due anni) · duplica-ordine OCCHIALI:
SOLO se gratis-per-costruzione (il Ripeti-LAC generalizzato «in due
righe»); altrimenti anno 2 — «non si usa quasi mai: remake,
conformità, garanzie a diottria invariata» (04/08).

## 5 · Le superfici (traccia)
La UI-home della collega (catena a un click) = materiale atteso; il
flusso ordine come dettato (filtri = UI sopra righe codificate).

## 6 · I conti che questo modulo salda
A7 «la montatura non scarica» → f4a.9 (progettato: scarico alla
caparra) · Beni in custodia + foglio → f4c (progettato) · Riordina
uguale LAC → f4d (progettato; occhiali in camminata) · centrature
espulse da M2 → f4a.7 · provenienza a tre vie → §2.

## 7 · Test (traccia)
Contratto: stati nuovi+mappa, vincoli custodia, immutabilità Rx-ordine
(guardia: no update post-fiscale). E2E `m4-ordine.spec.ts`: occhiale
completo fino a da_ordinare con bolla+scarico; preventivo/sospeso senza
effetti; annullo pre-caparra pulito; solo-LOF con custodia.

## 8 · Collaudo S1..Sn (bozza)
S1 occhiale completo end-to-end: dettaglio→Rx confermata→montatura
stock→LOF→sconto→conferma→centrature→caparra: bolla ✓ NIENTE scarico ✓
numero O0001-123 ✓ (scarico alla consegna) · S2 preventivo: zero effetti · S3 salvato: congelato,
stampabile come preventivo; ripreso e confermato → tutto scatta; il
contenitore dei salvati si consulta come recall · S4 sbaglio il
dettaglio PRIMA della caparra → cancello: ordine e Rx generata
spariscono puliti · S5 dopo fattura → reso+nuovo, storico parla ·
S6 solo-LOF: montatura del cliente in custodia col foglio, bolla solo
LOF · S7 LAC «Ripeti»; Rx rigenerata → «stessa tipologia?» · S8 catena
a un click fino a in_consegna, mai indietro · S9 fornitore che fa
anche la montatura → bolla completa.

## 9 · Camminata a tavolino — verbale
**04/08 · passata di Ray**: integrata (è il dettato: vocabolario,
immutabilità, numerazione, i tre tipi, centrature-dopo-il-prezzo,
catena stati, applicazione a sé). Attese: UI-home collega + camminata
congiunta.

## 10 · Congelamento
**Annotazione 1 · 04/08 (audit)** — il §6 citava ancora «scarico alla
caparra» (pre-correzione): FA FEDE f4a.9/11-bis.2 — la caparra crea la
bolla e NON scarica; lo scarico è alla consegna, e A7 si salda lì.

## 11-bis · Risposte (04/08) — verso il sigillo
1. **Spartiacque** ✓ primo evento fiscale: la caparra emette, quindi
   caparra-presa = territorio reso+nuovo (mai annullo che perde il
   movimento). Automazione «modifica percepita» = futuro dichiarato.
2. **CORREZIONE**: la caparra NON scarica (non si consegna nulla) —
   crea la BOLLA subito; lo scarico è alla consegna (v0.1 confermato).
   Regola di libertà: giacenza negativa permessa, avviso mai blocco.
3. **Lettere** ✓ O=occhiale completo · M=solo montatura · L=solo LOF ·
   C=LAC; il «-NNN» negozio nasce con la semina (M10).
4. **Centrature solo-LOF** ✓ stessi 5 campi, dati montatura a mano.
5. **Preventivi=salvati accorpati** ✓ uno stato (`preventivo`), il
   preventivo è una STAMPA dell'ordine salvato; niente scadenza: il
   contenitore è un recall commerciale che l'ottico consulta e pota.

Sigillo apposto il 04/08; la UI-home resta materiale ATTESO per §5
(innesto Y), non condizione.