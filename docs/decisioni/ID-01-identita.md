# ID-01 · Modello di identità (persone vs clienti)

> ⚠️ **Nota di provenienza.** L'allegato canonico `decisione-ID01-identita.md`
> **non era incluso** nel messaggio della consegna G6. Questo file è la **sintesi
> operativa** ricavata dal testo della consegna, così che la decisione stia
> accanto al codice (migrazione 011) da subito. Quando l'allegato completo
> arriva, **sostituisce o riconcilia** questo file — il contenuto qui non deve
> divergere da quello.

## Le tre regole che governano la migrazione 011

1. **`persone` è di Limpidia.** Nessun `azienda_id`. Una riga per essere umano,
   identificata dal **telefono normalizzato** (`normalizza_telefono` →
   `+39XXXXXXXXXX`, colonna generata e unica: la stessa persona non si sdoppia).
2. **`clienti` resta del negozio.** Non si tocca. La persona di piattaforma e il
   cliente del negozio sono due cose diverse, collegate solo quando serve
   (`prenotazioni.cliente_id`, facoltativo).
3. **Il negozio non legge mai `persone`.** Mai. RLS attiva **senza policy**:
   nessuno legge, nemmeno l'ottico autenticato — ci arrivano solo le funzioni
   `security definer`. La conseguenza tecnica è che il dato di contatto si
   **copia sulla prenotazione** (`contatto_nome/telefono/email`): l'ottico vede
   chi ha prenotato da lì, senza nessuna finestra sull'identità di piattaforma.

## Perché questa forma

- Una persona che gira fra più ottici resta **una** persona per Limpidia (utile
  per il portale-aggregatore: storico, lista d'attesa, «vicino a me»), ma ogni
  negozio continua a vedere solo i propri clienti e le proprie prenotazioni.
- Il **registro dei riferimenti** (`persone_riferimento_registro`, append-only)
  è l'unico posto che, fra un anno, spiega «perché questa persona risulta di
  Bianchi?»: ogni passaggio di riferimento lascia una riga immutabile.

## Limite noto (accettato)

Due persone che **condividono un numero fisso di famiglia** collassano in una
sola riga `persone` (la chiave è il telefono normalizzato). È accettabile: il
caso «prenoto per mia figlia» si risolve con **`per_conto_di`** sulla
prenotazione, non con identità separate. Se un domani servisse distinguerle,
si aggiungerà un discriminante, non si spezzerà la chiave del telefono.
