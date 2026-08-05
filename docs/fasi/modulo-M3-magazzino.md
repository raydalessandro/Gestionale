# Modulo M3 — Catalogo & Magazzino · Spec (bozza COMPLETA di racconto)

*Era 1 · 30/07/2026. Racconto+passata di Ray (dettato serale, integrale)
+ PDF giacenze + Resi Terze Parti + Danno/LOF. **SIGILLATA il 01/08/2026** — passate complete; risposte in §11-bis.
La zip documenti in arrivo vale come verifica, non sorgente.*

## 0 · Fonti
Dettato M3 di Ray (30/07, 8KB — gestiva personalmente questi movimenti)
· PDF giacenze (montature/LAC/sole/miste) · Resi per Difetto di
conformità Brand Terze Parti · Reso per Danno (Sedico) · MODULO LOF ·
`dominio-ottica.md` §13-14. Attesa: zip documenti M3 (annunciata).

## 1 · Il modulo in una pagina
Il canale negozio↔fornitore, disegnato per PRIVATI e non per la
corporate: **un solo Ricevimento bolle** (la divisione
spedizione/ricevimento di catena è un artefatto corporate), il **carico
parziale** come gesto normale (ordinati 2, arrivato 1 → carichi 1), e
**la bolla generata dall'ordine**: i fornitori dei privati non sono
integrati, quindi la integrazione la facciamo NOI dal lato ordine —
quando l'ordine di lavorazione si conferma col movimento fiscale (la
caparra), il software legge le righe, distingue già-in-negozio da
in-arrivo, e genera la bolla attesa che l'ottico ritroverà nel
ricevimento: all'arrivo si CONFRONTA, non si digita. Le uscite hanno
**una causale sola raccontata due volte**: il fatto porta il perché,
cliente e magazzino sono due letture. I report: M9 («tutto il resto è
lettura») — i dati li prepariamo qui.

## 2 · Vocabolario (SIGILLATO)
- **Department**: montature vista · lenti oftalmiche · occhiali da sole
  · LAC · **liquidi** · accessori — espandibili. (Contratto intatto: il
  tipo `soluzione` resta nel DB, «Liquidi» è l'etichetta di department;
  `servizio` è nostro, fuori merce.)
- **Le tre quantità** (dal banco, finalmente nominate):
  `totale` = bollettato dal fornitore (anche non ancora caricato) ·
  `confermata` = arrivato fisicamente E caricato (= la giacenza
  vendibile) · `da confermare` = bollettato, non ancora caricato.
  Da noi: giacenza = confermata [PROIEZIONE dai movimenti]; totale e
  da-confermare derivano dalle bolle attese [PROIEZIONE].
- **Stati bolla attesa**: `attesa` → `caricata` (anche parziale, riga
  per riga) · `annullata`.
- **Causali di scarico interno** (rettifiche ±): `consumo` · `errore` ·
  `furto` · `danno_negozio` · `scaduto` · `smaltimento` · `altro`.
- **Analitiche di reso** (vivono sul RESO cliente, il magazzino le
  eredita): le 8 di Fase 4 ∪ {difetto_conformita, errore_checkup,
  errore_ricetta_oculista, insoddisfazione, non_adattamento_progressivo,
  scaduto} — mappa e consolidamento in camminata.
- **Pratica difetto conformità**: `aperta` → `riconosciuta` |
  `respinta` → `chiusa`; esiti: `sostituzione` · `rimborso` ·
  `respinto` («dipende dagli accordi col fornitore»).
- Campi SAP morti (Menge_ret, UMO): non si replicano.

## 3 · I flussi

