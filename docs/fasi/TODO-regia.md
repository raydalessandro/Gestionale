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
   ⚠️ **Rettifica 07/08**: prima qui era scritto che senza quel secret
   «la CI non può applicarsi le migrazioni da sola». È FALSO, ed è un
   errore mio: la CI non applica migrazioni **in nessun caso**, né con
   né senza il secret — nel job «L2 contratto» non esiste alcun passo
   che lo faccia. Le migrazioni si applicano SOLO a mano, con
   `npm run db:applica-migrazioni` (idempotente, tiene
   `_infra_migrazioni`, salta il già fatto, si ferma alla prima che
   fallisce). Il secret serve a un'altra cosa: è la connessione
   Postgres DIRETTA che i due test di `bonifica-020.test.ts` usano per
   leggere il CATALOGO di sistema (grant e default privileges, che via
   API non si vedono). Senza, quei due skippano puliti — non è un
   rosso, è copertura che manca.
   Resta vero, e misurato due volte in un giorno, che
   **quando la migrazione cambia L2 va rosso** finché non la si applica
   al progetto di test, e che quel rosso somiglia a un difetto del
   codice mentre è disallineamento fra repo e DB. Ma la causa non è il
   secret: è che il passo di applicazione non è automatizzato. La
   regola operativa non cambia: **la migrazione
   si applica al DB di test PRIMA di aspettarsi il verde**.
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
