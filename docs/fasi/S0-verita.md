# S0 · La verità — esiti della bonifica (Era 2)

*Prodotto dalla busta S0 il 05/08/2026. Le buste a valle si adattano
**solo qui**, non a metà corsa (piano §S0). Ogni riga è un fatto
verificato sul database reale o sul codice, con la prova a fianco.*

## 1 · Le due domande sui fatti

### `negozi_servizi.attivo` esiste? → **SÌ**
Colonna `boolean`, presente **in entrambi gli ambienti** (test e
produzione). Verificata su `information_schema.columns`.

> **Conseguenza per B6**: la voce «(`negozi_servizi.attivo` se S0 dice
> che manca)» del piano **decade**. B6 non deve aggiungerla. È già usata
> in produzione da `slot_liberi` e dalla vista `servizi_pubblici`
> (filtro `ns.attivo = true`).

### `ordini_lac` ha le righe per occhio? → **SÌ, ma dentro il jsonb**
`ordini_lac` **non ha colonne per-occhio**: le righe vivono nella
colonna `righe jsonb`, e ogni elemento porta la chiave **`occhio`**
(`'OD' | 'OS' | null`), scritta da `daPrescrizione`
(`components/WizardOrdineLac.tsx:143-154`).

Rilevazione sui dati di produzione: 4 ordini · 5 righe totali dentro i
jsonb · **2 righe con `occhio` valorizzato** (OD/OS). Chiavi presenti:
`descrizione, occhio, parametri, prezzo, prodotto_id, quantita`.

> **Conseguenza per B7** (copertura LAC ÷2): il dato **c'è e basta**,
> nessuna migrazione serve — ma la query di copertura deve **spacchettare
> il jsonb** (`jsonb_array_elements(righe)`) e non può leggere colonne
> piatte. Va scritto così nella busta B7. Attenzione al caso `occhio
> null` (riga non attribuita a un occhio): oggi 3 righe su 5 — la
> formula ÷2 non può assumere che ogni riga sia mono-occhio.

## 2 · Diagnosi del timeout «Da catalogo» (TODO §10)

**Ipotesi «pezzi mancanti»: SMENTITA.** Il percorso è completo nel
codice; nessun pezzo manca. Le prove, in `components/WizardOrdineLac.tsx`:

| Passaggio | Riga | Esito |
|---|---|---|
| La pagina passa il cliente pre-selezionato | `app/(app)/ordini/lac/nuovo/page.tsx:14-29` | ✓ risolto da `?cliente=` |
| Con cliente pre-selezionato il wizard **parte dal passo 2** | `:71` | ✓ |
| `righe` parte con **una riga vuota** | `:82` | ✓ (`righeValide` = false, corretto) |
| `daCatalogo` **scarta le righe vuote** e inserisce la riga di catalogo con `descrizione` valorizzata | `:162-176` | ✓ |
| `righeValide` diventa true (descrizione non vuota) | `:196` | ✓ |
| «Avanti» si abilita al passo 2 quando `righeValide` | `:430-438` | ✓ |
| Il passo 3 rende «Crea ordine» (`type=submit`) | `:439-447` | ✓ |
| La ricerca a catalogo filtra `tipo in ('lac','soluzione')` … | `:96-106` | ✓ … e il prodotto del test è creato con `tipo='lac'` (`e2e/fase2-magazzino.spec.ts:17`) |
| `Passi` rende `div`, non bottoni (nessuna ambiguità di selettore) | `:462-495` | ✓ |

**Quindi**: né UI mancante, né condizione di abilitazione impossibile,
né selettore ambiguo. **La causa NON è nel codice dell'applicazione per
quanto è ispezionabile staticamente.**

**Limite dichiarato**: la conferma definitiva richiede il **trace
Playwright su un run vivo** (app avviata + segreti del DB di test), che
S0 in questo ambiente non può produrre. Il sospetto residuo è
**test-side** (attesa/timing sul debounce di 250 ms della ricerca a
catalogo, `:94`) — ma è un sospetto, non un fatto, e come tale resta.

> **Chi lo chiude**: **B3 · Catalogo & Magazzino**, che rimette mano a
> quel wizard. Primo gesto della busta, PRIMA di rifattorizzare:
> togliere il `test.fixme` da `e2e/fase2-magazzino.spec.ts` S4, farlo
> girare in CI e **leggere il trace**. Se è codice, è una regressione da
> correggere (e la spec cresce, protocollo del bug); se è il test, si
> riscrive. Nessuna delle due cose si decide a memoria.

## 3 · Censimento dei `test.fixme` E2E → **5**

| File | Scenario | Perché è fermo | Chi lo chiude |
|---|---|---|---|
| `e2e/fase4-cassa.spec.ts` | **S3** consegna con caparra | modulo cassa non chiuso | **B5** |
| `e2e/fase4-cassa.spec.ts` | **S6** reso con causale | resi in rifacimento | **B5** |
| `e2e/fase4-cassa.spec.ts` | **S8** chiusura serale | liturgia di chiusura non definita | **B5** |
| `e2e/fase1-ordini-buste.spec.ts` | **S1** LAC dal banco, Rx→consegna | la consegna passa ora dalla cassa; la scelta ricetta dal modulo prescrizioni | **B2/B4/B5** |
| `e2e/fase2-magazzino.spec.ts` | **S4** ordine da catalogo → scarico | il timeout di §2 + la coda passa dalla cassa | **B3** (trace) |

Sono skip **espliciti** (non silenziosi): la CI li mostra come
«in attesa». I due `test.skip` presenti sono diversi — sono guardie
d'ambiente (`!process.env.TEST_SUPABASE_SERVICE_ROLE_KEY`), non debiti.

