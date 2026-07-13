# Fase 3 — Agenda & Richiami (v0.4) · Specifica di codifica

Il "livello ricavi": qui il gestionale smette di registrare e comincia a
**far succedere le cose**. Stessa disciplina delle fasi precedenti.

## 0 · Prima di scrivere una riga

Leggere: `README.md` (contratto) · `supabase/migrazioni/004_agenda_richiami.sql` ·
`docs/dominio-ottica.md` §3 (viaggio del cliente) e §11 (automazioni di catena) ·
il codice delle fasi 1–2 per i pattern (wizard, azioni evento, ricerca cliente
live, link WhatsApp in `AzioniOrdine`).

**Stato di partenza garantito**: 004 applicata; `lib/database.types.ts`
(`AppuntamentoRow`, `RichiamoRow`) e `lib/utils.ts` (`TIPI_APPUNTAMENTO`,
`STATI_APPUNTAMENTO`, `TIPI_RICHIAMO`, `ESITI_RICHIAMO`, `CANALI_RICHIAMO`,
`scadenzaRx`) già allineati. Disallineamenti evidenti → correggere i tipi,
segnalare nel commit, non toccare la migrazione.

Convenzioni tecniche: identiche (§0 Fase 1).

## 1 · Obiettivo e perimetro

**Dentro**: Agenda con vista giorno e slot (default 20'), creazione
appuntamenti anche dagli ordini ("Fissa ritiro"), stati
completato/mancato/annullato; Richiami con **coda del giorno**, **proposte
calcolate al volo** dai dati (niente cron), registrazione esiti con canale e
valore, ripianificazione; aggancio a dashboard e scheda cliente.

**Fuori**: invio reale di messaggi (qui solo link `wa.me`/`tel:` precompilati),
notifiche push (arriveranno con l'app satellite), sync con calendari esterni,
vista settimana/mese, promemoria automatici, campagne massive, qualunque
scheduler o edge function.

## 2 · Regole di dominio vincolanti

1. **Niente cron, per architettura.** Le proposte di richiamo si calcolano
   quando si apre la pagina, con query sui dati che già abbiamo. La tabella
   `richiami` registra solo ciò che viene pianificato o lavorato.
2. **Le proposte** (ognuna con cliente, motivo leggibile, riferimento e —
   dove ha senso — valore):

   | Tipo | Condizione (query) | Riferimento | Valore |
   |---|---|---|---|
   | `ritiro_sollecito` | buste `pronta` con `avvisato_il` null oppure avvisate da > 3 gg; ordini LAC `arrivato` con `avvisato_il` null oppure avvisati da > 3 gg | numero | saldo (busta) / totale − acconto (LAC) |
   | `promessa_ritardo` | buste in `lavorazione` o `arrivata` con `data_promessa` < oggi | numero | saldo |
   | `lac_esaurimento` | ordini LAC `consegnato` con `data_consegna` tra 100 e 70 gg fa, e il cliente non ha ordini LAC più recenti (qualsiasi stato ≠ annullato) | numero | totale dell'ordine (proxy del riordino) |
   | `controllo_vista` | prescrizioni `attiva` con scadenza (`scadenzaRx`) entro 30 gg (anche appena passata, fino a −15 gg), cliente senza appuntamento `controllo_vista` futuro | — | null |
   | `fermo_scadenza` | fermi `attivo` con `scade_il` < oggi | prodotto | prezzo × quantità |

3. **GDPR — la regola che ci distingue**: `ritiro_sollecito`,
   `promessa_ritardo` e `fermo_scadenza` sono contatti **operativi** (il
   cliente aspetta la sua merce): sempre proposti. `controllo_vista` e
   `lac_esaurimento` sono contatti **commerciali**: proposti SOLO se
   `clienti.consenso_marketing = true`. In testa alla sezione proposte,
   se esistono clienti esclusi per mancanza di consenso, una riga sobria:
   "N proposte commerciali nascoste per mancanza di consenso marketing."
4. **Dedupe**: una proposta non compare se esiste già un richiamo dello
   stesso `tipo` per lo stesso cliente (stesso `riferimento`, quando c'è)
   con `esito` null, oppure lavorato (`fatto_il`) negli ultimi 15 giorni.
5. **Ogni tentativo è una riga.** Registrare un esito non modifica mai un
   richiamo già lavorato: `esito = 'richiamare'` offre "Ripianifica" che
   crea un **nuovo** richiamo (prefill: stesso tipo/cliente/riferimento,
   `da_fare_il` = +3 gg, modificabile). La storia dei tentativi resta tutta.
6. **Registrare un esito** valorizza insieme: `canale` (obbligatorio),
   `esito` (obbligatorio), `fatto_il = now()`, `utente_id` = utente corrente,
   `valore` (precompilato dalla proposta, modificabile), `note` (facoltative).
   Esito `appuntamento_fissato` → dopo il salvataggio, redirect a
   `/agenda/nuovo` con cliente/tipo/riferimento precompilati.
7. **Macchina a stati appuntamento**:

   | Da | Evento | A | Note |
   |---|---|---|---|
   | prenotato | "Completato" | completato | |
   | prenotato | "Non presentato" | mancato | il no-show è un dato |
   | prenotato | "Annulla" | annullato | motivo facoltativo in note |

   Stati finali: nessuna azione. Transizioni validate anche lato server.
8. **Slot**: `durata_minuti` default **20**, input a step di 5 (5–240).
   Nessun vincolo di sovrapposizione (più operatori lavorano in parallelo):
   se due appuntamenti dello **stesso operatore** si sovrappongono, la lista
   li evidenzia con un puntino ambra e il title "Si sovrappone" — informare,
   non bloccare.
9. **Mappatura tipo appuntamento ↔ provenienza**: "Fissa ritiro" da busta →
   tipo `consegna`; da ordine LAC → `ritiro_lac`; da proposta
   `controllo_vista` → `controllo_vista`. `riferimento` = numero ordine
   quando esiste.

## 3 · Pagine e rotte

### 3.1 `lib/modules.ts` e Sidebar
`agenda` → `attivo: true`. Aggiungere la voce
`{ id: "richiami", nome: "Richiami", href: "/richiami", icona: "richiami", attivo: true }`
subito dopo `agenda`; in `Sidebar.tsx` mappare `richiami` → icona `PhoneCall`
(lucide). Nient'altro nel registry.

### 3.2 `/agenda` — vista giorno (server)
`searchParams`: `data` (ISO `YYYY-MM-DD`, default oggi).

- Header con data leggibile ("martedì 14 luglio") e nav `←  Oggi  →`
  (link con `?data=`). CTA "Nuovo appuntamento" (accent).
- **Timeline del giorno**: appuntamenti ordinati per `inizio`; ogni riga:
  ora inizio–fine in `f-mono` · badge tipo (`TIPI_APPUNTAMENTO`, tinta
  neutra) · cliente (link; "Impegno interno" se null) · con chi (nome
  utente) · `riferimento` mono se presente · badge stato
  (`STATI_APPUNTAMENTO`) · azioni inline sui `prenotato` (§2.7, pattern
  azioni fermi). Puntino ambra per sovrapposizioni stesso operatore (§2.8).
- Sotto la timeline: contatore sobrio "N completati · N non presentati"
  del giorno, solo se > 0.
- Vuoto: `Vuoto` con CTA.

### 3.3 `/agenda/nuovo` (client)
Prefill da query: `?cliente=&tipo=&riferimento=&data=`.
Campi: cliente (ricerca live riusata; facoltativo — senza cliente è un
impegno interno) · tipo (select `TIPI_APPUNTAMENTO`) · data (default oggi o
`?data`) · ora (input time, step 300) · durata (default 20, step 5) · con chi
(select utenti attivi dell'azienda, default utente corrente) · riferimento ·
note. Salva → redirect `/agenda?data=<giorno>`.

### 3.4 `/richiami` — la coda che fa i ricavi (server)
Tre sezioni nella stessa pagina, in quest'ordine:

1. **Da fare** — richiami con `esito` null e `da_fare_il` ≤ oggi (i futuri
   entro 7 gg in un sottogruppo "In arrivo"). Riga: badge tipo
   (`TIPI_RICHIAMO`, tinta ottone) · cliente (link) + telefono ·
   riferimento mono · valore (`fmtEuro`, se presente) · scaduto da N gg se
   `da_fare_il` < oggi · bottone "Registra esito" (form inline §2.6) ·
   link ghost `tel:` e WhatsApp (riusare la normalizzazione della Fase 1;
   messaggio precompilato per tipo, tono del banco).
2. **Proposte dal negozio** — calcolate al volo (§2.2–2.4). Stessa resa,
   più il motivo leggibile ("Busta BL-… pronta da 5 giorni, non avvisata").
   Bottoni: "Registra esito" (crea il richiamo già lavorato in un colpo) e
   "Pianifica" (crea richiamo `esito` null con `da_fare_il` a scelta,
   default oggi). Riga GDPR §2.3 in testa se serve.
3. **Storico** — ultimi 50 lavorati: quando (`fmtQuando`) · tipo · cliente ·
   canale · esito (`ESITI_RICHIAMO`) · valore · chi. Sola lettura.

CTA header: "Nuovo richiamo" → form inline o pagina `/richiami/nuovo`
(cliente, tipo `generico` default, da_fare_il, riferimento, note).

### 3.5 Aggancio ordini
Nelle schede ordine (Fase 1), accanto a "Segna avvisato/a": bottone ghost
**"Fissa ritiro"** (busta in `pronta`, LAC in `arrivato`) → `/agenda/nuovo`
prefill (§2.9). Nessun'altra modifica alle schede.

### 3.6 Dashboard
Sotto i KPI (e l'eventuale avviso sotto scorta): due righe-link sobrie —
"Oggi in agenda: N appuntamenti →" (se N > 0) e "Richiami da fare: N →"
(ambra se N > 0). Niente nuove card.

### 3.7 Scheda cliente
Sezione "Richiami" compatta dopo gli ordini: ultimi 3 (tipo, quando/da fare,
esito) + prossimo appuntamento futuro se esiste ("In agenda: controllo vista
il 21/07 alle 10:00"). Sola lettura + link ai moduli.

## 4 · Server actions (in `lib/actions.ts`)

| Azione | Firma | Note |
|---|---|---|
| `creaAppuntamento` | `(prev, formData)` | compone `inizio` da data+ora; valida durata 5–240 |
| `eventoAppuntamento` | `(id, evento, prev, formData)` con `evento ∈ completa·mancato·annulla` | macchina §2.7, stato riletto dal DB |
| `creaRichiamo` | `(prev, formData)` | manuale o "Pianifica" da proposta |
| `registraEsitoRichiamo` | `(id, prev, formData)` | §2.6; rifiuta se `esito` già valorizzato |
| `registraEsitoProposta` | `(prev, formData)` | crea il richiamo già lavorato (tipo/cliente/riferimento/valore da hidden fields + canale/esito/note dal form) |

Le proposte si calcolano in una funzione server condivisa
`lib/richiami-proposte.ts` (esporta `calcolaProposte(supabase)` che ritorna
l'array tipizzato usato sia da `/richiami` sia dal contatore in dashboard):
niente logica duplicata tra pagina e dashboard.

## 5 · Cosa NON fare

Niente scheduler, edge function, webhook o invii reali. Niente modifiche a
001–004 né al vocabolario. Niente nuove dipendenze (i calcoli data si fanno
con `Date`, come già in `rxValida`/`scadenzaRx`). Non toccare la Fase 1–2
oltre ai punti espliciti (§3.5, §3.6, §3.7). Nessuna tabella/colonna nuova.

## 6 · Criteri di accettazione

Build verde; tutto usabile a 390px. Le proposte commerciali spariscono
togliendo il consenso marketing al cliente (e ricompaiono col consenso).
Il dedupe regge: registrato l'esito, la proposta non si ripresenta; dopo 15
giorni sì. "Ripianifica" crea una riga nuova, mai modifica la vecchia.
Appuntamento: nessuna azione sugli stati finali, transizioni rifiutate lato
server. "Fissa ritiro" arriva in agenda già compilato. Nessuna regressione
sulle fasi 1–2.

## 7 · Collaudo manuale (script per gli ottici)

**S1 · Fissa ritiro.** Da una busta `pronta`: "Fissa ritiro" → agenda
precompilata (consegna, cliente, numero) → salva → il giorno giusto la
mostra con l'ora in mono. *Atteso: in scheda cliente compare "In agenda…".*

**S2 · Il no-show è un dato.** Segna un appuntamento "Non presentato".
*Atteso: badge ambra, conteggio del giorno aggiornato, nessuna azione
ulteriore possibile.*

**S3 · La proposta che diventa incasso.** Una busta pronta da >3 gg non
ritirata compare nelle proposte con il saldo come valore → "Registra esito"
(telefono, appuntamento fissato) → redirect in agenda precompilata.
*Atteso: la proposta sparisce, lo storico mostra canale/esito/valore/chi.*

**S4 · GDPR sul campo.** Cliente con LAC consegnate ~80 gg fa e consenso
marketing attivo → compare "LAC in esaurimento"; togli il consenso dalla
scheda → la proposta sparisce e appare la riga "proposte commerciali
nascoste". *Atteso: esattamente questo, nient'altro.*

**S5 · Controllo vista.** Cliente con Rx che scade tra 20 gg (e consenso):
compare la proposta; fissa l'appuntamento controllo vista → la proposta
sparisce (c'è un appuntamento futuro).

**S6 · Richiamare non è fallire.** Esito "Da richiamare" → "Ripianifica"
a +3 gg. *Atteso: due righe nello storico/coda, la vecchia intoccata.*

**S7 · La coda del lunedì.** Con dati misti: la sezione "Da fare" mostra
gli scaduti in evidenza, i futuri in "In arrivo", i link tel/WhatsApp
funzionano col messaggio giusto per tipo.

**Domande ai tester**: i 5 motivi di proposta coprono i vostri richiami
veri? I tempi (3 gg sollecito, 70–100 gg LAC, 30 gg Rx) sono quelli giusti
per il vostro negozio? Il flusso "esito → agenda" rispecchia la telefonata
reale? Cosa manca per fidarvi a usarla ogni mattina?

## 8 · Consegna

Commit granulari `feat(agenda): …` / `feat(richiami): …`, build verde a ogni
commit, README: spuntare la Fase 3. File ammessi: `app/(app)/agenda/**` e
`app/(app)/richiami/**` (nuovi), `lib/richiami-proposte.ts` (nuovo),
componenti nuovi in `components/`, `app/(app)/ordini/**` (solo §3.5),
`app/(app)/dashboard/page.tsx` (§3.6), `app/(app)/clienti/[id]/page.tsx`
(§3.7), `lib/actions.ts`, `lib/modules.ts`, `components/Sidebar.tsx` (icona).