### f3a · Ricevimento bolle — raccontato ◐ (con l'invenzione)
La lista bolle mostra: documento d'acquisto, data ordine, fornitore,
**riferimento interno** (n° busta/ordine + nome cliente), quantità
ordinata, **consegnato EDITABILE** (il carico parziale è la norma),
n° bolla, lettera di vettura.
**La bolla generata dall'ordine** [STATO GUIDATO]: alla CONFERMA
FISCALE dell'ordine (caparra incassata — 4c), il sistema legge le
righe, l'ottico ha già indicato in ordine cosa è da negozio e cosa da
fornitore (flag di provenienza riga → **incastro M4**), e nasce la
bolla attesa con le righe in-arrivo. La codifica al volo di M2 (f2f)
alimenta le righe LAC. All'arrivo: confronto fisica↔attesa, si carica
il consegnato (movimenti [FATTO]), la bolla va a `caricata`. Senza
bolla attesa (fornitore non ordinato da noi): carico manuale classico.
**Perimetro del trigger (chiarito da Ray il 30/07 sera)**: la bolla
attesa nasce SOLO dagli ordini-cliente confermati fiscalmente — busta
con caparra, ordine LAC per cliente (che l'acconto ce l'ha SEMPRE: si
ordina per lui, si conferma con lui → incastro M5). NON nasce per:
forniture di scorta che ordino io senza cliente, né vendite veloci di
LAC a banco — lì il carico resta manuale.
**Sviluppo futuro dichiarato (appunto, non si costruisce)**: lo stesso
meccanismo esteso ai riordini automatici di scorta («tengo dieci -2.00
giornaliere, ne vendo tre, il riordino le rimpiazza → il software sa
cosa arriva e prepara la bolla») — meccanica da catena, nei privati non
è rodata: farla ora sarebbe over-engineering.

### f3b · Inventario — raccontato ◐
Liturgia del banco: **conta settimanale/mensile almeno degli occhiali
da sole** (controllo furti); poi inventari di department, settoriali,
totale di fine anno. Il flusso è GUIDATO (liste per department →
marchio → SKU con colonna «contato», come i report veri) invece che
affidato alla mente del responsabile; le PWA lo agevoleranno (dopo).
Le differenze diventano **rettifiche ± con motivo** [FATTO con segno]:
consumo, errore, furto, altro.

### f3c-bis · Le due nature economiche dello scarico — DEFINITIVO (01/08)
Quando CARICO, carico anche un costo. Quando SCARICO, due strade:
**reso a fornitore = RIACQUISISCO il costo** (movimento fiscale: rendo
→ rimborso → ricompro il conforme — nota per MF) · **rottura di
negozio = PERDO il costo**. La differenza vive **nelle causali**: ogni
causale porta il suo carattere economico (`recupera_costo` sì/no nel
registro) e l'ottico sa sempre se scarica recuperando o perdendo.
**Valore fotografato DOPPIO**: `valore_costo` E `valore_prezzo`
[ISTANTANEE] — ogni impresa conta a modo suo (la catena: prima costi,
ora prezzi); **da noi le letture di default ragionano sul COSTO**.

### f3c · Scarico interno («l'ho rovinato io») — raccontato ◐
Movimento con causale + **valore fotografato** [ISTANTANEA]: non ho più
l'occhiale, ho un costo. Il TRATTAMENTO fiscale (stock accantonato?
scarico a fine anno? agevolazioni su merce danneggiata?) «va capito» →
**conto nuovo in lista unica, destinazione MF coi commercialisti**; il
movimento del gestionale intanto è sempre lo stesso.

### f3d · Reso a fornitore — raccontato ◐
Accordi variabili: merce sostitutiva o rimborso. **Causale unica**:
se origina da un reso cliente, il movimento la EREDITA via riferimento
— mai doppio inserimento; «cliente» e «magazzino» sono due proiezioni
(perché LUI ha reso / perché il 10% dei progressivi torna). Per danno
lenti → Sedico (flusso documentato). Per **conformità terze parti**
(Kering/Marcolin/Safilo): finestra 2 anni+2 mesi, pratica con SKU,
riferimento busta, descrizione, FOTO, proprietà-cliente vs esposizione,
esiti come da vocabolario — per l'indipendente si parla col
rappresentante, la pratica resta il registro. I «resi a magazzino» da
liste corporate: FUORI (via b — non siamo la catena).

### f3e · Fermo merce — ◐ (modellato; contatore scaduti C5 qui)
### f3f · Nascita prodotto — ◐ (listini AI + codifica al volo da M2;
carico iniziale via movimenti; UPC/EAN dal listino)

