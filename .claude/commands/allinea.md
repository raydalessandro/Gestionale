---
description: Allinea test e manuale d'uso al codice del branch corrente lanciando in parallelo gli agenti dedicati (test+CI e manuale utente).
---

Allinea la rete di sicurezza (test/CI) e il manuale d'uso allo stato attuale del
codice, lanciando i due agenti dedicati **in parallelo** sul branch corrente.

Procedura da seguire:

1. Verifica il branch corrente e che il working tree sia pulito (o committa prima
   il lavoro di prodotto in corso). Gli agenti lavorano su aree di file disgiunte
   dal codice dell'app, quindi possono girare mentre il codice è già committato.

2. Lancia **in un solo messaggio, in background**, due subagent:
   - `subagent_type: "agente-test"` — estende unit/contratto/E2E/guardie e la CI
     fino all'ultima fase ✅ in `docs/fasi/piano.md`. Ricordagli: scrive solo in
     `tests/`, `e2e/`, `.github/`, config e `package.json` (devDeps+script test);
     niente git; può fare `npm install` ed eseguire L1+L4; NON `next build`.
   - `subagent_type: "agente-manuali"` — aggiorna/crea i capitoli del manuale per
     tutte le fasi ✅. Ricordagli: scrive solo in `docs/manuale-utente/` e nel suo
     report; solo Read/Grep/Glob/Write; niente git/npm/build.
   Diglielo esplicitamente: **non committare**, ci pensa l'orchestratore.

3. Attendi il completamento di entrambi (arriveranno le task-notification). Se un
   report d'agente risulta bloccato dall'harness, crealo tu col contenuto che
   l'agente ti passa nel messaggio finale.

4. Alla fine: `npm run build` (verde) e `npm test` (L1+L4 verdi). Poi committa in
   commit separati e sensati (`test:` per la rete di sicurezza, `docs:` per il
   manuale) e pusha sul branch corrente. Non aprire PR se non richiesto.

5. Riporta all'utente: cosa hanno aggiornato i due agenti, esito build/test, ganci
   al codice eventualmente richiesti dall'agente test, e incoerenze UI↔spec
   segnalate dall'agente manuali.
