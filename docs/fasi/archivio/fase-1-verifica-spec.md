# Fase 1 — Verifica della spec (pre-codifica)

Verifica della specifica `fase-1-ordini-buste.md` incrociata con lo stato reale
del repo **prima** di scrivere codice, per non accumulare debito. Confronto fatto
su: `supabase/schema.sql` (001), `supabase/migrazioni/002_ordini_buste.sql`,
`lib/database.types.ts`, `lib/utils.ts`, `lib/actions.ts`, `components/ui.tsx`,
`components/PrescrizioneCard.tsx`, `components/Sidebar.tsx`, `lib/modules.ts`.

## Verdetto

La spec è **coerente e implementabile**. Dominio, macchina a stati, vocabolario
stati, `tipo_lavoro`, numerazione via rpc e ordinamento pipeline combaciano 1:1
con DB e utils. **Nessuna** modifica necessaria a 001/002.

Il debito reale è concentrato in **3 punti nel layer dei tipi TS** — che la spec
§0 dà per "già allineati" ma non lo sono — più alcuni chiarimenti doc-level. I 3
fix ai tipi rientrano nei "bug evidenti" che §0 stesso autorizza a correggere.

---

## 🔴 Blocker — tipi da sistemare prima di codare

Contraddicono §0 ("`lib/database.types.ts` … sono già allineati"). Senza questi
fix il codice tipizzato non compila o legge campi `undefined`.

### B1 · `OrdineLacRow` manca `avvisato_il`
- 002 (righe 84-85) aggiunge `avvisato_il timestamptz` a `ordini_lac`.
- `OrdineLacRow` (`database.types.ts` 142-158) **non ha** `avvisato_il`.
- La spec lo usa in §2.3 ("Segna avvisato" in `arrivato`), §3.2 (contatore
  `arrivato && avvisato_il is null`), §3.5, §4 (`eventoOrdineLac` evento `avvisa`).
- Con client tipizzato: `.update({ avvisato_il })` e le `.select()` che leggono
  il campo danno errore TS / valore assente.
- **Fix**: aggiungere `avvisato_il: string | null` a `OrdineLacRow`.

### B2 · `PrescrizioneRow` manca `attiva`
- 002 (righe 28-29) aggiunge `attiva boolean not null default true`.
- `PrescrizioneRow` (78-107) **non ha** `attiva`.
- `rxValida(p)` (`utils.ts` 119-128) **richiede** `p.attiva`; la spec §2.8 filtra
  le Rx valide con `attiva && !scaduta` via `rxValida`.
- Il selettore Rx del wizard deve `select` anche `attiva`: senza il campo nel
  tipo, o non compila o tutte le Rx risultano "non valide".
- **Fix**: aggiungere `attiva: boolean` a `PrescrizioneRow`.
- Nota collaterale: `creaPrescrizione` (`actions.ts`) non imposta `attiva` — va
  bene, il `default true` del DB copre. La disattivazione (Rx superata) sarà UI
  di una fase successiva, non serve ora.

---

## 🟠 Trappola runtime ad alto rischio

### P1 · `ordini_occhiali.saldo` è colonna GENERATA, ma i tipi la fanno insertabile
- schema.sql: `saldo numeric(10,2) generated always as (totale - acconto) stored`.
- `Ins<OrdineOcchialiRow>` esclude solo `id/created_at/updated_at` → `saldo`
  risulta passabile in insert/update.
- Se `creaBusta` (o qualunque update) invia `saldo`, Postgres risponde
  `cannot insert a non-DEFAULT value into column "saldo"`.
- La spec §4 dice "totale server-side" ma **non** dice esplicitamente "non
  scrivere `saldo`".
- **Regola da fissare**: la action scrive **solo** `totale` e `acconto`; `saldo`
  si **legge** per il display, non si scrive mai. Vale anche per `conferma`
  (aggiorna `acconto` → `saldo` si ricalcola da solo). Punto a favore: non
  esistono percorsi in cui vada toccato.

---

## 🟡 Ambiguità da chiarire (non bloccanti)

### M1 · "Riusare la formattazione di `PrescrizioneCard`" (§2.8, §3.5)
`PrescrizioneCard` è un `export default` che rende una **Card intera** su
`{ p: PrescrizioneRow }`, non una "riga mono compatta". La formattazione
riutilizzabile vera è `fmtRefrazione` / `fmtDiottria` in `utils.ts`. La riga mono
va costruita ex-novo (eventualmente estratta in un sub-componente condiviso). Da
leggere come "riusa `fmtRefrazione`", non il componente.

