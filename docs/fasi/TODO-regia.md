# TODO di regia (fuori-codice: decide/agisce Ray, la casa è una)

1. **Testo e versione dell'informativa privacy** — Ray + legale; poi
   diventa costante di piattaforma per release (M1 §10, Annot. 2).
2. **Travaso `tutore_legale` testo → relazioni vere** — assistito, in
   fase pulizie post-C0 (M1 §10, Annot. 3).
3. **Risposte da banco (ottici/collega)** alle domande dell'agente-
   manuali — le tre citate: i tre canali bastano? «Cellulare» copre
   chiamata E messaggio? la seconda firma SOSTITUISCE i canali o li
   somma? (le altre: in coda alla PR #35). Nessun impatto-codice
   finché non decise: raffinano copy e, al più, additive.
4. **Cinture dal dashboard** — default privileges di `supabase_admin`
   · secret `TEST_SUPABASE_DB_URL` in CI — **stasera (Ray)**.
   **Che cosa accende quel secret, al 11/08** (due rettifiche in tre
   giorni: la voce è stata sbagliata due volte, qui c'è lo stato buono).
   (a) I due test di `bonifica-020.test.ts`, che senza connessione
   Postgres DIRETTA skippano puliti: leggono il CATALOGO di sistema
   (grant e default privileges), che via API non si vede. Non è un
   rosso, è copertura che manca. (b) **E da PR #36 anche
   l'allineamento automatico del DB di test**: il passo «Allinea il DB
   di test al repo (migrazioni)» in `ci.yml` è condizionato a
   `if: env.TEST_SUPABASE_DB_URL != ''`. Con il secret la CI applica da
   sé le migrazioni prima del contratto, e la classe di rossi 125/126
   (repo avanti, DB indietro) si chiude alla radice.
   **Storia delle due rettifiche, perché non si ripeta**: il 06/08 qui
   c'era scritto che senza il secret «la CI non può applicarsi le
   migrazioni da sola» — affermazione giusta nella conclusione ma
   sbagliata nella causa, perché allora la CI non le applicava in
   nessun caso. Il 07/08 l'ho corretta dicendo che il secret «non
   c'entra con le migrazioni» — vero quel giorno, falso dall'11/08, da
   quando la #36 ha aggiunto il passo. Morale operativa: questa voce
   descrive un `ci.yml` che cambia, e va riletta CONTRO il file, non
   ricordata.
   Finché il secret manca resta la regola-toppa: **la migrazione si
   applica a mano al DB di test PRIMA di aspettarsi il verde**
   (`scripts/migra-cloud.sh test`, oppure
   `SUPABASE_DB_URL=… npm run db:applica-migrazioni`).
5. **021 in produzione** — dopo l'OK e il merge, SOLO dalla strada
   che registra. Il DB di **test** è invece già in pari al 06/08
   (`anonimizza_persone_del_cliente` + delega, applicate a mano).
6. **Una `persona` del portale vale per PIÙ negozi** — `persone` non ha
   `azienda_id` e la dedup sul telefono è globale: chi ha prenotato da
   due ottici è UNA riga sola. Da quando la parte-persone di C1
   funziona davvero (06/08), l'anonimizzazione chiesta dal negozio A
   sbianca nome/email/telefono anche per il negozio B, che quella
   prenotazione ce l'ha ancora. Prima non si vedeva solo perché
   l'UPDATE non passava. Le strade sono tre e sono da decidere, non da
   indovinare: (a) si sbianca comunque — la persona ha chiesto di
   sparire, e la richiesta è alla piattaforma; (b) si sbianca solo se
   NESSUN altro negozio ha prenotazioni vive con lei; (c) si scinde la
   riga per negozio, che è una migrazione e tocca la dedup. Ratificato
   in C1 come aperto; nessun codice si muove finché non è deciso.
   → **RISOLTA 05/08**: decisione in C1 (sgancio + anonimizza-se-orfana).
7. **Cancellazione lato-PIATTAFORMA su richiesta del soggetto** (la
   persona che vuole sparire ovunque): processo di regia col legale —
   futuro, fuori busta.
