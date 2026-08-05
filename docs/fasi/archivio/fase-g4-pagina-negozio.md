# Fase G4 — Pagina pubblica del negozio

La prima pagina pubblica del progetto: `/ottica/[slug]`, dove atterra il QR della
vetrina. Un anonimo la apre e vede il negozio col suo nome e i suoi colori. **In
questa consegna non si prenota**: il motore (disponibilità/prenotazioni) arriva
in G6/G7 e si innesta nei punti già predisposti qui.

## Per chi rivede — cosa è stato fatto

Guscio pubblico: instradamento, apertura controllata al pubblico, marchio, dati
di vetrina, letti dal DB con la sola chiave anon. Nessun file del gestionale
toccato oltre ai tre punti concordati (`proxy.ts`, `tailwind.config.ts` in
aggiunta, i tipi in fondo a `database.types.ts`).

### Cosa NON è stato toccato (verificato)

- **Nessun token Tailwind esistente cambiato** — `carta`, `inchiostro`, `ottone`,
  `linea`, `soft`, `faint`, `verde/ambra/blu/rosso`: identici, valore per valore.
  Aggiunto solo lo spazio `lim` (colori Limpidia) e i due font `lim-display` /
  `lim-testo`. La guardia **G13c** lo verifica a ogni run.
- `app/(app)/**`, `app/(public)/**`, `app/(stampa)/**`, `app/layout.tsx`,
  `components/**` fuori da `components/portale/`, `lib/actions.ts`, `lib/utils.ts`,
  `supabase/migrazioni/**`: intatti. Nessuna migrazione nuova.

### La pagina funziona con la chiave ANON, senza service role

`lib/portale/negozio.ts` crea un client anonimo **stateless** (nessun cookie,
nessuna sessione) e legge **solo** la vista `negozi_pubblici`. Se la pagina
renderizza, DB-02 è dimostrata sul campo. Il service role non compare da nessuna
parte del portale.

### Sicurezza del brand (iniezione CSS)

`aziende.brand` è jsonb controllato dal tenant e i suoi valori finiscono in un
attributo `style` (il colore dell'intestazione). `lib/portale/brand.ts` accetta
**solo** `#RGB`/`#RRGGBB` con una regex stretta; ogni chiave non valida o mancante
ricade sul colore Limpidia. Il valore grezzo del DB non entra mai in `style`.
Coperto da `tests/unit/portale-brand.test.ts` (payload di iniezione inclusi).

## Cosa ho preso dal prototipo e cosa ho riscritto

| Dal prototipo | Esito |
|---|---|
| `PaginaNegozio` (layout, gerarchia) | Riscritto in Tailwind coi token `lim-*`, ridotto ai soli elementi disponibili in G4 (nome, tagline, logo, indirizzo, CTA inerte, firma) |
| `LogoLimpidia`, `SimboloLimpidia` | **Copiati** (eccezione autorizzata) in `components/portale/Marchio.tsx`; solo lo `style={{display:block}}` → `className` |
| `Icon` | Portato in `components/portale/Icone.tsx` (un file), colore su `currentColor` |
| `Btn`, `Tag`, `Card`, `Eyebrow` | Riscritti in Tailwind in `components/portale/primitivi.tsx`, presentazionali (nessun `onClick`) |
| `T` / `F` (token JS) | Diventati i colori `lim-*` e i font Gabarito/Figtree; **non** restano oggetti JS |
| `SERVIZI`, `CAPACITA`, `ASSICURAZIONI` | **Non entrati** — sono dati del negozio, verranno dal DB quando le tabelle esisteranno |
| `NEGOZI`, `GIORNI`, `ORARI`, `occupato()`, ecc. | **Mai** — finti |
| wizard, `Progresso`, `QRFinto`, `VistaOttico` | Non in G4 (sono G6/G7/G8) |
| stili inline `style={{…}}` | Nessuno entrato, tranne **l'unico colore dinamico validato** del brand (intestazione) |

## Le cuciture per il futuro (§8)

- **`modalita: "portale" | "sito_negozio"`** — oggi sempre `"portale"`. Il ramo
  `sito_negozio` sarà QUESTA stessa pagina con gli elementi dell'aggregatore
  spenti (oggi: la firma Limpidia in fondo). Il punto d'innesto esiste già.
- **CTA di prenotazione** — nella posizione definitiva ma **inerte** («Prenotazione
  in arrivo»), senza collegamento. Lo spazio che G6/G7 riempiranno.

## SEO / AI

- `app/(portale)/layout.tsx` sovrascrive `robots` a `index:true, follow:true`,
  ribaltando il `noindex` che il layout radice mette su tutta l'app (guardia
  **G13b**).
