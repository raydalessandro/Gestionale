# La campagna di completamento — due ere, un gestionale finito

*Riscritta la sera del 28/07/2026 (v2, sostituisce la v1 del pomeriggio).
Prima si specifica TUTTO, poi si esegue TUTTO: il dominio non va
scoperto ma trascritto — sta in documenti di catena costruiti su
decenni — e il business può partire intanto su portale, prenotazioni e
richiami. Le cose messe dentro bene restano per sempre; l'unica a
manutenzione annuale è la fiscalità, ed è per questo che vive fuori dal
core (`docs/decisioni/FI-01`).*

## Le tre clausole del patto

1. **Ogni spec si sigilla col collaudo a tavolino**: gli scenari S1..Sn
   camminati su carta da Ray e dall'agente (due ottici veri) prima che
   la spec sia chiusa. È il feedback dell'esperto al posto del feedback
   del codice.
2. **Si specifica in ordine di dipendenza e ogni spec rilegge le
   precedenti.** A fine Era 1 la passata di coerenza C0 controlla i
   punti dove i moduli si parlano.
3. **Durante l'Era 1 l'unico codice ammesso è la S0** (infrastruttura).
   I moduli si codano solo in Era 2, a spec congelate.

## S0 · Fondazioni — stato VERIFICATO stasera (28/07)

| Voce | Stato |
|---|---|
| §1 Secrets CI + progetto Supabase di test | ✅ CHIUSO — progetto on, CI attiva sul DB di test (conferma Ray; `ci.yml` e `ambienti.md` verificati) |
| §6 Fuso `lib/utils.ts` | ✅ SALDATO in G8/019 — helper `TZ_ROMA`, migrazione applicata |
| §10 Timeout wizard LAC «Da catalogo» — MAI diagnosticato | 🔶 APERTO — **diagnosi in S0**, fix nella spec/esecuzione M5 |
| §4 Favicon + OG portale (`public/` non esiste) | 🔶 APERTO — termine: primo negozio reale |
| §5 Commento stale `schema.sql` (fonte `sito`→`sito_negozio`) | 🔶 cosmetico, strada facendo |

## Era 1 · «La grande specifica» — 29/07 → ~metà settembre

