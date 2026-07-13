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
| **3 ▶** | v0.4 | **Agenda & Richiami** — spec pronta: `fase-3-agenda-richiami.md` | `004` pronta da applicare | Il "livello ricavi": la settimana di richiami |
| 4 | v0.5 | **Cassa & Vendite** — vendita veloce e da busta, doppia aliquota 4/22, caparra confirmatoria (scontrino unico alla consegna), resi con causali, incamera caparra | `005` — vendite, resi | Consegna con saldo, un reso, una chiusura |
| 5 | v0.6 | **Convenzioni** — pratiche assicurative (attivata→PIC→fatturata→liquidata), gara voucher, coupon aziendali | `006` — voucher_convenzioni | La corsa al voucher, esito pratica |
| 6 | v0.7 | **Integrazione sito & app** — endpoint service-role, catalogo pubblico, ordini reali `fonte='sito'\|'app'` che atterrano in pipeline | `007` — grant/viste pubbliche | Ordino dal sito, lo vedo comparire in Ordini |
| 7 | v0.8 | **Collaudo MIDO** — ruoli fini, export CSV, PDF definitivi, hardening, procedure di emergenza | eventuali ritocchi | Giro completo con più utenti |

Il dominio che alimenta tutte le fasi è distillato in
[`docs/dominio-ottica.md`](../dominio-ottica.md) — lettura obbligatoria prima
di codare qualunque fase.

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
