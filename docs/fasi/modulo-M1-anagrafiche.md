# Modulo M1 — Anagrafiche & Privacy · Spec (bozza COMPLETA di racconti)

*Era 1 · aperta il 29/07/2026. Stato: **tutti e cinque i flussi
raccontati** (racconto + contro-interrogatorio del 29/07, risposte in
§11). **SIGILLATA il 01/08/2026** — camminate assorbite dalle passate
incrociate (Ray 30/07-01/08, collega via documenti); risposte finali in §11-bis.*

## 0 · Fonti
Racconto di Ray del 29/07 (anagrafica campo per campo) + risposte al
contro-interrogatorio (§11) · schermate CIAO! (`dominio-ottica.md` §14)
· migrazione 006 (base esistente) · `docs/regole/ponte-chiave.json` ·
AR-01. **Nota del 30/07**: i moduli consenso di catena sono DECLASSATI a
materiale legale — pagine da allegare alla firma, non moduli operativi;
creeremo i nostri testi e la `versione_informativa` del mastro punterà
a quelli. Per il sigillo resta SOLO la camminata.

## 1 · Il modulo in una pagina
La scheda cliente come la fa un ottico vero: **a compilazione
progressiva** — una parte prima della visita, una dopo, a scelta
dell'operatore, da qualunque superficie («a noi non cambia in
gestione»). Qui nascono identità, recapiti, consensi col loro libro
mastro, relazioni (tutela e famiglia), requisiti per sconti
assicurativi/convenzionati, dati di fatturazione. NON nascono qui:
prescrizioni (M2), il registro pieno di assicurazioni/convenzioni
(modulo convenzioni — qui struttura e cancello), la firma digitale come
tecnologia (roadmap — qui i suoi agganci).
**Visione (vincola il disegno)**: il gestionale lo apre poco l'ottico;
DB e azioni reggono PWA sottili e QR (per il cliente: la futura area
personale dove gestirà da sé preferenze e canale).

## 2 · Vocabolario (SIGILLATO)
- **Canali di consenso marketing**: `email` · `cellulare`
  (chiamata/messaggio) · `cartaceo`. Perimetro del PERMESSO.
- **Canale preferito** (operativo, già in casa dalla 006): SLEGATO
  dalla privacy — dice quale provare per primo, si cambia senza
  toccare le firme; domani self-service nell'area cliente.
- **Relazioni tra clienti**: `tutore_legale` (persona O ente — centri
  sociali inclusi) · familiari granulari **simmetrici in lettura**:
  `padre` · `madre` · `figlio` · `fratello` · `sorella` (una riga, due
  versi). Nessuna visibilità né permesso dalla relazione. Le varianti
  di INTESTAZIONE fattura del minorenne (al minore, o con tutore
  segnalato) → MF: solo fatturazione, non toccano il sistema.
- **Modalità firma**: `penna` (stampata e archiviata) · `digitale`
  (quando il modulo firma sarà vivo).
- **Assicurazione del cliente**: `null` = da rilevare · voce esplicita
  `NESSUNA` = chiesto, non ne ha · altrimenti la voce del registro.

## 3 · I flussi

### f1a · Nuovo cliente al banco — raccontato ◐
Compilazione progressiva verso la scheda più completa possibile.
1. Identità [ANAGRAFE]: nome, cognome, data di nascita, sesso, CF;
   secondo nome presente ma secondario in UI.
