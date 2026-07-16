# Fase 4d — Consensi come in negozio (audit A6) · Specifica di codifica

Piccola e testarda, come il modello di catena che la ispira: *"il sistema
fa il rompiscatole finché il consenso non c'è"*. Parte SOLO dopo il merge
di 4b e 4c (tocca ClienteForm e PrescrizioneForm: corsia 4b).

## 0 · Prima di scrivere una riga

Leggere: `docs/revisione-procedure-vista.md` §A6 · la decisione del 16/07
qui sotto · migrazione 007 (§1-bis). **Stato garantito**: 007 applicata;
`ClienteRow.consenso_sanitario_il` nei tipi.

## 1 · La decisione (dal banco, non dal codice)

Due consensi, due momenti: il **marketing** si raccoglie alla creazione
della scheda (e in qualunque momento dopo); il **sanitario** si raccoglie
alla prima prescrizione, perché è lì che nascono i dati art. 9. Il sistema
non blocca mai il lavoro, ma **chiede ogni volta** finché manca. Firma
digitale, archivio documenti privacy e invio informativa via email sono
una fase futura a roadmap: qui si registrano flag, data e chi.

## 2 · Regole vincolanti

1. **Il promemoria in scheda cliente**: aprendo la scheda di un cliente a
   cui manca un consenso, un banner discreto ma persistente (non popup
   bloccante) elenca cosa manca — "Consenso marketing: non raccolto ·
   Consenso dati sanitari: non raccolto" — con il bottone "Registra
   consensi" che apre un piccolo dialogo: spunte, data (default oggi,
   modificabile per consensi raccolti in passato su carta), conferma. Il
   salvataggio imposta `consenso_marketing`/`data_consenso` e
   `consenso_dati_sanitari`/`consenso_sanitario_il`.
2. **La prescrizione pretende il sanitario**: nel PrescrizioneForm
   (creazione E modifica), se il cliente non ha `consenso_dati_sanitari`,
   in testa al form compare il blocco consenso con la spunta obbligatoria
   "Il cliente ha firmato l'informativa e acconsente al trattamento dei
   dati sanitari" — senza spunta non si salva. La spunta aggiorna il
   cliente (flag + `consenso_sanitario_il = now()`) nella stessa azione,
   atomicamente.
3. **La scheda mostra lo stato**: nella sezione privacy della scheda
   cliente, due righe leggibili — "Marketing: sì, dal 12/03/2026" /
   "Dati sanitari: non raccolto" — sempre visibili, mai solo il boolean.
4. **Il motore richiami non cambia**: già oggi le proposte commerciali
   esigono il consenso marketing; nessun tocco a `richiami-proposte`.
5. Niente firma digitale, niente upload/archivio PDF, niente email
   automatiche, nessuna migrazione oltre la 007, nessun tocco alle
   corsie test/manuali.

## 3 · Collaudo

**S1**: cliente nuovo senza consensi → la scheda mostra il banner; registro
il marketing con data di ieri (carta) → il banner ora elenca solo il
sanitario. **S2**: nuova prescrizione per quel cliente → il form pretende
la spunta; salvo → il banner sparisce, la scheda mostra le due date.
**S3**: modifica di una prescrizione di un cliente GIÀ consenziente → nessun
blocco, nessuna richiesta doppia. **S4**: le proposte commerciali del
cliente senza marketing restano escluse (regressione richiami). Build
verde, 390px ok.

## 4 · Consegna

Commit `feat(consensi): …`. File ammessi: `components/ClienteForm.tsx` e
scheda cliente, `components/PrescrizioneForm.tsx`, `lib/actions.ts` (solo
le azioni cliente/prescrizione esistenti). Manuale: riga nel giro v0.5.1
dell'agente manuali (cap. Clienti + cap. Prescrizioni), non qui.
