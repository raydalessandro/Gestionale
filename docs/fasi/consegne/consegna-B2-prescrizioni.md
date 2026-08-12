# CONSEGNA · B2 — Prescrizioni

*Consegna auto-assemblata dall’esecutrice il 12/08/2026. È il primo file della PR `era2/B2-prescrizioni`; applicazione esclusiva sul progetto Supabase di TEST tramite la strada che registra. Nessun merge e nessuna scrittura in produzione.*

## 0 · RITO D’APERTURA — concluso

Sono stati letti integralmente `docs/fasi/mandato-manus.md`, `docs/README.md`, `docs/fasi/piano-era2.md` e `docs/fasi/modulo-M2-prescrizioni.md`. La base verificata per questa busta è `main` al commit `d2693f8`, dopo `023_igiene_funzioni`; la prima migrazione della busta è pertanto `024_`.

La verifica ha prodotto tre fermate, tutte verbalizzate nella pagina Notion di coordinamento e sciolte dalla regia. La **fermata n°1** ha chiarito che `prove_lac`, campioni, conferma da prova e gli scenari S9–S10 appartengono al filone Y/M5 e non entrano in B2. La **fermata n°2** ha introdotto RV-01: i vincoli esistenti possono essere sostituiti soltanto con domini uguali o più larghi, nella stessa transazione, con nome versionato, commento e test di non-regressione. La **fermata n°3** ha stabilito che `prescrizioni.tipo` resta legacy e invariato: le nuove letture usano sezioni e `prescrizioni_lac`; la compatibilità scrive `occhiali` per Occhiali, piano incluso, e `lac` solo per scheda esclusivamente LAC. Le differenze sono annotate in M2 §10.

## 1 · Contesto

B2 sostituisce il modello duale di prescrizione con una **scheda clinico-operativa unica**: una visita può contenere sezioni Occhiali, LAC e plano, con data reale, scadenza sticky, origine e professionista coerenti. Il lavoro viene ora perché B1 ha già fornito consensi sanitari per-Rx, registro oculisti, helper permessi e default privileges chiuse.

Il perimetro conserva il ponte verso B4: una LAC definitiva può essere inserita direttamente in `prescrizioni_lac` e diventa disponibile al futuro ordine senza reinserimento. Non materializza attivazioni e non implementa prove LAC: entrambe sono esplicitamente fuori busta.

## 2 · Spec e decisioni di riferimento (congelate)

| Fonte | Parti applicate in B2 |
|---|---|
| `docs/fasi/modulo-M2-prescrizioni.md` | §1–§4, flussi f2a/f2a-occhiali/f2a-lac/f2b/f2c/f2e/f2x, formule §2-bis, §8 S1–S8/S11/S12 e §10 Annotazioni 4–5 |
| `docs/fasi/piano-era2.md` | Patto operativo; B2; template consegna; divieti e DoD |
| `docs/fasi/mandato-manus.md` | Test-only, additive-only, migrazioni registrate, CI e fermate |
| `docs/decisioni/RV-01-vincoli.md` | Sostituzione dei soli vincoli allargati, con test del dominio precedente/nuovo/fuori dominio |
| Regia su Notion, decisioni fermate n°1–3 | Perimetro Y/M5, RV-01 sui vincoli e deprecazione in lettura di `tipo`; LAC definitiva diretta ponte B4 |

## 3 · Migrazione

**`024_prescrizioni.sql`** viene applicata esclusivamente tramite `scripts/migra-cloud.sh test` e registra il proprio passaggio in `_infra_migrazioni`. È solo additive sui dati e sui nomi. Estende `prescrizioni` per rappresentare la scheda unica: sezioni attive, scadenza e sticky flag, origine M2, professionista/oculista, derivazione, tipologie e mista per occhio, addizione e visus per occhio, prisma valore+base, notazione, speciali, invariato e appaiamento. Le colonne DNP legacy restano intatte e sono soltanto deprecate in lettura.

