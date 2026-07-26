-- ============================================================================
-- 009 · Vocabolario `fonte` sugli ORDINI (G3-bis)
-- ----------------------------------------------------------------------------
-- Additiva e idempotente, come la 008. Chiude il disallineamento lasciato dalla
-- G2, che ha allineato `clienti.fonte` e creato `appuntamenti.fonte` ma NON le
-- altre due colonne `fonte` del dominio: `ordini_lac.fonte` e
-- `ordini_occhiali.fonte`, il cui check elencava ancora ('banco','sito','app',
-- 'convenzione') — un insieme che il tipo TS (Exclude<Fonte,'import'>) già non
-- riconosceva.
--
-- Nuovo vocabolario per le due colonne degli ordini:
--     banco, app, convenzione, qr_vetrina, sito_negozio, portale
-- cioè esattamente Exclude<Fonte,'import'>: un ordine non si importa.
--
-- Backfill — semantica DIVERSA dalla 008. Là `clienti.fonte = 'sito'` è
-- diventato 'banco' (prima acquisizione ignota). Qui no: il commento dello
-- schema dice che questi ordini arrivano dal SITO PUBBLICO del negozio, quindi
-- la mappatura onesta è 'sito' -> 'sito_negozio'. Backfill PRIMA del check.
-- (Righe interessate sul DB demo al momento della consegna: 0 — vedi doc.)
-- ============================================================================

update public.ordini_lac      set fonte = 'sito_negozio' where fonte = 'sito';
update public.ordini_occhiali set fonte = 'sito_negozio' where fonte = 'sito';

alter table public.ordini_lac drop constraint if exists ordini_lac_fonte_check;
alter table public.ordini_lac add constraint ordini_lac_fonte_check
  check (fonte in ('banco','app','convenzione','qr_vetrina','sito_negozio','portale'));

alter table public.ordini_occhiali drop constraint if exists ordini_occhiali_fonte_check;
alter table public.ordini_occhiali add constraint ordini_occhiali_fonte_check
  check (fonte in ('banco','app','convenzione','qr_vetrina','sito_negozio','portale'));

-- ============================================================================
-- Fine 009. Ora le QUATTRO colonne `fonte` del dominio parlano la stessa lingua
-- dei tipi: clienti/appuntamenti = FONTI intero; ordini = FONTI meno 'import'.
-- ============================================================================