- La pagina emette `generateMetadata` (title = nome pubblico, description =
  tagline, canonical assoluto, OpenGraph) e un blocco **JSON-LD `Optician`** con
  nome, indirizzo e URL canonico (§9). Orari e servizi si aggiungeranno con le
  tabelle.

## Regole non negoziabili rispettate

- Slug inesistente o `portale_attivo=false` → **`notFound()`** (404 vera).
- **Nessun redirect** al sito dell'ottico.
- **Nessun componente client** (tutto server component).
- La firma `limpidia.it` è resa **monocromatica inchiostro**, mai in ambra:
  ospiti sul materiale del negozio.

## Le guardie (G13)

- **G13** — `ROTTE_PUBBLICHE` in `proxy.ts` è esattamente `[/login, /registrati,
  /auth, /ottica]`, e la vecchia catena di `||` non torna.
- **G13b** — portale `index:true`, radice `index:false`.
- **G13c** — token gestionale invariati (valore per valore) + spazio `lim` presente.

## I test

- **Unit**: `portale-brand.test.ts` (validazione brand / anti-iniezione) — 79
  unit verdi in tutto.
- **Contratto/E2E**: preparati dall'agente di test (anon legge solo la vetrina;
  `/ottica/<pubblicato>`→200 col nome, `/ottica/non-esiste`→404,
  `portale_attivo=false`→404, `/dashboard`→redirect `/login`).

## Verifiche

- `npx tsc --noEmit`: pulito · `npm run build`: verde (rotta `ƒ /ottica/[slug]`).
- `npm run test`: 79 unit verdi.

## Domande aperte / da decidere

1. **Pacchetto asset del marchio (`public/marchio/**`).** La consegna chiedeva di
   copiare gli SVG/PNG del pacchetto marchio, ma **non erano nell'allegato**
   (che è solo il `.tsx` col marchio reso inline). Il marchio è quindi reso
   **inline via SVG** in `Marchio.tsx` — identico alla resa del prototipo, e la
   pagina mostra il logotipo senza file esterni. Se serve la cartella
   `public/marchio/` (per favicon, OpenGraph image, download), passami il
   pacchetto e la aggiungo.
2. **Preview + negozio demo nel DB.** Il seed contiene il negozio `ottica-demo`
   (idempotente), ma perché la **preview** mostri `/ottica/ottica-demo` quel
   negozio deve esistere nel database a cui punta la preview. Come per le
   migrazioni: lo inserisco al tuo OK (una `insert … on conflict do nothing`).
3. **Contrasto dell'intestazione.** Il testo è bianco su `brand.primary`: se un
   negozio scegliesse un primary chiaro, la leggibilità calerebbe. Gestione del
   contrasto (auto-scelta bianco/nero) rimandata — nessuna regola concordata ora.
4. **Telefono in vetrina.** Resta fuori dalla vista `negozi_pubblici` (decisione
   della 008): la pagina non lo mostra. Invariato.

## Criterio di accettazione

Un anonimo apre `/ottica/ottica-demo` dal telefono e vede un negozio col suo nome
e i suoi colori; uno slug sbagliato dà 404; il gestionale resta chiuso; nessun
token, font o colore del gestionale è cambiato.
