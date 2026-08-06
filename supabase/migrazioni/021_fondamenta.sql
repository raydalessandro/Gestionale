-- ============================================================================
-- 021 · Fondamenta — B1 dell'Era 2
-- ----------------------------------------------------------------------------
-- Le basi che TUTTE le buste successive useranno: consensi (libro mastro),
-- relazioni fra clienti, registri (oculisti, assicurazioni), parametri di
-- negozio, e le colonne additive su `clienti`.
--
-- Fonti: M1 §4 · M2 §4/f2b · M10 §4 · contratti-B1 C3 (invarianti consensi) e
-- C4 (relazioni). Additiva: nessun rename, nessun drop.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0 · IN TESTA — DEFAULT PRIVILEGES (decisione §5-bis dopo S0, 05/08)
-- ----------------------------------------------------------------------------
-- La 020 ha ripulito i grant delle tabelle di OGGI: era una fotografia. Qui si
-- rende INVARIANTE: ogni tabella e ogni funzione create d'ora in poi nascono
-- senza privilegi per `anon` (e le funzioni nemmeno per `PUBLIC` — è la gemella
-- del buco EXECUTE trovato dal rito in S0: `anon` ereditava da PUBLIC).
--
-- ⚠️ CONSEGUENZE DA RICORDARE NELLE MIGRAZIONI FUTURE:
--   · una nuova funzione va accompagnata dal suo `grant execute` esplicito
--     (a `authenticated`, e ad `anon` SOLO se è del portale);
--   · una nuova VISTA del portale va accompagnata dal suo `grant select to anon`
--     esplicito (VP-01): le viste seguono le default privileges delle tabelle.
-- Le quattro viste esistenti conservano i grant che hanno già.
-- ----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from public, anon;

-- Su Supabase gli oggetti possono nascere anche da `supabase_admin`, che ha
-- default privileges PROPRIE. Si TENTA di chiudere anche quelle, ma:
--   · il ruolo NON esiste sul Postgres vergine di `scripts/db-locale.sh`;
--   · su Supabase il ruolo del connettore NON ha il diritto di cambiarle
--     (42501: solo supabase_admin stesso o un superuser).
-- Quindi il blocco è tollerante e NON fa fallire la migrazione.
--
-- ⚠️ LIMITE DICHIARATO (verbalizzato in PR): l'invariante copre gli oggetti
-- creati dal ruolo delle NOSTRE migrazioni — cioè tutti i nostri. Restano
-- fuori quelli creati direttamente da `supabase_admin` (strumenti interni di
-- Supabase): per chiuderli serve una mano dal dashboard, con quel ruolo.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    begin
      execute 'alter default privileges for role supabase_admin in schema public revoke all on tables    from anon';
      execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from public, anon';
      raise notice 'default privileges di supabase_admin: chiuse';
    exception when insufficient_privilege then
      raise notice 'default privileges di supabase_admin: NON modificabili da questo ruolo (42501) — restano aperte, vedi nota in testa';
    end;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · `assicurazioni` — registro MINIMO (M1 §2/§4: si arricchisce col modulo
--     convenzioni). Catalogo GLOBALE come `servizi`: le compagnie sono
--     nazionali, non del singolo negozio → niente azienda_id, lettura a tutti
--     gli autenticati.
--     Semantica di `clienti.assicurazione_id`: null = DA RILEVARE ·
--     voce «NESSUNA» = chiesto, non ne ha · altra voce = quella.
-- ----------------------------------------------------------------------------
create table if not exists public.assicurazioni (
  id     uuid primary key default uuid_generate_v4(),
  nome   text not null unique,
  attivo boolean not null default true
);
comment on table public.assicurazioni is
  'Registro delle assicurazioni sanitarie (M1 §4), catalogo globale come servizi. La voce NESSUNA distingue «chiesto, non ne ha» da «da rilevare» (null su clienti.assicurazione_id).';

