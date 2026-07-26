# Fase G6 — Le tabelle del portale e il calcolo degli slot

Le tabelle su cui poggia tutto il portale + la funzione che calcola gli orari
liberi. Alla fine, la pagina del negozio **mostra gli slot disponibili veri**,
calcolati dagli orari meno quello che è già occupato.

**Ancora non si prenota.** La scrittura (`crea_prenotazione()` + percorso
guidato) è G7: qui si costruisce e si legge. Il calcolo degli slot è la parte con
più casi limite del progetto e va vista funzionare da sola prima di scriverci sopra.

## Per chi rivede — le richieste della consegna

### 1 · URL di preview con la griglia

- **Negozio principale (scuro):** `/ottica/ottica-vista-demo?servizio=visita` —
  la griglia degli orari liberi, coi **buchi** dove il seed mette appuntamenti e
  un blocco. Il giorno si cambia con ‹ › (`?giorno=`), il servizio coi chip.
- **Ottica Aurora (chiara):** `/ottica/ottica-demo?servizio=visita`.

La 011 e il seed G6 si applicano al DB della preview **dopo l'OK**.

### 2 · Nessuno legge `persone` né il registro

- `anon`: **niente** — non legge `persone`, `prenotazioni`, `lista_attesa`, il
  registro (revoke esplicito), ma **può** chiamare `slot_liberi` (security
  definer). Verificato su DB: `anon` esegue `slot_liberi`, `select` diretta su
  `persone`/`prenotazioni` = falso.
- **negozio autenticato**: legge **solo le proprie** prenotazioni/lista_attesa
  (`azienda_id = get_azienda_id()`); su `persone` e sul registro **RLS senza
  policy** → non legge nemmeno lui. Ci arrivano solo le funzioni security definer.

La guardia **G15b** sorveglia che `persone` e il registro restino **senza policy**.

### 3 · Fuso orario e ora legale (in tre righe)

Gli orari di apertura sono ora di **parete** italiana; in `slot_liberi` li si
àncora all'istante assoluto con `(giorno + apre) at time zone 'Europe/Rome'`, che
applica le regole di ora legale **di quel giorno**. I candidati si generano poi in
**tempo assoluto** (passo di 15'), così sul giorno del cambio d'ora non nascono
orari inesistenti né se ne saltano. Nessun confronto si affida al fuso della
sessione DB.

### 4 · Decisione aperta (scritta qui, in `docs/`)

**Scadenza delle richieste non risolte.** Una prenotazione `in_attesa`
**occupa** lo slot finché l'ottico non la risolve (giusto per l'utente: meglio non
offrire uno slot conteso). Ma se l'ottico non risponde per una settimana, lo slot
resta bloccato. Serve una **scadenza** delle richieste non risolte (dopo N ore/
giorni tornano libere o passano in uno stato «scaduta»), **da decidere insieme al
comportamento dell'inbox in G8**. Non risolta in G6 di proposito.

## Le tabelle (migrazione 011)

- **`persone`** — di Limpidia, nessun `azienda_id`; chiave = telefono
  normalizzato (colonna **generata** unica; `normalizza_telefono` porta
  `340…`, `+39 340…`, `3401…` alla stessa `+39…`). Modello: vedi
  `docs/decisioni/ID-01-identita.md`.
- **`prenotazioni`** — la **richiesta** (stati `in_attesa/accettata/rifiutata/
  annullata`, ≠ dalla visita che è l'appuntamento). Il **contatto è copiato** qui
  (`contatto_nome/telefono/email`) perché il negozio non legge `persone`. `fonte`
  usa il vocabolario `FONTI` (guardia **G12f**). **Niente delete fisica**: un
  trigger la vieta — quelle date sono la materia prima dei richiami a un anno.
- **`persone_riferimento_registro`** — **append-only** (trigger che rifiuta
  update/delete): l'unica cosa che fra un anno spiega «perché questa persona
  risulta di Bianchi?».
- **`lista_attesa`** — nasce ora; l'avviso vero è G8.

Coerenza tenant (008) sulle FK incrociate (`prenotazioni.cliente_id/
appuntamento_id`, `registro.prenotazione_id`). Indici su `(azienda_id, inizio)`,
`(persona_id, inizio)`, la lista e il registro.

## `slot_liberi(slug, servizio, giorno)`

`security definer`, eseguibile da `anon`: l'unico modo perché l'anonimo ottenga
il calcolo senza leggere le tabelle occupanti. Algoritmo: azienda pubblicata →
durata del servizio attivo → niente se il giorno è in chiusura → per ogni fascia
del giorno, candidati **ogni 15'** con `inizio+durata ≤ chiusura`, scartando quelli
che si sovrappongono a un **appuntamento** (`prenotato/completato`), a una
**prenotazione** (`in_attesa/accettata`) o a un **blocco**, quelli nel passato e
quelli a meno di **2 ore** da adesso; **orizzonte 90 giorni**. Costanti (passo,
anticipo, orizzonte) commentate in testa alla funzione.

Verifica su DB (dry-run, non persistito): feriale 09–19 / visita 30' = **39 slot**,
sabato 09–13 = **15**, domenica = **0**, giorno in ferie = **0**; `anon` esegue ma
non legge `persone`.

## La pagina

Sezione «Prenota un servizio» sotto i servizi: chip-servizio e navigazione giorno
sono **link** (`?servizio` / `?giorno`), **zero JavaScript, nessun componente
client**. Slot **in sola lettura**; stato vuoto con la frase utile e il link al
giorno dopo («Nessun orario libero … Prova …»). Il bottone di prenotazione resta
**inerte**. `force-dynamic` (da G5) tiene il calcolo in tempo reale.

## Seed

Sul negozio principale: tre appuntamenti nei prossimi giorni + un blocco di due
ore → la griglia mostra **buchi veri**. Nessuna `persona` né `prenotazione` nel
seed: nascono in G7, dal percorso vero.

## Guardie e test

- **Guardie statiche**: **G12f** (prenotazioni.fonte = FONTI) + **G12e** esteso;
  **G15/b/c/d** (RLS+revoke sulle 4 tabelle; `persone`/registro senza policy;
  `slot_liberi` security definer eseguibile da anon; niente delete fisica).
- **Contratto + algoritmo + E2E**: preparati dall'agente di test. Nota
  architetturale: l'algoritmo vive in SQL (solo un security definer può leggere le
  tabelle occupanti sotto RLS), quindi i suoi casi (giorno chiuso, ferie, pausa,
  fine giornata a 60', overlap, annullato che non blocca, blocco a cavallo,
  anticipo, **cambio ora legale**) sono esercitati come test di **contratto**
  contro il DB di test, non come unit puri.

## Nota per la CI e allegato

- La 011 va applicata anche al progetto Supabase di **test** perché contratto/E2E
  girino (vedi `docs/agenti/TODO-ray.md`).
- L'**allegato ID-01** non era nel messaggio della consegna:
  `docs/decisioni/ID-01-identita.md` è una sintesi dal testo, da sostituire con
  l'originale quando arriva.

## Criterio di accettazione

La pagina mostra gli orari realmente liberi per un servizio in un giorno,
calcolati dagli orari meno l'occupato — e nessuno, né anonimo né ottico, può
leggere la tabella delle persone.
