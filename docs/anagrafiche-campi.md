# Pass anagrafiche — foglio di lavoro per le schermate

Scopo: dalle schermate in arrivo (anagrafica cliente completa, dati
magazzino, manuali di catena) usciamo con **una** migrazione additiva
`006_anagrafiche.sql` ben disegnata — non cinque gocce — più i form
aggiornati. Le schermate NON toccano i flussi (macchine a stati, movimenti,
numerazioni, RLS: quelli sono il contratto e restano): cambiano solo il
**vocabolario delle voci**. Additive only, come sempre.

## Regole di decisione (colonna vs jsonb vs tabella)

1. **Colonna vera** se il dato filtra o ordina le liste, ha un vincolo, o
   alimenta una logica (es.: `data_nascita` → compleanno ✓ già c'è;
   `ricambio_giorni` LAC → esaurimento richiami; `codice_fiscale` → TS ✓).
2. **`parametri` jsonb** (tipizzato in TS) se è un attributo descrittivo
   per-tipo senza logica trasversale (calibro, materiale, indice lente).
3. **Tabella nuova** solo per cardinalità > 1 reale e usata (contatti
   multipli, tag). Default: NO — semplicità prima.
4. Mai rinominare o ristrutturare l'esistente.

## CLIENTI — attuale vs candidati

**Attuale** (schema + 002): nome, cognome, data_nascita, codice_fiscale,
email, telefono, indirizzo, citta, cap, provincia, fonte,
consenso_marketing (+ data), consenso_dati_sanitari, note.

**Candidati noti dai manuali/foto** — spuntare ciò che le schermate
confermano, aggiungere ciò che manca:
- [ ] titolo / sesso · [ ] secondo telefono (fisso) · [ ] **canale
      preferito di contatto** (tel/WhatsApp/SMS/email — alimenta i
      richiami: → colonna)
- [ ] professione · [ ] hobby/interessi · [ ] "come ci ha conosciuto"
      dettagliato (la colonna `fonte` c'è: bastano i valori?)
- [ ] oculista di riferimento · [ ] medico curante
- [ ] azienda/convenzione di appartenenza (aggancio Fase 5)
- [ ] terzo consenso (profilazione? → incrociare col manuale *Customer
      Data Capture* in archivio) · [ ] data del consenso sanitario
- [ ] tessera/loyalty · [ ] lingua · [ ] flag "non contattare" (rispetto
      prima di tutto)

**Domande alle schermate**: quali campi sono obbligatori al banco? Quali
stanno nella testata della scheda (= i vitali)?

## PRESCRIZIONI — attuale vs candidati

**Attuale**: tipo, uso, origine, esaminatore, data_visita, OD/OS (sfero,
cilindro, asse, prisma + base, raggio, diametro), addizione,
validita_mesi, attiva, note.

**Candidati**:
- [ ] **PD/DNP per occhio** (distanza naso-pupillare) — quasi certo:
      serve alla busta · [ ] altezza di montaggio
- [ ] acuità visiva (visus) OD/OS · [ ] addizione intermedia (office)
- [ ] LAC: marca/modello provato, cheratometria?, feedback della prova
      (il tipo "Campioni lenti" del dominio §2) · [ ] prossimo controllo
      consigliato

**Domande**: la Rx di catena separa lontano/vicino in due righe o una con
addizione? Dove vive la PD (sulla Rx o sulla busta)?

## PRODOTTI — attuale vs candidati per tipo

**Attuale**: tipo, marca, nome, descrizione, sku, prezzo, costo,
fornitore, giacenza, scorta_minima, visibile_sito, attivo, parametri.

- **Montatura** → parametri: [ ] calibro [ ] ponte [ ] asta [ ] colore
  (codice + nome) [ ] materiale [ ] forma [ ] genere [ ] collezione/stagione
- **Lente** → parametri: [ ] indice [ ] geometria [ ] trattamenti (lista)
  [ ] diametro [ ] produttore / codice listino
- **LAC** → parametri già: raggio, diametro, confezione. Candidata
  **colonna**: [ ] `ricambio_giorni` (1/14/30 — alimenta l'esaurimento
  richiami con precisione: logica → colonna) · [ ] materiale/idratazione
  (parametri)
- **Soluzione** → [ ] formato ml · **Servizio** → [ ] durata?
- Trasversali: [ ] foto (probabilmente rimandata alla fase sito) ·
  [ ] codice produttore distinto dallo sku · [ ] "difettoso / in attesa di
  smaltimento": ipotesi NO colonna (già leggibile dai movimenti `danno`),
  verificare se le schermate mostrano una vista dedicata.

**Domande alle schermate magazzino**: quali colonne ha la griglia? quali
filtri si usano davvero? esiste un concetto di "impegnato/in transito"?

## Output atteso dal pass

1. `supabase/migrazioni/006_anagrafiche.sql` (additiva) + tipi/utils
   allineati.
2. Mini-spec `fase-4b-anagrafiche.md` per Opus: form Clienti / Prescrizione
   / Prodotto aggiornati, **zero flussi toccati**.
3. Voci nuove annotate in `docs/dominio-ottica.md`.
4. Subito dopo: **revisione della roadmap** in `piano.md` — candidati
   emersi strada facendo: modulo Preventivi (dalla campagna recall
   "giorno dopo"), Inventario fisico, Fase 5 ridisegnata come "portale
   unico convenzioni", fase fiscale TS, hardening → collaudo MIDO a
   gennaio.

## Struttura (domanda del 13/07 sera): ruoli e multi-negozio

**Multi-tenant per azienda: già fatto.** È il fondamento del sistema (RLS su
`get_azienda_id()`, testato dai contratti L2): più negozi-azienda convivono
isolati nello stesso DB. La domanda vera è su due assi diversi, con due
momenti diversi:

**Ruoli (titolare / responsabile / ottico / addetto vendita).**
- Domani, nel 006: si fissa il **vocabolario** (`utenti.ruolo` con check a 4
  valori) e si scrive la **matrice permessi come spec** (chi chiude la
  cassa, chi incamera, chi tocca le impostazioni, chi vede il ROI) — carta,
  zero codice.
- L'**enforcement** (guardie nelle server action + RLS solo dove pesa:
  impostazioni, chiusure, metodi) è una fase di hardening pre-pilota,
  quando la superficie delle azioni è completa (~dopo Fase 5/6): una
  passata sola su tutte le action invece di rincorrerle fase per fase.
