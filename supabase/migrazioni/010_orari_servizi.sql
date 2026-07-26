-- ============================================================================
-- 010 · Orari, servizi e chiusure del portale (G5)
-- ----------------------------------------------------------------------------
-- Additiva e idempotente come le precedenti. Prepara anche il terreno alla
-- prenotazione (G6): senza orari e senza servizi con una durata, il calcolo
-- degli slot non esiste. `slot_liberi()` NON è qui: deve sottrarre le
-- prenotazioni, e la tabella `prenotazioni` non esiste ancora (dipende dal
-- modello di identità, deciso in G6).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Catalogo servizi GLOBALE (senza azienda_id) + scelta per negozio
-- ----------------------------------------------------------------------------
-- Decisione architetturale: il vocabolario dei servizi è NOSTRO, non del
-- singolo negozio. Domani il portale farà cercare «chi fa il controllo della
-- vista vicino a me»: se ogni negozio scrivesse il nome come gli pare, la
-- ricerca sarebbe impossibile. Il negozio SCEGLIE quali voci accendere e con
-- che durata — esattamente come `moduli_attivi`.
-- ----------------------------------------------------------------------------
create table if not exists public.servizi (
  codice                    text primary key,
  etichetta                 text not null,
  durata_predefinita_minuti int  not null check (durata_predefinita_minuti > 0),
  ordine                    int  not null default 0
);

comment on table public.servizi is
  'Catalogo GLOBALE dei servizi (vocabolario condiviso, senza azienda_id). Il negozio ne accende un sottoinsieme via negozi_servizi.';

insert into public.servizi (codice, etichetta, durata_predefinita_minuti, ordine) values
  ('visita',         'Visita optometrica',   30, 10),
  ('occhiale',       'Occhiale da vista',     45, 20),
  ('lenti',          'Lenti a contatto',      40, 30),
  ('visita_bambini', 'Visita per bambini',    40, 40),
  ('controllo',      'Controllo della vista', 20, 50),
  ('sole',           'Occhiali da sole',      30, 60)
on conflict (codice) do nothing;

create table if not exists public.negozi_servizi (
  id              uuid primary key default uuid_generate_v4(),
  azienda_id      uuid not null references public.aziende (id) on delete cascade,
  servizio_codice text not null references public.servizi (codice) on delete restrict,
  durata_minuti   int check (durata_minuti > 0),   -- deroga facoltativa alla durata predefinita
  attivo          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (azienda_id, servizio_codice)
);

comment on column public.negozi_servizi.durata_minuti is
  'Deroga facoltativa alla durata_predefinita_minuti del catalogo. NULL = usa quella globale.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Orari, chiusure, blocchi — tre cose DIVERSE di proposito
-- ----------------------------------------------------------------------------
-- • orari_apertura: la settimana tipo. UNA riga per FASCIA, non per giorno:
--   la pausa pranzo sono due righe, non una colonna `pausa_inizio`. È l'unico
--   modo per reggere «giovedì continuato, sabato solo mattina» senza aggiungere
--   colonne ogni volta.
-- • chiusure: un PERIODO (ferie, festività). Date.
-- • blocchi_slot: il BUCO singolo («giovedì 15–16 non ci sono»). Istanti assoluti.
-- Fonderle sembra elegante e poi non regge il primo caso reale.
-- ----------------------------------------------------------------------------
create table if not exists public.orari_apertura (
  id         uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  giorno     int  not null check (giorno between 0 and 6),   -- 0=domenica … 6=sabato
  apre       time not null,
  chiude     time not null,
  check (chiude > apre)
);
create index if not exists idx_orari_azienda on public.orari_apertura (azienda_id, giorno);

create table if not exists public.chiusure (
  id         uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  dal        date not null,
  al         date not null,
  motivo     text,
  check (al >= dal)
);
create index if not exists idx_chiusure_azienda on public.chiusure (azienda_id, dal, al);

