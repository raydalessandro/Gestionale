# Fase 017 · I servizi di tipo «richiesta»

**Branch:** `portale/017-servizi-richiesta` · **Prerequisito:** 016 su `main`.
**Perché prima del design del percorso:** aggiunge una *forma* di percorso diversa
(3 passi invece di 5). Chi disegna il 5-passi e poi scopre che ne esiste uno a 3
rifarebbe il lavoro.

## Il problema

Il portale ha **due tipi di servizio**, e ne era implementato uno solo:

- **appuntamento** — ha durata, occupa uno slot, genera un appuntamento in agenda;
- **richiesta** — niente durata, niente slot: «Occhiali da sole», «Le mie lenti a
  contatto», «Riparazione». Il negozio risponde entro 24 ore.

Prima della 017 tutto era appuntamento: `sole` aveva 30′ e poteva occupare mezz'ora
dell'agenda di un ottico per *comprare occhiali da sole*. E il catalogo aveva 6 voci
contro le 13 del prototipo.

## Cosa cambia — DB (migrazione `017_servizi_richiesta.sql`)

1. **`servizi.tipo`** ∈ (`appuntamento`,`richiesta`); `durata_predefinita_minuti`
   nullable con `check` per tipo (valorizzata>0 per appuntamento, NULL per richiesta).
2. **Catalogo completo: i 13 del prototipo** (10 appuntamento + 3 richiesta). `sole`
   **ritipizzato** a richiesta (0 prenotazioni sul test). La «capacità» (bambini,
   ortocheratologia, …) **non** è una tabella: la fa `negozi_servizi`. `controllo`
   (Controllo della vista) — non nel prototipo — resta come 14° legacy (vedi
   *Decisioni aperte*).
3. **`negozi_servizi`**: trigger che vieta la deroga durata su un servizio richiesta.
4. **`prenotazioni`**: `appuntamento_id`/`inizio`/`durata_minuti` **nullable** +
   trigger di coerenza per tipo (appuntamento → tutti valorizzati; richiesta → tutti
   nulli). Le righe esistenti (tutte appuntamento) restano valide.
5. **`crea_prenotazione` si biforca** (idempotenza per chiave su entrambi i rami):
   richiesta = niente lock/slot/appuntamento, crea persona + prenotazione con
   `inizio` nullo e il testo nelle note; appuntamento = comportamento pre-017.
6. **`slot_liberi`**: guardia esplicita → insieme vuoto per un servizio richiesta.
7. Vista pubblica **`servizi_pubblici` espone `tipo`** (l'app distingue i gruppi).

## Cosa cambia — App (portale)

- **`prenota/azioni.ts`** tipo-aware: per la richiesta `inizio` è null e il testo va
  nelle note; lo slot è obbligatorio solo per l'appuntamento.
- **`WizardPrenota.tsx`**: ramo **richiesta a 3 passi** (Servizio → Dettagli → Invia)
  accanto al **5 passi invariato**. Schermata finale biforcata: per la richiesta
  niente Quando/Durata, «il negozio ti risponde entro 24 ore». *Il ramo lungo non è
  stato toccato.*
- **Pagina negozio**: due gruppi — «Servizi su appuntamento» (durata + griglia slot)
  e «Serve altro? Ti rispondiamo entro 24 ore» (richieste, nessuno slot).

## Test (agente-test)

- **L2 contratto** `tests/contratto/servizi-richiesta.test.ts` — 8 test: slot vuoto su
  richiesta (controprova su `visita`); crea_prenotazione richiesta senza appuntamento;
  doppia richiesta non in conflitto; trigger nei due sensi (P0001); check durata
  (23514); `negozi_servizi` richiesta+durata; vista `tipo`.
- **L3 E2E** `e2e/g7bis-servizi-richiesta.spec.ts` — Scenario A (3 passi, mobile,
  verifica DB); il 5-passi (Scenario B) resta su `g7-prenota.spec.ts`, invariato.
- `tsc` + `build` + `npm test` (L1+L4, 127) verdi in locale.

## Decisioni aperte (vedi `docs/agenti/TODO-ray.md` §12)

- **`controllo`** resta in catalogo ma **non attivato** sui negozi demo (`seed_demo.sql`):
  a chi prenota sarebbe un doppione di «Visita optometrica». Da chiudere insieme alla
  tassonomia delle visite/prescrizioni del gestionale — è la stessa questione.

## Criterio di accettazione

Un negozio offre due tipi di servizio, chi prenota vede due percorsi di forma diversa,
e chiedere il prezzo di un paio di occhiali da sole non occupa più mezz'ora dell'agenda
di nessuno.