I CHECK incompatibili vengono allargati seguendo RV-01: `drop constraint` e `add constraint` nella stessa transazione, nomi `chk_*_v2`, commento SQL con migrazione e motivo. Nessun vincolo viene ristretto e nessuna colonna parallela viene introdotta. In particolare sono coperti quattro origini M2, tipologie Occhiali incluse `office` e `mista`, e basi prisma M2 senza perdere i valori legacy già ammessi.

La migrazione crea `public.prescrizioni_lac` con una sola riga indipendente per `occhio` (`od`/`os`) e relativo vincolo unico; include tipologia, sottotipo, geometria, fornitore/modello/prodotto, parametri, BC/DIA, `extra`, visus, dominante e note. Applica RLS, policy tenant, trigger di coerenza tenant ed esplicita assenza di grant ad anon. I tre trigger B2 e la policy tenant sono preceduti dai rispettivi `drop … if exists`, così il runner registrato può riprendere in modo deterministico dopo un arresto parziale senza toccare colonne o dati. Non crea `prove_lac`.

## 4 · Azioni, funzioni e superfici

Le conversioni restano **funzioni pure**, isolate in `lib/prescrizioni-conversioni.ts`: intermedio = lontano + ADD/2; office = lontano + ADD senza intermedio automatico; conversione vertice oltre ±4,00 con risultato sempre modificabile. Le funzioni non fanno I/O e ricevono valori per occhio.

L’azione di salvataggio della scheda richiede il permesso B1 prima dell’accesso applicativo, crea il nuovo fatto clinico con consenso sanitario inline per-Rx e salva le righe LAC definitive per occhio. La rettifica distingue la contro-scrittura clinica collegata dall’errore di digitazione sostitutivo, senza riferimento obbligatorio dagli ordini. L’oculista al volo riusa la funzione B1; un occhio invariato recupera i valori della prescrizione precedente lasciando visibile il nuovo controllo.

La superficie prescrizioni viene aggiornata al minimo indispensabile per gli scenari M2 inclusi: sezioni attivabili, origine e professionista, scadenza sticky, dati Occhiali e LAC per occhio, azioni «Salva e chiudi» e stub «Salva e crea ordine». Il secondo non trasferisce ancora un ordine: conserva soltanto il ponte dati per B4.

## 5 · Test obbligatori

| Livello | Copertura obbligatoria |
|---|---|
| TDD unit | Tabelle complete per intermedio, office e vertice: segno, soglia ±4,00, valori decimali, assenza ADD e override; logica sticky; composizione LAC OD/OS indipendente |
| Contratto migrazione | Ogni CHECK RV-01: valori legacy validi, valori M2 nuovi validi, valore fuori dominio respinto; prisma valore senza base respinto; base senza valore respinta; unicità per occhio; RLS e coerenza tenant con errore `23514` |
| E2E Playwright | M2 S1, S2, S3, S4, S5, S6, S7, S8, S11 e S12, per nome e senza sostituzioni inventate |
| Esclusioni dichiarate | S9 e S10, prove, campioni e conferma da prova sono Y/M5; il recall di S11 è collaudato in B7, non qui |

## 6 · Definition of Done

Il rito resta verbalizzato sul log Notion e nella descrizione della PR. La PR contiene RV-01, le Annotazioni 4–5 di M2 §10, una sola migrazione `024_`, test completi, regole valide, CI verde e nessuna modifica fuori perimetro. La clausola di inferenza della regia resta operativa tramite il log Notion e non modifica il mandato in questa PR. La descrizione della PR riporta i tre pezzi: verbale con differenze motivate, verità misurate e punti caldi del diff.

## 7 · Divieti

Sono vietati rename e drop di colonne o dati; un `drop constraint` è ammesso solo nel pattern RV-01 per sostituirlo nella medesima transazione con un dominio più largo. Restano vietati `prove_lac`, attivazioni dedicate, UI oltre il minimo E2E, dipendenze npm nuove, modifiche a guardie/CI e qualunque intervento in produzione. Le quattro viste-portale definer non si toccano; gli errori tenant attesi restano `23514`, mai `23503`.
