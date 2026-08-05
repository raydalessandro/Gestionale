# Modulo M7 — Richiami · Spec (bozza a metodo ROVESCIATO)

> **SIGILLATA il 04/08/2026** — camminate chiuse per dichiarazione di Ray: assorbite dalle passate incrociate e dalla coerenza M1-M10. Da qui: solo annotazioni in §10.

*Era 1 · 04/08/2026. Assemblata dal corpus + le due indicazioni di Ray
di oggi. Sorpresa della fotografia: la tabella `richiami` ESISTE già a
contratto, ricca (tipi, canali, esiti, date) — il motore ha già il suo
registro dei fatti. Qui si specifica il CERVELLO (le code) e il GESTO.*

## 0 · Fonti
mappa-db: tabella `richiami` viva (tipi: controllo_vista ·
lac_esaurimento · ritiro_sollecito · fermo_scadenza · promessa_ritardo
· generico; canali: telefono · whatsapp · sms · email · di_persona;
esiti: appuntamento_fissato · richiamare · non_risponde ·
non_interessato · gestito) · M2 f2e (àncora del recall) · M5
(copertura ÷2, vendita veloce che resetta, anticipo=taratura) · M6
(mancato, prenotazioni, disdetta visibile) · M4 (contenitore
preventivi, canale per-ordine) · M1 (consenso marketing coi canali,
canale_preferito) · C2/C4/C5 in lista · **Ray 04/08**: i due lati e la
gerarchia delle fonti.

## 1 · Il modulo in una pagina
Il recall **lo fa il sistema, lo conferma l'ottico**: il gestionale
genera le CODE [PROIEZIONI] sui dati dell'ottico, l'ottico guarda,
chiama, e registra l'esito — che diventa il fatto `richiami` (già a
contratto). **Due lati**: il lato-ottico (questo modulo, ora) e il
lato-rete — noi, col database completo, sappiamo chi ha prenotato dal
portale senza mai avere una Rx registrata: a quelli il recall lo
manderemo NOI (perimetrato, si costruisce dopo). Chi non ha né Rx né
prenotazione NON entra nei recall-cliente: campagna a parte, futura,
«come se non ne avessimo parlato».

## 2 · Vocabolario (in gran parte GIÀ A CONTRATTO)
- **Tipi, canali, esiti**: quelli della tabella viva (sopra) —
  additive-ready per il futuro (es. `convenzione_voucher` quando
  arriverà C4/M-convenzioni).
