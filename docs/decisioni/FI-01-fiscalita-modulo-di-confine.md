# FI-01 · La fiscalità è un modulo di confine

*Decisa il 28/07/2026 (Ray). Vincolante per tutta la campagna di
completamento e oltre.*

## Il problema

La fiscalità italiana (fattura elettronica, scontrino/RT, tracciati
Sistema TS) è il terreno che cambia più spesso e che richiede revisione
professionale. Intrecciarla nel core del gestionale significa: ogni
modifica fiscale tocca il cuore, ogni revisione del commercialista
diventa un refactoring, ogni demo dipende da adempimenti.

## La decisione

1. **Il core è fiscal-aware ma fiscal-free.** Raccoglie e custodisce i
   FATTI fiscali (CF, flag DM per riga, aliquote, tracciabilità,
   opposizione, date) — come già fa — ma non emette nulla.
2. **I numeri si mostrano al netto.** Ovunque il gestionale parla di
   fatturato/incassato (dashboard, report), il valore è scorporato
   dell'IVA usando le aliquote di riga già registrate. (Intervento in M8/M9
   della campagna.)
3. **Il modulo di confine arriva per ultimo** e opera SOLO su
   transazioni chiuse (vendite emesse, chiusure salvate): le trasforma
   in documenti — fattura, scontrino, tracciato TS — in modo
   append-only, senza mai riscrivere il passato del core.
4. **L'interfaccia è a senso unico**: il core espone i fatti, il modulo
   li consuma. Nessun import dal modulo fiscale verso il core, mai.

## Le conseguenze pratiche, da subito

Niente logica di emissione nel core durante la campagna · i campi
fiscali continuano a raccogliersi con la cura di oggi (sono il
carburante del modulo futuro) · l'export «TS-ready» (C3) resta nel core
perché è un ESTRATTO di fatti, non un'emissione · il modulo di confine
si progetta nei nove mesi post-campagna, con i commercialisti al tavolo.


## Addendum del 29/07 — lo scontrino è in tempo reale

La premessa di Ray sui due mondi della catena (AR-01) impone una
precisazione al punto 3. «Solo su transazioni chiuse» resta perfetto per
FATTURE e TRACCIATI TS (batch, a valle). Lo SCONTRINO invece per legge
nasce col gesto: quando MF si accenderà, per la cassa non sarà un batch
serale ma **la coda inline dell'operazione** — il core chiude la vendita
(il fatto), il modulo di confine emette e restituisce i riferimenti del
documento. La presa per questa spina esiste già: `vendite.doc_numero` e
`doc_data`, vuoti dalla Fase 4, aspettano esattamente questo. Il confine
non cambia: il core registra e non emette, MAI — cambia solo il momento
in cui il confine viene chiamato.
