# Modulo M5 — LAC · Spec (bozza a metodo ROVESCIATO)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. **Scritta da Claude assemblando il corpus** (metodo
invertito, deciso da Ray: da qui in poi i moduli sono servizi nostri o
derivati — Claude propone dai sigilli, Ray e la collega correggono).
Ogni fonte è citata; il pezzo NUOVO — lo schema famiglia→variante — è
marcato PROPOSTA. I buchi da sciogliere sono in §11.*

## 0 · Fonti (tutto già in casa)
M4 f4d (ordine LAC, Ripeti, stessa-tipologia, precedenza fonti, acconto
sempre) · M4 f4g (Applicazione: perimetro, due canali, 1–4/5 settimane,
provate≠generate) · doc «Integrazione anamnesi e contattologia» della
collega (fonte primaria Applicazione) · M2 sigillata (prescrizioni_lac
definitiva per occhio, prove primo distillato, conferma-trasferisce,
campioni consumabili, filtri collegati, codifica al volo) · M3
sigillata (bolla attesa, acconto sempre, riordino-stock=futuro) · lista
unica: C2, incognita §10, listini AI, fixme e2e LAC.

## 1 · Il modulo in una pagina
La vita del portatore di LAC: dalla consegna dell'ordine (scarico,
avviso sul canale fotografato, **reset del recall**) al riordino rapido
(«Ripeti» in negozio oggi, dall'app del cliente domani), con la
finestra C2 che stima quando la scorta finisce e il win-back se il
cliente sparisce. Sotto, la chiave di volta: il **catalogo LAC a due
piani** — la famiglia (il modello del fornitore, coi suoi parametri
possibili) e le varianti (gli SKU per potere che vanno a giacenza, come
oggi) — che rende veri i filtri collegati, i BC/DIA autocompilati, la
codifica al volo e i listini via AI. L'**Applicazione** resta il modulo
della collega: perimetro fissato in M4, struttura dal suo documento.

## 2 · Vocabolario (SIGILLATO)
- **Il catalogo a scala** [CONFERMATO+RAFFINATO da Ray, 04/08]:
  **fornitore → linea/modello → producibilità**. Il modello porta le
  info comuni (tipologia, geometria, durata di porto, pezzi per
  confezione, BC/DIA) E **le regole di producibilità**: range sfero
  (−15…+15 tipico), step 0,25 tra ±6,50 e 0,50 fuori, cilindri
  disponibili per le toriche, assi — «a meno che quella LAC non abbia
  quelle diottrie in produzione». **Le diottrie NON sono righe: sono
  DATI** — sull'ordine, sulla prova, sulla Rx [ISTANTANEE]. Fare le
  combinazioni per riga (toriche: sfero×cilindro×asse) «diventa
  centinaia di migliaia di righe: impossibile, dobbiamo per forza fare
  i livelli».
- **Variante-prodotto** = riga per potere SOLO dove c'è stock FISICO
  (le scorte vere: decine di righe, on-demand dal modello, con l'UPC
  giusto quando noto). Il catalogo descrive il POSSIBILE, il magazzino
  registra il REALE.
- **Durate**: giornaliera · quindicinale · mensile · trimestrale ·
  semestrale · annuale · convenzionale ✓ (confermate).
- **Variante** = lo SKU per potere/parametri (l'unità che si vende e va
  a giacenza — com'è oggi, contratto intatto).
- **Campioni**: varianti della categoria dedicata (Ray, M2): fuori
  giacenza, consumabili.
- **Eventi dell'Applicazione** (doc collega): prima_applicazione ·
  controllo · modifica · sostituzione · follow_up; stati/esiti prova
  già a vocabolario M2.
- **Porto standard per tipologia** (Ray 04/08): giornaliera = 1 giorno
  a lente · quindicinale = 15 · mensile = 30 · (trimestrale 90,
  semestrale 180, annuale 365) — il porto pieno è il default.
- **Copertura stimata** [PROIEZIONE]: lenti totali (confezioni × pezzi)
  × durata **÷ 2** — perché «l'uomo ha due occhi: due mensili fanno un
  solo mese» (Ray, 04/08 — «spesso i clienti fanno i conti con un
  occhio solo»). Ordini monolaterali: le righe sono per occhio, la
  divisione segue. Porto ridotto (part-time): correttore opzionale
  dall'Applicazione o dalla scheda, sempre correggibile. L'ANTICIPO
  della coda è una taratura del motore → M7.

## 3 · I flussi

### f5a · Consegna e ritiro — assemblato ◐
Ordine `da_chiamare` → avviso sul canale fotografato nell'ordine →
`in_consegna` → ritiro: ponte di cassa (saldo se dovuto), **scarico
alla consegna** [FATTO], l'àncora del recall si sposta alla data di
consegna (M2 f2e → M7). Da qui parte la copertura stimata.

### f5b · Riordino rapido — assemblato ◐ (+ C2)
In negozio: «Ripeti» dallo storico (M4 f4d) o «stessa tipologia» se la
Rx è rigenerata; precedenza fonti già scolpita. **La finestra C2**
[PROIEZIONE → motore M7]: quando la copertura stimata si avvicina alla
fine (anticipo di N giorni), il cliente entra nella coda «riordino
LAC»; se la supera senza riordinare → **win-back**. Il porto dichiarato
arriva dall'Applicazione (autonomia/porto) o dal default del modello,
sempre correggibile. Domani: lo stesso «Ripeti» dall'app del cliente
con pagamento (M4, seme dichiarato).

### f5c · Vendita veloce LAC a banco — assemblato ◐
Senza ordine: scarico diretto alla vendita [FATTO], CF come istantanea
se richiesto (M1 nascita-al-volo). **Resetta il recall come una consegna** (Ray 04/08: raro — «chi fa
ordine ricorrente non fa vendite veloci» — ma così l'edge case è
previsto in modo semplice).

### f5d · Codifica al volo, completa — assemblato ◐
Dentro l'ordine (M2 f2f): se il modello non esiste → si crea la
FAMIGLIA (fornitore, nome, tipologia, durata, pezzi, BC/DIA) in un
pannello unico CON le regole di producibilità; il potere richiesto è
un DATO della riga d'ordine, e finisce in bolla attesa — nessuna
variante da creare (nasce solo se un giorno carichi stock). «Gli ottici ci codificano le LAC senza
accorgersene» — e da oggi codificano famiglie, non righe sciolte.

### f5e · Listini via AI — assemblato ◐ (conto in lista)
L'ingestione popola i MODELLI: producibilità e mappa UPC-per-potere.
Le varianti si materializzano on-demand con l'UPC giusto solo quando
servono a giacenza. La ricerca umana (famiglia → filtri →
variante) diventa naturale invece che «diametro+raggio».

### f5f · L'Applicazione — perimetrata, fonte: doc collega ◐
Modulo a sé (M4 f4g): eventi, valutazione clinica strutturata (scale
configurabili, rotazione toriche con asse compensato proposto,
film/BUT, depositi), **BC/DIA autocompilati dalle varianti del
modello** (ecco perché serve la famiglia), campioni per occhio,
«Conferma come lente definitiva» → trasferisce alla sezione LAC della
scheda (M2) → l'ordine la trova prioritaria (M4). Assignment: la
collega la lavora in autonomia; il DDL sotto è il raffinamento del
primo distillato.

### f5g · L'incognita §10 — storia chiusa a metà (04/08)
Memoria di Ray: **bug d'epoca già diagnosticato** — «mancavano dei
pezzi» nel catalogo piatto e il wizard «Da catalogo» andava in timeout.
Il ridisegno a scala ELIMINA la classe d'errore: niente righe-potere da
cui possano mancare pezzi — il wizard naviga modelli (pochi) e valida i
poteri con la funzione di producibilità. La verifica in S0 resta dovuta
(conferma nel codice); i due `fixme` e2e si riscrivono sul flusso nuovo
in Era 2.

## 4 · I dati (DDL ABBOZZATO — PROPOSTA da correggere)
```sql
create table public.lac_modelli (            -- ANAGRAFE: la famiglia
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  fornitore text not null,
  nome text not null,
  tipologia text not null,                   -- vocabolario M2
  sottotipo text, geometria text,
  durata text not null check (durata in ('giornaliera','quindicinale','mensile','trimestrale','semestrale','annuale','convenzionale')),
  pezzi_per_confezione int not null default 1,
  bc_disponibili numeric[], dia_disponibili numeric[],
  parametri_schema jsonb,                    -- campi extra dipendenti dal prodotto (SF)
  producibilita jsonb,   -- {sfero:{min,max,step_regole}, cilindri:[…], assi:{…}, add:[…]}
  upc_mappa jsonb,       -- dal listino: potere→UPC (materializza la variante giusta on-demand)
  campioni boolean not null default false,
  attivo boolean not null default true,
  unique (azienda_id, fornitore, nome)
);
-- prodotti (additive): modello_id uuid references lac_modelli
--   → varianti ON-DEMAND: nascono SOLO per lo stock fisico (carico
--     scorte, vendita veloce), auto-generate dal modello con l'UPC
--     della mappa. Il contratto giacenza resta intatto.
-- ordini_lac / prove: i poteri (sfero/cil/asse/add) sono DATI di riga
--   [ISTANTANEE]; il controllo di producibilità è una FUNZIONE PURA
--   sul modello (avviso, mai blocco: regola di libertà)
-- prove_lac (raffinamento dal doc collega, additive sul distillato M2):
--   evento text check (evento in ('prima_applicazione','controllo','modifica','sostituzione','follow_up'))
--   valutazione jsonb   -- movimento, centratura, rotazione+asse_compensato{proposto,usato},
--                       -- film{but,menisco}, scale{schema,valori}, depositi, comfort/visione
--   suggerimenti_materiale text  -- non vincolanti, con motivazione (SF)
-- ordini_lac righe: variante = prodotto_id (com'è) + modello leggibile via join
```
**Incastri**: copertura → coda riordino/win-back (M7) · consegna →
reset recall (M7) · bolla attesa ← ordine (M3) · definitiva ← conferma
prova (M2/M4 precedenza) · listini AI → famiglie+varianti · app
cliente ← Ripeti (futuro) · contenitore preventivi-recall (M4) vale
anche per i salvati LAC.

## 7 · Test (contratto)
Contract: vincoli `lac_modelli` (durate, unique) e `prodotti.modello_id`.
Unit PURE: producibilità (griglia di casi: step 0,25/0,50, cilindri,
fuori-range → avviso) · copertura ÷2 (bilaterale, monolaterale, porto
ridotto). E2E: S1·S3·S4·S6·S7 per nome (S2 coda/win-back gira in B7;
S5 Applicazione = innesto Y, rimandato con motivo). Ereditati: i due
e2e LAC `fixme` si RISCRIVONO sul flusso nuovo (B4/B9).

## 6 · I conti che questo modulo salda
C2 finestra+win-back → f5b · incognita §10 → f5g (ipotesi + diagnosi
S0) · listini AI + codifica al volo → f5d/f5e · fixme e2e LAC →
riscritti in Era 2 sul flusso nuovo · campioni → f5f (consumabili,
conferma-definitiva).

## 8 · Collaudo S1..Sn (bozza)
S1 consegna: scarico, recall che riparte, copertura stimata visibile ·
S2 mensili 2 confezioni ×6, porto quotidiano → coda riordino a ~11
mesi meno anticipo; win-back se supera · S3 «Ripeti» in tre click; Rx
rigenerata → «stessa tipologia?» · S4 codifica al volo di una famiglia
nuova dentro l'ordine → variante in bolla · S5 prova torica: asse
compensato proposto, corretto a mano, tracciato; conferma → definitiva
→ l'ordine la trova prioritaria · S6 vendita veloce a banco: scarico,
CF istantanea, [recall: §11.3] · S7 wizard da-catalogo sul due-piani:
fluido (post-diagnosi §10).

## 9 · Camminata — verbale
Bozza rovesciata del 04/08: ATTENDE le correzioni di Ray (flussi,
vocabolario durate, C2) e della collega (Applicazione, famiglia
clinica). Poi sigillo.

## 11-bis · Risposte (04/08)
2. **C2/porto** ✓ porto standard dalla tipologia (tabella in §2);
   **divisione per due occhi** nella copertura; monolaterale dalle
   righe; porto ridotto = correttore opzionale; anticipo = taratura M7.
3. **Vendita veloce** ✓ resetta il recall come una consegna (edge case
   raro, previsto semplice).
4. **Campioni** ✓ così per ora — niente costo, niente fiscalità;
   contarli è evoluzione dichiarata, si costruisce dopo.
5. **Rigide/su misura**: coperte dai doc della collega (tipologie
   Rigida/Semirigida/Specialistica + campi dipendenti dal prodotto =
   `parametri_schema`); sono rare → le note libere bastano sempre.
   Conferma finale: camminata della collega.

## 11-ter · Le ultime due (04/08) — il modulo è pieno
1. **Catalogo a scala** ✓ CONFERMATO e raffinato: fornitore→linea→
   producibilità; le diottrie sono DATI, mai righe; varianti solo per
   lo stock fisico. (I doc della collega davano i filtri collegati; la
   griglia dei poteri non era specificata — ora lo è, qui.)
6. **§10** ✓ memoria: bug d'epoca diagnosticato, pezzi mancanti; il
   ridisegno lo assorbe; verifica in S0.
Sigillo apposto il 04/08 (camminate chiuse); il filone Applicazione è
innesto Y della collega.

## 10 · Congelamento
**Annotazione 2 · 05/08 (esito S0)** — l'ipotesi «pezzi mancanti nel
catalogo piatto» come causa del timeout è stata SMENTITA dalla
diagnosi (tabella riga-per-riga in S0-verita.md): la causa vera è nel
trace e si chiude in B3. Il ridisegno a scala di f5g resta valido per
le sue ragioni proprie (niente esplosione combinatoria), non come fix
del bug.
**Annotazione 1 · 04/08 (audit)** — refusi di patch: il bullet
«Variante» compariva due volte (fa fede «Variante-prodotto»); S6 punta
a «§11.3» che ora è 11-bis.3.