- **La gerarchia della fonte-àncora (Ray, 04/08)**: (1) **la Rx
  dell'ottico** — àncora = max(ultima Rx clinica, ultima fornitura su
  di essa), derivate mute, il plano richiama (M2); (2) se non c'è Rx →
  **la prenotazione del portale** (l'ultima visita prenotata); (3)
  nessuna delle due → fuori dalle code cliente (campagna a parte,
  futura).
- **La scala commerciale dietro la gerarchia (Ray, 04/08)**: il
  fallback-portale È il servizio per il tier «solo agenda» — ottici
  che usano la nostra agenda e i nostri richiami SENZA il gestionale
  completo: per loro la prenotazione è l'unico dato possibile, e «il
  fine sarà fargli fare la prescrizione» (portarli al gestionale
  pieno). A regime, tutto dalla Rx. Le vendite semplici senza scheda
  non entrano in nessuna coda: non c'è il cliente.
- **Tarature per tipo** [REGISTRO]: quanto anticipo per ogni coda
  (LAC: giorni prima della fine-copertura; controllo vista: mesi prima
  della scadenza). Ogni negozio regola le sue.

## 3 · I flussi

### f7a · La coda «controllo vista» — assemblato ◐
Per ogni cliente: àncora dalla gerarchia → scadenza (+1 anno sticky di
M2 quando la colonna arriverà; oggi data_visita) → entra in coda con
l'anticipo tarato. Il plano richiama come ogni controllo; le derivate
non generano mai code proprie.

### f7b · La coda «LAC in esaurimento» (C2) — assemblato ◐
Dalla consegna (o vendita veloce): copertura = lenti × durata ÷ 2
(M5) → in coda all'avvicinarsi della fine, con l'anticipo tarato.
**Win-back**: copertura superata senza riordino → il cliente passa
alla lettura dedicata («sparito coi mensili da tre mesi»).

### f7c · Win-back dagli appuntamenti — assemblato ◐
`mancato` (M6) e disdette non riprogrammate → lettura per il banco:
richiamare per capire e recuperare (lo strumento della disdetta
visibile, f6d, sfocia qui).

### f7d · «Ritiro sollecito» — assemblato ◐
Ordini fermi in `in_consegna` oltre N giorni (taratura): l'occhiale è
pronto, il cliente non viene — la coda lo ricorda.

### f7e · «Fermo in scadenza» (C5) — assemblato ◐
La lettura dei fermi di M3 sfocia nella coda col suo anticipo.

### f7f · Il contenitore dei preventivi — assemblato ◐ (da M4)
Gli ordini salvati sono un recall commerciale che l'ottico CONSULTA e
pota a mano: niente code automatiche qui — è una lettura, per scelta.

### f7g · Il gesto del richiamo — assemblato ◐
Dalla coda: si chiama (sul canale giusto: consenso M1 + preferito —
vedi §11.1), si registra l'esito [FATTO su `richiami`]:
appuntamento_fissato chiude e può aprire l'agenda (M6);
`richiamare` = rinvio con nuova `da_fare_il`; gli altri chiudono con
memoria. `valore` e `riferimento` legano al pezzo che ha originato la
voce.

### f7h · Il lato-rete — PERIMETRATO (si costruisce dopo)
Noi, sul database completo: recall ai portale-only (prenotazione senza
Rx). Senso unico rete→cliente, mai dentro i dati dell'ottico. La
campagna agli sconosciuti («vieni a fare il controllo da noi») è
un'altra storia, futura.

## 4 · I dati (quasi nulla — il registro c'è già)
```sql
-- richiami: ESISTE ✓ (tipi/canali/esiti a contratto — nessuna modifica)
create table public.tarature_richiami (      -- REGISTRO per negozio
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references aziende,
  tipo text not null,                        -- gli stessi tipi di richiami
  anticipo_giorni int not null default 30,
  attivo boolean not null default true,
  unique (azienda_id, tipo)
);
-- Le CODE sono PROIEZIONI (viste/query), mai tabelle.
-- prescrizioni.data_scadenza: arriva col DDL M2 (Era 2, additive).
```
**Incastri**: àncora ← M2 f2e · copertura ← M5 · mancato/disdette ←
M6 · preventivi ← M4 · canali ← consenso M1 + preferito ·
appuntamento_fissato → agenda M6 · C4 Fondo Est → tipo additive
futuro (convenzioni) · esiti → letture M9.

## 7 · Test (contratto)
Contract: `tarature_richiami` (unique per tipo). Unit: gerarchia fonti
(Rx > prenotazione > fuori) · gate consenso marketing (senza → mai in
coda) · copertura+anticipo (i due occhi) · esclusione vendite senza
scheda. E2E: S1-S7 per nome. Rimandati: il lato-rete f7h (futuro
dichiarato) e la campagna esterna.

## 6 · I conti che questo modulo salda
C2 → f7b (progettato) · C5 lettura → f7e · win-back → f7b/f7c ·
contenitore preventivi → f7f · C4 → predisposto (tipo additive) ·
campagna-rete → perimetrata futura (f7h).

## 8 · Collaudo S1..Sn (bozza)
S1 Rx di 11 mesi fa → in coda controllo_vista con l'anticipo giusto;
la derivata non raddoppia · S2 plano di un anno fa → richiama ·
S3 mensili consegnate a gennaio, copertura 6 mesi → coda a giugno meno
anticipo; a luglio senza riordino → win-back · S4 mancato di ieri →
lettura win-back, chiamo, esito `appuntamento_fissato` → agenda ·
S5 occhiale in_consegna da 10 giorni → sollecito · S6 esito
`richiamare` → rientra con la nuova data · S7 cliente senza consenso
marketing → [dipende da §11.1].

## 9 · Camminata — verbale
Bozza rovesciata del 04/08 con fotografia del contratto (la tabella
c'era già) e le indicazioni di Ray integrate (due lati, gerarchia
fonti). ATTENDE la camminata di stasera.

## 11-bis · Risposte (04/08) — M7 COMPLETA
1. **Il recall è COMMERCIALE** — «non stiamo inserendo dati clinici:
   gli stiamo proponendo un controllo». Consenso = quello marketing;
   canali = quelli FIRMATI NEL MASTRO (+ preferito, come sempre);
   senza consenso → il cliente NON entra nelle code (S7 risolto:
   l'ottico può sempre agire di persona, il motore non propone
   contatti). E l'àncora si semplifica: serve solo LA DATA dell'ultima
   visita — «non ci serve neanche sapere qual è» la Rx.
   **Titolarità pulita**: i richiami li registriamo noi
   (infrastruttura) ma PARTONO DALL'OTTICO, per il suo cliente, coi
   suoi consensi — «così non abbiamo problemi di gestire consensi».
   (Il lato-rete f7h, quando verrà, si porrà la stessa domanda da
   capo.)
2. **Finezza di vocabolario accolta**: l'esito `richiamare` collide
   con `da_chiamare` degli ordini → l'etichetta diventa
   **«da_spostare»** (voce additive in Era 2, contratto intatto, la
   vecchia si depreca in lettura). Il concetto resta: rinvio con nuova
   `da_fare_il`.

Sigillo apposto il 04/08.