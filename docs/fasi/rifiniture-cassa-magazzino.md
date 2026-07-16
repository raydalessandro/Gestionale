# Rifiniture Cassa ↔ Magazzino — lista di lavoro

Dal collaudo di Ray (16/07) + analisi dell'agente esterno (in arrivo).
Sessione dedicata → spec `fase-4c` per Opus. Qui si accumula, non si coda.

## 1 · Il cassetto atteso ignora i rimborsi (bug-da-spec, confermato)
La giornata `/cassa` calcola i contanti attesi come fondo + incassi −
prelievi/spese, MA non sottrae i **resi `denaro` rimborsati in contanti**
oggi. Spec corretta (§3.2 Fase 4); il codice va allineato. Stessa verifica
sul calcolo `sistema` della chiusura: la spec prevede «incassi − rimborsi
per metodo di rimborso» — controllare che il codice lo faccia davvero.

## 2 · Due gesti, due nature (da preservare ovunque)
**Reso da cassa = storno di uno scontrino**: muove denaro (metodo di
rimborso) e, se selezionate, le righe che rientrano. **Smaltimento/danno
da magazzino = scarico di merce mai venduta**: muove quantità e VALORE,
mai contanti. Il modello già li separa (tabella `resi` vs movimenti
`danno`/`reso_fornitore`); ogni schermata e report deve rispettare la
distinzione.

## 3 · Il valore dello smaltimento
Oggi i movimenti di magazzino registrano solo quantità; il documento 551
di catena porta prezzo e totale riga (−23 pezzi, −4.454 €). Candidato:
colonna `valore_unitario` snapshot sui movimenti (danno, rottamazione,
reso fornitore) — al costo o al prezzo di vendita? Da decidere in
sessione. Additiva, come sempre.

## 4 · Punti dall'analisi dell'agente — ARRIVATA (16/07)
Documento integrale: `docs/revisione-procedure-vista.md`. I punti 1–2 di
questa lista coincidono con A1/A3/A4 e sono assorbiti nella spec
`fase-4c-caparra-quadratura.md` (+ migrazione 007). Restano QUI per la
sessione dedicata: il punto 3 (valore sugli smaltimenti), A6 → **DECISA il 16/07** (spec `fase-4d-consensi.md`; resta a roadmap l'anonimizzazione), A7 (montatura da catalogo),
C2/C3/C5 (roadmap richiami/TS/fermi).
