# Fase G5 — Orari, servizi e leggibilità della testata

La pagina negozio ora dice anche **quando è aperto e cosa fa** — le due domande
per cui una persona apre la pagina dopo aver inquadrato un QR alle nove di sera.
È anche la consegna che prepara il terreno alla prenotazione (G6): senza orari e
senza servizi con una durata, il calcolo degli slot non esiste.

**Fuori ambito, di proposito:** `slot_liberi()` (deve sottrarre le prenotazioni,
e la tabella `prenotazioni` non esiste ancora → G6) e il vocabolario `capacita`.

## Per chi rivede — le richieste della consegna

### 1 · URL di preview dei due negozi

- **`/ottica/ottica-demo`** — insegna **scura** (`primary #1F5C56`): orari con
  pausa pranzo (Lun–Ven), Sab ridotto, Dom chiuso; una chiusura futura per ferie;
  tre servizi. Testo testata **bianco**.
- **`/ottica/ottica-chiara`** — insegna **chiara** (`primary #F0E4CE`): prova del
  contrasto. Testo testata **scuro** (inchiostro). Orario continuato, due servizi.

Come per G4/le migrazioni: la 010 e il seed si applicano al DB della preview
**dopo il tuo OK** (una `apply_migration` + il blocco seed, entrambi idempotenti).

### 2 · `anon` non ha `select` diretta sulle tabelle nuove

La 010 fa, per **ognuna** delle cinque tabelle create (`servizi`,
`negozi_servizi`, `orari_apertura`, `chiusure`, `blocchi_slot`): `enable row
level security`, policy per `authenticated` sul proprio tenant, e **`revoke
select … from anon` esplicito** (Supabase concede select ad anon di default sulle
tabelle nuove — è la trappola da non dimenticare). Verificato su DB (dry-run
transazionale): `anon` ha select su **nessuna** delle cinque, e su **tutte e tre**
le viste pubbliche. Le guardie **G14/G14b** lo sorvegliano staticamente.

### 3 · Fuso orario, in una riga

Ogni confronto e ogni formattazione oraria del portale passa da
`lib/portale/orari.ts`, che àncora tutto a **`Europe/Rome`** esplicito (giorno,
minuti e data di «adesso» estratti con `Intl` su quel fuso); nessun `new Date()`
nudo confrontato con un orario di apertura.

### 4 · TODO sul fuso preesistente

`lib/utils.ts` formatta **senza `timeZone`** (eredita UTC su Vercel): difetto
preesistente che tocca anche l'agenda del gestionale. **Non risolto qui** (fuori
ambito); segnato in `docs/agenti/TODO-ray.md` §6 come **da chiudere prima di
stampare qualcosa con delle date** (buste, quietanze, agenda). Il portale ha la
sua gestione del fuso ed è al sicuro.

## La migrazione 010, blocco per blocco

- **Catalogo servizi GLOBALE.** `servizi` (senza `azienda_id`) è il vocabolario
  NOSTRO; `negozi_servizi` è quali voci accende ogni negozio, con durata in deroga
  facoltativa. Il motivo: domani il portale farà cercare «chi fa il controllo
  della vista vicino a me» — se ogni negozio scrivesse il nome come gli pare,
  quella ricerca sarebbe spazzatura. Esattamente come `moduli_attivi`.
- **Orari: una riga per FASCIA, non per giorno.** La pausa pranzo sono due righe.
  È l'unico modo per reggere «giovedì continuato, sabato solo mattina» senza
  aggiungere colonne. Vincolo `chiude > apre`.
- **Tre cose diverse di proposito:** `orari_apertura` (settimana tipo),
  `chiusure` (periodo: ferie/festività, `al >= dal`), `blocchi_slot` (il buco
  singolo, istanti assoluti). Fonderle non regge il primo caso reale.
