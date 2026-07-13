# Dominio fiscale & normativo — verificato

Questo è il **layer delle norme**, separato dai flussi operativi
(`dominio-ottica.md`): le norme cambiano, i flussi restano. Ogni sezione
indica le fonti; verifica complessiva effettuata il **13/07/2026** su fonti
ufficiali (Sistema TS, Agenzia delle Entrate, Fondo Est) e di settore.
Regola: **all'apertura della fase che usa una sezione, si rifà il giro di
verifica** prima di codare.

---

## 1 · Sistema Tessera Sanitaria (→ Fase fiscale)

**Chi e da quando.** Gli ottici sono tra i soggetti obbligati all'invio delle
spese sanitarie **dal 2016** (non dal 2022: nel 2022 — DM MEF 28/11/2022 +
Decreto RGS 22/12/2022 — è cambiata solo la *modalità di registrazione* al
Sistema TS). Codice attività: storicamente ATECO 47.78.20; per chi inizia
l'attività **dal 1° aprile 2025** vale il nuovo ATECO 2025 **47.74.01
"Commercio al dettaglio di occhiali e lenti"** ai fini dell'accreditamento.

**Cosa si trasmette.** I dati delle spese documentate con **fattura o
documento commerciale integrato con il codice fiscale** del cliente, con un
**codice spesa**:
- **AD** — dispositivi medici con marcatura CE (occhiali da vista, lenti
  oftalmiche graduate, LAC graduate, liquidi per LAC): detraibili **anche se
  pagati in contanti**;
- **AA** — altre spese sanitarie (prestazioni professionali): detraibili
  **solo con pagamento tracciabile**.

Vale il **principio di cassa**: conta la data del pagamento, non quella del
documento.

**Quando.** Dalle spese **2025** l'invio è **annuale** (art. 5 D.Lgs 81/2025;
scadenza fissata dal DM 29/10/2025): **entro il 31 gennaio dell'anno
successivo**. Prima uscita: spese 2025 → 2 febbraio 2026 (il 31/1 era
sabato), correzioni entro il 9 febbraio. Il servizio resta aperto 24/7: si
può inviare in tempo reale, ogni giorno o ogni mese — e conviene, per non
arrivare a gennaio col magazzino di documenti.

**Come.** Tre canali: data entry sul portale, web service sincrono (una spesa
alla volta, esito immediato), asincrono (file XML cumulativo). Possibile la
**delega a un intermediario** (commercialista), ma la responsabilità
dell'invio resta dell'ottico. Ogni invio produce un **protocollo** e
ricevute con eventuali errori: vanno conservati.

**Opposizione del cittadino.** Il cliente può opporsi all'uso dei suoi dati
per la precompilata (anche online, tra il 9 febbraio e l'8 marzo dell'anno
successivo): il documento non va trasmesso.

**Impatti su VISTA** (checklist per la fase fiscale): CF sul documento di
vendita · codice spesa AD/AA per riga o documento · flag "pagamento
tracciato" · flag "opposizione trasmissione TS" · data di pagamento distinta
dalla data documento · coda invii con protocollo, esito e ricevute
scaricabili (il benchmark UX è la console telematica di FOCUS).

## 2 · IVA — la mappa delle aliquote (→ Fase 4)

Base normativa: **n. 41-quater, Tabella A parte II, DPR 633/72** ("protesi e
ausili inerenti a menomazioni di tipo funzionale permanenti") come chiarito
dalla Circolare Min. Finanze 50/1990 e dalle risposte AdE 488/2020 e
264/2022.

**Al 4%**: l'**occhiale da vista come prodotto finito** (montatura + lenti
graduate assemblate), le **lenti oftalmiche graduate**, le **LAC correttive**
(anche colorate, purché correttive).

**Al 22%**: la **sola montatura** (diventa 4% *solo* dentro l'occhiale
completo — quindi busta `solo_montatura` → 22%), le LAC colorate puramente
estetiche, le **soluzioni/liquidi di manutenzione**, il sole non graduato,
**garanzie e servizi**.

**Attenzione a non confondere i piani**: il liquido per LAC è dispositivo
medico (codice spesa **AD**, quindi detraibile e trasmissibile al TS) **ma**
viaggia a IVA **22%**. Detraibilità e aliquota sono due assi indipendenti.

