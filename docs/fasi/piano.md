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
| **2 ▶** | v0.3 | **Catalogo & Magazzino** — spec pronta: `fase-2-catalogo-magazzino.md` | `003` pronta da applicare | Ricevimento merce, giacenze, i "fermi" |
| 3 | v0.4 | **Agenda & Richiami** — appuntamenti a slot, richiami generati dalle regole di dominio (verifica 2gg pre-promessa, avviso arrivo, solleciti 3/10gg, LAC in esaurimento) | `004` — appuntamenti, richiami | Il "livello ricavi": la settimana di richiami |
| 4 | v0.5 | **Cassa & Vendite** — vendita veloce e da busta, doppia aliquota 4/22, caparra confirmatoria (scontrino unico alla consegna), resi con causali, incamera caparra | `005` — vendite, resi | Consegna con saldo, un reso, una chiusura |
| 5 | v0.6 | **Convenzioni** — pratiche assicurative (attivata→PIC→fatturata→liquidata), gara voucher, coupon aziendali | `006` — voucher_convenzioni | La corsa al voucher, esito pratica |
| 6 | v0.7 | **Integrazione sito & app** — endpoint service-role, catalogo pubblico, ordini reali `fonte='sito'\|'app'` che atterrano in pipeline | `007` — grant/viste pubbliche | Ordino dal sito, lo vedo comparire in Ordini |
| 7 | v0.8 | **Collaudo MIDO** — ruoli fini, export CSV, PDF definitivi, hardening, procedure di emergenza | eventuali ritocchi | Giro completo con più utenti |

Il dominio che alimenta tutte le fasi è distillato in
[`docs/dominio-ottica.md`](../dominio-ottica.md) — lettura obbligatoria prima
di codare qualunque fase.
