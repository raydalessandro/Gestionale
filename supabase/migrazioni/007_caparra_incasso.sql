-- ============================================================================
-- MIGRAZIONE 007 — Il denaro della caparra all'ingresso (audit A1/A2/B1)
-- ============================================================================
-- Additiva: si applica DOPO 001–006. Fonte: docs/revisione-procedure-vista.md
-- (findings A1, A2, B1) + docs/dominio-cassa-documenti.md §3–4.
-- La spec UI/azioni è in docs/fasi/fase-4c-caparra-quadratura.md
-- (Nota: l'ossatura multi-negozio, prima annunciata come 007, diventa 008.)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · BUSTE — la caparra ha un metodo e una data (A1)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.ordini_occhiali
  add column if not exists acconto_metodo       text,
  add column if not exists acconto_incassato_il timestamptz,
  add column if not exists garanzia_tipo        text
      check (garanzia_tipo in ('servizio','polizza'));

comment on column public.ordini_occhiali.acconto_metodo is
  'Nome del metodo con cui la caparra è stata incassata (dai metodi_pagamento attivi). Entra nella quadratura serale e si stampa sulla ricevuta, come nel documento reale.';
comment on column public.ordini_occhiali.acconto_incassato_il is
  'Quando la caparra è entrata in cassa: àncora del contatore "caparre emesse" del giorno. Si imposta la prima volta che l''acconto diventa > 0 e non si ritocca.';
comment on column public.ordini_occhiali.garanzia_tipo is
  'servizio = garanzia interna del negozio (IVA 22) · polizza = assicurazione di terzi (natura esclusa/esente, caso ERGO). Guida l''aliquota della riga in consegna.';

-- Backfill dichiarato: per le buste già esistenti con acconto, la data
-- d'incasso migliore che abbiamo è la nascita della busta (approssimazione
-- già usata dal contatore; il metodo resta null = "non registrato").
update public.ordini_occhiali
   set acconto_incassato_il = created_at
 where acconto > 0
   and acconto_incassato_il is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 1-bis · CLIENTI — quando è stato raccolto il consenso sanitario (audit A6)
-- ────────────────────────────────────────────────────────────────────────────
-- Decisione del 16/07 (strada "a" potenziata, dal modello di catena): il
-- consenso ai dati sanitari si raccoglie alla prima prescrizione e il
-- sistema lo richiede finché manca. Qui la data; il flag esiste dalla 002.
alter table public.clienti
  add column if not exists consenso_sanitario_il timestamptz;

comment on column public.clienti.consenso_sanitario_il is
  'Quando il consenso ai dati sanitari (art. 9 GDPR) è stato raccolto. La firma digitale e l''archivio documenti privacy sono una fase futura a roadmap.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · RESI — il legame con la busta per le restituzioni caparra (A2)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.resi
  add column if not exists busta_id uuid references public.ordini_occhiali (id) on delete set null;

comment on column public.resi.busta_id is
  'Valorizzato quando il reso è la restituzione della caparra di una busta annullata: alimenta il contatore "caparre rese" della chiusura (i 4 contatori del report di catena).';

create index if not exists idx_resi_busta on public.resi (busta_id) where busta_id is not null;

-- ============================================================================
-- Fine 007.
-- ============================================================================