2. Recapiti [ANAGRAFE]: cellulare, tel. casa, tel. lavoro, email
   **facoltativa e MAI fittizia** (le fittizie aziendali sono una pezza
   dei sistemi che non reggono il senza-email; da noi il vuoto è
   legittimo — e culturalmente «se manca è perché non l'hai chiesta»).
3. Indirizzo [ANAGRAFE]: via, scala/app. ripiegato, CAP, città,
   provincia, nazione.
4. Consenso marketing [FATTO nel mastro, §4]: sì/no + canali
   consentiti + firma [ISTANTANEA: modalità, versione informativa].
   Il canale preferito si sceglie A PARTE (slegato).
5. Requisiti sconti [ANAGRAFE + REGISTRO]: assicurazione (da rilevare
   → NESSUNA o voce) e azienda convenzionata. **Cancello** (AR-01):
   senza requisito, lo sconto corrispondente in M8 rifiuta — e quel
   rifiuto è anche il punto naturale di raccolta del dato in vendita.
6. Se P.IVA [ANAGRAFE, jsonb]: CF azienda, ragione sociale, doppio
   indirizzo, CAP/città/provincia/nazione, SDI (lo leggerà MF).
7. Tutela/famiglia [ANAGRAFE relazionale]: vedi f1d. **Dal CF si
   riconosce il minorenne** → il sistema PROPONE la scheda tutore
   (facoltativa).
Fonte: racconto 29/07 + risposte 1·2·4.

### f1b · Cliente veloce / di passaggio — raccontato ◐
«Sarebbe bello prendere dati ma non c'è modo in quel flusso e
soprattutto non c'è la sua volontà; il problema non sono mai i due
minuti.» **Fuori dal codice (via c)**: l'attrito è umano; la vendita
veloce resta senza cliente o con scheda minima; la risposta sono le PWA
(fuori perimetro). Per il DB: niente da fare — già regge entrambe.

**La nascita al volo (idea del 30/07, Ray)** — la variante che invece
il DB DEVE reggere: sulla vendita veloce (LAC comprese) si chiede il CF
→ [ISTANTANEA] `cf_cliente` sul fatto: basta per scontrino col CF,
detrazione 730 e invio TS (lato emissione: MF). **Senza consenso, il CF
resta lì**: nessuna scheda nasce, nessun dato oltre lo storico del
fatto. **Con la firma sul popup** (contatto + consenso, firma digitale
→ riga `digitale` nel mastro, `documento_ref`): nasce l'anagrafica coi
dati prefillati dal CF — data di nascita, sesso, comune (il nome si
verifica soltanto: si digita) — e la vendita si collega. La cassa non
si inquina: la nascita è un gesto di BANCO che affianca la vendita
(AR-01); aggancio lato cassa in spec M8.

### f1c · Aggiornamento nel tempo — raccontato ◐
Recapiti e indirizzo: modifica libera [ANAGRAFE]. Consensi: SOLO
attraverso il mastro (nuova riga; la cache si aggiorna). Canale
preferito: si cambia quando si vuole, zero firme — e in prospettiva lo
fa il cliente dall'area personale [incastro §4]. **Rinnovo periodico
della firma: NON ESISTE** (risposta 5: il consenso è permanente; presa
la firma e conservata a norma, su questo fronte il negozio non lavora
più). Fuori dal codice (via b): scadenze e solleciti di ri-firma.

### f1d · Minore, tutelato, famiglia — raccontato ◐
Il tutore/referente È un'anagrafica cliente completa (persona o ENTE:
centri sociali), COLLEGATA con tipo `tutore_legale`. **Lo scopo è la
fatturazione**: il documento può intestarsi al referente [incastro MF].
i familiari granulari (padre/madre/figlio/fratello/sorella) sono il filtro
interno di Ray: aprendo la scheda vedo che in famiglia ci sono altri
clienti — informazione al banco oggi, potenziale commerciale domani
[incastro: comunicazioni/offerte di famiglia]. Nessuna visibilità
speciale deriva dalle relazioni.

### f1e · Revoca e cancellazione — raccontato ◐
Due gesti, stessa sezione permessi della scheda:
1. **Revoca comunicazioni**: un tasto → riga `revocato` nel mastro,
   cache spenta, i richiami COMMERCIALI si fermano subito; gli
   operativi («i suoi occhiali sono pronti») restano leciti. Teniamo i
   dati, non le si comunica.