insert into public.assicurazioni (nome) values ('NESSUNA')
on conflict (nome) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · `oculisti` — registro per negozio (M2 f2b: inserito AL VOLO alla prima
--     ricetta, poi selezionato). `citta`/`studio` disambiguano gli omonimi
--     (prassi di settore, dominio-ottica §2); la mappa «da quali oculisti
--     arrivano le ricette» è lettura di zona → M9.
-- ----------------------------------------------------------------------------
create table if not exists public.oculisti (
  id         uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  nome       text not null,
  studio     text,
  citta      text,
  note       text,
  attivo     boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.oculisti is
  'Registro degli oculisti esterni da cui arrivano le ricette (M2 f2b). Per negozio; nome+studio disambiguano gli omonimi.';

-- Un oculista per (negozio, nome, studio). Indice funzionale perché `studio` è
-- facoltativo e in un UNIQUE di tabella i NULL non si confrontano fra loro:
-- senza `coalesce`, «Rossi» senza studio potrebbe entrare due volte.
create unique index if not exists uq_oculista_per_negozio
  on public.oculisti (azienda_id, lower(btrim(nome)), lower(coalesce(btrim(studio), '')));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · `parametri` — REGISTRO chiave/valore per negozio (M10 §4).
--     È il posto dove le POLITICHE escono dal codice: fondo cassa, tolleranza
--     di versamento, passo/anticipo/orizzonte degli slot, notazione di default.
-- ----------------------------------------------------------------------------
create table if not exists public.parametri (
  id         uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende (id) on delete cascade,
  chiave     text not null,
  valore     jsonb not null,
  updated_at timestamptz not null default now(),
  unique (azienda_id, chiave)
);
comment on table public.parametri is
  'Politiche di negozio in chiave/valore (M10 §4): fondo_cassa, tolleranza_versamento, notazione_default, passo/anticipo/orizzonte slot… La matrice dei PERMESSI non sta qui: vive in docs/regole/permessi.json.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · `consensi` — IL LIBRO MASTRO (M1 §4 + contratto C3)
--     Eventi = FATTI; lo stato corrente è una CACHE su `clienti`, scritta solo
--     dall'azione del mastro (mai a mano). Nessuna cache per i dati sanitari:
--     quelli si leggono dal mastro, per prescrizione.
-- ----------------------------------------------------------------------------
create table if not exists public.consensi (
  id                   uuid primary key default uuid_generate_v4(),
  azienda_id           uuid not null references public.aziende (id) on delete cascade,
  cliente_id           uuid not null references public.clienti (id) on delete cascade,
  tipo                 text not null check (tipo in ('marketing','dati_sanitari')),
  prescrizione_id      uuid references public.prescrizioni (id) on delete set null,
  azione               text not null check (azione in ('dato','revocato')),
  canali               text[],
  modalita             text check (modalita in ('penna','digitale')),
  versione_informativa text,
  documento_ref        uuid,
  utente_id            uuid references public.utenti (id) on delete set null,
  avvenuto_il          timestamptz not null default now(),

  -- ── C3 · gli invarianti, a DB ──────────────────────────────────────────
  -- (1) il sanitario è PER PRESCRIZIONE e non ha canali
  constraint consensi_sanitario_per_rx check (
    tipo <> 'dati_sanitari' or (prescrizione_id is not null and canali is null)
  ),
  -- (2) il marketing non punta a una prescrizione
  constraint consensi_marketing_senza_rx check (
    tipo <> 'marketing' or prescrizione_id is null
  ),
  -- (3) marketing DATO: almeno un canale, tutti leciti, e la modalità di firma
  --
  -- ⚠️ `cardinality`, NON `array_length`. Su un array vuoto `array_length(x,1)`
  -- torna **NULL**, non 0: il confronto `>= 1` diventa NULL, l'intera CHECK
  -- vale NULL, e una CHECK che vale NULL **accetta** (rifiuta solo su FALSE).
  -- Con `array_length` il consenso marketing «dato» con canali `{}` entrava —
  -- cioè un consenso senza alcun canale, che C3 vieta. `cardinality('{}')` è 0
  -- e il confronto è FALSE, quindi la riga viene rifiutata davvero.
  constraint consensi_dato_marketing_canali check (
    not (azione = 'dato' and tipo = 'marketing')
    or (canali is not null
        and cardinality(canali) >= 1
        and canali <@ array['email','cellulare','cartaceo']::text[]
        and modalita is not null)
  ),
  -- (4) la revoca è totale per TIPO: non porta canali
  constraint consensi_revoca_senza_canali check (
    azione <> 'revocato' or canali is null
  )
);
comment on table public.consensi is
  'Libro mastro dei consensi (M1 §4, contratto C3). Eventi immutabili; clienti.consenso_marketing/consenso_canali sono la CACHE dell''ultimo evento marketing COMMESSO, scritta solo dall''azione del mastro. Per i dati sanitari nessuna cache: si legge qui, per prescrizione.';

-- Riparazione idempotente del vincolo (3). Su un database dove la 021 è già
-- passata, il `create table if not exists` qui sopra non tocca nulla: il
-- vincolo resterebbe quello vecchio, col buco di `array_length`. Qui lo si
-- rifà sempre — su un DB nuovo è un giro a vuoto, su uno già passato è la
-- correzione.
--
-- Si rifà `not valid`, e questo è il punto: il mastro è un libro di FATTI e la
-- 021 non ne cancella nessuno (G28b). `not valid` blocca da subito ogni riga
-- NUOVA — l'enforcement su insert/update è pieno — e lascia stare le righe
-- vecchie invece di pretenderle in regola o farle sparire. Poi, se il mastro
-- è già pulito (il caso normale), il vincolo si valida qui sotto e resta
-- pieno a tutti gli effetti. Se righe rotte ci sono, la migrazione NON cade:
-- resta il vincolo che morde in avanti e le righe restano visibili, da
-- guardare a mano — che è come si tratta un fatto sbagliato in un mastro.
alter table public.consensi drop constraint if exists consensi_dato_marketing_canali;
alter table public.consensi add  constraint consensi_dato_marketing_canali check (
  not (azione = 'dato' and tipo = 'marketing')
  or (canali is not null
      and cardinality(canali) >= 1
      and canali <@ array['email','cellulare','cartaceo']::text[]
      and modalita is not null)
) not valid;

do $$
begin
  if not exists (
    select 1 from public.consensi
     where azione = 'dato' and tipo = 'marketing'
       and coalesce(cardinality(canali), 0) = 0
  ) then
    alter table public.consensi validate constraint consensi_dato_marketing_canali;
  else
    raise warning 'consensi: righe marketing «dato» senza canali già presenti — il vincolo resta NOT VALID e morde solo in avanti. Vanno guardate a mano.';
  end if;
end $$;

create index if not exists idx_consensi_cliente on public.consensi (cliente_id, tipo, avvenuto_il desc);
create index if not exists idx_consensi_rx      on public.consensi (prescrizione_id) where prescrizione_id is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · `clienti_relazioni` — UNA riga, letta nei DUE versi (M1 §4 + contratto C4)
--     Le inverse NON si materializzano mai: l'etichetta «genitore di / figlio
--     di» è derivata a video.
-- ----------------------------------------------------------------------------
create table if not exists public.clienti_relazioni (
  id          uuid primary key default uuid_generate_v4(),
  azienda_id  uuid not null references public.aziende (id) on delete cascade,
  cliente_id  uuid not null references public.clienti (id) on delete cascade,
  relativo_id uuid not null references public.clienti (id) on delete cascade,
  tipo        text not null check (tipo in ('tutore_legale','padre','madre','figlio','fratello','sorella')),
  note        text,
  created_at  timestamptz not null default now(),
  -- C4 · nessuno è parente di sé stesso
  constraint clienti_relazioni_non_se_stesso check (cliente_id <> relativo_id),
  unique (cliente_id, relativo_id, tipo)
);
comment on table public.clienti_relazioni is
  'Relazioni fra clienti (M1 §4, contratto C4): UNA riga fisica, letta nei due versi. Il tutore può essere persona o ENTE. Nessuna visibilità né permesso deriva da una relazione.';

-- C4 · la blindatura: una coppia = AL PIÙ UNA relazione familiare, in
-- qualunque verso. `tutore_legale` è categoria a parte e può coesistere.
-- L'indice funzionale rende impossibile la doppia anche a un bug dell'azione.
create unique index if not exists uq_relazione_familiare_per_coppia
  on public.clienti_relazioni (
    azienda_id,
    least(cliente_id, relativo_id),
    greatest(cliente_id, relativo_id)
  )
  where tipo in ('padre','madre','figlio','fratello','sorella');

create index if not exists idx_relazioni_relativo on public.clienti_relazioni (relativo_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · `clienti` — le colonne additive di B1
--     `consenso_marketing` esiste già dallo schema base: `if not exists` la
--     rende una no-op (idempotenza).
-- ----------------------------------------------------------------------------
alter table public.clienti add column if not exists assicurazione_id        uuid references public.assicurazioni (id) on delete set null;
alter table public.clienti add column if not exists azienda_convenzionata_id uuid references public.clienti (id) on delete set null;
alter table public.clienti add column if not exists dati_fatturazione       jsonb;
alter table public.clienti add column if not exists consenso_marketing      boolean not null default false;
alter table public.clienti add column if not exists consenso_canali         text[];
alter table public.clienti add column if not exists anonimizzato_il         timestamptz;

comment on column public.clienti.assicurazione_id is
  'M1 §2: null = DA RILEVARE · voce NESSUNA = chiesto, non ne ha · altra voce = quella. Il cancello sconti (M8) è anche il punto di raccolta del dato.';
comment on column public.clienti.azienda_convenzionata_id is
  'L''azienda convenzionata è essa stessa una scheda cliente (come l''ENTE tutore di f1d). Il registro pieno delle convenzioni arriva col suo modulo.';
comment on column public.clienti.consenso_canali is
  'CACHE dei canali dall''ultimo evento marketing del mastro (C3). Non si scrive mai direttamente: solo l''azione dei consensi.';
comment on column public.clienti.anonimizzato_il is
  'Valorizzata da anonimizza_cliente (C1): esclude il cliente da ricerche, code e letture. I FATTI aziendali restano integri.';

create index if not exists idx_clienti_non_anonimi on public.clienti (azienda_id) where anonimizzato_il is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · Sicurezza — RLS e policy (lo standard delle tabelle esistenti)
-- ----------------------------------------------------------------------------
alter table public.assicurazioni     enable row level security;
alter table public.oculisti          enable row level security;
alter table public.parametri         enable row level security;
alter table public.consensi          enable row level security;
alter table public.clienti_relazioni enable row level security;

-- Catalogo globale: leggibile da ogni autenticato (come `servizi`); si scrive
-- con le migrazioni o col modulo convenzioni, non dall'app.
drop policy if exists "assicurazioni: catalogo in lettura" on public.assicurazioni;
create policy "assicurazioni: catalogo in lettura" on public.assicurazioni
  for select to authenticated using (true);

drop policy if exists "oculisti: della propria azienda" on public.oculisti;
create policy "oculisti: della propria azienda" on public.oculisti
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "parametri: della propria azienda" on public.parametri;
create policy "parametri: della propria azienda" on public.parametri
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "consensi: della propria azienda" on public.consensi;
create policy "consensi: della propria azienda" on public.consensi
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "clienti_relazioni: della propria azienda" on public.clienti_relazioni;
create policy "clienti_relazioni: della propria azienda" on public.clienti_relazioni
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- Igiene esplicita: le default privileges del punto 0 valgono per il futuro,
-- ma queste tabelle nascono ORA — nessun grant ad anon, in nessun caso.
revoke all on public.assicurazioni     from anon;
revoke all on public.oculisti          from anon;
revoke all on public.parametri         from anon;
revoke all on public.consensi          from anon;
revoke all on public.clienti_relazioni from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 8 · Coerenza tenant (DB-01, migrazione 008): nega le FK incrociate fra
--     aziende. Ricorda: l'errore atteso è SEMPRE `23514`, mai `23503`.
--     `clienti` entra ora nell'elenco: prima non aveva FK verso tabelle con
--     azienda_id, adesso ha `azienda_convenzionata_id` che punta a `clienti`.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_tenant on public.consensi;
create trigger trg_tenant before insert or update on public.consensi
  for each row execute function public.assicura_coerenza_tenant(
    'cliente_id','clienti','prescrizione_id','prescrizioni','utente_id','utenti');

drop trigger if exists trg_tenant on public.clienti_relazioni;
create trigger trg_tenant before insert or update on public.clienti_relazioni
  for each row execute function public.assicura_coerenza_tenant(
    'cliente_id','clienti','relativo_id','clienti');

drop trigger if exists trg_tenant on public.clienti;
create trigger trg_tenant before insert or update on public.clienti
  for each row execute function public.assicura_coerenza_tenant(
    'azienda_convenzionata_id','clienti');

drop trigger if exists trg_parametri_updated on public.parametri;
create trigger trg_parametri_updated before update on public.parametri
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 9 · Registro delle migrazioni (regola permanente della 020).
-- ----------------------------------------------------------------------------
insert into public._infra_migrazioni (nome) values ('021_fondamenta')
on conflict (nome) do nothing;

-- ============================================================================
-- Fine 021. Le fondamenta ci sono: i consensi hanno un mastro con gli
-- invarianti a DB, una coppia non può avere due relazioni familiari nemmeno
-- per errore, le politiche di negozio hanno dove stare, e da qui in avanti
-- nessuna tabella e nessuna funzione nasce aperta ad `anon`.
-- ============================================================================

-- ============================================================================
-- 10 · LE FUNZIONI DEI CONTRATTI
-- ----------------------------------------------------------------------------
-- Perché a DB e non nell'azione: C3 pretende lock + insert + cache NELLA STESSA
-- TRANSAZIONE, e C1 pretende UNA transazione sola. Il client Supabase non ha
-- transazioni: una RPC è l'unico modo di ottenerle.
--
-- Sono `security INVOKER` (non definer): girano come l'utente autenticato,
-- quindi la RLS continua a valere. Il permesso lo verifica l'azione con
-- `richiedi()` (C2) PRIMA di chiamarle: qui dentro si difendono gli INVARIANTI,
-- non i ruoli.
--
-- ⚠️ Le default privileges del punto 0 tolgono EXECUTE a PUBLIC: ogni funzione
-- qui sotto ha il suo `grant execute to authenticated` esplicito.
-- ============================================================================

-- ── C3 · il mastro dei consensi ─────────────────────────────────────────────
-- Il lock sulla riga cliente serializza gli eventi concorrenti: la cache
-- riflette l'ultimo COMMIT per costruzione, senza confronti di timestamp.
create or replace function public.registra_consenso(
  p_cliente_id      uuid,
  p_tipo            text,
  p_azione          text,
  p_canali          text[]  default null,
  p_modalita        text    default null,
  p_prescrizione_id uuid    default null,
  p_versione        text    default null,
  p_documento_ref   uuid    default null
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog as $$
declare
  v_az uuid;
  v_id uuid;
begin
  -- (1) lock della riga cliente: da qui gli eventi si mettono in fila
  select azienda_id into v_az from public.clienti where id = p_cliente_id for update;
  if v_az is null then raise exception 'CLIENTE_NON_TROVATO'; end if;

  -- (2) l'evento (i CHECK della tabella difendono gli invarianti C3)
  insert into public.consensi (
    azienda_id, cliente_id, tipo, prescrizione_id, azione, canali, modalita,
    versione_informativa, documento_ref, utente_id
  ) values (
    v_az, p_cliente_id, p_tipo, p_prescrizione_id, p_azione, p_canali, p_modalita,
    p_versione, p_documento_ref, auth.uid()
  ) returning id into v_id;

  -- (3) la cache — SOLO per il marketing (per i dati sanitari si legge il mastro)
  if p_tipo = 'marketing' then
    update public.clienti
       set consenso_marketing = (p_azione = 'dato'),
           consenso_canali    = case when p_azione = 'dato' then p_canali else null end,
           data_consenso      = case when p_azione = 'dato' then now() else data_consenso end,
           updated_at         = now()
     where id = p_cliente_id;
  end if;

  return v_id;
end $$;
comment on function public.registra_consenso(uuid,text,text,text[],text,uuid,text,uuid) is
  'C3: scrive UN evento nel mastro e riallinea la cache marketing su clienti, nella stessa transazione, sotto lock della riga cliente. La cache non si scrive mai altrove.';
revoke execute on function public.registra_consenso(uuid,text,text,text[],text,uuid,text,uuid) from public, anon;
grant  execute on function public.registra_consenso(uuid,text,text,text[],text,uuid,text,uuid) to authenticated;

-- La revoca è il gesto operativo del tasto: totale per tipo, senza canali.
create or replace function public.revoca_marketing(p_cliente_id uuid, p_modalita text default null)
returns uuid
language sql security invoker set search_path = public, pg_catalog as $$
  select public.registra_consenso(p_cliente_id, 'marketing', 'revocato', null, p_modalita, null, null, null);
$$;
comment on function public.revoca_marketing(uuid,text) is
  'C3: revoca totale del marketing (tasto della scheda). I richiami COMMERCIALI si fermano subito; gli operativi restano leciti.';
revoke execute on function public.revoca_marketing(uuid,text) from public, anon;
grant  execute on function public.revoca_marketing(uuid,text) to authenticated;

-- ── C4 · relazioni ──────────────────────────────────────────────────────────
-- La guardia di coppia sta QUI (per dare l'errore parlante con la riga
-- esistente); l'indice unico funzionale resta la blindatura sotto.
create or replace function public.crea_relazione(
  p_cliente_id uuid, p_relativo_id uuid, p_tipo text, p_note text default null
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog as $$
declare
  v_az uuid; v_az2 uuid; v_esistente record; v_id uuid;
  c_familiari constant text[] := array['padre','madre','figlio','fratello','sorella'];
begin
  if p_cliente_id = p_relativo_id then raise exception 'relazione_con_se_stesso'; end if;

  select azienda_id into v_az  from public.clienti where id = p_cliente_id;
  select azienda_id into v_az2 from public.clienti where id = p_relativo_id;
  if v_az is null or v_az2 is null then raise exception 'CLIENTE_NON_TROVATO'; end if;

  -- guardia di coppia: una sola familiare fra due persone, in QUALUNQUE verso.
  if p_tipo = any (c_familiari) then
    select r.id, r.tipo, r.cliente_id, r.relativo_id into v_esistente
    from public.clienti_relazioni r
    where r.tipo = any (c_familiari)
      and ((r.cliente_id = p_cliente_id and r.relativo_id = p_relativo_id)
        or (r.cliente_id = p_relativo_id and r.relativo_id = p_cliente_id))
    limit 1;
    if found then
      raise exception 'gia_in_relazione: % (riga %)', v_esistente.tipo, v_esistente.id;
    end if;
  end if;

  insert into public.clienti_relazioni (azienda_id, cliente_id, relativo_id, tipo, note)
  values (v_az, p_cliente_id, p_relativo_id, p_tipo, p_note)
  returning id into v_id;
  return v_id;
end $$;
comment on function public.crea_relazione(uuid,uuid,text,text) is
  'C4: UNA riga, mai le inverse. Vieta il sé stesso e la seconda relazione familiare fra la stessa coppia in qualunque verso (errore gia_in_relazione con la riga esistente). Il tutore_legale è categoria a parte e può coesistere.';
revoke execute on function public.crea_relazione(uuid,uuid,text,text) from public, anon;
grant  execute on function public.crea_relazione(uuid,uuid,text,text) to authenticated;

-- ── Registro oculisti: al volo alla prima ricetta (M2 f2b) ──────────────────
create or replace function public.crea_oculista_al_volo(
  p_nome text, p_studio text default null, p_citta text default null
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog as $$
declare v_az uuid; v_id uuid;
begin
  v_az := public.get_azienda_id();
  if v_az is null then raise exception 'NON_AUTENTICATO'; end if;
  if coalesce(btrim(p_nome),'') = '' then raise exception 'NOME_OBBLIGATORIO'; end if;

  select id into v_id from public.oculisti
   where azienda_id = v_az
     and lower(btrim(nome)) = lower(btrim(p_nome))
     and lower(coalesce(btrim(studio),'')) = lower(coalesce(btrim(p_studio),''));
  if found then return v_id; end if;   -- già in registro: si seleziona, non si duplica

  insert into public.oculisti (azienda_id, nome, studio, citta)
  values (v_az, btrim(p_nome), nullif(btrim(p_studio),''), nullif(btrim(p_citta),''))
  returning id into v_id;
  return v_id;
end $$;
comment on function public.crea_oculista_al_volo(text,text,text) is
  'M2 f2b: inserito al volo alla prima ricetta, poi selezionato. Idempotente su (negozio, nome, studio) normalizzati.';
revoke execute on function public.crea_oculista_al_volo(text,text,text) from public, anon;
grant  execute on function public.crea_oculista_al_volo(text,text,text) to authenticated;

insert into public._infra_migrazioni (nome) values ('021_fondamenta') on conflict (nome) do nothing;

-- ============================================================================
-- 11 · C1 · ANONIMIZZAZIONE — «possibile, non comodissima» (M1 f1e.2)
-- ----------------------------------------------------------------------------
-- I FATTI aziendali restano integri e leggibili; sparisce la RICONOSCIBILITÀ
-- della persona. Una sola transazione (per questo è una funzione).
--
-- ⚠️ MISURATO PRIMA DI SCRIVERE (verbalizzato in PR): la risposta C1(2) dice
-- «telefono_grezzo → NULL, così l'anonimo esce dalla dedup perché un NULL non
-- partecipa all'indice unico». Corretto in principio, MA qui il NULL non
-- arriva all'indice: `telefono_normalizzato` è una colonna GENERATA e
-- `normalizza_telefono(NULL)` restituisce **''** (stringa vuota), non NULL.
-- Col vincolo unico sulla colonna generata, il SECONDO anonimizzato
-- collidereb­be col primo su ''.
-- Si ottiene l'intento con la modifica di vincolo che C1 stessa sancisce
-- lecita: l'unicità diventa PARZIALE, «solo sui telefoni veri».
-- ----------------------------------------------------------------------------
alter table public.persone alter column telefono_grezzo drop not null;

-- L'unicità dei telefoni VERI resta intatta; le righe anonime (normalizzato
-- vuoto) non partecipano più — è esattamente «uscire dalla dedup».
alter table public.persone drop constraint if exists persone_telefono_normalizzato_key;
create unique index if not exists uq_persone_telefono_reale
  on public.persone (telefono_normalizzato)
  where telefono_normalizzato <> '';

comment on column public.persone.telefono_grezzo is
  'Chiave di dedup della persona. NULL solo dopo l''anonimizzazione (C1): la riga esce dalla dedup — l''unicità è parziale, «solo sui telefoni veri» (uq_persone_telefono_reale).';

-- C1 · voce 6 (decisa 05/08): `persone` è identità di PIATTAFORMA e non ha
-- azienda_id — la stessa riga sta su prenotazioni di negozi diversi. Perché
-- l'anonimizzazione di UN negozio non tocchi il grafo altrui, le prenotazioni
-- di quel negozio devono poter LASCIARE ANDARE la persona: `persona_id` diventa
-- annullabile. È la modifica-di-vincolo che C1 sancisce lecita, la stessa già
-- usata su `persone.telefono_grezzo`: si allenta, non si droppa.
alter table public.prenotazioni alter column persona_id drop not null;
comment on column public.prenotazioni.persona_id is
  'La persona del portale che ha prenotato. NULL solo dopo lo SGANCIO dell''anonimizzazione (C1, voce 6): il fatto resta, il filo verso l''identità di piattaforma no. Chi legge non deve presumerlo valorizzato.';

-- ⚠️ L'UNICA `security definer` della 021, e la ragione è una sola.
-- `persone` ha RLS attiva **senza policy** (011 §8, ID-01): nessuno la legge né
-- la scrive, nemmeno l'ottico autenticato — ci arrivano solo le funzioni
-- definer. Sotto `security invoker` l'UPDATE della parte-persone non trovava
-- righe e passava in **silenzio**: `anonimizza_cliente` rispondeva «fatto» e
-- lasciava in piedi nome, email e telefono della persona del portale. È il
-- «punto sorvegliato» che il test di contratto prediceva per nome.
--
-- Il prezzo di una definer è che la RLS non protegge più il tenant. Qui il
-- tenant lo protegge la GUARDIA ESPLICITA dei punti (1) e (2): l'azienda si
-- prende dal JWT del chiamante, mai da un parametro (un parametro sarebbe
-- scavalcabile chiamando la funzione fuori dall'azione), e il cliente deve
-- essere di quell'azienda.
--
-- ── C1 · voce 6 (decisa 05/08): SGANCIA-E-SE-ORFANA-ANONIMIZZA ──────────────
-- `persone` è identità di PIATTAFORMA: la stessa riga sta su prenotazioni di
-- negozi diversi, perché la dedup sul telefono è globale. Sbiancarla a comando
-- di UN negozio porterebbe via il contatto anche all'altro. Quindi:
--   (3) SGANCIO — le prenotazioni di QUESTO negozio per QUESTO cliente
--       lasciano andare la persona (`persona_id → NULL`) e azzerano le PROPRIE
--       istantanee di contatto: il fatto resta, il nome no.
--   (4) la riga `persone` si anonimizza SOLO SE ORFANA dopo lo sgancio. Se è
--       viva altrove resta INTATTA: il negozio B non perde nulla, e il negozio
--       A non la raggiunge più da nessun suo dato. Tenant-safe per costruzione.
-- E qui la definer serve una seconda volta, non solo per la RLS di `persone`:
-- sapere se la persona è orfana vuol dire GUARDARE LE PRENOTAZIONI DEGLI ALTRI
-- NEGOZI, che sotto invoker la RLS nasconde. Sotto invoker l'orfanità sarebbe
-- sempre «sì», e si tornerebbe a sbiancare il grafo altrui.
create or replace function public.anonimizza_persone_del_cliente(p_cliente_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_az      uuid;
  v_persone uuid[];
  v_n       integer := 0;
begin
  -- (1) l'azienda del CHIAMANTE, dal suo JWT
  v_az := public.get_azienda_id();
  if v_az is null then raise exception 'CLIENTE_NON_TROVATO'; end if;

  -- (2) il cliente dev'essere SUO. Dentro una definer la RLS non filtra più:
  --     questo confronto è ciò che sta al posto della policy. Il messaggio è
  --     lo stesso del cliente inesistente, apposta: da fuori non si distingue
  --     «non è tuo» da «non c'è», che è quanto dice il tenant di sé.
  if not exists (
    select 1 from public.clienti c
     where c.id = p_cliente_id and c.azienda_id = v_az
  ) then
    raise exception 'CLIENTE_NON_TROVATO';
  end if;

  -- Chi era attaccato, PRIMA di sganciare: dopo l'update `returning` darebbe i
  -- valori nuovi, cioè NULL, e l'orfanità non si potrebbe più chiedere.
  select coalesce(array_agg(distinct pr.persona_id), '{}')
    into v_persone
  from public.prenotazioni pr
  where pr.cliente_id = p_cliente_id
    and pr.azienda_id = v_az
    and pr.persona_id is not null;

  -- (3) SGANCIO + istantanee di contatto (in mappa C1 dal 05/08). `contatto_nome`
  --     e `contatto_telefono` sono NOT NULL e restano tali: si applica la regola
  --     già usata su `persone.nome` — «il NOT NULL si rispetta, l'identità
  --     sparisce». Il vincolo è una garanzia sulle prenotazioni NUOVE e non si
  --     allenta per ripulire le vecchie.
  update public.prenotazioni pr set
    persona_id        = null,
    contatto_nome     = 'Anonimo',
    contatto_telefono = '',
    contatto_email    = null,
    updated_at        = now()
  where pr.cliente_id = p_cliente_id
    and pr.azienda_id = v_az;

  -- (4) …e solo ora l'orfanità, che è vera perché lo sgancio è già avvenuto.
  --     NOTA · `lista_attesa` NON è nella mappa C1 e non viene toccata: una sua
  --     riga tiene quindi la persona NON orfana, e la riga resta intatta. È la
  --     scelta conservativa (non sbianca mai chi è ancora agganciato); se la
  --     mappa dovrà comprenderla, è una decisione di regia, non di qui.
  update public.persone p set
    email           = 'anon-' || p.id::text || '@invalid',
    nome            = 'Anonimo',        -- il NOT NULL si rispetta, l'identità sparisce
    telefono_grezzo = null,             -- esce dalla dedup (indice unico parziale)
    updated_at      = now()
  where p.id = any (v_persone)
    and not exists (select 1 from public.prenotazioni pr2 where pr2.persona_id = p.id)
    and not exists (select 1 from public.lista_attesa  la  where la.persona_id  = p.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
comment on function public.anonimizza_persone_del_cliente(uuid) is
  'C1 voce 6, parte-persone: SGANCIA-E-SE-ORFANA-ANONIMIZZA. Le prenotazioni del negozio chiamante lasciano andare la persona (persona_id→NULL) e azzerano le proprie istantanee contatto_*; la riga `persone` si anonimizza SOLO se non resta agganciata a nessuna prenotazione né lista d''attesa (di NESSUNA azienda) — altrove viva, resta intatta. UNICA security DEFINER della 021, per due ragioni: `persone` ha RLS senza policy (ID-01), e l''orfanità si può leggere solo vedendo le prenotazioni degli altri negozi. Il tenant è protetto dalla guardia esplicita interna (azienda dal JWT + cliente della propria azienda). Torna il numero di persone ANONIMIZZATE (0 se tutte ancora vive altrove).';
revoke execute on function public.anonimizza_persone_del_cliente(uuid) from public, anon;
grant  execute on function public.anonimizza_persone_del_cliente(uuid) to authenticated;

create or replace function public.anonimizza_cliente(p_cliente_id uuid)
returns void
language plpgsql security invoker set search_path = public, pg_catalog as $$
declare
  v_az uuid;
begin
  select azienda_id into v_az from public.clienti where id = p_cliente_id for update;
  if v_az is null then raise exception 'CLIENTE_NON_TROVATO'; end if;

  -- ── clienti: la mappa C1, campo per campo ────────────────────────────────
  update public.clienti set
    nome                    = 'Cliente',
    cognome                 = 'Anonimizzato-' || left(id::text, 8),
    secondo_nome            = null,
    codice_fiscale          = null,
    data_nascita            = null,
    sesso                   = null,
    email                   = null,
    telefono                = null,
    telefono_casa           = null,
    telefono_lavoro         = null,
    indirizzo               = null,
    indirizzo2              = null,
    cap                     = null,
    citta                   = null,
    provincia               = null,
    nazione                 = null,
    note                    = null,
    dati_fatturazione       = null,
    canale_preferito        = null,
    assicurazione_id        = null,
    azienda_convenzionata_id = null,
    tutore_legale           = null,   -- testo legacy: identifica un TERZO per nome
    lingua                  = null,
    tags                    = '{}',
    non_contattare          = true,   -- i flag operativi si spengono in senso RESTRITTIVO
    consenso_marketing      = false,  -- cache spente
    consenso_canali         = null,
    data_consenso           = null,
    consenso_dati_sanitari  = null,
    consenso_sanitario_il   = null,
    -- `fonte` RESTA: statistica aziendale, non identifica (C1, 05/08)
    anonimizzato_il         = now(),
    updated_at              = now()
  where id = p_cliente_id;

  -- ── consensi: le righe SI CONSERVANO (fatti storici su identità anonima) ──
  update public.consensi set documento_ref = null where cliente_id = p_cliente_id;

  -- ── relazioni: si CANCELLANO (de-anonimizzano per prossimità) ────────────
  delete from public.clienti_relazioni
   where cliente_id = p_cliente_id or relativo_id = p_cliente_id;

  -- ── clinico e agenda: si conservano, i testi liberi no ───────────────────
  update public.prescrizioni  set note = null where cliente_id = p_cliente_id;
  update public.appuntamenti  set note = null where cliente_id = p_cliente_id;
  update public.richiami      set note = null where cliente_id = p_cliente_id;
  update public.prenotazioni  set note = null where cliente_id = p_cliente_id;

  -- ── la persona del PORTALE collegata alle prenotazioni ───────────────────
  -- Sta in una sotto-funzione a privilegio del proprietario, non qui: `persone`
  -- ha RLS senza policy, e da questa funzione — che è e resta INVOKER — quel-
  -- l'UPDATE non troverebbe righe e passerebbe in silenzio. Perimetro e guardia
  -- di tenant sono scritti dentro la sotto-funzione, esplicitamente.
  perform public.anonimizza_persone_del_cliente(p_cliente_id);

  -- ── ordini: FATTI + istantanee Rx intatti, via i testi liberi ────────────
  update public.ordini_occhiali set note = null where cliente_id = p_cliente_id;
  update public.ordini_lac       set note = null where cliente_id = p_cliente_id;

  -- ── vendite: fatti fiscali INTATTI, via il codice fiscale ────────────────
  update public.vendite set cf_cliente = null where cliente_id = p_cliente_id;

  -- movimenti_*, resi, chiusure_cassa, fermi: INTATTI per contratto.
end $$;
comment on function public.anonimizza_cliente(uuid) is
  'C1: rende irriconoscibile la persona lasciando integri i FATTI aziendali (vendite, ordini, movimenti). Una sola transazione. Il permesso «anonimizzazione» lo verifica l''azione con richiedi() PRIMA di chiamarla.';
revoke execute on function public.anonimizza_cliente(uuid) from public, anon;
grant  execute on function public.anonimizza_cliente(uuid) to authenticated;

-- La rimozione di una relazione è una DELETE legittima: `clienti_relazioni` è
-- ANAGRAFE (un legame), non un FATTO — e C1 stessa le cancella. Vive qui come
-- RPC, non nell'azione, perché la guardia G1 vieta `.delete()` in
-- `lib/actions.ts`: la regola di casa resta intatta e l'eccezione è esplicita.
-- ⚠️ RIFATTA QUI (l'originale è nella 018): da C1 voce 6 `prenotazioni.persona_id`
-- può essere NULL — lo SGANCIO dell'anonimizzazione — e il passo (d) di questa
-- funzione scrive `persona_id` nel registro, che è NOT NULL. Senza la guardia
-- l'operatore prenderebbe un 23502 crudo. Il resto del corpo è quello della 018,
-- invariato: se un giorno la 018 cambia, questa va riallineata (è il prezzo del
-- `create or replace`, ed è la stessa strada già percorsa da 013/014/016 su
-- `crea_prenotazione`).
create or replace function public.prendi_persona_come_cliente(
  p_prenotazione_id uuid,
  p_cliente_id      uuid default null   -- valorizzato = collega quell'esistente; null = crea
) returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_az       uuid := public.get_azienda_id();
  v_utente   uuid := auth.uid();
  r          record;
  v_cli      uuid;
  v_prec     uuid;         -- ottico_di_riferimento precedente (→ da_azienda nel registro)
  v_nome_pieno text;
  v_nome     text;
  v_cognome  text;
  v_spazio   int;
begin
  if v_az is null then raise exception 'NON_AUTENTICATO'; end if;

  select p.id, p.azienda_id, p.stato, p.persona_id, p.appuntamento_id, p.cliente_id,
         p.contatto_nome, p.contatto_telefono, p.fonte
    into r
  from public.prenotazioni p
  where p.id = p_prenotazione_id;
  if not found            then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if r.azienda_id <> v_az then raise exception 'NON_TUA'; end if;
  if r.stato <> 'accettata' then raise exception 'NON_ACCETTATA'; end if;

  -- idempotenza: già presa → ritorna il cliente collegato, niente doppi.
  if r.cliente_id is not null then
    return r.cliente_id;
  end if;

  -- C1 · voce 6: se l'anonimizzazione ha SGANCIATO la persona, qui non c'è più
  -- nessuno da prendere come cliente. Senza questo controllo il passo (d)
  -- proverebbe a scrivere un persona_id NULL nel registro (NOT NULL) e
  -- l'operatore vedrebbe un 23502 crudo invece di una frase.
  if r.persona_id is null then
    raise exception 'PRENOTAZIONE_SGANCIATA';
  end if;

  -- (a) cliente: collega il proprio esistente o creane uno nuovo.
  if p_cliente_id is not null then
    select c.id into v_cli from public.clienti c
    where c.id = p_cliente_id and c.azienda_id = v_az;
    if v_cli is null then raise exception 'CLIENTE_NON_TUO'; end if;
  else
    -- nome unico dalla prenotazione → nome/cognome (best-effort: primo token /
    -- resto). Il cognome mancante resta '—' da completare: non si perde nulla.
    v_nome_pieno := btrim(coalesce(r.contatto_nome, ''));
    if v_nome_pieno = '' then v_nome_pieno := 'Cliente'; end if;
    v_spazio := position(' ' in v_nome_pieno);
    if v_spazio > 0 then
      v_nome    := btrim(substr(v_nome_pieno, 1, v_spazio - 1));
      v_cognome := btrim(substr(v_nome_pieno, v_spazio + 1));
    else
      v_nome    := v_nome_pieno;
      v_cognome := '—';
    end if;
    if v_cognome = '' then v_cognome := '—'; end if;

    insert into public.clienti (azienda_id, nome, cognome, telefono, fonte)
    values (v_az, v_nome, v_cognome, r.contatto_telefono, r.fonte)
    returning clienti.id into v_cli;
  end if;

  -- (b) collega il cliente all'appuntamento e alla prenotazione.
  if r.appuntamento_id is not null then
    update public.appuntamenti set cliente_id = v_cli where id = r.appuntamento_id;
  end if;
  update public.prenotazioni set cliente_id = v_cli, updated_at = now() where id = r.id;

  -- (c) l'ottico di riferimento della persona diventa quest'azienda; il vecchio
  --     va nel registro come da_azienda.
  select persone.ottico_di_riferimento into v_prec from public.persone where persone.id = r.persona_id;
  update public.persone set ottico_di_riferimento = v_az, updated_at = now()
  where persone.id = r.persona_id;

  -- (d) la riga di registro: l'unica cosa che fra un anno spiega «perché questa
  --     persona risulta di questo negozio».
  insert into public.persone_riferimento_registro
    (persona_id, da_azienda_id, a_azienda_id, prenotazione_id, utente_id)
  values (r.persona_id, v_prec, v_az, r.id, v_utente);

  return v_cli;
end $$;
comment on function public.prendi_persona_come_cliente(uuid, uuid) is
  'G8 §6: prende la persona di una prenotazione ACCETTATA come cliente del negozio chiamante (get_azienda_id). Collega un cliente esistente (p_cliente_id) o ne crea uno (nome/telefono/fonte dalla prenotazione, senza consenso commerciale), riempie i due cliente_id, imposta persone.ottico_di_riferimento e scrive il registro. Idempotente. Errori: NON_AUTENTICATO, PRENOTAZIONE_NON_TROVATA, NON_TUA, NON_ACCETTATA, CLIENTE_NON_TUO.';
revoke execute on function public.prendi_persona_come_cliente(uuid, uuid) from anon, public;
grant  execute on function public.prendi_persona_come_cliente(uuid, uuid) to authenticated;

create or replace function public.elimina_relazione(p_id uuid)
returns void
language plpgsql security invoker set search_path = public, pg_catalog as $$
begin
  delete from public.clienti_relazioni where id = p_id;   -- la RLS impone il tenant
end $$;
comment on function public.elimina_relazione(uuid) is
  'C4: rimuove UNA relazione. Legittima perché la relazione è ANAGRAFE, non un fatto. La RLS limita al proprio negozio.';
revoke execute on function public.elimina_relazione(uuid) from public, anon;
grant  execute on function public.elimina_relazione(uuid) to authenticated;
