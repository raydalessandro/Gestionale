# Fase 4c — La caparra entra in cassa (v0.5.1) · Specifica di codifica

Correzione pre-collaudo nata dall'audit `docs/revisione-procedure-vista.md`
(findings A1–A5, B1). Un solo tema: **il denaro deve tornare al centesimo
senza inventare causali**. Chirurgica: si parte SOLO dopo che la Fase 4b è
mergiata (tocca file diversi, ma la sequenza evita sorprese).

## 0 · Prima di scrivere una riga

Leggere: `docs/revisione-procedure-vista.md` (A1, A2, A3, A4, A5, B1 — è il
perché di ogni regola) · `docs/dominio-cassa-documenti.md` §3–4 ·
`supabase/migrazioni/007_caparra_incasso.sql`. **Stato garantito**: 007
applicata; tipi già allineati (`acconto_metodo`, `acconto_incassato_il`,
`garanzia_tipo` sulla busta; `busta_id` sui resi).

## 1 · Perimetro

**Dentro**: metodo+data sull'incasso caparra (form busta, ricevuta,
restituzione) · quadratura e homepage con UNA formula condivisa · i quattro
contatori caparre · guardrail sull'annullo vendita · avviso riallineamento
su giornata chiusa · garanzia tipizzata servizio/polizza.
**Fuori**: A6 (decisione GDPR a parte), A7 (montatura da catalogo →
mini-fase dedicata), C1/C2/C3/C5 (roadmap), manuale (giro dedicato
dell'agente manuali), qualunque tocco a `richiami-proposte`/anagrafiche
(corsia 4b) e alle migrazioni.

## 2 · Regole vincolanti

1. **La caparra nasce con un metodo.** Nel wizard/form busta, se
   `acconto > 0` il select **Metodo** (dai `metodi_pagamento` attivi,
   escluso `Caparra`; seed automatico se l'azienda non ne ha, come §3.9
   Fase 4) è obbligatorio. Al salvataggio, la PRIMA volta che l'acconto
   passa da 0/null a > 0 si imposta `acconto_incassato_il = now()`; le
   modifiche successive dell'importo non toccano la data. La **ricevuta
   caparra stampata** riporta il metodo (come il documento reale).
2. **Una formula sola** in `lib/cassa-calcoli.ts` (nuovo):
   `sistema(M) = Σ vendite.pagamenti[M] del giorno (esclusa la voce
   'Caparra') + Σ acconti con acconto_incassato_il oggi e
   acconto_metodo = M − Σ resi 'denaro' del giorno con
   metodo_rimborso = M`. La usano IDENTICA la chiusura (blocco 1) e i
   "contanti attesi" della homepage (`fondo + sistema('Contanti') −
   prelievi/spese di oggi`). Le buste col backfill (`acconto_metodo`
   null) compaiono in chiusura come riga informativa "caparre senza
   metodo registrato: € X" fuori dal conteggio, senza bloccare nulla.
3. **La voce 'Caparra' esce dal blocco conta**: le caparre scalate non
   sono denaro del giorno; vivono nel blocco caparre come "scontate".
4. **Quattro contatori** (come il report di catena): *emesse* = Σ acconto
   delle buste con `acconto_incassato_il` oggi · *scontate* = Σ pagamenti
   'Caparra' delle vendite di oggi · *rese* = Σ resi di oggi con
   `busta_id` valorizzato · *incamerate* = Σ movimenti `incamero_caparra`
   di oggi. `annullaBustaConRestituzione` valorizza `resi.busta_id` e
   precompila `metodo_rimborso = acconto_metodo` (modificabile).
5. **Guardrail annullo (A4)**: `annullaVendita` rifiuta se
   `data_vendita` non è oggi **oppure** esiste già la chiusura del giorno
   della vendita → errore: "La giornata è chiusa (o la vendita è di un
   giorno passato): registra un reso." Rientro magazzino automatico SOLO
   per le vendite libere; se `busta_id`/`ordine_lac_id` è valorizzato,
   nessun rientro e il messaggio di conferma guida al reso con selezione
   righe (la merce è dal cliente).
6. **Riallineamento su giornata chiusa (A5)**: avviso non bloccante nel
   form quando la data scelta ha già una chiusura ("questa giornata è già
   chiusa: la vendita resterà fuori dalle quadrature") + stessa nota nel
   dettaglio vendita.
7. **Garanzia tipizzata (B1)**: nel form busta, sotto il campo garanzia,
   radio "Servizio del negozio" (default) / "Polizza di compagnia" →
   `garanzia_tipo`. Alla consegna, la riga garanzia nasce a 22% se
   servizio, `esente` se polizza (sempre modificabile a mano).
8. Zero migrazioni nuove, zero cambi al vocabolario, nessun tocco alle
   chiusure già salvate (i riepiloghi passati restano congelati).

## 3 · Criteri di accettazione e collaudo

Build verde; 390px ok. **S1 · La sera torna.** Mattina: busta con caparra
100 € in contanti. Sera: chiusura senza causali inventate — i contanti di
sistema includono i 100, il blocco caparre mostra *emesse 100*. **S2 · Per
metodo.** Caparra 50 con Mastercard + vendita saldata Visa → ogni circuito
quadra da solo. **S3 · I quattro contatori.** In un giorno: una caparra
emessa, una scalata in consegna, una restituita ("Annulla e restituisci" →
il reso nasce con metodo precompilato), una incamerata → il blocco caparre
li mostra tutti e quattro. **S4 · Il guardrail.** Annullo su vendita di
ieri → rifiutato con guida al reso; annullo su vendita-da-ordine di oggi →
nessun rientro merce, messaggio chiaro. **S5 · L'avviso.** Riallineamento
su giornata già chiusa → il form avvisa, il dettaglio ricorda. **S6 · La
polizza.** Busta con garanzia "polizza" → in consegna la riga nasce
`esente`. Nessuna regressione sui collaudi Fase 4.

## 4 · Consegna

Commit `feat(cassa): …` granulari, build verde a ogni commit. File
ammessi: `lib/cassa-calcoli.ts` (nuovo), `lib/actions.ts`,
`app/(app)/cassa/**`, `app/(app)/ordini/**` (form busta e azioni caparra),
`components/` (BustaWizard/Form, CassaUI), le route di stampa
caparra/quietanza. Il manuale NON si tocca (giro dedicato).
