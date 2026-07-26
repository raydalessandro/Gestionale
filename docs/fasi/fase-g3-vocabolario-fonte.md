# Fase G3 — Vocabolario `fonte` nel codice

Chiusura del gap lasciato aperto dalla 008 (punto B.5): allineare il **codice**
al vocabolario `fonte` allargato dal DB. **Solo TypeScript**: nessuna migrazione,
nessuna tabella, nessuna rotta. **Nessun file in `app/` né in `supabase/` è
toccato.** Diff confinato a 6 file: 5 di codice + le guardie.

## Per chi rivede — cosa abbiamo cambiato rispetto alla consegna G3, e perché

Sintesi per il revisore (che ha scritto la consegna): in un colpo d'occhio, gli
scostamenti dalla lettera e le decisioni prese. Il dettaglio è nelle sezioni sotto.

**A · Una sola deviazione tecnica necessaria (semantica invariata)**

1. **`ETICHETTE_FONTE` tipata con un'intersezione, non con `Record<Fonte, string>`
   liscio.** La consegna chiedeva `Record<Fonte, string>`. Applicandolo, `tsc`
   rompe **un consumatore in `app/`** che la indicizza con una `fonte` grezza:
   `app/(app)/ordini/page.tsx` ha un view-model locale `RigaLista` con
   `fonte: string` e fa `ETICHETTE_FONTE[o.fonte] ?? o.fonte` (pattern
   tollerante). Con la chiave ristretta a `Fonte`, `string` non può più
   indicizzare (`TS7053`). La consegna vieta di toccare `app/`. Soluzione che
   tiene entrambe le cose:
   ```ts
   Record<Fonte, string> & Record<string, string>
   ```
   L'intersezione **impone tutte le chiavi di `Fonte`** (togline una e non
   compila — è la garanzia che volevamo) e insieme **tollera l'indice `string`**,
   così i consumatori in `app/` restano intatti. Completezza a compile-time
   dimostrata sotto ("Prova di rottura").

**B · Punti aperti chiusi da questa consegna**

2. **Gap `'sito'` della 008 (punto B.5) — chiuso.** G3 è il merge immediatamente
   successivo alla 008, come previsto dalla condizione della sua review: quindi
   **non** è stato necessario rimettere `'sito'` nel check. Da qui in poi scegliere
   la fonte non produce più l'errore di check: le sole fonti scegliibili a mano
   sono quelle del check DB.
3. **Fonti di sistema non retrocedono.** Nel form, se si modifica un cliente la cui
   `fonte` è assegnata dal sistema (`portale`, `qr_vetrina`, `sito_negozio`), la
   fonte è mostrata **in sola lettura** e rimandata invariata con un campo
   nascosto: non deve poter tornare a `banco` per il solo fatto di aprire la
   scheda. Il select propone **solo** `FONTI_MANUALI` (`banco, convenzione,
   import`).

## Cosa cambia, file per file

Unica fonte di verità: **`lib/database.types.ts`**.

- **`lib/database.types.ts`** — introdotti `FONTI` (array `as const`, stesso
  ordine del check SQL della 008), `type Fonte = (typeof FONTI)[number]` e
  `FONTI_MANUALI` (le sole fonti scegliibili a mano). Il vecchio union scritto a
  mano sparisce; `ClienteRow.fonte` diventa `Fonte`. Le righe ordini
  (`OrdineLacRow.fonte`, `OrdineOcchialiRow.fonte`) restano `Exclude<Fonte,
  "import">` e si **aggiornano da sole** (derivate — non toccate).
- **`lib/actions.ts`** — l'unione inline `| "banco" | "sito" | …` diventa
  `as Fonte`, importando il tipo. Nient'altro nella funzione.
- **`lib/utils.ts`** — `ETICHETTE_FONTE` passa da `Record<string, string>` (con
  `sito`) al vocabolario nuovo, tipata con l'intersezione del punto A.1.
- **`components/ui.tsx`** — `tintaFonte` non è più uno `switch` con `'sito'`: una
  mappa interna `Record<Fonte, …>` (completezza imposta) con input `string`
  tollerante (`?? "neutro"`).
- **`components/ClienteForm.tsx`** — il select genera le opzioni da
  `FONTI_MANUALI` con le etichette di `ETICHETTE_FONTE`; ramo di sola lettura +
  campo nascosto per le fonti di sistema (punto B.3).

## Guardie aggiunte (`tests/unit/guardie.test.ts`)

Legano i tre posti che devono combaciare (check SQL ↔ `FONTI` ↔ mappe derivate):

- **G12** — `FONTI` (codice) combacia col check SQL di `clienti_fonte_check` e
  `appuntamenti_fonte_check` estratto dalla 008, **ordine compreso**; e `'sito'`
  non è più fra le fonti.
- **G12b** — `Object.keys(ETICHETTE_FONTE)` è **esattamente** `FONTI` (nessuna in
  più, nessuna in meno) e nessuna etichetta è vuota. Confronta i valori
  importati, non legge file: scatta anche su un refuso di chiave.
- **G12c** — `FONTI_MANUALI ⊂ FONTI` e **non** contiene le fonti di sistema
  (`qr_vetrina, sito_negozio, portale, app`).

## Censimento — riferimenti trovati oltre ai 5 punti

Per trasparenza, cosa il censimento ha trovato e **perché non è stato toccato**:

- **Righe derivate** `OrdineLacRow.fonte` / `OrdineOcchialiRow.fonte`
  (`Exclude<Fonte, "import">`): si aggiornano da sole cambiando `Fonte`. Corrette
  per costruzione, nessuna modifica.
- **Consumatori in `app/`** che leggono le mappe in modo tollerante
  (`ETICHETTE_FONTE[x] ?? x`, `tintaFonte(x)`): fuori ambito, non toccati. È
  proprio questo pattern che ha richiesto la deviazione A.1.
- **Divergenza nota, fuori ambito: il check DB degli _ordini_.** Il tipo TS delle
  righe ordini è `Exclude<Fonte, "import">` (7 − 1 = 6 valori), ma il **check SQL
  sugli ordini** in DB elenca ancora il vecchio insieme (`banco, sito, app,
  convenzione`). Non è compito di G3 (che tocca solo `clienti`/`appuntamenti`, e
  solo codice). **Segnalato**: gli ordini oggi non ricevono comunque valori nuovi
  (le server action impostano `fonte: "banco"`), quindi il gap è latente. Andrà
  chiuso in una migrazione dedicata quando gli ordini erediteranno la fonte del
  cliente.

## Verifica

- **`tsc --noEmit`**: pulito.
- **`npm run build`**: verde (tutte le rotte compilate).
- **Unit + guardie** (`vitest run tests/unit`): **63 verdi** (erano 60; +3 per
  G12/G12b/G12c).
- **Prova di rottura (completezza a compile-time).** Rimossa a mano la chiave
  `qr_vetrina` da `ETICHETTE_FONTE`: `tsc` fallisce con
  *«Property 'qr_vetrina' is missing … but required in type Record<…>»*.
  Ripristinata la chiave, `tsc` torna pulito. La garanzia «aggiungi una fonte e
  scordi la mappa → non compila» è reale, non promessa.

## Cosa resta aperto

- **Check DB degli ordini** allineato a `Exclude<Fonte, "import">`: migrazione
  futura (vedi censimento). Latente finché gli ordini non ereditano la fonte.
- **Verifica visiva del portale**: le fonti di sistema (`portale`, `qr_vetrina`,
  `sito_negozio`) esistono nel vocabolario ma nessuna porta le scrive ancora —
  arriveranno con le tabelle del portale.
