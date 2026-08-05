# Fase G5-bis — Allineamento dei dati dimostrativi

Piccola consegna di **soli dati di prova**: nessuna migrazione, nessuna logica
applicativa. Fa incontrare le due metà del progetto prima di G6.

## Il problema che chiude

Il DB demo aveva **due aziende che non si parlavano**: quella nata dalla
registrazione (piena di clienti/ordini/agenda ma `portale_attivo=false`, invisibile
in vetrina) e `ottica-demo`/Ottica Aurora (pubblicata ma **vuota**, senza nemmeno
un utente per accedere). Il portale si provava su un negozio senza agenda, il
gestionale su un negozio fuori vetrina — e in G6 una prenotazione deve atterrare
nell'agenda di un negozio **vero**.

## L'esito — due negozi completi e di colore opposto

| | **Negozio A** | **Ottica Aurora** |
|---|---|---|
| Origine | l'azienda più vecchia (tutti i dati del seed) | slug `ottica-demo` |
| Portale | **pubblicato** (ora) | pubblicato |
| Insegna | **scura** (`#243447`) | **chiara** (`#F0E6D2`) |
| Testata | testo bianco | testo scuro (inchiostro) |
| Accesso gestionale | la registrazione esistente | titolare creato dallo script |
| Clienti | i tanti del seed | **due suoi** (Sferruzzi, Quaranta) |
| `moduli_attivi` | tutti | `dashboard, agenda, clienti` |

Verificato su DB (dry-run transazionale, non persistito): A e Aurora entrambi in
`negozi_pubblici`, brand `#243447` vs `#F0E6D2`, Aurora con 2 clienti, A con 8
moduli, Aurora con 3; e la **seconda** esecuzione del blocco non aggiunge nulla
(idempotente).

## Per chi rivede — le richieste della consegna

### 1 · URL di preview

- **Negozio A:** `/ottica/<slug della tua azienda registrata>` (il seed lo
  pubblica; lo slug è quello scelto in registrazione).
- **Ottica Aurora:** `/ottica/ottica-demo`.

Aperte una dopo l'altra, **le testate hanno testo di colore opposto** — senza che
nessuno abbia scelto niente a mano: è solo `testoSuFondo` (WCAG) su `brand.primary`.

### 2 · Credenziali dimostrative, e dove stanno

In **`docs/credenziali-demo.md`** (non nel codice):
- **Negozio A:** le credenziali con cui è stato **registrato** (il seed non le tocca).
- **Ottica Aurora:** `titolare.aurora@example.com` / `AuroraDemo-2026!`, creato
  dallo script (sotto).

### 3 · Lo script non è importato da nessun file dell'applicazione

`scripts/crea-negozio-demo.ts` dà il **titolare** a Ottica Aurora — cosa che il
seed SQL non può fare (`auth.users` è di GoTrue). Con la chiave di **servizio**
(letta dall'ambiente, **mai** scritta su file): crea l'utente auth (email
confermata) + la riga in `public.utenti` con ruolo `titolare`. **Idempotente**
(se l'utente esiste, lo dice e non fa nulla). In testa al file, a lettere chiare:
**solo sviluppo, mai importato dall'app**. Verificato: nessun `import` da
`app/`, `lib/`, `components/`.

## Coordinamento con G5

G5 chiedeva «un secondo negozio con brand chiaro». **Quel negozio è Ottica
Aurora**, non un terzo: G5 aveva aggiunto un `ottica-chiara` separato — qui è
stato **rimosso** e consolidato in Aurora (tre negozi demo = confusione).

## Limite noto — `moduli_attivi` oggi non produce effetti

I due negozi hanno `moduli_attivi` diversi, ma **oggi non si vede**: `lib/modules.ts`
ha ancora `attivo: true` scritto a mano e **non legge** quella colonna. Il
collegamento è una consegna successiva. Il dato c'è già così che, quando
accenderemo il meccanismo, la differenza si veda subito invece di doverla
costruire in quel momento. **Non è rotto: è a monte del suo interruttore.**

## Verifiche

- Seed: **due volte di fila** in dry-run transazionale → nessun errore, nessun
  duplicato (clienti/orari/servizi guardati da `not exists` / `on conflict`;
  brand e moduli di A cambiati solo se ancora al default).
- Script: idempotente per costruzione (cerca l'utente per email, salta se c'è).
- `tsc --noEmit` (che include `scripts/`): pulito · `npm run build`: verde ·
  `vitest run tests/unit`: **102 verdi** · `playwright --list`: il caso G5-bis
  colleziona.

## E2E

`e2e/g5bis-contrasto-testata.spec.ts` — un caso solo, quello che conta: due
negozi (uno scuro, uno chiaro) creati via service role, le due pagine aperte in
sequenza, l'h1 con `color: rgb(255,255,255)` sul primo e `rgb(23,21,18)` sul
secondo. La prova automatica che il contrasto funziona su **dati veri**, non solo
negli unit.

## Applicazione al DB

Come sempre: seed aggiornato + `scripts/crea-negozio-demo.ts` si applicano al DB
della preview **dopo il tuo OK**. La migrazione **010 (G5)** dev'essere applicata
prima (fornisce orari/servizi).

## Criterio di accettazione

Esistono due negozi veri: entrambi in vetrina, entrambi accessibili dal
gestionale, con due elenchi clienti separati e due insegne di colore opposto. In
G6 una prenotazione avrà un'agenda vera dove atterrare.
