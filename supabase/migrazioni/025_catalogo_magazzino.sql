-- ============================================================================
-- 025 · Catalogo & Magazzino — B3 dell'Era 2
-- ----------------------------------------------------------------------------
-- Famiglie LAC, bolle attese, registro causali, istantanee economiche e
-- pratiche difetto. Additiva su dati e nomi; i movimenti rimangono append-only
-- e la giacenza continua a derivare esclusivamente dal trigger storico.
--
-- Fonti: piano Era 2 §B3 · M3 §2–§4, §10–§11-bis · M5 §4, §7, §10.
-- ============================================================================

-- Il runner `scripts/applica-migrazioni.ts` apre, registra e committa l'unica
-- transazione. Questa migrazione non gestisce transazioni autonome.

-- ── 1 · Famiglie LAC e varianti fisiche on-demand ──────────────────────────
create table if not exists public.lac_modelli (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  fornitore text not null,
  nome text not null,
  tipologia text not null check (tipologia in ('monofocale','multifocale','rigida','semirigida','specialistica')),
  sottotipo text check (sottotipo is null or sottotipo in ('sclerale','ortocheratologia','cheratocono','ibrida','altro')),
  geometria text check (geometria is null or geometria in ('sferica','torica')),
  durata text not null check (durata in ('giornaliera','quindicinale','mensile','trimestrale','semestrale','annuale','convenzionale')),
  pezzi_per_confezione integer not null default 1 check (pezzi_per_confezione > 0),
  bc_disponibili numeric[] not null default '{}'::numeric[],
  dia_disponibili numeric[] not null default '{}'::numeric[],
  parametri_schema jsonb not null default '{}'::jsonb,
  producibilita jsonb not null default '{}'::jsonb,
  upc_mappa jsonb not null default '{}'::jsonb,
  campioni boolean not null default false,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (azienda_id, fornitore, nome)
);
comment on table public.lac_modelli is
  '025/M5: anagrafe della famiglia LAC. Producibilità e UPC mappa informano; le varianti prodotti nascono soltanto per stock fisico.';
comment on column public.lac_modelli.producibilita is
  '025/M5: schema JSON della funzione pura di avviso; un valore fuori catalogo non blocca ordine, codifica o prova.';

alter table public.prodotti
  add column if not exists modello_id uuid references public.lac_modelli(id) on delete set null;
create index if not exists idx_prodotti_modello on public.prodotti (modello_id) where modello_id is not null;

-- Trigger additivo: prodotto e famiglia devono appartenere allo stesso tenant.
drop trigger if exists trg_tenant_prodotti_b3 on public.prodotti;
create trigger trg_tenant_prodotti_b3 before insert or update on public.prodotti
  for each row execute function public.assicura_coerenza_tenant('modello_id','lac_modelli');

drop trigger if exists trg_lac_modelli_updated on public.lac_modelli;
create trigger trg_lac_modelli_updated before update on public.lac_modelli
  for each row execute function public.tocca_updated_at();

alter table public.lac_modelli enable row level security;
drop policy if exists "lac_modelli: della propria azienda" on public.lac_modelli;
create policy "lac_modelli: della propria azienda" on public.lac_modelli
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());
revoke all on public.lac_modelli from anon;

-- ── 2 · Registro causali ed istantanee economiche ──────────────────────────
-- Registro comune, immutabile nei codici: le letture di magazzino usano costo
-- per default; `recupera_costo` distingue reso/rimborso da perdita di negozio.
create table if not exists public.causali_magazzino (
  codice text primary key,
  descrizione text not null,
  recupera_costo boolean not null,
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  check (codice = lower(codice) and codice ~ '^[a-z0-9_]+$')
);
comment on table public.causali_magazzino is
  '025/M3: registro causali di scarico. Il fatto porta un solo perché, riusabile dalle proiezioni cliente e magazzino.';
comment on column public.causali_magazzino.recupera_costo is
  'True per una restituzione al fornitore con riacquisizione economica; false per consumo, danno, furto, smaltimento e perdite interne.';

insert into public.causali_magazzino (codice, descrizione, recupera_costo) values
  ('consumo', 'Consumo interno', false),
  ('errore', 'Errore operativo', false),
  ('furto', 'Furto', false),
  ('danno_negozio', 'Danno in negozio', false),
  ('scaduto', 'Merce scaduta', false),
  ('smaltimento', 'Smaltimento', false),
  ('altro', 'Altra causale', false),
  ('reso_fornitore', 'Reso a fornitore', true),
  ('difetto_conformita', 'Difetto di conformità', true),
  ('errore_checkup', 'Errore di check-up', false),
  ('errore_ricetta_oculista', 'Errore ricetta oculista', false),
  ('insoddisfazione', 'Insoddisfazione cliente', false),
  ('non_adattamento_progressivo', 'Non adattamento progressivo', false)
