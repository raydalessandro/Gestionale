# Piano delle fasi — da v0.1 a MIDO

Metodo di lavoro: per ogni fase (1) si scrive la **specifica** con le regole di
dominio vincolanti, (2) si prepara il **DB** (migrazione additiva, mai
distruttiva: il contratto v0.1 non si tocca), (3) si manda tutto a **Opus**
che coda seguendo la spec, (4) **collaudo manuale** con persone d'esperienza
nel settore ottico, seguendo gli scenari scritti nella spec stessa.

Ogni spec vive in `docs/fasi/`, ogni migrazione in `supabase/migrazioni/`.
Regola d'oro per chi coda: **il vocabolario del contratto non si cambia mai**
(fonti, stati, numerazioni — vedi `supabase/schema.sql` e README).

| Fase | Versione | Contenuto | DB | Collaudo (cosa provano gli ottici) |
|---|---|---|---|---|
| **1 ✅** | v0.2 | **Ordini & Buste** — FATTA (in collaudo con gli ottici) | `002` applicata | La giornata tipo al banco: dalla Rx alla consegna |
| **2 ✅** | v0.3 | **Catalogo & Magazzino** — FATTA (in collaudo) | `003` applicata | Ricevimento merce, giacenze, i "fermi" |
| **3 ✅** | v0.4 | **Agenda & Richiami** — FATTA (in collaudo) | `004` applicata | Il "livello ricavi": la settimana di richiami |
| **4 ✅** | v0.5 | **Cassa & Vendite** — FATTA (in collaudo) | `005` applicata | La giornata di cassa: vendite, resi, chiusura |
| 5 | v0.6 | **Convenzioni** — pratiche assicurative (attivata→PIC→fatturata→liquidata), gara voucher, coupon aziendali | `006` — voucher_convenzioni | La corsa al voucher, esito pratica |
| 6 | v0.7 | **Integrazione sito & app** — endpoint service-role, catalogo pubblico, ordini reali `fonte='sito'\|'app'` che atterrano in pipeline | `007` — grant/viste pubbliche | Ordino dal sito, lo vedo comparire in Ordini |
| 7 | v0.8 | **Collaudo MIDO** — ruoli fini, export CSV, PDF definitivi, hardening, procedure di emergenza | eventuali ritocchi | Giro completo con più utenti |

Il dominio che alimenta tutte le fasi è distillato in
[`docs/dominio-ottica.md`](../dominio-ottica.md) (flussi operativi, dai
manuali di catena) e [`docs/dominio-fiscale.md`](../dominio-fiscale.md)
(norme verificate: Sistema TS, IVA, RT, fondi) — lettura obbligatoria prima
di codare qualunque fase; il layer normativo si ri-verifica all'apertura
della fase che lo usa.

## Interfase in corso — Pass anagrafiche (foglio: `docs/anagrafiche-campi.md`)

Prima delle prossime fasi: fatto il 16/07: schermate lette, `006` pronta da applicare, spec form in `fase-4b-anagrafiche.md`. Poi revisione di questa roadmap (candidati: Preventivi, Inventario,
Fase 5 "portale unico", fase fiscale TS).

## Correzione pre-collaudo — Fase 4c (dall'audit `revisione-procedure-vista.md`)

La caparra entra in cassa: `007_caparra_incasso.sql` pronta, spec
`fase-4c-caparra-quadratura.md` (parte DOPO il merge della 4b). L'ossatura
multi-negozio slitta da 007 a **008** (invariata nei contenuti). Dopo 4c:
**Fase 4d consensi** (`fase-4d-consensi.md`, decisione A6 del 16/07 — il
sistema chiede finché manca; sanitario alla prescrizione). A roadmap:
firma digitale dei consensi + archivio documenti privacy + invio
informativa via email.

## Binari paralleli (da Fase 3 in poi)

Oltre alla codifica delle fasi (la spina dorsale), corrono **due binari
paralleli** con ordini di lavoro propri in `docs/agenti/`:

1. **Test & CI** — [`agente-test.md`](../agenti/agente-test.md): unit sulla
   logica pura, test del **contratto** su un Supabase di test (RLS,
   trigger, vincoli, concorrenza), E2E Playwright **derivati 1:1 dai
   collaudi di fase**, cancello CI su GitHub Actions.
2. **Manuale utente** — [`agente-manuali.md`](../agenti/agente-manuali.md):
   il manuale da consegnare col software, nella lingua del banco.

Regole di convivenza: **proprietà dei file rigida** (ognuno scrive solo nelle
sue cartelle; chi coda le fasi non tocca `tests/`, `e2e/`, `manuale-utente/`,
e viceversa) e **checkpoint = completamento di fase** (test e manuale si
aggiornano quando una fase diventa ✅, mai a ogni commit). L'orchestratore
(Opus) può lanciare i tre binari in parallelo: gli ordini di lavoro sono
scritti per non collidere.
