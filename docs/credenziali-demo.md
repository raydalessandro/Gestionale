# Credenziali dimostrative

> Solo per i test manuali sul progetto Supabase demo. Non sono segreti di
> produzione. La **service role key** non è qui e non va **mai** messa su file
> versionato: si passa allo script dall'ambiente.

Due negozi dimostrativi, **completi e di colore opposto**, entrambi visibili in
vetrina e accessibili dal gestionale (vedi `docs/fasi/fase-g5bis-dati-dimostrativi.md`).

## Negozio A — l'azienda con tutti i dati (insegna scura)

È l'azienda più vecchia del database demo, quella a cui il seed attacca clienti,
prescrizioni, ordini, agenda e cassa. Il seed la **pubblica** sul portale
(`portale_attivo = true`) con un brand scuro.

- **Accesso al gestionale:** le credenziali con cui è stata **registrata**
  (quelle di Ray). Il seed non le tocca.
- **Pagina pubblica:** `/ottica/<slug della tua azienda>`.

## Negozio B — Ottica Aurora (insegna chiara)

Negozio dedicato alla vetrina, con `brand.primary` chiaro (prova del contrasto),
due clienti suoi (Genoveffa Sferruzzi, Bartolomeo Quaranta), orari e servizi.

- **Slug / pagina pubblica:** `/ottica/ottica-demo`
- **Titolare (gestionale):**
  - email: `titolare.aurora@example.com`
  - password: `AuroraDemo-2026!`
- Il titolare **non** lo crea il seed (non può creare utenti auth): si crea con
  lo script di sviluppo, una volta:

  ```bash
  SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<service key> \
    npx tsx scripts/crea-negozio-demo.ts
  ```

  Idempotente: rilanciarlo non crea doppioni (dice che l'utente esiste già).

## Prova rapida dell'isolamento multi-tenant

Entra con le credenziali del **Negozio A** → vedi i suoi tanti clienti.
Entra con quelle di **Ottica Aurora** → vedi **due** clienti diversi, e nessuno
di quelli del Negozio A. Le due metà non si sfiorano.