on conflict (codice) do update
  set descrizione = excluded.descrizione,
      recupera_costo = excluded.recupera_costo;

alter table public.causali_magazzino enable row level security;
drop policy if exists "causali_magazzino: lettura autenticata" on public.causali_magazzino;
create policy "causali_magazzino: lettura autenticata" on public.causali_magazzino
  for select to authenticated using (true);
revoke all on public.causali_magazzino from anon;

create or replace function public.recupera_costo(p_causale text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select recupera_costo from public.causali_magazzino where codice = p_causale and attiva), false)
$$;
comment on function public.recupera_costo(text) is
  '025/M3: restituisce il carattere economico della causale; false per codice assente o inattivo, così non nasce mai un recupero implicito.';
revoke all on function public.recupera_costo(text) from public, anon;
grant execute on function public.recupera_costo(text) to authenticated;

alter table public.movimenti_magazzino
  add column if not exists causale_codice text references public.causali_magazzino(codice),
  add column if not exists valore_costo numeric(12,2),
  add column if not exists valore_prezzo numeric(12,2);

alter table public.movimenti_magazzino
  drop constraint if exists chk_movimenti_valore_costo_b3,
  add constraint chk_movimenti_valore_costo_b3 check (valore_costo is null or valore_costo >= 0) not valid,
  drop constraint if exists chk_movimenti_valore_prezzo_b3,
  add constraint chk_movimenti_valore_prezzo_b3 check (valore_prezzo is null or valore_prezzo >= 0) not valid,
  drop constraint if exists chk_movimenti_causale_tipo_b3,
  add constraint chk_movimenti_causale_tipo_b3 check (
    causale_codice is null or tipo in ('scarico','rettifica','reso_fornitore','danno','uso_interno')
  ) not valid;
comment on column public.movimenti_magazzino.valore_costo is
  '025/M3: istantanea del valore unitario al momento del fatto; analisi e report ragionano a costo per default.';
comment on column public.movimenti_magazzino.valore_prezzo is
  '025/M3: istantanea del prezzo unitario al momento del fatto; non sostituisce il valore a costo.';

-- ── 3 · Bolle attese e ricevimento progressivo ─────────────────────────────
create table if not exists public.bolle_attese (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  fornitore text not null,
  origine_busta_id uuid references public.ordini_occhiali(id) on delete set null,
  origine_lac_id uuid references public.ordini_lac(id) on delete set null,
  riferimento_interno text,
  numero_bolla text,
  lettera_vettura text,
  stato text not null default 'attesa' check (stato in ('attesa','caricata','annullata')),
  note text,
  chiusa_il timestamptz,
  chiusura_nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (origine_busta_id is not null and origine_lac_id is not null)),
  check ((chiusa_il is null) = (chiusura_nota is null))
);
comment on table public.bolle_attese is
  '025/M3: confronto fra merce attesa e fisica. Non muove mai valori o giacenza: lo fanno soltanto i movimenti reali del ricevimento.';
comment on column public.bolle_attese.chiusura_nota is
  'Motivo umano di chiusura di una differenza: arrivata dopo, merce rimandata o bolla rigenerata.';

