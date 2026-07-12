-- ============================================================================
-- MIGRAZIONE 002 — Fase 1 · Ordini & Buste (v0.2)
-- ============================================================================
-- Additiva: si applica DOPO schema.sql (001). Non tocca né rinomina nulla
-- dell'esistente. Incollare nel SQL Editor di Supabase ed eseguire una volta.
--
-- Cosa introduce (motivazioni in docs/dominio-ottica.md §10):
--   1. prescrizioni: origine 'lenti_precedenti' + flag attiva
--   2. clienti: consenso_dati_sanitari (privacy dati medici ≠ marketing)
--   3. ordini_occhiali: tipo_lavoro, stato 'arrivata' + ispezione,
--      avvisato_il, caparra_incamerata_il
--   4. ordini_lac: avvisato_il
--   5. contatori + rpc prossimo_numero('BL'|'OL') — numerazione race-safe
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · PRESCRIZIONI
-- ────────────────────────────────────────────────────────────────────────────
-- Origine: si aggiunge 'lenti_precedenti' (valori letti al frontifocometro
-- dall'occhiale in uso del cliente). 'plano' resta rappresentabile con sfero 0.
alter table public.prescrizioni
  drop constraint if exists prescrizioni_origine_check;
alter table public.prescrizioni
  add constraint prescrizioni_origine_check
  check (origine in ('interna','esterna','lenti_precedenti'));

-- Mai cancellare, solo disattivare (manuale o a scadenza, lato app).
alter table public.prescrizioni
  add column if not exists attiva boolean not null default true;

comment on column public.prescrizioni.attiva is
  'Una prescrizione non si elimina mai: si disattiva quando ne arriva una più recente o alla scadenza.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · CLIENTI — consenso privacy sui dati sanitari (distinto dal marketing)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.clienti
  add column if not exists consenso_dati_sanitari timestamptz;

comment on column public.clienti.consenso_dati_sanitari is
  'Quando il cliente ha firmato il consenso al trattamento dei dati sanitari (raccolto alla prima prescrizione). NULL = non ancora raccolto.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · ORDINI_OCCHIALI (busta lavoro)
-- ────────────────────────────────────────────────────────────────────────────
-- Tipo di lavoro: i job type di settore. 'montatura_cliente' è il
-- "frame to come" dell'indipendente (il cliente porta la sua montatura).
alter table public.ordini_occhiali
  add column if not exists tipo_lavoro text not null default 'occhiale_completo'
  constraint ordini_occhiali_tipo_lavoro_check
  check (tipo_lavoro in ('occhiale_completo','solo_lenti','solo_montatura','montatura_cliente'));

-- Stato: si inserisce 'arrivata' tra 'lavorazione' e 'pronta'.
-- L'arrivo dal laboratorio NON è "pronta": in mezzo c'è l'ispezione.
alter table public.ordini_occhiali
  drop constraint if exists ordini_occhiali_stato_check;
alter table public.ordini_occhiali
  add constraint ordini_occhiali_stato_check
  check (stato in ('preventivo','lavorazione','arrivata','pronta','consegnata','annullata'));

-- Ispezione all'arrivo: chi ha controllato e quando (si valorizzano nel
-- passaggio arrivata → pronta).
alter table public.ordini_occhiali
  add column if not exists ispezionata_da uuid references public.utenti (id) on delete set null,
  add column if not exists ispezionata_il timestamptz;

-- Avviso al cliente ("pronta · avvisa"): quando è stato avvisato.
alter table public.ordini_occhiali
  add column if not exists avvisato_il timestamptz;

-- Chiusura busta per mancato ritiro (trafila solleciti → raccomandata →
-- incameramento della caparra: la gestisce l'app, qui resta la data).
alter table public.ordini_occhiali
  add column if not exists caparra_incamerata_il timestamptz;

comment on column public.ordini_occhiali.tipo_lavoro is
  'occhiale_completo | solo_lenti | solo_montatura | montatura_cliente (il cliente porta la sua).';
comment on column public.ordini_occhiali.ispezionata_il is
  'Ispezione all''arrivo dal laboratorio: obbligatoria prima di marcare la busta come pronta.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · ORDINI_LAC — avviso al cliente ("arrivato · avvisa")
-- ────────────────────────────────────────────────────────────────────────────
alter table public.ordini_lac
  add column if not exists avvisato_il timestamptz;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · NUMERAZIONE — contatori per azienda + anno, race-safe
-- ────────────────────────────────────────────────────────────────────────────
-- Sostituisce la generazione in-app: due postazioni che creano buste nello
-- stesso istante non collidono mai. Formato: BL-2026-0141 / OL-2026-0032.
create table if not exists public.contatori (
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  chiave     text not null,              -- es. 'BL-2026'
  valore     integer not null default 0,
  primary key (azienda_id, chiave)
);

-- Nessuna policy: la tabella è raggiungibile SOLO tramite la funzione qui
-- sotto (security definer). RLS attiva = accesso diretto negato a tutti.
alter table public.contatori enable row level security;

create or replace function public.prossimo_numero(p_prefisso text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_azienda uuid;
  v_anno    integer := extract(year from now())::integer;
  v_chiave  text;
  v_valore  integer;
begin
  v_azienda := public.get_azienda_id();
  if v_azienda is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if p_prefisso not in ('BL','OL') then
    raise exception 'PREFISSO_NON_VALIDO';
  end if;

  v_chiave := p_prefisso || '-' || v_anno::text;

  insert into public.contatori (azienda_id, chiave, valore)
  values (v_azienda, v_chiave, 1)
  on conflict (azienda_id, chiave)
  do update set valore = public.contatori.valore + 1
  returning valore into v_valore;

  return v_chiave || '-' || lpad(v_valore::text, 4, '0');
end;
$$;

revoke execute on function public.prossimo_numero(text) from public, anon;
grant  execute on function public.prossimo_numero(text) to authenticated;

-- ============================================================================
-- Fine 002. La UI di questa fase è specificata in docs/fasi/fase-1-ordini-buste.md
-- ============================================================================
