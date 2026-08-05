# Modello di spec di modulo — Era 1 «la grande specifica»

*Ogni spec di modulo (`docs/fasi/modulo-M<numero>-<nome>.md`) segue questo
scheletro, nello stesso ordine. Le sezioni si possono allungare quanto
serve — «grosse e fitte» è l'obiettivo — ma non si saltano né si
riordinano: la forma uguale è ciò che rende possibile la passata di
coerenza C0 e l'esecuzione dell'Era 2 senza sorprese.*

## 0 · Fonti
I documenti di catena usati (elencati con data di consegna a Claude),
i `dominio-*.md` toccati/estesi da questa spec, le spec precedenti
rilette (obbligatorio: tutte quelle già sigillate).

## 1 · Il modulo in una pagina
Cosa fa, per chi, dove inizia e dove finisce. I confini con gli altri
moduli dichiarati esplicitamente («la Rx nasce qui, la busta la
consuma»).

## 2 · Vocabolario
Stati, tipi, causali, transizioni — DEFINITIVI. Tabelle, non prosa.
Ogni voce con la fonte (documento di catena o decisione, linkata).
Questo vocabolario diventerà check-constraint: si scrive come tale.

## 3 · I flussi
Uno per sezione, camminati passo-passo come al banco: chi fa cosa, cosa
vede, cosa scrive il sistema, cosa stampa. **Ogni passo che tocca dati
porta la sua classe grammaticale** tra parentesi quadre — [FATTO],
[STATO], [ANAGRAFE], [REGISTRO], [PROIEZIONE], [ISTANTANEA] — secondo
`docs/grammatica-dati.md`; le due domande del contro-interrogatorio
(«cosa dovrà essere leggibile?», «cosa fotografo adesso?») hanno la
risposta scritta nel passo stesso. Ogni flusso chiude con la
riga «Fonte: …». I casi limite stanno DENTRO il flusso a cui
appartengono, non in un'appendice.

## 4 · I dati
Migrazione abbozzata (DDL completo in spec, NON applicato in Era 1):
tabelle/colonne nuove, vincoli, trigger, RPC. Additive-only. Ogni
colonna con il commento che ne spiega l'esistenza. **E con la sua classe
grammaticale dichiarata.** In coda alla sezione, la tabella degli
incastri: per ogni FATTO/ISTANTANEA introdotto, quali letture future lo
consumeranno (basta nominarle: la costruzione può aspettare, l'incastro
no).

## 5 · Le superfici
Pagine e componenti toccati, comportamento per ruolo
(titolare/responsabile/ottico/addetto), stampe. Niente pixel: gesti.

## 6 · I conti che questo modulo salda
Le righe della lista unica (piano-completamento) di competenza, ciascuna
con COME viene saldata nel testo sopra (rimando alla sezione).

## 7 · Test
- **Contratto (L2)**: i vincoli/RPC della §4, uno per test, nominati
  `tests/contratto/m<numero>-<tema>.test.ts`.
- **E2E**: il flusso completo del modulo, scritto sugli scenari §8,
  `e2e/m<numero>-<nome>.spec.ts`. I `fixme` ereditati si riscrivono qui.

## 8 · Collaudo S1..Sn
Gli scenari, scritti perché due ottici possano CAMMINARLI A TAVOLINO
in Era 1 (carta e penna) e dal vivo in Era 2. Concreti: nomi, cifre,
giorni.

## 9 · Camminata a tavolino — verbale
Data, chi ha camminato (Ray + agente), cosa non tornava, cosa è stato
corretto in quale sezione. La spec è SIGILLATA solo quando questo
verbale esiste e chiude senza riserve.

## 10 · Congelamento
Dopo il sigillo, ogni modifica in Era 2 si annota qui con data e motivo
(«scoperto in esecuzione: …»). Se la lista cresce oltre le tre voci, la
spec torna in camminata.