2. **Eliminazione definitiva**: tasto separato e protetto (conferma
   forte via codice; in seconda fase pagina «operazioni speciali») →
   procedura di anonimizzazione che preserva i fatti fiscali.
   **Scope dichiarato**: che sia POSSIBILE, non comodissima — «non
   succede praticamente mai», si affina se servirà.
(In catena lo gestisce la sede; noi, lavorando con privati, siamo il
canale diretto.)

## 4 · I dati (DDL ABBOZZATO — non si applica in Era 1)

**I consensi come LIBRO MASTRO** (la «cosa delicata» risolta col
pattern di casa: eventi=FATTI, stato corrente=cache):

```sql
create table public.consensi (
  id            uuid primary key default uuid_generate_v4(),
  azienda_id    uuid not null references aziende,
  cliente_id    uuid not null references clienti,
  tipo          text not null check (tipo in ('marketing','dati_sanitari')),
  prescrizione_id uuid,           -- SOLO dati_sanitari: la firma è PER-PRESCRIZIONE (01/08)
  azione        text not null check (azione in ('dato','revocato')),
  canali        text[],            -- solo marketing ⊆ {email,cellulare,cartaceo}
  modalita      text check (modalita in ('penna','digitale')),
  versione_informativa text,       -- ISTANTANEA: quale testo ha firmato
  documento_ref uuid,              -- aggancio al futuro archivio firme
  utente_id     uuid references utenti,
  avvenuto_il   timestamptz not null default now()
);
-- clienti.consenso_* diventano PROIEZIONE-cache tenute allineate
-- dall'azione (pattern giacenza). canale_preferito resta com'è: slegato.

create table public.clienti_relazioni (
  id          uuid primary key default uuid_generate_v4(),
  azienda_id  uuid not null references aziende,
  cliente_id  uuid not null references clienti,   -- il soggetto
  relativo_id uuid not null references clienti,   -- il collegato (persona o ente)
  tipo        text not null check (tipo in ('tutore_legale','padre','madre','figlio','fratello','sorella')),
  -- una riga, letta nei DUE versi (padre⇄figlio, fratello⇄fratello)
  note        text,
  unique (cliente_id, relativo_id, tipo)
);
-- clienti.tutore_legale (006, testo) → DEPRECATA a favore della relazione.

-- Su clienti (additive):
--   assicurazione_id uuid references assicurazioni,        -- null = da rilevare
--   azienda_convenzionata_id uuid references convenzioni,  -- registro pieno col modulo convenzioni
--   dati_fatturazione jsonb  -- {cf_azienda, ragione_sociale, indirizzo1, indirizzo2, cap, citta, provincia, nazione, sdi}
--   consenso_canali text[]   -- cache dal mastro
-- Registro assicurazioni: nasce qui MINIMO (id, nome, attivo) con la
-- voce NESSUNA; si arricchisce col modulo convenzioni.
```

**Tabella degli incastri**: richiami per canale → mastro+cache canali ·
audit privacy → mastro (modalità, versione, documento_ref) · sconto
assicurativo/convenzione (M8) → requisiti ≠ null/NESSUNA · fattura B2B
e fattura-al-referente (MF) → dati_fatturazione + relazione tutore ·
area personale cliente (app futura) → mastro consensi e canale
preferito via identità portale · nascita scheda dalla vendita veloce →
M8 chiama la creazione standard M1 (CF prefill + mastro digitale) · comunicazioni di famiglia (futuro) →
clienti_relazioni.

## 5 · Le superfici (traccia)
Scheda in sezioni con i campi rari ripiegati; sezione Permessi col
mastro leggibile («dato il 12/03, penna, informativa v2»), tasto revoca
e tasto eliminazione protetto; blocco famiglia informativo. UI vera più
avanti; le PWA sono fuori perimetro ma il disegno delle azioni le
prevede.

