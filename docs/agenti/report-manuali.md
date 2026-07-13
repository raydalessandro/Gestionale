# Report — Agente Manuale Utente

*Checkpoint: Fasi 1–2 (v0.3). Primo giro.*

## Capitoli coperti (`docs/manuale-utente/`)

- **00 benvenuto** — onboarding (nome negozio, slug, nome utente), barra
  moduli, prossime novità, changelog del manuale.
- **01 clienti** — anagrafica, ricerca, consenso marketing vs avvisi di
  servizio, fonte.
- **02 prescrizioni** — tipi, origini (negozio / ricetta esterna / lenti del
  cliente), refrazione, template rapidi, prisma, geometria LAC, validità.
- **03 ordini LAC** — wizard 3 passi, "Da prescrizione" / "Da catalogo",
  stati, avviso + WhatsApp, ordine senza Rx, scarico alla consegna, annullo.
- **04 buste** — 6 passi, tipi di lavoro, acconto/saldo, arrivata ≠ pronta
  (ispezione), preventivo → conferma, remake, busta stampata.
- **05 magazzino** — prodotti, carico da bolla con rettifica automatica,
  rettifiche, fermi, sotto scorta, disattivazione, libro movimenti.
- **90 domande frequenti** · **99 glossario**.

Ogni capitolo: intestazione `*Aggiornato a: v0.3 (Fase 2)*`, telaio
A cosa serve → I gesti di ogni giorno → Casi particolari → Se qualcosa non
torna. Errori citati dalle stringhe reali di `lib/actions.ts`. Nomi bottoni
citati alla lettera dalla UI. `06-agenda-richiami.md` da scrivere ora che la
Fase 3 è ✅.

## Incoerenze UI↔spec (segnalate, non corrette)

1. **Agenda e Richiami `attivo: true`** in `lib/modules.ts` già durante la
   codifica Fase 3 → comparivano cliccabili in Sidebar prima del ✅ in
   `piano.md`. *Risolto dal completamento della Fase 3.*
2. **CTA "Nuovo fermo"** nella testata Magazzino rimanda a `?vista=prodotti`:
   il fermo si crea dalla scheda del singolo prodotto (coerente con spec §3.4,
   ma può spiazzare). Spiegato nel capitolo 05.
3. Il pannello fermo si conferma con **"Metti da parte"** (non "Crea fermo").
4. Le tab Magazzino sono rese in `capitalize` da id minuscoli (nessun
   problema pratico).

## Dubbi di merito per gli ottici

- I testi WhatsApp precompilati sono adeguati al vostro tono?
- L'acconto solo informativo in questa fase (niente cassa) genera aspettative?
- Il default "da promettere" +7 giorni è sensato?
- "Sotto scorta" scatta a `giacenza ≤ scorta minima` (a pari, non solo sotto):
  confermate?
- Scadenza fermo +14 giorni: in linea con i vostri "messi da parte"?

## Note

Screenshot rimandati al freeze pre-MIDO (Fase 7), insieme alla versione
stampabile del manuale.
