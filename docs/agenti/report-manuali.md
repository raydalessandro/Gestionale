# Report — Agente Manuale Utente

*Checkpoint: Fasi 1–4 (v0.5).*

## Capitoli (`docs/manuale-utente/`)

- **00 benvenuto** · **01 clienti** · **02 prescrizioni** · **03 ordini LAC** ·
  **04 buste** · **05 magazzino** — Fasi 1–2 (giro precedente).
- **06 agenda e richiami** *(nuovo, v0.4)* — agenda vista giorno, "Nuovo
  appuntamento", stati Completato/Non presentato/Annulla, "Fissa ritiro"; coda
  richiami Da fare, Proposte dal negozio (5 motivi), consenso/GDPR, "Registra
  esito", "Pianifica", link Chiama/WhatsApp.
- **07 cassa** *(nuovo, v0.5)* — vendita veloce e "Da catalogo", pagamenti col
  resto sui contanti, "Consegna e incassa" (caparra scalata), annullo e reso con
  causale, "Incamera caparra" / "Annulla e restituisci caparra", movimenti di
  cassa, "Chiudi la giornata" (4 blocchi, tolleranza 5 cent), impostazioni
  metodi, ricevuta caparra e quietanza.
- **90 FAQ** e **99 glossario** aggiornati (aliquote, DM, caparra confirmatoria,
  chiusura/Z, versamento, quietanza, riallineamento, opposizione TS…).

Bottoni citati alla lettera dalla UI; errori della sezione "Se qualcosa non
torna" presi dalle stringhe reali di `lib/actions.ts`. Perimetro rispettato:
non documentati stampa fiscale reale, invio Sistema TS, saldi gift card.

## Incoerenze UI↔spec (segnalate, non corrette)

1. **"Ripianifica" non esiste come bottone.** La spec Fase 3 §2.5 lo prevede
   (esito "Da richiamare" → nuovo richiamo automatico a +3 gg); `registraEsitoRichiamo`
   registra solo l'esito. Documentato il comportamento reale (poi "Nuovo
   richiamo"/"Pianifica"). **Da decidere: implementare o allineare la spec.**
2. **Ingranaggio "Impostazioni" in `/cassa` senza etichetta** (solo icona);
   la spec §3.2 la chiama "Impostazioni".
3. **Movimenti di cassa** stanno nel riquadro della home Cassa (form "Registra
   movimento"), non in una rotta dedicata — coerente con §3.2.

## Dubbi di merito per gli ottici

- I 5 motivi di proposta e i tempi (3 gg sollecito, 70–100 gg LAC, 30 gg Rx)
  sono giusti per il vostro negozio?
- La caparra come "pagamento" alla consegna e il metodo "Caparra" non
  disattivabile sono chiari al banco?
- La conta per metodo e la tolleranza dei 5 centesimi rispecchiano la vostra
  chiusura reale?
- Default sensati? (durata appuntamento 20', fondo cassaforte 300 €; per la
  restituzione caparra forse serve una causale "rinuncia cliente" oltre a
  "Modifica dell'ordine").
- I testi WhatsApp precompilati per i 5 motivi sono nel vostro tono?

Screenshot rinviati al freeze pre-MIDO (Fase 7).
