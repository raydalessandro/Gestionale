# Fase 4b — Anagrafiche complete (dalla 006) · Specifica di codifica

Interfase chirurgica: i FORM si allineano alle voci della migrazione 006,
i FLUSSI non si toccano. Piccola, precisa, senza inventiva.

## 0 · Prima di scrivere una riga

Leggere: `docs/anagrafiche-campi.md` (le decisioni del 16/07) ·
`docs/dominio-ottica.md` §14 · `supabase/migrazioni/006_anagrafiche.sql`.
**Stato garantito**: 006 applicata; tipi (`ClienteRow`, `PrescrizioneRow`,
`ProdottoRow`, ruolo utenti) e utils (`ETICHETTE_CANALE_PREFERITO`,
`ETICHETTE_RUOLO`) già allineati. Convenzioni: §0 Fase 1.

## 1 · Perimetro

**Dentro**: ClienteForm e scheda cliente estesi · DNP nella
PrescrizioneForm e nelle stampe dove c'è la griglia Rx · ProdottoForm con
tipo `sole`, ricambio LAC e parametri dedicati per montature/sole ·
rispetto di `non_contattare` e `canale_preferito` nel motore richiami.
**Fuori**: blocco assicurazione/azienda convenzionata (Fase 5), enforcement
ruoli (hardening), visus/altezza montaggio, granularità LAC per-potere,
qualunque cambio a stati/azioni/numerazioni.

## 2 · Regole vincolanti

1. **ClienteForm** in quattro sezioni: *Identità* (nome, secondo nome,
   cognome, data di nascita, sesso, codice fiscale, tutore legale — hint:
   "se il cliente è minorenne"), *Recapiti* (cellulare, tel. casa, tel.
   lavoro, email, canale preferito da `ETICHETTE_CANALE_PREFERITO`, toggle
   "Non contattare per promozioni"), *Indirizzo* (via, scala/appartamento,
   CAP, città, provincia, nazione — default vuoto = Italia), *Privacy e
   note* (consensi esistenti, lingua, fonte, note). Tutti facoltativi
   tranne nome+cognome, come oggi.
2. **Scheda cliente**: la testata mostra i vitali (telefono preferito
   evidenziato secondo `canale_preferito`, età se c'è la data di nascita,
   badge "Tutore: <nome>" se minore, badge grigio "Non contattare" se
   attivo).
3. **Motore richiami** (`lib/richiami-proposte.ts`): con
   `non_contattare = true` le proposte COMMERCIALI del cliente spariscono
   (stessa meccanica del consenso marketing, stessa riga di conteggio);
   sulle operative resta tutto, ma la riga mostra il badge. Nel form
   "Registra esito", il canale è precompilato con `canale_preferito` se
   presente.
4. **PrescrizioneForm**: riga DNP (OD/OS, mm, step 0.5, placeholder 31.5)
   sotto la griglia, visibile solo per tipo occhiali. La stampa busta, se
   la Rx collegata ha le DNP, le riporta accanto alla griglia.
5. **ProdottoForm**: opzione tipo "Occhiale da sole" (`sole`); per
   `montatura` e `sole` il blocco parametri dedica input a: calibro, ponte,
   asta (interi, mm), colore codice, colore nome, materiale → salvati in
   `parametri` (chiavi: `calibro`, `ponte`, `asta`, `colore_codice`,
   `colore_nome`, `materiale`); per `lac` si aggiunge il campo **Ricambio**
   (select: 1 — giornaliere · 14 — quindicinali · 30 — mensili · 90 —
   trimestrali · vuoto) sulla colonna `ricambio_giorni`. La lista prodotti
   mostra il calibro accanto al nome per montature/sole.
6. "Da catalogo" (wizard LAC e vendita): i prodotti `sole` NON compaiono
   tra le LAC; compaiono in vendita come gli altri (22% + DM di default,
   come da mappa aliquote §2.2 Fase 4).
7. Zero migrazioni nuove, zero dipendenze, zero cambi al contratto.

## 3 · Criteri di accettazione e collaudo

Build verde; 390px ok. **S1**: anagrafica completa stile CIAO! (secondo
nome, scala/app, tre telefoni, canale WhatsApp, lingua) → la scheda mostra
i vitali giusti. **S2**: cliente minorenne con tutore → badge in scheda.
**S3**: cliente con "Non contattare" → le sue proposte commerciali
spariscono dai richiami, le operative restano col badge; l'esito
precompila il canale preferito. **S4**: prodotto `sole` con
calibro/ponte/asta e colore → in lista si legge il calibro; in vendita
esce a 22% DM. **S5**: LAC mensile con ricambio 30 → il campo si vede in
scheda prodotto (il motore lo userà con la taratura, non ora). **S6**: Rx
occhiali con DNP → la busta stampata le riporta. Nessuna regressione.

## 4 · Consegna

Commit `feat(anagrafiche): …`, build verde. File ammessi:
`components/ClienteForm.tsx`, `components/PrescrizioneForm.tsx`,
`components/ProdottoForm.tsx`, pagine scheda cliente/prodotto, la stampa
busta (solo DNP), `lib/richiami-proposte.ts` (solo §2.3),
`app/(app)/richiami/**` (solo precompilazione canale), `lib/actions.ts`
(solo i campi nuovi nelle azioni crea/aggiorna esistenti).
