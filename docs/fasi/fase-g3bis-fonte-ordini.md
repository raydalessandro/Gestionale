# Fase G3-bis — Vocabolario `fonte` sugli ordini

Chiude il disallineamento lasciato dalla G2: il vocabolario `fonte` vive in
**quattro** colonne, non due. La G2 ha allineato `clienti.fonte` e creato
`appuntamenti.fonte`, ma `ordini_lac.fonte` e `ordini_occhiali.fonte` erano
rimaste al vecchio check `('banco','sito','app','convenzione')`. Consegna
piccola: una migrazione additiva, due righe di tipo, una riga di tolleranza, due
guardie. **Non tocca** `app/**`, `schema.sql`, la 008, né il resto di
`lib/actions.ts`.

## Per chi rivede — cosa abbiamo fatto e perché

**Il difetto era reale, non cosmetico.** Il tipo `OrdineLacRow.fonte` era
`Exclude<Fonte,"import">` (ammette `qr_vetrina/sito_negozio/portale`) mentre il
DB li rifiutava; e il DB ammetteva `'sito'`, che il tipo e la 008 avevano
ritirato. Appena il portale toccherà gli ordini, sbatteva qui.

**A · Migrazione 009 — additiva e idempotente (come la 008)**

- Nuovo check per le due colonne ordini: `banco, app, convenzione, qr_vetrina,
  sito_negozio, portale` — cioè **esattamente** `Exclude<Fonte,"import">`. Gli
  ordini non si importano: quell'esclusione era già l'intenzione dei tipi, ora
  il DB la raggiunge.
- **Backfill con semantica diversa dalla 008.** Nella 008 `clienti.fonte='sito'`
  → `'banco'` (prima acquisizione ignota). Qui no: il commento dello schema dice
  che questi ordini arrivano dal **sito pubblico del negozio**, quindi la
  mappatura onesta è **`'sito' → 'sito_negozio'`**. Backfill **prima** del check.
- **Righe interessate (conteggio richiesto).** Sul DB demo (progetto
  `uijfhhctrgirglmkrgoo`), al momento della consegna: **0 righe** con
  `fonte='sito'` in `ordini_lac` e **0** in `ordini_occhiali`. (Distribuzione
  attuale: `ordini_lac` = 3 `banco` + 1 `app`; `ordini_occhiali` = 7 `banco`.)
  Se in un DB reale se ne trovassero, il numero va aggiornato qui.

**B · Tipi — un nome per la cosa**

`Exclude<Fonte,"import">` compariva due volte anonimo. Ora è
`export type FonteOrdine = Exclude<Fonte,"import">;`, agganciabile dalle guardie
e leggibile. Le due righe delle righe ordini diventano `fonte: FonteOrdine`.

**C · L'etichetta che mentiva sul tipo**

`ETICHETTE_FONTE` era `Record<Fonte,string> & Record<string,string>`:
l'intersezione fa bene la completezza, ma **mentiva sulle chiavi sconosciute** —
`ETICHETTE_FONTE["sito"]` era tipizzato `string` mentre a runtime è `undefined`
(lo asserisce il nostro stesso test). I sei consumatori in `app/` sono salvi solo
grazie al `?? x`, che così TypeScript considerava **codice morto**: il primo che
"ripulisce" quel `??` introdurrebbe un bug invisibile al compilatore.

Correzione, una riga: il secondo membro diventa `Record<string, string |
undefined>`. Tutti e sei i punti in `app/` usano già `[x] ?? x`, quindi
`string | undefined` si risolve in `string` e **nessun file `app/` va toccato**.
L'unico punto interno da sistemare era `components/ClienteForm.tsx` (ramo di sola
lettura della fonte di sistema), dove ho aggiunto `?? cliente.fonte` — il
comportamento giusto anche per una riga storica fuori vocabolario. La completezza
non si è persa nel cambio di tipo: togliere una chiave a `ETICHETTE_FONTE` **non
compila** ancora (verificato).

**D · Guardie — la vera lezione**

- **G12d** — il check SQL di `ordini_lac.fonte` e `ordini_occhiali.fonte` nella
  009 coincide con `FONTI` meno `import`.
- **G12e** — sentinella sul **conto delle colonne**. Scandaglia `schema.sql` +
  tutte le migrazioni, trova ogni `check (fonte in (...))`, ne ricava la tabella
  e verifica che l'insieme trovato sia **esattamente** quello guardato
  (`clienti, appuntamenti, ordini_lac, ordini_occhiali`). Una **quinta** colonna
  `fonte` senza guardia allarga l'insieme → rosso. Il conto delle colonne non
  vive più nella memoria di qualcuno.

## Verifiche

- **Migrazione due volte di fila**: dry-run transazionale sul DB demo
  (`begin … rollback`, non persistito) → nessun errore; i nuovi check risultano
  in vigore. Idempotente per costruzione (`drop constraint if exists` prima di
  ogni `add`).
- **`tsc --noEmit`**: pulito · **`npm run build`**: verde ·
  **`vitest run tests/unit`**: **71 verdi** (69 → +2 per G12d/G12e).
- **Conteggio `fonte='sito'` negli ordini**: 0 + 0 (sopra).
- **Prova di rottura**: rimossa `qr_vetrina` da `ETICHETTE_FONTE` → `tsc` fallisce
  *«Property 'qr_vetrina' is missing … but required»* anche col nuovo tipo
  `string | undefined`; ripristinata, torna pulito.

## Criterio di accettazione — raggiunto

Le quattro colonne `fonte` del DB parlano la stessa lingua dei tipi
(clienti/appuntamenti = `FONTI`; ordini = `FONTI` ∖ `import`), e G12e si accorge
da sola se domani ne nasce una quinta.

## Nota di sequenza

Consegna **stacked** su G3 (PR #12), non ancora mergiata: `FonteOrdine` e il tipo
di `ETICHETTE_FONTE` vivono su `gest/vocabolario-fonte`. Questo branch parte da
lì; quando G3 entra in `main`, la PR di G3-bis mostrerà da sola solo il proprio
diff. La 009 si applica al DB **dopo** la revisione (come la 008).