## 6 · I conti che questo modulo salda
Anonimizzazione GDPR → f1e.2 (scope minimo dichiarato) · gemello
«revoca consensi» → f1e.1 · gemello «anonimizzazione» → f1e.2 ·
schermate CIAO! restanti → documenti M1.

## 7 · Test (traccia)
Contratto: vincoli mastro/relazioni, cache allineata dall'azione.
E2E `m1-anagrafiche.spec.ts`: scheda progressiva → consenso con canali
→ revoca → i commerciali spariscono, gli operativi restano; tutelato
con referente-ente collegato.

## 8 · Collaudo S1..Sn (bozza)
S1 scheda completa stile racconto, con blocco P.IVA · S2 consenso a
penna (email+cellulare) poi seconda firma digitale con canali diversi:
il mastro mostra due righe, la cache l'ultima · S3 revoca dal tasto: i
commerciali si fermano SUBITO, «occhiali pronti» ancora lecito · S4
minore con centro sociale come tutore: la relazione c'è, la scheda del
minore mostra il referente, [MF: fattura intestabile al referente] ·
S5 assicurazione da-rilevare → in vendita lo sconto assicurativo
rifiuta e invita a rilevare; con NESSUNA rifiuta e basta · S6
eliminazione definitiva protetta → anonimizzato, fatti fiscali intatti
· **S7** vendita veloce LAC con CF: (a) niente firma → scontrino/TS col
CF, NESSUNA scheda; (b) firma sul popup → scheda nata con prefill dal
CF, vendita collegata, mastro con riga `digitale`.
(S7 è scenario CROSS-MODULO: si collauda in B5/M8; la busta B1 copre
S1-S6 per disegno — annotato su audit esterno, 05/08.)

## 9 · Camminata a tavolino — verbale
**30/07 · passata di Ray**: «muta» al livello dati — nessuna riserva su
campi e flussi; tutte le osservazioni riguardano le informazioni che la
scheda mostra una volta aperta al banco → superfici/PWA, parcheggiate
al lavoro UI. In attesa: passata della collega (stasera).

## 10 · Congelamento
**Annotazione 1 · 05/08 (checkpoint B1)** — `azienda_convenzionata_id`
è FK a CLIENTI (l'ente convenzionato è una scheda cliente-ente, come
il tutore-ente): il `references convenzioni` del §4 si legge così
finché il modulo convenzioni non nascerà (ponte additive allora).
(dopo il sigillo)

## 11-bis · Risposte finali (01/08) — il sigillo
1. **Minori/CF**: dal CF si riconosce il minorenne → proposta scheda
   tutore; le varianti di fattura sono SOLO fatturazione → MF.
2. **Consenso dati sanitari**: si chiede e firma **A OGNI inserimento
   di prescrizione** (popup alla Rx, interna o oculistica); il
   marketing basta una volta. La riga del mastro porta il riferimento
   alla Rx.
3. **Familiari**: padre/madre/figlio/fratello/sorella, simmetrici in
   lettura. Servono a legare le famiglie, punto.

## 11 · Contro-interrogatorio del 29/07 — RISPOSTO
1. Email: facoltativa, mai fittizie ✓. (Niente import di dati di catena: nessuna normalizzazione da prevedere — 31/07.)
2. Canali di consenso ≠ canale preferito: SLEGATI ✓ (preferito
   liberamente modificabile, domani self-service del cliente).
3. Relazioni: tutore anche ENTE, scopo fatturazione; famiglia =
   informazione interna; niente visibilità dalle relazioni ✓.
4. Requisiti: compilazione progressiva, default «da rilevare»; il
   cancello sconti è anche punto di raccolta ✓.
5. Rinnovo firma: NON esiste — consenso permanente, revocabile ✓.
6. Revoca = tasto nei permessi (subito); eliminazione = tasto protetto,
   possibile non comodissima ✓.
