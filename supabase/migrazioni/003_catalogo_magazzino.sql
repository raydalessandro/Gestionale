-- ============================================================================
-- MIGRAZIONE 003 — Fase 2 · Catalogo & Magazzino (v0.3)
-- ============================================================================
-- Additiva: si applica DOPO 001 e 002. Incollare nel SQL Editor ed eseguire
-- una volta. Motivazioni in docs/dominio-ottica.md §8 (flussi merce di catena).
--
-- Cosa introduce:
--   1. prodotti: giacenza (cache), scorta_minima, costo, fornitore
--   2. movimenti_magazzino — libro giornale dello stock, APPEND-ONLY
--   3. trigger: la giacenza si aggiorna DA SOLA a ogni movimento
--   4. fermi — merce accantonata per un cliente (impegnata, non scaricata)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · PRODOTTI — campi di magazzino
-- ────────────────────────────────────────────────────────────────────────────
alter table public.prodotti
  add column if not exists giacenza      integer not null default 0,
  add column if not exists scorta_minima integer not null default 0,
  add column if not exists costo         numeric(10,2),
  add column if not exists fornitore     text;

comment on column public.prodotti.giacenza is
  'Cache mantenuta dal trigger sui movimenti: NON aggiornare a mano. Multi-sede futura: nascerà una tabella giacenze per punto vendita, in modo additivo.';
comment on column public.prodotti.scorta_minima is
  'Sotto questa soglia il prodotto compare tra i "sotto scorta".';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · MOVIMENTI_MAGAZZINO — il libro giornale (append-only)
-- ────────────────────────────────────────────────────────────────────────────
-- Convenzione: quantita CON SEGNO. carico > 0; scarichi < 0; rettifica ±.
-- La coerenza segno/tipo è imposta dal check: un movimento sbagliato non entra.
create table public.movimenti_magazzino (
  id           uuid primary key default uuid_generate_v4(),
  azienda_id   uuid not null references public.aziende  (id) on delete cascade,
  prodotto_id  uuid not null references public.prodotti (id) on delete cascade,
  utente_id    uuid references public.utenti (id) on delete set null,

  tipo         text not null check (tipo in
               ('carico','scarico','ordine_cliente','rettifica',
                'reso_fornitore','danno','uso_interno')),
  quantita     integer not null check (quantita <> 0),
  riferimento  text,          -- n° bolla, numero ordine (OL-…/BL-…), motivo breve
  note         text,

  created_at   timestamptz not null default now(),

  constraint movimenti_segno_coerente check (
    (tipo = 'carico'    and quantita > 0) or
    (tipo = 'rettifica' and quantita <> 0) or
    (tipo in ('scarico','ordine_cliente','reso_fornitore','danno','uso_interno')
       and quantita < 0)
  )
);

create index idx_movimenti_prodotto on public.movimenti_magazzino (prodotto_id, created_at desc);
create index idx_movimenti_azienda  on public.movimenti_magazzino (azienda_id, created_at desc);

-- Niente updated_at, niente trigger di modifica: un movimento non si tocca.

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · TRIGGER — la giacenza segue i movimenti, sempre e solo così
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.applica_movimento_magazzino()
returns trigger language plpgsql as $$
begin
  update public.prodotti
     set giacenza = giacenza + new.quantita
   where id = new.prodotto_id;
  return new;
end;
$$;

create trigger trg_movimenti_applica
  after insert on public.movimenti_magazzino
  for each row execute function public.applica_movimento_magazzino();

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · FERMI — merce messa da parte per un cliente
-- ────────────────────────────────────────────────────────────────────────────
-- Un fermo NON muove la giacenza (la merce è in negozio): la "impegna".
-- Disponibile = giacenza − Σ fermi attivi (calcolato in query).
-- Al ritiro: stato 'ritirato' + movimento 'scarico' (lo fa la server action).
create table public.fermi (
  id           uuid primary key default uuid_generate_v4(),
  azienda_id   uuid not null references public.aziende  (id) on delete cascade,
  prodotto_id  uuid not null references public.prodotti (id) on delete cascade,
  cliente_id   uuid not null references public.clienti  (id) on delete cascade,
  utente_id    uuid references public.utenti (id) on delete set null,

  quantita     integer not null check (quantita > 0),
  stato        text not null default 'attivo'
               check (stato in ('attivo','ritirato','annullato')),
  scade_il     date,
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_fermi_azienda on public.fermi (azienda_id, stato);
create index idx_fermi_cliente on public.fermi (cliente_id);
create trigger trg_fermi_updated before update on public.fermi
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
alter table public.movimenti_magazzino enable row level security;
alter table public.fermi               enable row level security;

-- Movimenti: SOLO lettura e inserimento. Nessuna policy di update/delete:
-- l'immutabilità del libro giornale la garantisce il database, non la UI.
create policy "movimenti: select della propria azienda" on public.movimenti_magazzino
  for select to authenticated using (azienda_id = public.get_azienda_id());
create policy "movimenti: insert nella propria azienda" on public.movimenti_magazzino
  for insert to authenticated with check (azienda_id = public.get_azienda_id());

create policy "fermi: della propria azienda" on public.fermi
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- ============================================================================
-- Fine 003. La UI di questa fase è specificata in docs/fasi/fase-2-catalogo-magazzino.md
-- ============================================================================