- Nota: l'attribuzione per-utente c'è GIÀ ovunque (utente_id su vendite,
  richiami, appuntamenti, movimenti): l'80% del valore dei ruoli — sapere
  chi ha fatto cosa — è già nei dati.

**Multi-negozio (punti vendita).**
- Domani: si decide il **modello su carta** — tabella `punti_vendita`;
  colonna `punto_vendita_id` (nullable) su ciò che è "della sede":
  movimenti_magazzino, fermi, appuntamenti, vendite, chiusure,
  movimenti_cassa, ordini; giacenze per sede come da nota già scritta
  nella 003; `utenti.sede_predefinita`; numerazione per sede (chiave
  contatori estesa). Regola d'oro: **clienti e prescrizioni restano
  dell'AZIENDA** (condivisi tra sedi — il vantaggio da catena, gara
  voucher compresa); stock, cassa e agenda sono **della SEDE**.
- L'**ossatura dati** parte come 007 subito dopo il pass anagrafiche e
  PRIMA della Fase 5: convenzioni, agenda, cassa e sito sono tutte "per
  negozio" — ogni fase costruita senza la colonna è backfill in più. Col
  default "Sede principale" il mono-negozio non si accorge di nulla.
- La **UX completa** (switch sede, trasferimenti merce, report
  consolidati) è una fase dedicata: quando arriva il primo cliente con due
  negozi, o per il pitch MIDO se serve.
- Cosa NON fare: RLS per-ruolo ovunque adesso (rallenterebbe ogni fase e
  la matrice cambierà ancora).

## DECISIONI del 16/07 (dalle schermate)

**Clienti — nella 006**: secondo_nome · sesso · indirizzo2
(scala/appartamento) · nazione · telefono_casa · telefono_lavoro · lingua ·
tutore_legale · canale_preferito (uno, guida i richiami; CIAO! usa flag
multipli) · non_contattare. **Rimandati**: assicurazione/azienda
convenzionata → Fase 5 (registro + FK); professione/hobby/oculista → non in
CIAO!, si riapre solo se i tester li chiedono.

**Prescrizioni — nella 006**: od_dnp / os_dnp (mm). Rimandati: visus,
altezza di montaggio (quella è della busta, arriverà col laboratorio).

**Prodotti — nella 006**: tipo `sole` (quinto department) ·
ricambio_giorni (LAC). Parametri per tipo nel form (calibro/ponte/asta,
colore codice+nome, materiale) → spec 4b. Granularità LAC per-potere:
futuro (ordini elettronici).

**Utenti — nella 006**: ruolo → titolare / responsabile / ottico / addetto
(mappati optometrista→ottico, staff→addetto). Enforcement in hardening.
