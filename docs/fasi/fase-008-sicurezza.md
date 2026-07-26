# Fase 008 — Sicurezza e isolamento tenant (G2)

Migrazione `supabase/migrazioni/008_sicurezza_tenant.sql`. **Solo SQL**: nessun
TypeScript, nessuna tabella del portale, nessuna rotta. Additiva e idempotente.

## Perché adesso

Finora il database è stato raggiunto **solo da utenti autenticati**, e la RLS
(`get_azienda_id()`) bastava a garantire che ognuno vedesse solo la sua azienda.
Sta per cambiare: il portale scriverà con **service role**, e il service role
**bypassa la RLS**. Tutto ciò che oggi è protetto solo da una policy va quindi
protetto anche da un vincolo di database che il service role non può aggirare.
Questa migrazione chiude quei buchi **prima** che si aprano.

Le tabelle del portale (`prenotazioni`, `orari_apertura`, `chiusure`,
`blocchi_slot`, `lista_attesa`) arrivano in una consegna successiva: dipendono
da una decisione sul modello di identità non ancora presa.

## Cosa fa, blocco per blocco

- **DB-01 · Coerenza tenant sulle FK incrociate.** Un trigger generico
  (`assicura_coerenza_tenant`) verifica, per ogni FK verso una tabella con
  `azienda_id`, che la riga puntata sia della stessa azienda. **Non dipende da
  `auth.uid()`** (altrimenti il service role lo aggirerebbe per costruzione):
  confronta gli `azienda_id` reali. `SECURITY DEFINER` per leggere l'azienda
  della riga riferita a prescindere dalla RLS del chiamante.
- **DB-02 · Lettura pubblica solo di vetrina.** `revoke select on aziende from
  anon` (esplicito) + vista `negozi_pubblici` con **solo** slug, nome_pubblico
  (fallback su nome), tagline, logo_url, indirizzo, citta, cap, provincia,
  brand; `grant select` all'anon **solo sulla vista**. Mai esposti: partita_iva,
  ragione_sociale, email, stato_abbonamento, moduli_attivi, data_scadenza, id.
- **DB-03 · `portale_attivo`** (default `false`): un negozio compare in vetrina
  solo quando qualcuno lo decide; sospenderlo non tocca i suoi dati.
- **DB-04 · Nessuna sovrapposizione appuntamenti** (vincolo `EXCLUDE` GIST): tre
  porte scrivono sulla stessa agenda; la doppia prenotazione si nega a livello
  DB, non con logica applicativa. Solo gli stati che occupano lo slot
  (`prenotato`, `completato`) sono vincolati.
- **DB-05 · `appuntamenti.fonte`** (default `banco`): da quale porta entra ogni
  singola prenotazione (diverso da `clienti.fonte`, che è la prima acquisizione
  del cliente).
- **DB-06 · Vocabolario `fonte` allargato** — vedi la deroga qui sotto.

## Tabelle e FK coperte dal trigger DB-01

Enumerate da `schema.sql` + migrazioni 002–007 e verificate su
`information_schema`. **11 tabelle**, 26 FK incrociate:

| Tabella | FK verificate (colonna → tabella) |
|---|---|
| appuntamenti | cliente_id→clienti · utente_id→utenti |
| chiusure_cassa | chiusa_da→utenti |
| fermi | cliente_id→clienti · prodotto_id→prodotti · utente_id→utenti |
| movimenti_cassa | utente_id→utenti |
| movimenti_magazzino | prodotto_id→prodotti · utente_id→utenti |
| ordini_lac | cliente_id→clienti · prescrizione_id→prescrizioni |
| ordini_occhiali | cliente_id→clienti · prescrizione_id→prescrizioni · ispezionata_da→utenti |
| prescrizioni | cliente_id→clienti · utente_id→utenti |
| resi | cliente_id→clienti · utente_id→utenti · vendita_id→vendite · busta_id→ordini_occhiali |
| richiami | cliente_id→clienti · utente_id→utenti |
| vendite | cliente_id→clienti · utente_id→utenti · busta_id→ordini_occhiali · ordine_lac_id→ordini_lac |