- **Sicurezza:** RLS + policy tenant + revoke anon su tutte; nessun trigger di
  coerenza tenant (nessuna FK verso tabelle con `azienda_id`: puntano solo ad
  `aziende` e al catalogo globale). L'anon legge **solo** le tre viste, filtrate
  su `portale_attivo=true`. `chiusure_pubbliche` **non** espone `motivo` (fatto
  interno del negozio). `blocchi_slot` **non ha vista pubblica**: i buchi non si
  mostrano, si sottrarranno solo in `slot_liberi()` (G6).

## La pagina

- **Orari «da persona»:** i giorni con le stesse fasce si raggruppano —
  «Lun–Ven 9:00–13:00 · 15:00–19:30», «Sab 9:00–12:30», «Dom chiuso». Se una
  chiusura copre oggi: «Chiuso per ferie fino al 22 agosto».
- **Aperto ora / Chiuso**, calcolato in ora italiana tenendo conto delle ferie.
  La pagina è **`export const dynamic = "force-dynamic"`** (con commento): una
  pagina statica congelerebbe l'indicatore alla build. La strategia di cache si
  rivedrà col traffico; oggi vale la correttezza.
- **Servizi** attivi con durata, nell'ordine del catalogo. Nessun prezzo. Il CTA
  di prenotazione resta **inerte** (G6/G7).
- **Testata a contrasto (aritmetica, non estetica):** `testoSuFondo(brand.primary)`
  sceglie inchiostro o bianco per il rapporto di contrasto WCAG più alto; il colore
  scelto guida anche il bordo del tondo del logo e le sfumature (tagline). Formula
  standard: canali normalizzati, correzione gamma, `0.2126R+0.7152G+0.0722B`,
  rapporto `(L1+0.05)/(L2+0.05)`.
- **JSON-LD** completato: `openingHoursSpecification` dagli orari veri e
  `hasOfferCatalog` dai servizi. Le chiusure straordinarie **non** entrano.

## Verifiche

- Migrazione 010 + seed: **dry-run transazionale** sul DB (BEGIN…ROLLBACK, non
  persistito) → tutto creato, `anon` revocato sulle 5 tabelle e ammesso sulle 3
  viste, `motivo` assente da `chiusure_pubbliche`; le viste restituiscono i dati
  attesi per i due negozi demo (11 orari/3 servizi/1 chiusura per demo; 6 orari/2
  servizi per chiara). Idempotente per costruzione (`if not exists` / `on
  conflict` / `create or replace`).
- `tsc --noEmit`: pulito · `npm run build`: verde (rotta `ƒ /ottica/[slug]`,
  force-dynamic) · `vitest run tests/unit`: **102 verdi** (orari + contrasto
  inclusi).

## Le guardie e i test

- **Unit** (miei): `portale-orari.test.ts` (raggruppamento: una fascia, pausa,
  giorno chiuso, tutti uguali; «aperto ora» ai confini di apertura/chiusura e
  durante le ferie) e `portale-brand.test.ts` esteso (luminanza/contrasto/
  `testoSuFondo`: nero→bianco, bianco→inchiostro, beige→inchiostro, ≥3 casi con
  rapporto > 4,5:1).
- **Guardie statiche:** **G14** (le 5 tabelle nuove hanno RLS + revoke anon;
  `blocchi_slot` senza vista pubblica), **G14b** (`chiusure_pubbliche` non espone
  `motivo`).
- **Contratto/E2E:** preparati dall'agente di test (anon legge le 3 viste solo
  per i pubblicati, non le tabelle sottostanti; la pagina mostra orari raggruppati
  e servizi; il negozio a brand chiaro ha la testata col testo scuro).

## Nota per la CI

Perché contratto ed E2E girino davvero, la migrazione **010 va applicata anche al
progetto Supabase di test** (come schema+migrazioni precedenti). Vedi
`docs/agenti/TODO-ray.md`.

## Criterio di accettazione

Una persona apre la pagina alle nove di sera, vede se il negozio è aperto adesso,
quando riapre e cosa ci può fare — e la vede leggibile qualunque sia il colore
dell'insegna.
