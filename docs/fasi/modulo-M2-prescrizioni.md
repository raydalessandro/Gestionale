# Modulo M2 — Prescrizioni · Spec (bozza AVANZATA — tre contributi fusi)

*Era 1 · 30-31/07/2026. Fonti fuse: racconto+passata di Ray, risposte
della collega alle 6 domande, e le sue «Specifiche funzionali» (11 pp.,
31/07 — d'ora in poi: SF). **SIGILLATA il 01/08/2026** — passate incrociate complete; risposte in
§11-bis. Il percorso prove LAC MIGRA al modulo Applicazione (doc
integrazione collega 01/08 = fonte primaria per M5).*

## 0 · Fonti
Racconto M2 di Ray (30/07) · Risposte della collega alle domande §11
(31/07) · **SF — Specifiche funzionali modulo prescrizioni** della
collega (31/07, 11 pp.): fonte primaria per struttura della scheda,
sezione LAC e percorso prove · migrazioni 001/006 · AR-01.

## 1 · Il modulo in una pagina
**Una sola scheda clinico-operativa** (SF §1): la visita si registra
una volta e può contenere Occhiali, Lenti a contatto, entrambe, oppure
l'esito Plano/Nessuna correzione — stessa origine, stessa data, stesso
professionista, sezioni attivabili. Sotto la scheda vive il
**convertitore** di Ray: dalla base le conversioni per calcolo puro
(formule fissate, §2-bis), correggibili a mano da chiunque sia
autorizzato («supporto, non vincolo» — SF §10.3), e le **attivazioni**
dichiarano cosa il cliente sta usando (per le LAC: la «Conferma come
prescrizione definitiva» della prova, SF §8.5). La centratura NON vive
qui: DNP, boxing, altezze, avvolgimento si rilevano NELL'ORDINE (SF
§6.9) — dipendono dalla montatura. Il fatto è il conteggio: niente
scontrini a 0, l'esaminatore è un dato, gli oculisti sono un registro.

## 2 · Vocabolario (DEFINITIVO salvo camminata)
- **Origini** (SF §3, plano ESPULSO dalle origini): `check_up` ·
  `lenti_cliente` · `ricetta_oculistica` (rinomina della vecchia
  «esterna») · `prescrizione_precedente` (recupero dallo storico:
  riusa i valori, la data ORIGINALE resta identificabile).
- **Plano** = esito/contenuto, non origine (SF): selezione nella
  scheda, Rx VALIDA con valori 0,00, resta in storico, serve forniture
  neutre (sole, fotocromatiche plano, filtro luce blu), **genera
  recall**.