create table if not exists public.blocchi_slot (
  id         uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  inizio     timestamptz not null,
  fine       timestamptz not null,
  motivo     text,
  check (fine > inizio)
);
create index if not exists idx_blocchi_azienda on public.blocchi_slot (azienda_id, inizio);

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · Sicurezza — le tabelle NASCONO leggibili da anon se non facciamo niente
-- ----------------------------------------------------------------------------
-- Supabase concede `select` ad anon per default su ogni tabella nuova. Le
-- accendiamo con RLS, diamo la policy al proprietario del tenant e REVOCHIAMO
-- select ad anon in modo esplicito. L'anon leggerà solo tramite le viste.
-- (Nessun trigger di coerenza tenant qui: nessuna delle nuove tabelle ha una FK
-- verso una tabella con azienda_id — puntano solo ad aziende e al catalogo
-- globale servizi. Niente scritture cross-tenant possibili.)
-- ----------------------------------------------------------------------------
alter table public.servizi        enable row level security;
alter table public.negozi_servizi enable row level security;
alter table public.orari_apertura enable row level security;
alter table public.chiusure       enable row level security;
alter table public.blocchi_slot   enable row level security;

-- Catalogo globale: leggibile da ogni utente autenticato (serve per scegliere).
drop policy if exists "servizi: catalogo in lettura" on public.servizi;
create policy "servizi: catalogo in lettura" on public.servizi
  for select to authenticated using (true);

drop policy if exists "negozi_servizi: della propria azienda" on public.negozi_servizi;
create policy "negozi_servizi: della propria azienda" on public.negozi_servizi
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "orari: della propria azienda" on public.orari_apertura;
create policy "orari: della propria azienda" on public.orari_apertura
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "chiusure: della propria azienda" on public.chiusure;
create policy "chiusure: della propria azienda" on public.chiusure
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "blocchi_slot: della propria azienda" on public.blocchi_slot;
create policy "blocchi_slot: della propria azienda" on public.blocchi_slot
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- Revoca esplicita di select ad anon (e public) su TUTTE le nuove tabelle.
revoke select on public.servizi        from anon;
revoke select on public.negozi_servizi from anon;
revoke select on public.orari_apertura from anon;
revoke select on public.chiusure       from anon;
revoke select on public.blocchi_slot   from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · Viste pubbliche — l'anon legge SOLO qui, e solo dei negozi pubblicati
-- ----------------------------------------------------------------------------
-- Come negozi_pubblici (008): viste di proprietà del migratore (non
-- security_invoker), filtrate su portale_attivo=true. L'anon riceve select
-- sulla vista, mai sulle tabelle.
--   • orari_pubblici     — slug, giorno, apre, chiude
--   • chiusure_pubbliche — slug, dal, al  (SENZA `motivo`: fatto interno del
--     negozio, non della vetrina)
--   • servizi_pubblici   — slug, codice, etichetta, durata_minuti, ordine
-- blocchi_slot NON ha vista pubblica: i buchi singoli non si mostrano, si
-- sottraggono soltanto quando arriverà slot_liberi().
-- ----------------------------------------------------------------------------
create or replace view public.orari_pubblici
with (security_invoker = false) as
select a.slug, o.giorno, o.apre, o.chiude
from public.orari_apertura o
join public.aziende a on a.id = o.azienda_id
where a.portale_attivo = true;

create or replace view public.chiusure_pubbliche
with (security_invoker = false) as
select a.slug, c.dal, c.al
from public.chiusure c
join public.aziende a on a.id = c.azienda_id
where a.portale_attivo = true;

create or replace view public.servizi_pubblici
with (security_invoker = false) as
select
  a.slug,
  s.codice,
  s.etichetta,
  coalesce(ns.durata_minuti, s.durata_predefinita_minuti) as durata_minuti,
  s.ordine
from public.negozi_servizi ns
join public.aziende a on a.id = ns.azienda_id
join public.servizi s on s.codice = ns.servizio_codice
where ns.attivo = true and a.portale_attivo = true;

comment on view public.chiusure_pubbliche is
  'Vetrina: chiusure dei negozi pubblicati SENZA il motivo (fatto interno del negozio).';

grant select on public.orari_pubblici     to anon;
grant select on public.chiusure_pubbliche to anon;
grant select on public.servizi_pubblici   to anon;

-- ============================================================================
-- Fine 010. anon legge orari/chiusure/servizi solo via le tre viste; le tabelle
-- restano chiuse. blocchi_slot è invisibile al pubblico per costruzione.
-- ============================================================================