### M2 · Primitive UI mancanti vs "UI solo da `components/ui.tsx`" (§0)
`ui.tsx` offre: `Card`, `PageHeader`, `Button` (varianti `primary`/`accent`/
`ghost` ✅), `ButtonLink`, `Field`, `inputCls`, `Errore`, `Badge`, `tintaFonte`,
`Vuoto`. **Non** esistono: segmented/tabs, chips stato, radio-card `tipo_lavoro`,
stepper wizard, griglia righe/centratura. §9 **consente** nuovi componenti sotto
`components/**`, quindi non è un blocco: il vincolo §0 va letto come "token e
primitive esistenti + nuovi componenti ordini coerenti". Il "segmented" si imita
da `PrescrizioneForm` (riferimento già citato in spec).

### M3 · Pill di stato con colori arbitrari (§3.2)
Il componente `Badge` accetta solo `tinta` da un set fisso
(verde/ambra/blu/rosso/neutro/ottone), non hex. I colori stato stanno come
`bg`/`fg` **hex** in `STATI_LAC`/`STATI_BUSTA`. → La pill di stato va resa con
`style={{ background, color }}` inline (non con `Badge`). Coerente con la spec,
solo da esplicitare per non forzare un mapping hex→tinta.

---

## 🟢 Note minori / conferme

- **L1** · `utils.ts` `generaNumero()` (49-53) è **legacy** e contraddice §2.1
  (numeri sempre da rpc, mai in JS). Non è un bug ma una trappola: **non usarlo**.
- **L2** · `modules.ts` ha `nota: "v0.2"` su `ordini`. La Sidebar mostra `nota`
  **solo** quando `!attivo` (`Sidebar.tsx:52`): con `attivo:true` è innocua.
  §3.1 dice "attivo: true. Nient'altro." → basta il flip, la nota resta muta.
- **L3** · `laboratorio` (busta) è mostrato in scheda/stampa (§3.5/§3.6) ma
  **nessuno step** del wizard (§3.4) lo raccoglie. In fase 1 resterà sempre
  vuoto. Da decidere: accettabile vuoto, oppure aggiungere un input (dove? step 4
  o riepilogo). **Domanda aperta per te.**
- **L4** · `caparra_incamerata_il` citato nella cronologia (§3.5) è concetto di
  fase 4 (§1 "Fuori"). In fase 1 non sarà mai valorizzato → riga cronologia
  sempre assente (display condizionale). Innocuo.
- **L5** · **Vocabolario stati: allineato ✅.** `STATI_LAC`/`STATI_BUSTA`
  combaciano 1:1 con i CHECK di 001+002; tutte le transizioni §2.3/§2.4 sono
  rappresentabili; `tipo_lavoro` combacia. Nessun enum fuori posto.
- **L6** · `rpc('prossimo_numero')` ✅ race-safe, `security definer`, richiede
  `authenticated` + `get_azienda_id()`, solleva `NON_AUTENTICATO` /
  `PREFISSO_NON_VALIDO`. La action deve gestire l'errore rpc. Formato
  `BL-YYYY-####` / `OL-YYYY-####` combacia con §2.1.
- **L7** · Trigger `updated_at` presenti su entrambe le tabelle
  (`trg_ordini_lac_updated`, `trg_buste_updated`): l'ordinamento pipeline
  `updated_at desc` + `fmtQuando` funziona senza toccare `updated_at` a mano. ✅
- **L8** · `totale` (busta e LAC) è colonna **normale** con default 0: il server
  la calcola e la scrive (§2.10 / §2.9). `acconto ≤ totale` (§2.10) **non** ha
  vincolo DB → va imposto nella action. `fonte` esclude `'import'` in tipi e
  CHECK ✅.
- **L9** · Pattern action confermato (`getUser` → `utenti.select(azienda_id)` →
  insert con `azienda_id`, ritorno `{ errore } | null`, `revalidatePath` +
  `redirect`): le action ordini seguono lo stesso stampo di `creaCliente`/
  `creaPrescrizione`.

---

## Cosa serve da te prima dell'implementazione

1. **OK a patchare i tipi** `OrdineLacRow.avvisato_il` e `PrescrizioneRow.attiva`
   (B1/B2) — sono i "bug evidenti" ammessi da §0, ma tocco `database.types.ts`.
2. **`laboratorio` (L3)**: lo lascio sempre vuoto in fase 1 o aggiungo un campo
   al wizard? (dove?)
3. Conferma che l'implementazione vera parte **dopo** questo report (scope: prima
   verifica, poi codifica).

Il collaudo §8 (scenari S1–S8) resta **manuale, a carico degli ottici** su dati
veri dopo il deploy: non è eseguibile in questo ambiente. Lato mio garantisco i
criteri §7 (build verde, transizioni difese anche server-side, numeri solo da
rpc, ecc.).