- **Tipologie occhiali**: `lontano` · `vicino` · `intermedio` ·
  `bifocale` · `progressiva` · **`office`** (RESTA: deciso a voce
  Ray+collega, la SF era in errore — 01/08) · `trifocale` · **`mista`**
  (OD e OS configurati separatamente: un occhio neutro e l'altro
  progressivo, o destinazioni d'uso diverse).
- **Prisma**: valore + base — `interna` · `esterna` · `superiore` ·
  `inferiore` — obbligatori INSIEME, per occhio (SF §6.3).
- **Notazione**: `TABO` · `internazionale` (SF §6.4).
- **Prescrizioni speciali**: `bangerter` · `occlusione` ·
  `filtro_medicale` · `tinta_terapeutica` · `altro`+descrizione.
- **LAC — tipologia principale** (SF §7.2): `monofocale` ·
  `multifocale` · `rigida` · `semirigida` · `specialistica`
  (sottotipo: `sclerale` · `ortocheratologia` · `cheratocono` ·
  `ibrida` · `altro`); **geometria**: `sferica` · `torica`;
  OD/OS SEMPRE indipendenti (mista intenzionale).
- **Stati prova LAC** (SF §8.2): `prova_in_negozio` ·
  `campioni_consegnati` · `controllo_programmato`(+data).
- **Esiti prova**: `confermata` · `nuova_prova` · `lente_modificata` ·
  `interrotta` · `altro`+nota.
- **Oculisti**: registro per azienda, inserito al volo (Ray 31/07).

## 2-bis · Le formule (fissate — diventano funzioni pure testate)
- **Intermedio** = Lontano + (Addizione/2) — solo monofocale da
  intermedio.
- **Office**: lontano + addizione da vicino; NIENTE intermedio
  automatico — la progressione la calcola il produttore della lente.
- **Occhiali → LAC**: compensazione della distanza al vertice
  AUTOMATICA oltre ±4,00 D; fino a ±4,00 nessuna; risultato sempre
  modificabile.
- **Override**: tutti gli utenti autorizzati alla gestione Rx.

## 3 · I flussi

### f2a · Aggiungi prescrizione — la scheda unica (SF §2) ◐
1. Dalla scheda cliente: «Aggiungi prescrizione».
2. **Origine** [REGISTRO]. 3. **Data reale** del controllo/ricetta
   [FATTO: tempo di business — per origine: data del check-up, data
   SULLA ricetta, data della rilevazione lenti, data ORIGINALE della
   Rx recuperata].
4. **Scadenza proposta a +1 anno**, modificabile; dopo modifica
   manuale il sistema NON risovrascrive mai [sticky — SF §4.2].
5. **Professionista**: check_up/lenti_cliente → ottico dalla lista
   utenti (ruoli abilitati); ricetta_oculistica → oculista dal
   registro (al volo la prima volta); prescrizione_precedente →
   resta visibile quello originale.
6. **Sezioni** ✅: Occhiali / LAC / Plano — anche insieme.
7. Compilazione sezioni attive → 8. **«Salva e chiudi»** o **«Salva e
   crea ordine»** (trasferimento automatico: per le LAC fornitore,
   modello, tipologia, geometria, parametri, BC/DIA; per gli occhiali
   i valori — centrature e montaggio si acquisiscono NELL'ORDINE).

### f2a-occhiali · La sezione Occhiali (SF §6) ◐
Per occhio: sfero (0,00/Plano ammesso), cilindro, asse, **addizione
PER OCCHIO** quando prevista, **visus corretto PER OCCHIO** (il
naturale NON è richiesto). Prisma per occhio (valore+base insieme).
Notazione TABO/internazionale. Speciali (Bangerter, occlusione,
filtro medicale, tinta terapeutica, altro). Note libere cliniche.
**Occhio invariato** ☐OD ☐OS: recupero automatico dei valori dalla
precedente — resta comunque un NUOVO controllo con evidenza
dell'invarianza (SF §6.7). **Appaiamento**: flag che dichiara
intenzionale l'equilibrio OD/OS (SF §6.8). NIENTE DNP/centrature
(→ ordine, M4).

### f2a-lac · La sezione LAC (SF §7) ◐
**OD e OS indipendenti in tutto**: tipologia, geometria, fornitore,
modello, parametri (sfero/cil/asse/add quando applicabili), **BC e
DIA**, campi aggiuntivi dipendenti dal prodotto, **visus corretto
obbligatorio per occhio**, **occhio dominante** (multifocali,
monovisione), note PER OCCHIO + note generali. La lente si sceglie con
**filtri collegati** (fornitore → modelli compatibili → modello
esatto) da **libreria centralizzata** — che è il nostro catalogo
alimentato da listini AI + codifica al volo (f2f): convergenza piena.

### f2x · Convertitore e attivazioni — DEFINITIVO (01/08)
Si inseriscono SOLO lontano e vicino (la base). Tutto il resto si
genera al momento: **quando l'ottico apre un nuovo ordine e sceglie la
tipologia** (monofocale, progressivo, office, LAC…), il sistema calcola
LÌ le diottrie derivate — correggibili [ISTANTANEA di soggettività] —
e le salva NELL'ORDINE. L'attivazione è la traccia di quel gesto:
«quali tipologie il cliente ha aperto per acquistare». Niente pannello
«quali servite?» separato: la domanda È la scelta del tipo d'ordine
(più semplice — Ray 01/08). Il modulo di consultazione delle derivate
sarà un pezzo a parte, dopo. Formule: §2-bis, funzioni pure.

### f2p · Prove LAC — MIGRATE al modulo Applicazione (01/08)
Il doc «Integrazione anamnesi e contattologia» ristruttura: la pagina
Rx resta SEMPLICE; prove, valutazione clinica (movimento, centratura,
rotazione toriche con asse compensato proposto, film lacrimale/BUT,
scale configurabili, depositi), campioni e conferma vivono nel
**modulo Applicazione LAC** separato → fonte primaria della spec M5.
Qui resta la Rx LAC DEFINITIVA, alimentata dalla «Conferma come lente
definitiva» [risolve la domanda 6: si TRASFERISCE, le prove restano
tutte]. Il testo sotto vale come primo distillato per M5.

#### (assorbito da M5) Il percorso prove — primo distillato ◐
Ogni prova è un RECORD completo per occhio [FATTO+STATO]: data,
tipologia/geometria, fornitore/modello, parametri, BC/DIA, visus,
note per occhio, note generali, **stato** (in negozio / campioni
consegnati / controllo programmato + data prevista), poi **esito**.
**Riutilizzo**: nuova prova con «riusa OD / riusa OS / entrambi» —
copia tutto dell'occhio invariato, si tocca solo l'altro (prova
parzialmente confermata: SF §11). **Campioni consegnati**: quantità
OD e OS [01/08: NON scaricano giacenza — consumabili, spesso neppure caricati]. **«Conferma come
prescrizione definitiva»**: la lente confermata diventa la Rx LAC
attiva [= ATTIVAZIONE] e si trasferisce nell'ordine.

### f2b · Ricetta oculistica ◐ — registro oculisti (Ray 31/07)
Inserito al volo alla prima ricetta, poi selezionato; la mappa «da
quali oculisti arrivano le ricette» è un dato di zona → M9.

### f2c · Prescrizione precedente & rettifica ◐
Recupero con data originale visibile. **Rettifica, due nature (SF
§10.6)**: (a) errore di digitazione → la Rx si ELIMINA («non è un dato
clinico reale») — riconciliazione grammatica in §11.7; (b) emessa ma
non tollerata/da correggere → resta in storico + nota + NUOVA
sostitutiva [contro-scrittura] ✓.

### f2e · Scaduta ◐ — il recall (SF §10.4, risposta 5)
Ancora del recall = **l'ultima prescrizione CLINICA**; le derivate NON
generano richiami; nuova fornitura su Rx esistente → **il recall
riparte dalla data della fornitura** [incastro M7: ancora =
max(ultima Rx clinica, ultima fornitura su di essa); + prenotazioni
portale senza doppioni].

### f2f · Codifica al volo + libreria ◐ (→ M3/M5, invariato)

## 4 · I dati (DDL ABBOZZATO — non si applica in Era 1)
```sql
-- prescrizioni = LA SCHEDA UNICA (additive sulla 001/006):
--   origine: check ampliato ('check_up','lenti_cliente','ricetta_oculistica','prescrizione_precedente') + mappa dati
--   sezioni: ha_occhiali bool, ha_lac bool, plano bool
--   data_scadenza date, scadenza_modificata bool default false  -- sticky
--   esaminatore_id uuid references utenti · oculista_id uuid references oculisti
--   derivata_da uuid references prescrizioni  -- prescrizione_precedente / sostitutiva
--   occhiali: tipologia ('lontano','vicino','intermedio','bifocale','progressiva','trifocale','mista')
--     + se mista: tipologia_od, tipologia_os
--   per occhio: sfero/cil/asse (già), od_add, os_add, od_visus, os_visus
--   od_prisma, od_prisma_base, os_prisma, os_prisma_base ('interna','esterna','superiore','inferiore')
--   notazione ('tabo','internazionale'), speciali text[], appaiamento bool
--   od_invariato bool, os_invariato bool
--   ⚠ od_dnp/os_dnp (006): DEPRECATE per la Rx — la centratura si rileva nell'ORDINE (M4)

create table public.prescrizioni_lac (        -- per occhio, indipendente
  id uuid primary key default uuid_generate_v4(),
  prescrizione_id uuid not null references prescrizioni,
  occhio text not null check (occhio in ('od','os')),
  tipologia text not null, sottotipo text, geometria text,
  fornitore text, modello text, prodotto_id uuid references prodotti,
  sfero numeric, cilindro numeric, asse int, addizione numeric,
  bc numeric, dia numeric, extra jsonb,        -- campi dipendenti dal prodotto
  visus text not null, dominante boolean, note text,
  unique (prescrizione_id, occhio)
);

create table public.prove_lac (               -- il percorso di adattamento
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  prescrizione_id uuid not null references prescrizioni,
  occhio text not null check (occhio in ('od','os')),
  data_prova date not null,
  tipologia text, sottotipo text, geometria text,
  fornitore text, modello text, prodotto_id uuid references prodotti,
  sfero numeric, cilindro numeric, asse int, addizione numeric,
  bc numeric, dia numeric, visus text,
  note_occhio text, note_generali text,
  stato text check (stato in ('prova_in_negozio','campioni_consegnati','controllo_programmato')),
  controllo_previsto date,
  campioni_consegnati int not null default 0,
  esito text check (esito in ('confermata','nuova_prova','lente_modificata','interrotta','altro')),
  esito_nota text,
  riusa_da uuid references prove_lac
);
-- REGOLA DI PROVENIENZA (31/07): gli ORDINI salvano i valori Rx come
-- ISTANTANEA propria (occhiali in M4, LAC già nei parametri riga); il
-- riferimento ordine→prescrizione è provenienza facoltativa,
-- `on delete set null`. La cancellazione del typo non rompe nulla.
-- prescrizioni_attivazioni: resta (Ray) — per le LAC la crea la
-- «Conferma definitiva» della prova; per gli occhiali il pannello
-- conversioni. oculisti: come da 31/07.
```
**Incastri**: recall (M7) ← max(Rx clinica, ultima fornitura) +
prenotazioni · centrature/boxing/altezze/avvolgimento → ORDINE (M4;
od_dnp/os_dnp della Rx deprecate) · **duplica intero ordine
precedente** (Rx+lente+materiale+trattamenti+colorazione — SF §10.5)
→ M4/M5 · campioni consegnati ↔ giacenza prove (M5) · libreria
LAC ← listini AI + codifica al volo (M3/M5) · mappa oculisti → M9 ·
KPI esaminatore → M9.

## 5 · Le superfici (traccia)
La scheda unica a sezioni (solo quelle attive — SF: «completa ma
modulare»); pannello conversioni col «servite?»; percorso prove come
timeline; «Salva e…» con le due azioni.

## 6 · I conti che questo modulo salda
Gemello «rettifica clinica» → f2c ✓ · stranezze #4/#5 già a schedario ·
listini AI (conto) → f2f · **nuovo per M4/M5**: duplica-ordine.

## 7 · Test (traccia)
Unità PURE sulle tre formule (tabelle di casi, ±4,00 compreso).
Contratto: vincoli scheda/lac/prove. E2E: scheda unica occhiali+LAC →
prova → campioni → conferma definitiva → «Salva e crea ordine».

## 8 · Collaudo S1..Sn (aggiornato coi casi SF §11)
S1 scheda unica: check-up con Occhiali+LAC insieme, un professionista,
una data · S2 office: lontano+add, NIENTE intermedio auto · S3
occhiali→LAC a −5,50: vertice applicato, a −3,00 no; correggibile ·
S4 oculista al volo → alla seconda si seleziona · S5 mista: OD neutro
OS progressivo · S6 OD invariato: recupero auto, nuovo controllo
evidente · S7 appaiamento intenzionale · S8 prisma: valore senza base
→ la scheda NON salva · S9 prova LAC parziale: confermo OD, nuova
prova solo OS · S10 campioni 2+2 consegnati, controllo programmato →
esito confermata → **Conferma definitiva** → ordine con tutti i
parametri senza reinserire · S11 plano da check-up: Rx valida, recall
parte · S12 typo eliminato (vedi §11.7) vs rettifica clinica con nota
e sostitutiva.

## 9 · Camminata a tavolino — verbale
**30/07 · Ray**: integrata (convertitore, oculisti, niente scontrini).
**31/07 · Collega**: consegnate Risposte (6/6) + SF 11 pp. —
INTEGRATE: scheda unica, origini definitive, scadenza sticky,
DNP→ordine, mista/invariato/appaiamento, notazione, speciali, LAC per
occhio, percorso prove completo, campioni, conferma definitiva,
formule, recall, duplica-ordine, rettifica a due vie.
**Resta**: camminata CONGIUNTA (Ray+collega) sugli S1–S12 + i due
punti di §11 → poi sigillo.

## 10 · Congelamento
**Annotazione 1 · 04/08 (audit)** — refuso: il commento DDL §4 sulle
tipologie ometteva `office` (restaurata in §2, che FA FEDE); la
migrazione B2 la include. Inoltre: «prescrizioni_attivazioni: resta» è
SUPERATO da f2x-definitivo — nessuna tabella: l'ordine è
l'attivazione, la lettura è una proiezione (piano B2).
**Annotazione 3 · 05/08 (checkpoint B1)** — il §4 rimandava a un DDL
di `oculisti` mai scolpito (buco della fusione): RATIFICATA
l'inferenza dell'esecutore — registro per azienda con nome, studio,
citta, note, attivo e dedup su nome+studio normalizzati (fedele a
f2b: la disambiguazione degli omonimi).
**Annotazione 2 · 04/08 sera** — CONFERMATO da Ray, col requisito di
lettura («ci dicono chi ha la Rx progressiva: info utili all'ottico;
assicuriamoci di leggerle dal DB per la dashboard»): garanzia in piano
B4 — colonna-istantanea `tipologia_visione` sull'ordine + test di
lettura obbligatorio.

## 11-bis · Risposte finali (01/08) — il sigillo
4. **Office RESTA** tra le tipologie (deciso a voce; la voce del
   contratto v0.1 vive).
5. **Attivazioni dall'ordine** (f2x definitivo): valgono per tutto, il
   modulo di gestione arriva a parte.
6. **Definitiva LAC**: la conferma TRASFERISCE alla prescrizione; le
   prove restano tutte (tracciabilità).
7. **Campioni**: consumabili, niente scarico (per ora).
8. **Un ordine = un tipo**: mai LAC e occhiale insieme; la scelta apre
   la ricetta giusta.
9. **Notazione**: TABO default di negozio (99%) + scelta per Rx; il
   convertitore a video è UI futura.
Dal sigillo M1: **consenso sanitario firmato A OGNI Rx** (popup in
f2a, riga nel mastro con riferimento).

## 11 · Punti aperti di riconciliazione (per la camminata congiunta)
7. ~~Eliminazione del typo~~ — **RISOLTO (Ray, 31/07 sera)** col
   modello a regime: **l'ordine non punta alla ricetta, la porta
   dentro** — al momento dell'ordine i valori derivati si salvano come
   ISTANTANEA nell'ordine stesso (l'ottico legge la Rx dallo storico
   dell'ordine, non seguendo il riferimento). Il collegamento alla Rx
   base è pura PROVENIENZA: facoltativo, e alla cancellazione del typo
   va a vuoto senza rompere nulla (`on delete set null`). Quindi: il
   typo si elimina liberamente, sempre; gli ordini restano integri per
   costruzione.
8. **DNP nella 006**: `od_dnp`/`os_dnp` esistono sulla Rx dal
   contratto v0.1 — restano (additive-only) ma DEPRECATE per la Rx: la
   spec M4 le farà vivere nell'ordine. Nessuna azione ora, solo
   consapevolezza.