(clienti/prodotti/prescrizioni/utenti sono solo *riferite*: la loro unica FK con
azienda_id punta ad `aziende`, quindi non "scrivono" verso altri tenant e non
hanno bisogno del trigger.)

## Deroga al contratto — vocabolario `fonte`

La regola d'oro del repo dice di non toccare il vocabolario del contratto.
DB-06 è **l'unica deroga**, decisa a monte: il vecchio valore `'sito'`
collassava tre cose distinte (QR in vetrina, sito del singolo negozio, portale
comune). Nuovo elenco: `banco, app, convenzione, import, qr_vetrina,
sito_negozio, portale`. Backfill: le righe con `fonte = 'sito'` diventano
`'banco'` (prima del nuovo check). Lo stesso check si applica a
`appuntamenti.fonte`.

**Allineamento del codice: consegna SUCCESSIVA.** Il valore `'sito'` è citato in
cinque punti (`lib/actions.ts`, `lib/utils.ts`, `lib/database.types.ts`,
`components/ClienteForm.tsx`, `components/ui.tsx`). **Non toccati qui.**
Conseguenza nota fra i due merge: creare un cliente scegliendo la fonte "Dal
sito" produrrà un errore di check dal DB (gestito come errore dall'azione, non
un crash); tutte le altre fonti funzionano. L'app **compila** lo stesso (il tipo
TS non conosce il check del DB). Da allineare subito dopo.

## Verifica (dry-run transazionale sul DB demo, con ROLLBACK — non persistito)

- **Rilevamento sovrapposizioni pre-esistenti**: query eseguita su seed + dati
  attuali → **0 sovrapposizioni**. Il vincolo `EXCLUDE` si aggiunge senza dover
  toccare nulla.
- **Idempotenza**: la migrazione gira **due volte di fila** senza errori
  (11 trigger, EXCLUDE, vista tutti presenti; backfill `sito` → 0 residui).
- **Comportamento** (con service role, in transazione): cross-tenant respinto ·
  overlap stessa azienda respinto · overlap fra aziende diverse accettato ·
  appuntamento annullato non blocca lo slot. Tutti verdi.
- I test di contratto (`tests/contratto/sicurezza-tenant.test.ts`) coprono gli
  stessi casi e girano in CI contro il progetto Supabase di test.

## Deviazioni tecniche rispetto alla lettera della consegna

1. **EXCLUDE + funzione IMMUTABLE.** La forma letterale
   `tstzrange(inizio, inizio + make_interval(mins => durata_minuti))` dentro
   l'`EXCLUDE` fallisce con `42P17: functions in index expression must be marked
   IMMUTABLE`, perché l'operatore `timestamptz + interval` è STABLE (dipende dal
   TimeZone per giorno/mese). Per una durata in soli **minuti** su un
   timestamptz (istante assoluto) il risultato è deterministico: l'ho
   incapsulato in `appuntamento_intervallo(...)` marcata `IMMUTABLE` — pattern
   standard, semantica identica.

## Cosa resta aperto

- **Una poltrona sola (limite noto).** Il vincolo DB-04 è per `azienda_id`:
  un negozio con due optometristi non può avere due appuntamenti in parallelo.
  Per l'indipendente con una poltrona è corretto ed è la difesa giusta; quando
  servirà la seconda poltrona si introdurrà una `risorsa_id` nel vincolo. **Non
  generalizzato adesso.**
- **`telefono` fuori dalla vetrina.** Il prototipo del front mostra il telefono
  del negozio, ma non è nell'elenco dei campi esposti da `negozi_pubblici`: è
  una decisione da prendere (esporlo è una scelta di prodotto, non tecnica).
  Lasciato **fuori**.
- **Allineamento codice `fonte`** (i 5 punti con `'sito'`): consegna successiva.
- **Applicazione al DB.** La migrazione è **verificata ma NON applicata** ad
  alcun database (dry-run con rollback): si applica al progetto di test / demo
  dopo la revisione.
