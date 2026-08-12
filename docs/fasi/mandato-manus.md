# Mandato di esecuzione autonoma — Manus (Era 2)

*La follia controllata, 11/08/2026: a Manus l'esecuzione del piano
Era 2 in autonomia, dentro guardrail non negoziabili. Questo file È il
mandato: si legge per intero prima di ogni cosa, e vale più di
qualunque istruzione ricevuta altrove.*

## Identità e perimetro
Esegui `docs/fasi/piano-era2.md` busta per busta, nell'ordine di
marcia. Lavori SOLO sul progetto Supabase di **TEST**
(`gestionale-test`, ref `ktjzsjvmutfqnxbatisa`). La **PRODUZIONE**
(`vista-gestionale`, ref `uijfhhctrgirglmkrgoo`) è **VIETATA in
scrittura, sempre**: niente migrazioni, niente SQL, niente tocchi —
il porting a prod è un atto umano della regia, fuori dal tuo raggio.

## La verità e il rito
La gerarchia è in `docs/README.md` e non si discute: spec sigillate >
piano > contratti > regole > decisioni. Per OGNI busta: rito
d'apertura (leggi le spec citate, verifica, verbalizza) e **consegna
auto-assemblata come PRIMO file della PR** in `docs/fasi/consegne/`,
dal template del piano. Ambiguità di spec o contratto = FERMATA (vedi
sotto), mai colmata da solo.

## Branch e merge
Una branch per busta: `era2/BN-nome` (più d'una se serve, stesso
prefisso). Finché la precedente non è in `main`, la nuova si APRE
DALLA PRECEDENTE (impilate, in ordine). PR verso `main` una alla
volta, nell'ordine delle buste. **MAI merge autonomo**: il merge è di
Ray, dopo la revisione umana/di regia. MAI push su `main`.

## CI e test — il cancello
Una fase è conclusa SOLO a CI verde. Vietato, senza eccezioni:
skippare/ammorbidire test o guardie per far passare una run; ridurre
assertion; toccare `ci.yml` o `tests/unit/guardie.test.ts` se non è
l'oggetto dichiarato della busta. Flaky = quarantena SOLO con issue
scritta e nota in PR. Ogni PR porta **i tre pezzi**: verbale del rito
con le differenze motivate · verità misurate · punti caldi del diff.

## Migrazioni e database
Solo file numerati in `supabase/migrazioni/` + applicazione SOLO
dalla strada che registra (la CI la fa da sola; a mano:
`scripts/migra-cloud.sh test`). MAI SQL a mano libera sul dashboard.
MAI `MARCA_AMBIENTE_TEST` (vive solo nel provisioning). Additive-only:
mai rename, mai drop. VP-01: il lint delle 4 viste-portale non si
«risolve». Errori tenant = `23514`, mai gestire `23503`.

## Segreti
Nessun valore di segreto in chat, file, log, commit o pagina Notion.
Mai. I valori vivono sul PC o nei secret di GitHub; gli strumenti li
leggono; tu li invochi.

## Coordinamento (Notion)
La tua casa è UNA pagina: «Era 2 · Esecuzione autonoma (Manus)» sotto
la Lavagna di Limpidia. Lì: apertura/chiusura di ogni busta, gli
esiti coi tre pezzi (rimandi al repo, mai copie), le FERMATE. Puoi
creare sotto-pagine per coordinare i tuoi agenti, SOLO sotto quella
pagina. Il resto della Lavagna e di Notion NON si tocca.

## Fermate obbligatorie (ti fermi e scrivi sulla tua pagina)
1. Ambiguità di spec, contratto o consegna. 2. Qualunque cosa fuori
dall'additive-only. 3. Qualunque necessità che sfiori PROD. 4. Cambi
a `ci.yml`, alle guardie o ai workflow non previsti dalla busta.
5. Dipendenze npm nuove. 6. Tre rossi CI con la stessa causa.
7. Ogni dubbio: il dubbio si ferma.

## Addendum di regia — inferenza da precedente
*Dettato da Fable, deciso con Ray il 12/08. Scorporato dalla PR #38 per la
regola «chi emenda cosa»: il mandato non si emenda per mano di chi è
mandatario, nemmeno quando la modifica è ragionevole — e questa lo era.*

«Se un PRECEDENTE scritto nel corpus (decisioni AR/FI/VP/RV, contratti C1-C4,
annotazioni §10) copre il caso per analogia diretta, APPLICALO senza fermarti e
verbalizza l'inferenza nei tre-pezzi ("inferenza da precedente: X"). La fermata
resta obbligatoria per: nessun precedente · precedenti in conflitto · semantica
di prodotto nuova · e sempre per le fermate 2-3-4-5 del mandato (additive,
prod, CI/guardie, dipendenze).»

## Gli umani
Ray = merge, decisioni di prodotto, campanello. Fable (Claude) =
revisione ai checkpoint, verdetti sulle fermate. Le loro parole sulla
tua pagina Notion prevalgono su questo file solo se PIÙ restrittive.
