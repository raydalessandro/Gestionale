-- ============================================================================
-- MIGRAZIONE 004 — Fase 3 · Agenda & Richiami (v0.4)
-- ============================================================================
-- Additiva: si applica DOPO 001, 002, 003. Incollare nel SQL Editor una volta.
-- Motivazioni in docs/dominio-ottica.md §3 (viaggio del cliente) e §11
-- (automazioni suggerite dai manuali di catena).
--
-- Cosa introduce:
--   1. appuntamenti — l'agenda del negozio (slot da 20' come default di catena)
--   2. richiami — il registro dei richiami: ogni tentativo è una riga
--
-- Nota architetturale: NIENTE cron. Le "proposte" di richiamo si calcolano
-- al volo da ordini/prescrizioni/fermi; qui si registra solo ciò che viene
-- pianificato o lavorato. Il motore è descritto nella spec di fase.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · APPUNTAMENTI
-- ────────────────────────────────────────────────────────────────────────────
create table public.appuntamenti (
  id            uuid primary key default uuid_generate_v4(),
  azienda_id    uuid not null references public.aziende (id) on delete cascade,
  cliente_id    uuid references public.clienti (id) on delete cascade,   -- null = impegno interno
  utente_id     uuid references public.utenti  (id) on delete set null,  -- con chi

  tipo          text not null default 'controllo_vista'
                check (tipo in ('controllo_vista','consegna','ritiro_lac',
                                'prima_applicazione_lac','altro')),
  inizio        timestamptz not null,
  durata_minuti integer not null default 20
                check (durata_minuti between 5 and 240),
  stato         text not null default 'prenotato'
                check (stato in ('prenotato','completato','mancato','annullato')),

  riferimento   text,          -- es. BL-2026-0141 / OL-2026-0032
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.appuntamenti.stato is
  'mancato = il cliente non si è presentato (no-show): è un dato, non una vergogna.';

create index idx_appuntamenti_giorno  on public.appuntamenti (azienda_id, inizio);
create index idx_appuntamenti_cliente on public.appuntamenti (cliente_id);
create trigger trg_appuntamenti_updated before update on public.appuntamenti
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · RICHIAMI — ogni tentativo di contatto è una riga (la storia resta)
-- ────────────────────────────────────────────────────────────────────────────
create table public.richiami (
  id            uuid primary key default uuid_generate_v4(),
  azienda_id    uuid not null references public.aziende (id) on delete cascade,
  cliente_id    uuid not null references public.clienti (id) on delete cascade,
  utente_id     uuid references public.utenti (id) on delete set null,   -- chi lo lavora

  tipo          text not null
                check (tipo in ('controllo_vista','lac_esaurimento','ritiro_sollecito',
                                'fermo_scadenza','promessa_ritardo','generico')),
  da_fare_il    date not null default current_date,

  -- Lavorazione (null finché il richiamo è "da fare")
  canale        text check (canale in ('telefono','whatsapp','sms','email','di_persona')),
  esito         text check (esito in ('appuntamento_fissato','richiamare',
                                      'non_risponde','non_interessato','gestito')),
  fatto_il      timestamptz,

  riferimento   text,                 -- numero ordine/busta/fermo collegato
  valore        numeric(10,2),        -- per il ROI: valore dell'ordine legato all'esito
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.richiami.valore is
  'Valore economico collegato all''esito (es. totale della busta ritirata): alimenta il ROI del modulo.';

create index idx_richiami_coda    on public.richiami (azienda_id, da_fare_il) where esito is null;
create index idx_richiami_cliente on public.richiami (cliente_id);
create trigger trg_richiami_updated before update on public.richiami
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
alter table public.appuntamenti enable row level security;
alter table public.richiami     enable row level security;

create policy "appuntamenti: della propria azienda" on public.appuntamenti
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "richiami: della propria azienda" on public.richiami
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- ============================================================================
-- Fine 004. La UI è specificata in docs/fasi/fase-3-agenda-richiami.md
-- ============================================================================