**Il rito, per ogni modulo** (3-4 giorni l'uno — deciso il 28/07 sera):
**il racconto viene prima dei documenti.** Ray racconta il flusso come al
banco (esperienza, non astrazione) → Claude contro-interroga («e se
succedesse…?») → **triage a tre vie**: (a) succede ed è gestito così →
si speca; (b) il codice potrebbe, ma in negozio non accade; (c) accade,
ma l'ottico ha già la soluzione in mano → niente codice. **Le vie (b) e
(c) si SCRIVONO in spec** (sezione «Fuori dal codice, e perché») — sono
semi del manuale, non buchi. Poi i manuali arrivano come **verifica e
vocabolario** (le parole esatte di causali e campi → check-constraint),
non come sorgente. Quindi: bozza di spec sul
[modello](modello-spec-modulo.md), grossa e fitta → **camminata a
tavolino** (Ray + agente) → correzioni → **sigillo** (verbale in §9).
Le funzionalità da una-volta-l'anno possono diventare **procedure
parallele dichiarate** (decisione scritta, non buco). Zero righe di
codice fuori da S0. La mappa interattiva dei flussi e dei documenti è
[`campagna.html`](campagna.html). La lingua comune di tutte le spec è
[`../grammatica-dati.md`](../grammatica-dati.md): sei classi, l'incastro
letture↔scritture, le TRE domande fisse (leggibilità futura, istantanee, gemello — la terza dal ponte con La Chiave, `docs/regole/ponte-chiave.json`).

**Il calendario e la lista della spesa** (i documenti da procurare per
ciascun modulo — così i recuperi si preparano in anticipo):

| # | Modulo | Documenti di catena da portare |
|---|---|---|
| M1 | Anagrafiche & Privacy | Moduli consenso/informative, procedura cancellazione/anonimizzazione, schermate CIAO! restanti |
| M2 | Prescrizioni | Schede Rx complete (visus, cheratometria, refertazione esterna), regole di validità |
| M3 | Catalogo & Magazzino | Procedure inventario complete (On-Hand già in casa), ricevimento merce/bolle, listini e import, 551 (già) |
| M4 | Buste & Laboratorio | Buste lavoro compilate campione, moduli ordine lenti/laboratorio, tabelle di montaggio |
| M5 | LAC | Schede applicazione/prova, protocolli di riordino e porto |
| M6 | Agenda & Prenotazioni | Regole appuntamenti di catena; DECISIONE §12 (tassonomia servizi↔visite) |
| M7 | Richiami | Script di richiamo (alcuni già), matrici tempi/tipologie |
| M8 | Cassa & Resi (non fiscale) | Chiusure campione (molte già in casa), causali complete resi |
| M9 | Report & Export | Report direzionali/KPI di catena, specifiche pubbliche tracciato TS |
| M10 | Utenti, Ruoli & Onboarding | Mansionari/permessi, checklist apertura negozio; DECISIONI §11 e multi-sede |
| C0 | **Passata di coerenza trasversale** (3-4 gg) | — rilettura incrociata di tutte le spec sigillate: anagrafica↔Rx↔busta↔cassa, agenda↔portale, magazzino↔buste, LAC↔richiami. Regola rossa: le letture possono vivere sul fronte, **denaro e giacenza si muovono solo lato server**. Esce il verbale C0 e l'ordine definitivo d'esecuzione |

**DoD di una spec (Era 1)**: fonti distillate nel dominio · vocabolario
definitivo in tabelle · flussi completi coi casi limite dentro · DDL
abbozzato in §4 · scenari S1..Sn concreti · **verbale di camminata
chiuso senza riserve** · conti della lista unica indirizzati · spec
precedenti rilette e incroci annotati.

## Era 2 · «L'esecuzione» — ~metà settembre → fine ottobre (buffer: novembre)

Modulo per modulo, nell'ordine confermato da C0: **test prima**
(contratto L2 + E2E del flusso completo, scritti sulla spec; i `fixme`
ereditati si riscrivono qui) → codice (migrazioni additive dalla §4,
vocabolario intoccabile, corsie) → CI verde → manuale (agente-manuali)
→ **collaudo S dal vivo**. Le spec sono congelate: ogni deroga si
annota in §10 della spec con data e motivo.

**DoD di un modulo (Era 2)**: spec rispettata · E2E del flusso completo
verde in CI · zero TODO/FIXME residui del modulo (codice E registro) ·
manuale allineato · collaudo S superato dal vivo · riga della lista
unica marcata ✅.

**M11 · Collaudo generale** (ultima settimana): E2E «la settimana del
negozio» multi-modulo, performance, manuale v1.0, `piano.md` riscritto.

**MF · Fiscalità** — dopo, coi commercialisti, nei nove mesi: modulo di
confine su transazioni chiuse, append-only (FI-01). Numeri al NETTO
d'IVA nel core: entrano dalle spec M8/M9.

## La lista unica dei conti aperti (verificata il 28/07 sera)

| Conto | Fonte | Stato | Si salda in |
|---|---|---|---|
| Secrets CI + progetto test | TODO-ray §1 | ✅ | — (chiuso) |
| Fuso `lib/utils.ts` | TODO-ray §6 | ✅ | — (G8/019) |
| Coerenza tenant registro | TODO-ray §7 | ✅ | — (018) |
| Residuo test prenotazioni | TODO-ray §5 | ✅ | — (015) |
| Contrasto testata portale | TODO-ray §5 | ✅ | — (G5) |
| Timeout wizard LAC | TODO-ray §10 | 🔶 quasi chiuso | memoria 04/08: pezzi mancanti nel piatto; ridisegno M5 f5g lo assorbe; conferma in S0 |
| Interfacce per ruolo (titolare vs addetto) | concetto tardivo | 🔶 progettato | M10 f10b/f10c (matrice in permessi.json + dashboard unica) |
| Favicon + OG (`public/` assente) | TODO-ray §4 | 🔶 | S0 |
| Commento stale schema | TODO-ray §5 | 🔶 | strada facendo |
| Seed metodi ↔ nascita negozio | TODO-ray §11 | 🔶 | spec M10 |
| Tassonomia servizi↔visite | TODO-ray §12 | 🔶 proposta | spec M6 §2 (tipo_visita: decisione da confermare, §11.1) |
| `fixme` fase1-S1 + fase2-S4 (LAC) | e2e | 🔶 | M5 |
| `fixme` fase4 S3/S6/S8 (cassa) | e2e | 🔶 | M8 |
| A7 montatura non scarica | revisione | 🔶 progettato | spec M4 (scarico COMPLETO alla consegna; caparra=solo bolla) |
| C1 Riprogramma appuntamento | revisione | 🔶 progettato | spec M6 f6c (annulla+ricrea legati) |
| C2 Finestra LAC da consegna + win-back | revisione | 🔶 progettato | M5 copertura + M7 f7b (coda e win-back) |
| C3 Export TS-ready | revisione | 🔶 | spec M9 |
| C4 Fondo Est ≥1,5D | revisione | 🔶 | spec M7 (predisposto) |
| C5 Fermi scaduti visibili | revisione | 🔶 progettato | M3 fermi + M7 f7e (coda) |
| Valore smaltimenti (551) | rifiniture | 🔶 | spec M3 |
| Anonimizzazione GDPR | revisione | 🔶 | spec M1 |
| 9 TODO nel codice | grep | 🔶 | ciascuno nel proprio modulo |
| Registro codici sconto = classificatori di vendita (accorpato alle convenzioni) | AR-01 | 🔶 | spec M8 (+ modulo convenzioni, KPI in M9) |
| La catena del difettoso guidata (reso cliente + reso fornitore orchestrati) | AR-01 | 🔶 | spec M3 + M8 |
| Nascita scheda dalla vendita veloce (CF → popup consenso firmato) | racconto M1 30/07 | 🔶 | lato M1 progettato ✓ · aggancio cassa in spec M8 |
| Listini LAC via AI + codifica al volo nell'ordine | racconto M2 30/07 | 🔶 | spec M3 (catalogo/import) + M5 (flusso ordine) |
| Trattamento fiscale rotture/svalutazioni (accantonamento, agevolazioni) | dettato M3 30/07 | 🔶 | MF, coi commercialisti (il core fotografa il valore: f3c) |
| «Riordina uguale» | SF 31/07 + dettato 04/08 | 🔶 progettato (LAC: f4d «Ripeti») | occhiali: camminata M4 |
| Modulo Anamnesi cliente (visiva, oculare, LAC, obiettivi) | doc integrazione 01/08 | 🔶 | spec dedicata, adiacente M5 |
| Beni in custodia + foglio firmato stato montatura | risposta 15 · 01/08 | 🔶 progettato | spec M4 f4c |
| `piano.md` fermo alle fasi vecchie | docs | 🔶 | M11 |

## Le corsie attive accanto alla campagna

**G9–G13** (pulizia, UI, hardening del portale): in lavorazione presso
l'agente dedicato con contesto aperto — le spec arriveranno da quella
corsia, questa non le tocca. Le spec eseguite (fasi 1–4 e G3–G8) sono in
[`archivio/`](archivio/LEGGIMI.md).

## Regole di campagna

Additive-only sempre · vocabolario del contratto intoccabile · corsie
tra agenti · leggere `TODO-ray.md` prima di ogni consegna · ogni spec
sigillata e ogni modulo chiuso aggiornano QUESTA tabella.