## 4 · I dati (DDL ABBOZZATO — non si applica in Era 1)
```sql
create table public.bolle_attese (              -- STATO GUIDATO
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  fornitore text not null,
  origine_busta_id uuid references ordini_occhiali,
  origine_lac_id   uuid references ordini_lac,
  numero_bolla text, lettera_vettura text,      -- dal cartaceo, all'arrivo
  stato text not null default 'attesa' check (stato in ('attesa','caricata','annullata')),
  note text, created_at timestamptz not null default now()
);
create table public.bolle_attese_righe (
  id uuid primary key default uuid_generate_v4(),
  bolla_id uuid not null references bolle_attese on delete cascade,
  prodotto_id uuid references prodotti,         -- null finché non codificato
  descrizione text not null, upc text,
  q_attesa int not null check (q_attesa > 0),
  q_caricata int not null default 0   -- parziale O ECCESSO: può superare q_attesa (3 su 2 → carichi 3; 01/08)
);
-- movimenti_magazzino (additive): valore_costo numeric, valore_prezzo numeric
--   ISTANTANEE doppie (01/08); letture default a COSTO. Nel REGISTRO causali:
--   recupera_costo boolean (reso_fornitore sì; danno/smaltimento no)
-- pratiche_difetto: prodotto/upc, cliente_id?, busta_rif, proprieta
--   ('cliente','esposizione'), descrizione, foto_refs, fornitore,
--   stato, esito ('sostituzione','rimborso','respinto'), accordi_note,
--   aperta_il, chiusa_il
```
**Incastri**: tre-quantità → proiezioni (confermata=giacenza; totale=
giacenza+Σ attese) · bolla attesa ← conferma fiscale ordine (M4: flag
provenienza riga; 4c: acconto_incassato_il) · analitiche due-letture →
report M9 (resi per causale lato prodotto E lato cliente) · fiscalità
rotture → MF · codifica al volo → righe bolla (M2/M5).

## 5 · Le superfici (traccia)
Ricevimento con lista bolle (attese in evidenza), confronto a video,
consegnato editabile; Inventario guidato coi tre scope; scarichi con
causale+valore; pratica difetto con foto.

## 6 · I conti che questo modulo salda
Valore smaltimenti (lista unica) → f3c · Fermi scaduti C5 → f3e ·
Listini AI + codifica al volo (metà M3) → f3f · **NUOVO**: trattamento
fiscale rotture/svalutazioni → lista unica, destinazione MF.

## 7 · Test (traccia)
Contratto: bolle attese, righe parziali, vincoli pratica. E2E: ordine
con caparra → bolla attesa → arrivo parziale → giacenze e tre-quantità
giuste; conta sole → furto → rettifica; reso cliente progressivo →
la lettura magazzino lo conta per causale.

## 8 · Collaudo S1..Sn (bozza)
S1 ordine occhiali con caparra: la bolla attesa nasce da sola con le
righe da-fornitore · S2 arrivano 1 su 2: carico parziale, `da
confermare`=1, giacenza +1 · S3 conta settimanale sole: manca un
Wayfarer → rettifica `furto`, storia pulita · S4 danno mio: scarico
`danno_negozio` con valore → M9 saprà quanto è costato l'anno · S5 reso
cliente «non adattamento progressivo» → il magazzino eredita la
causale: zero doppi inserimenti, due letture vive · S6 pratica
conformità Tom Ford (esposizione) con foto → riconosciuta →
sostituzione, giacenze giuste a ogni passo · S7 LAC non codificata
nell'ordine → codifica al volo → riga in bolla attesa.

## 9 · Camminata a tavolino — verbale
**30/07 sera · passata di Ray (integrata nel dettato)**: ricevimento
unico ✓ · bolla generata dall'ordine = design nostro ✓ · carico
parziale come norma ✓ · causale unica, due letture ✓ · resi-da-liste
corporate fuori ✓ · report rimandati a M9 ✓ · fiscalità rotture: da
capire coi commercialisti (conto aperto). **Stasera**: revisione
collega su M1-M2-M3. **Domani**: si apre M4.

## 10 · Congelamento
**Annotazione 1 · 04/08 (scoperto specificando M4)** — chiusura delle
bolle con differenza: `bolle_attese` guadagna `chiusa_il timestamptz` e
`chiusura_nota text`; la «lista delle bolle con differenza» (caricata ≠
attesa, in ±, non chiuse) è una PROIEZIONE ripescabile; l'ottico le
chiude A MANO col perché (arrivata dopo · merce rimandata · bolla
rigenerata dal fornitore) — nessun timer, nessuna integrazione.
Regola ribadita: **le bolle attese non muovono MAI valori né giacenze**
(i costi viaggiano solo coi movimenti reali del carico) → l'inventario
non si falsa per costruzione.

## 11-bis · Risposte finali (01/08) — il sigillo
10. **Valore**: costo E prezzo fotografati; letture default a costo.
11. **Rettifiche**: firma titolare/responsabile.
12. **N° bolla e lettera di vettura**: campi VERI ricercabili (la
    ricerca è UI, dopo — i dati ci sono).
13. **Eccesso**: come il difetto — 3 su 2, carichi 3.
E la regola economica in f3c-bis: recupero vs perdita, nelle causali.
