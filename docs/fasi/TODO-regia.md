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
   · secret `TEST_SUPABASE_DB_URL` in CI. **Il secondo non è più
   facoltativo, ed è misurato**: nel job «L2 contratto» di CI 125
   `TEST_SUPABASE_DB_URL` è **vuoto** (URL e chiavi ci sono, l'accesso
   diretto al database no). Conseguenza pratica: la CI **non può
   applicarsi le migrazioni da sola**, quindi ogni volta che una
   migrazione cambia, L2 resta rosso finché qualcuno non la applica a
   mano al progetto di test — e il rosso somiglia a un difetto del
   codice, mentre è disallineamento fra repo e DB (successo due volte
   in un giorno). Finché il secret manca, la regola è: **la migrazione
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