## 4 · Lo stato dei due ambienti (prima → dopo la 020)

| Rilievo | Prima (prod) | Prima (test) | Dopo la 020 |
|---|---|---|---|
| `_riparazioni_dati` RLS | **off** | **off** | **on**, senza policy |
| `_riparazioni_dati` grant | anon+authenticated **con DELETE** | idem | **nessuno** (solo service role) |
| Tabelle `public` con grant ad `anon` | **29** | **30** | **0** |
| Le 4 viste-portale leggibili da anon | 4 | 4 | **4** (VP-01, guardia in migrazione) |
| `anon` esegue le 3 funzioni-trigger | **sì** | **sì** | **no** |
| Policy `risorse` | **PUBLIC** | **PUBLIC** | **authenticated** |
| `_infra_migrazioni` | **assente** | fermo a **015** | **presente, 001→020** |

Il buco più concreto era il primo: `anon` poteva **cancellare** la riga
`019_fuso_appuntamenti_banco` da `_riparazioni_dati` e ri-armare così lo
slittamento di due ore degli appuntamenti presi al banco.

## 5 · Differenza rilevata dal rito (verbalizzata in PR)

La consegna §3 (c) dice «`revoke execute` da `anon` sulle tre funzioni
trigger». **Alla lettera non basta**: quelle funzioni hanno `EXECUTE`
concesso a **PUBLIC** (ACL `=X/postgres`) e `anon` lo **eredita**. Dopo
il solo `revoke … from anon`, `has_function_privilege('anon', …)` resta
**true** — misurato in dry-run: atteso 0, ottenuto 3.

Per ottenere ciò che la consegna **vuole** si revoca anche a `PUBLIC`;
`authenticated` e `service_role` conservano il loro grant **esplicito**
e non perdono nulla. Verificato in dry-run che i tre trigger
**continuano a scattare** (sala creata, sala assegnata, FK incrociata
respinta con `23514`): PostgreSQL non controlla `EXECUTE` quando un
trigger parte.

## 5-bis · ⚠️ DECISIONE PER RAY — la 020 è una fotografia, non un invariante

**Il fatto, misurato.** La 020 azzera i grant di `anon` sulle **30 tabelle
di oggi**. Ma Supabase ha *default privileges* che concedono **tutto** ad
`anon` su ogni tabella futura:

```
postgres → anon=arwdDxtm/postgres  ;  supabase_admin → anon=arwdDxtm/supabase_admin
```

Prova sul DB di test (in transazione, poi rollback): creata una tabella
nuova **dopo** la 020 → nasce con **7 grant ad `anon`** e
`has_table_privilege('anon', …, 'SELECT')` = **true**.

**Perché è urgente e non teorico.** La busta successiva, **B1, crea
cinque tabelle** (`consensi`, `clienti_relazioni`, `oculisti`,
`parametri`, `assicurazioni`). Con le default privileges così, **nascono
tutte leggibili da `anon`** — e l'igiene appena fatta si disfa alla PR
dopo. La RLS le proteggerebbe (come oggi), ma è esattamente la
«politica distratta dal buco» che S0 doveva chiudere.

**Cosa NON ho fatto, e perché.** Non ho toccato le default privileges:
è una decisione di piattaforma (vale per *ogni* oggetto futuro, anche
creato da altri strumenti), più larga del punto (b) della consegna.
Regola sovrana: non si colma un'ambiguità da soli.

**La correzione, pronta** (additiva, idempotente, due righe):

```sql
alter default privileges in schema public revoke all on tables from anon;
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon;
```

**Raccomandazione**: metterla **in testa a B1**, prima del DDL delle
cinque tabelle — così nascono già pulite e il test di contratto «anon
non legge le tabelle nuove» diventa un invariante, non una fotografia.
Serve il tuo via: è l'unico punto di S0 lasciato aperto di proposito.

## 5-ter · Altri limiti noti (dal collaudo cieco)

- **La guardia (f) della 020 controlla il *grant*, non la
  *leggibilità*.** `has_table_privilege` resterebbe true anche se una
  vista diventasse `security_invoker = true`: grant a posto, portale
  spento in silenzio. Coperto lato test: il contratto pretende **il
  dato** dalle quattro viste, e una guardia statica vieta
  `security_invoker = true`.
- **«`authenticated` conserva il grant esplicito»** sulle tre
  funzioni-trigger è vero *grazie alle default privileges di Supabase*,
  non grazie alla migrazione: assunzione sull'ambiente, innocua ma da
  sapere.
- **Ispezione del catalogo dai test**: PostgREST non espone `pg_catalog`
  nemmeno col service role. I due test che leggono
  `pg_class.relrowsecurity` e `has_function_privilege` usano una
  connessione Postgres diretta, **gated** su `TEST_SUPABASE_DB_URL`:
  senza quel segreto **skippano puliti** e il resto gira lo stesso. Se
  vuoi accenderli, aggiungi il segreto; l'alternativa è una RPC
  diagnostica `definer` (come `diag_normalizza_telefono` della 011).

## 6 · Baseline e strumenti

- **Catena migrazioni da zero**: `scripts/db-locale.sh` applica
  `schema.sql` + 002→**020** su un Postgres vergine — **20/20 OK**.
- **Mappa rigenerata**: `docs/mappa-db.md` → 30 tabelle, 21 funzioni,
  33 trigger.
- **Regole validate**: `grammatica-dati.json` allineata al db ✓. La 020
  introduce `_infra_migrazioni`, classificata **FATTO** («audit tecnico
  delle migrazioni applicate»), accanto al gemello `_riparazioni_dati`.
- **Migrazioni nel registro**: da ora la strada che registra è l'unica —
  `_infra_migrazioni` esiste in entrambi gli ambienti con 001→020.