**Impatti su VISTA**: aliquota di default per tipo prodotto a catalogo
(lente/LAC graduata 4 · montatura 22 · soluzione 22 · servizio 22) +
aliquota a livello busta guidata dal `tipo_lavoro` (occhiale_completo → 4%
sull'insieme; solo_montatura → 22). Il documento di consegna resta a doppia
aliquota quando c'è la garanzia (già in `dominio-ottica.md` §6).

## 3 · Registratore telematico e documenti (→ Fase 4)

Il **documento commerciale** va integrato col CF quando il cliente vuole
detrazione/invio TS. **Reso e annullo** sono documenti dedicati che
**referenziano il documento originario** (riferimento tecnico: manuale Epson
FP-81 II RT — "Documento di Reso" e "Documento di Annullo" basati sul
documento commerciale): per noi significa che vendite e resi devono
conservare numero e data del documento d'origine. La **caparra
confirmatoria** resta senza documento fiscale fino alla consegna
(`dominio-ottica.md` §6). Nota da approfondire: per i dettaglianti con RT
esiste la trasmissione TS direttamente via RT con l'invio giornaliero, previa
attivazione — verificarne l'applicabilità pratica per gli ottici quando
apriamo la fase.

## 4 · Fondo Est — il rimborsuale puro (→ Fase 5)

Verificato sulla pagina ufficiale "Lenti e occhiali" (piano 2026):

- Gestione **esclusivamente rimborsuale**: nessun ottico convenzionato col
  Fondo, il cliente compra **dove vuole** e chiede rimborso dall'area
  riservata MyFondoEst.
- **€ 90 ogni 36 mesi, su una singola fattura** (mai sommando più scontrini
  o richieste). Marche da bollo escluse dal rimborso.
- **La regola d'oro del cambio visus**: un nuovo rimborso *prima* dei 36
  mesi è possibile se l'oculista certifica una **variazione ≥ 1,5 diottrie
  sferiche e/o cilindriche su un singolo occhio** (mai sommando sfera +
  cilindro, né i due occhi), purché siano passati **almeno 12 mesi**
  dall'ultima fattura liquidata.
- **Documenti**: copia della **prescrizione dell'oculista** emessa **fino a
  24 mesi prima della fattura e mai dopo l'acquisto** (le prescrizioni di
  ottici/ortottisti non valgono, con UNA eccezione: difetto visivo isolato
  da vicino; per le multifocali serve sempre l'oculista) + copia del
  documento di spesa da cui si capisca **che prodotto è**.
- **Esclusi**: sola montatura, occhiali/lenti a fini estetici.
- Termine di presentazione: 1 anno dal documento di spesa (dato FAQ — da
  riconfermare sulla *Guida alle Prestazioni 2026*, PDF linkato sulla
  pagina, quando la recuperiamo).
- La **convenzione commerciale Salmoiraghi&Viganò / GrandVision** (sconto
  via portale) è un flusso **separato e cumulabile logicamente distinto**:
  in tassonomia è `sconto_coupon`, non `rimborsuale`. Non confonderli.

**Impatti su VISTA**: la meccanica `rimborsuale` non porta incassi dal fondo
ma **fidelizza chi la fa bene** — il modulo deve produrre il "kit rimborso"
perfetto: fattura parlante (prodotto evidente, no sola montatura), promemoria
prescrizione oculista *prima* dell'acquisto, date coerenti. E il colpo da
maestro: **VISTA ha lo storico Rx per occhio** — può accorgersi da solo
quando un cliente matura la variazione ≥ 1,5 D su un occhio dopo ≥ 12 mesi e
proporre il richiamo "hai diritto a un nuovo rimborso Fondo Est". Nessun
gestionale lo fa.

## 5 · Benchmark di mercato (non norme, ma tarature)

- **FOCUS CRM (Bludata)**: invito al controllo vista dopo **12 mesi**,
  promozione "rottamazione occhiale" dopo **24 mesi**. Conferma la nostra
  taratura del richiamo controllo vista (validità Rx 12 mesi) e candida un
  futuro tipo `rottamazione` a 24 mesi dalla consegna busta (commerciale →
  solo con consenso marketing).
- **FOCUS TS**: invio sincrono/asincrono con protocollo e ricevute in
  console — è l'asticella UX per la nostra fase fiscale.
- **Listini lenti**: il listino pubblico Suisse Optical (Essilor, 2022) è
  utile come **struttura** (indici, trattamenti, supplementi) per il
  preventivo busta — non per i prezzi, datati.

## 6 · Da recuperare dal mondo reale

Un documento commerciale vero a doppia aliquota 4/22 (dato privato: serve un
negozio reale) · la circolare Federottica sul Sistema TS · la *Guida alle
Prestazioni Fondo Est 2026* (PDF sul sito) per blindare termini e cavilli ·
regolamenti di altri fondi in gestione diretta (Previmedical/UniSalute lato
centro convenzionato) per la Fase 5.