create table if not exists public.bolle_attese_righe (
  id uuid primary key default uuid_generate_v4(),
  bolla_id uuid not null references public.bolle_attese(id) on delete cascade,
  prodotto_id uuid references public.prodotti(id) on delete set null,
  descrizione text not null,
  upc text,
  q_attesa integer not null check (q_attesa > 0),
  q_caricata integer not null default 0 check (q_caricata >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.bolle_attese_righe is
  '025/M3: riga attesa e ricevuta. q_caricata può superare q_attesa: 3 su 2 si carica 3, con movimento reale separato.';

create or replace function public.guida_stato_bolla_attesa_b3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.stato is distinct from new.stato and not (
    (old.stato = 'attesa' and new.stato in ('caricata','annullata'))
  ) then
    raise exception 'Transizione bolla attesa non ammessa: % → %.', old.stato, new.stato using errcode = '23514';
  end if;
  if old.stato = 'attesa' and new.stato = 'caricata'
     and current_setting('app.ricevimento_b3', true) is distinct from 'on' then
    raise exception 'Lo stato caricata nasce solo dal ricevimento atomico.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.guarda_quantita_riga_bolla_b3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.q_caricata is distinct from new.q_caricata
     and current_setting('app.ricevimento_b3', true) is distinct from 'on' then
    raise exception 'La quantità ricevuta cambia solo con il ricevimento atomico.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guida_stato_bolle_attese_b3 on public.bolle_attese;
create trigger trg_guida_stato_bolle_attese_b3 before update on public.bolle_attese
  for each row execute function public.guida_stato_bolla_attesa_b3();

create index if not exists idx_bolle_attese_azienda_stato on public.bolle_attese (azienda_id, stato, created_at desc);
create index if not exists idx_bolle_attese_differenze on public.bolle_attese (azienda_id, stato) where chiusa_il is null and stato <> 'annullata';
create index if not exists idx_bolle_attese_righe_bolla on public.bolle_attese_righe (bolla_id);

drop trigger if exists trg_bolle_attese_updated on public.bolle_attese;
create trigger trg_bolle_attese_updated before update on public.bolle_attese
  for each row execute function public.tocca_updated_at();
drop trigger if exists trg_bolle_attese_righe_updated on public.bolle_attese_righe;
create trigger trg_bolle_attese_righe_updated before update on public.bolle_attese_righe
  for each row execute function public.tocca_updated_at();
drop trigger if exists trg_tenant_bolle_attese_b3 on public.bolle_attese;
create trigger trg_tenant_bolle_attese_b3 before insert or update on public.bolle_attese
  for each row execute function public.assicura_coerenza_tenant(
    'origine_busta_id','ordini_occhiali', 'origine_lac_id','ordini_lac'
  );

create or replace function public.assicura_tenant_riga_bolla_b3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  azienda_bolla uuid;
begin
  select azienda_id into azienda_bolla from public.bolle_attese where id = new.bolla_id;
  if azienda_bolla is null then
    raise exception using errcode = '23514', message = 'Bolla attesa non trovata.';
  end if;
  if new.prodotto_id is not null and not exists (
    select 1 from public.prodotti where id = new.prodotto_id and azienda_id = azienda_bolla
  ) then
    raise exception using errcode = '23514', message = 'Prodotto di un tenant diverso dalla bolla.';
  end if;
  return new;
end;
$$;
revoke all on function public.assicura_tenant_riga_bolla_b3() from public, anon;

drop trigger if exists trg_tenant_bolle_attese_righe_b3 on public.bolle_attese_righe;
create trigger trg_tenant_bolle_attese_righe_b3 before insert or update on public.bolle_attese_righe
  for each row execute function public.assicura_tenant_riga_bolla_b3();
drop trigger if exists trg_guarda_quantita_bolle_attese_righe_b3 on public.bolle_attese_righe;
create trigger trg_guarda_quantita_bolle_attese_righe_b3 before update on public.bolle_attese_righe
  for each row execute function public.guarda_quantita_riga_bolla_b3();

-- Il ricevimento è un fatto atomico: riga, stato bolla e movimento reale
-- avanzano insieme. Nessuna bolla attesa può aggiornare giacenza da sola.
create or replace function public.ricevi_riga_bolla(
  p_riga_id uuid,
  p_quantita integer,
  p_utente_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bolla_id uuid;
  v_azienda_id uuid;
  v_prodotto_id uuid;
  v_stato text;
  v_numero_bolla text;
  v_costo numeric;
  v_prezzo numeric;
  v_movimento_id uuid;
begin
  if p_quantita < 1 then
    raise exception 'La quantità ricevuta deve essere almeno 1.' using errcode = '23514';
  end if;
  if p_utente_id is distinct from auth.uid() then
    raise exception 'Il ricevimento deve essere firmato dall''utente autenticato.' using errcode = '42501';
  end if;

  select r.bolla_id, b.azienda_id, r.prodotto_id, b.stato, b.numero_bolla
    into v_bolla_id, v_azienda_id, v_prodotto_id, v_stato, v_numero_bolla
    from public.bolle_attese_righe r
    join public.bolle_attese b on b.id = r.bolla_id
   where r.id = p_riga_id
   for update of r, b;

  if v_bolla_id is null then
    raise exception 'Riga bolla non trovata.' using errcode = 'P0002';
  end if;
  if v_stato = 'annullata' then
    raise exception 'Una bolla annullata non può ricevere merce.' using errcode = '23514';
  end if;
  if v_prodotto_id is null then
    raise exception 'Codifica il prodotto prima del ricevimento.' using errcode = '23514';
  end if;

  select costo, prezzo into v_costo, v_prezzo
    from public.prodotti
   where id = v_prodotto_id and azienda_id = v_azienda_id;
  if not found then
    raise exception 'Prodotto della bolla non coerente col tenant.' using errcode = '23514';
  end if;

  perform set_config('app.ricevimento_b3', 'on', true);

  insert into public.movimenti_magazzino (
    azienda_id, prodotto_id, utente_id, tipo, quantita, riferimento, valore_costo, valore_prezzo
  ) values (
    v_azienda_id, v_prodotto_id, p_utente_id, 'carico', p_quantita,
    coalesce('Bolla ' || nullif(v_numero_bolla, ''), 'Ricevimento bolla attesa'),
    v_costo, v_prezzo
  ) returning id into v_movimento_id;

  update public.bolle_attese_righe
     set q_caricata = q_caricata + p_quantita
   where id = p_riga_id;
  update public.bolle_attese
     set stato = 'caricata'
   where id = v_bolla_id and stato = 'attesa';

  return v_movimento_id;
end;
$$;
comment on function public.ricevi_riga_bolla(uuid, integer, uuid) is
  '025/M3: ricevimento atomico di una riga attesa. Aggiorna q_caricata e stato bolla, poi registra il carico reale con istantanee costo/prezzo.';
revoke all on function public.ricevi_riga_bolla(uuid, integer, uuid) from public, anon;
grant execute on function public.ricevi_riga_bolla(uuid, integer, uuid) to authenticated;

alter table public.bolle_attese enable row level security;
alter table public.bolle_attese_righe enable row level security;
drop policy if exists "bolle_attese: della propria azienda" on public.bolle_attese;
create policy "bolle_attese: della propria azienda" on public.bolle_attese
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());
drop policy if exists "bolle_attese_righe: della propria azienda" on public.bolle_attese_righe;
create policy "bolle_attese_righe: della propria azienda" on public.bolle_attese_righe
  for all to authenticated
  using (exists (
    select 1 from public.bolle_attese b
    where b.id = bolla_id and b.azienda_id = public.get_azienda_id()
  ))
  with check (exists (
    select 1 from public.bolle_attese b
    where b.id = bolla_id and b.azienda_id = public.get_azienda_id()
  ));
revoke all on public.bolle_attese, public.bolle_attese_righe from anon;

-- ── 4 · Registro pratiche difetto di conformità ────────────────────────────
create table if not exists public.pratiche_difetto (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  prodotto_id uuid references public.prodotti(id) on delete set null,
  cliente_id uuid references public.clienti(id) on delete set null,
  origine_busta_id uuid references public.ordini_occhiali(id) on delete set null,
  fornitore text not null,
  upc text,
  riferimento_busta text,
  proprieta text not null check (proprieta in ('cliente','esposizione')),
  descrizione text not null,
  foto_refs text[] not null default '{}'::text[],
  stato text not null default 'aperta' check (stato in ('aperta','riconosciuta','respinta','chiusa')),
  esito text check (esito is null or esito in ('sostituzione','rimborso','respinto')),
  accordi_note text,
  aperta_il timestamptz not null default now(),
  chiusa_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((stato = 'chiusa') = (chiusa_il is not null)),
  check (esito is null or stato in ('riconosciuta','respinta','chiusa'))
);
comment on table public.pratiche_difetto is
  '025/M3: registro delle pratiche di difetto conformità per beni cliente o esposizione, con foto-reference e accordi fornitore.';

create or replace function public.guida_stato_pratica_difetto_b3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.stato is distinct from new.stato and not (
    (old.stato = 'aperta' and new.stato in ('riconosciuta','respinta')) or
    (old.stato in ('riconosciuta','respinta') and new.stato = 'chiusa')
  ) then
    raise exception 'Transizione pratica difetto non ammessa: % → %.', old.stato, new.stato using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guida_stato_pratiche_difetto_b3 on public.pratiche_difetto;
create trigger trg_guida_stato_pratiche_difetto_b3 before update on public.pratiche_difetto
  for each row execute function public.guida_stato_pratica_difetto_b3();

create index if not exists idx_pratiche_difetto_azienda_stato on public.pratiche_difetto (azienda_id, stato, aperta_il desc);
drop trigger if exists trg_pratiche_difetto_updated on public.pratiche_difetto;
create trigger trg_pratiche_difetto_updated before update on public.pratiche_difetto
  for each row execute function public.tocca_updated_at();
drop trigger if exists trg_tenant_pratiche_difetto_b3 on public.pratiche_difetto;
create trigger trg_tenant_pratiche_difetto_b3 before insert or update on public.pratiche_difetto
  for each row execute function public.assicura_coerenza_tenant(
    'prodotto_id','prodotti', 'cliente_id','clienti', 'origine_busta_id','ordini_occhiali'
  );

alter table public.pratiche_difetto enable row level security;
drop policy if exists "pratiche_difetto: della propria azienda" on public.pratiche_difetto;
create policy "pratiche_difetto: della propria azienda" on public.pratiche_difetto
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());
revoke all on public.pratiche_difetto from anon;

-- La riga di registro rende la migrazione idempotente anche se il canale che
-- l'applica non è il runner. Non sostituisce mai il runner autorizzato.
insert into public._infra_migrazioni (nome) values ('025_catalogo_magazzino')
on conflict (nome) do nothing;

-- ============================================================================
-- Fine 025. Le bolle sono attese/confrontate, non giacenze contabili; i
-- movimenti reali restano append-only e fotografano valore a costo e prezzo.
-- ============================================================================
