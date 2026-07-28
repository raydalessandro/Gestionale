-- ============================================================================
-- 017 · I servizi di tipo «richiesta» (portale)
-- ----------------------------------------------------------------------------
-- Il portale ha DUE forme di servizio, non una:
--   • appuntamento — ha durata, occupa uno slot, genera un appuntamento in agenda
--   • richiesta    — NIENTE durata, NIENTE slot: «Occhiali da sole», «Le mie lenti
--                    a contatto», «Riparazione». Il negozio risponde entro 24 ore.
-- Finora tutto era di tipo appuntamento: «sole» aveva 30' e poteva occupare mezz'ora
-- dell'agenda di un ottico per comprare occhiali da sole. Qui il catalogo impara la
-- differenza e `crea_prenotazione` si biforca.
--
-- Additiva/idempotente. Le righe esistenti sono tutte di tipo appuntamento e
-- restano valide (i trigger di coerenza le accettano al primo update).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Il catalogo impara la differenza
-- ----------------------------------------------------------------------------
alter table public.servizi
  add column if not exists tipo text not null default 'appuntamento'
    check (tipo in ('appuntamento','richiesta'));

-- la durata esiste solo per i servizi con slot
alter table public.servizi alter column durata_predefinita_minuti drop not null;
alter table public.servizi drop constraint if exists servizi_durata_per_tipo;
alter table public.servizi add constraint servizi_durata_per_tipo check (
  (tipo = 'appuntamento' and durata_predefinita_minuti is not null and durata_predefinita_minuti > 0)
  or (tipo = 'richiesta' and durata_predefinita_minuti is null)
);

comment on column public.servizi.tipo is
  'appuntamento (durata+slot+appuntamento in agenda) | richiesta (niente slot, il negozio risponde entro 24h).';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Il catalogo completo — i 13 del prototipo (fonte: portale v2, const SERVIZI)
--   • 10 appuntamento (con durata), 3 richiesta (senza).
--   • `sole` viene RITIPIZZATO da appuntamento a richiesta, durata azzerata.
--   • La «capacità» (bambini/ortok/…) NON entra in tabella: la fa negozi_servizi,
--     che dice quali voci un negozio accende. Qui c'è il catalogo completo.
--   • `controllo` (Controllo della vista) esiste nel DB ma NON è nel prototipo:
--     lo lascio invariato (dato di catalogo, nessuna FK sul test) — da decidere se
--     ritirarlo in una consegna dedicata. Vedi PR.
-- ----------------------------------------------------------------------------
insert into public.servizi (codice, etichetta, tipo, durata_predefinita_minuti, ordine) values
  ('visita',         'Visita optometrica',           'appuntamento',  30,  10),
  ('occhiale',       'Occhiale da vista',            'appuntamento',  45,  20),
  ('lenti',          'Lenti a contatto',             'appuntamento',  40,  30),
  ('visita_bambini', 'Visita per bambini',           'appuntamento',  40,  40),
  ('ortok',          'Ortocheratologia',             'appuntamento',  60,  50),
  ('rigide',         'Lenti rigide e sclerali',      'appuntamento',  60,  60),
  ('miopia',         'Controllo miopia bambini',     'appuntamento',  45,  70),
  ('secco',          'Analisi occhio secco',         'appuntamento',  30,  80),
  ('smartglass',     'Smart glass e occhiali audio', 'appuntamento',  45,  90),
  ('sport',          'Occhiali sport graduati',      'appuntamento',  45, 100),
  ('sole',           'Occhiali da sole',             'richiesta',     null, 110),
  ('lenti_prod',     'Le mie lenti a contatto',      'richiesta',     null, 120),
  ('riparazione',    'Riparazione',                  'richiesta',     null, 130)
on conflict (codice) do update set
  etichetta                 = excluded.etichetta,
  tipo                      = excluded.tipo,
  durata_predefinita_minuti = excluded.durata_predefinita_minuti,
  ordine                    = excluded.ordine;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · La deroga di durata del negozio esiste solo per i servizi con slot.
--   Il tipo sta in un'altra tabella → serve un trigger, non un check.
-- ----------------------------------------------------------------------------
create or replace function public.coerenza_negozio_servizio()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
declare v_tipo text;
begin
  select tipo into v_tipo from public.servizi where codice = NEW.servizio_codice;
  if v_tipo = 'richiesta' and NEW.durata_minuti is not null then
    raise exception
      'SERVIZIO_RICHIESTA_SENZA_DURATA: un servizio di tipo richiesta non ammette una durata (negozi_servizi.durata_minuti deve essere null)';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_coerenza_negozio_servizio on public.negozi_servizi;
create trigger trg_coerenza_negozio_servizio
  before insert or update on public.negozi_servizi
  for each row execute function public.coerenza_negozio_servizio();

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · La prenotazione senza appuntamento
--   Per una richiesta non c'è slot da occupare: appuntamento_id/inizio/durata
--   tornano nullable, e un trigger garantisce la coerenza leggendo il tipo dal
--   catalogo (appuntamento → tutti e tre valorizzati; richiesta → tutti nulli).
-- ----------------------------------------------------------------------------
alter table public.prenotazioni alter column appuntamento_id drop not null;
alter table public.prenotazioni alter column inizio          drop not null;
alter table public.prenotazioni alter column durata_minuti   drop not null;

create or replace function public.coerenza_prenotazione_tipo()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
declare v_tipo text;
begin
  select tipo into v_tipo from public.servizi where codice = NEW.servizio_codice;
  if v_tipo = 'appuntamento' then
    if NEW.appuntamento_id is null or NEW.inizio is null or NEW.durata_minuti is null then
      raise exception
        'PRENOTAZIONE_APPUNTAMENTO_INCOMPLETA: un servizio su appuntamento richiede appuntamento_id, inizio e durata_minuti';
    end if;
  elsif v_tipo = 'richiesta' then
    if NEW.appuntamento_id is not null or NEW.inizio is not null or NEW.durata_minuti is not null then
      raise exception
        'PRENOTAZIONE_RICHIESTA_CON_SLOT: un servizio di tipo richiesta non ha appuntamento/inizio/durata (devono essere nulli)';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_coerenza_prenotazione_tipo on public.prenotazioni;
create trigger trg_coerenza_prenotazione_tipo
  before insert or update on public.prenotazioni
  for each row execute function public.coerenza_prenotazione_tipo();

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · `crea_prenotazione` si biforca (idempotenza valida per ENTRAMBI i rami).
--   richiesta  → niente lock di slot, niente disponibilità, niente appuntamento:
--                trova/crea la persona, inserisce la prenotazione con inizio NULLO
--                e il testo nelle note, restituisce id+codice. p_inizio è ignorato.
--   appuntamento → esattamente il comportamento pre-017 (016 incluso: id qualificati).
-- ----------------------------------------------------------------------------
create or replace function public.crea_prenotazione(
  p_slug text, p_servizio text, p_inizio timestamptz,
  p_nome text, p_telefono text, p_email text,
  p_per_conto_di text, p_note text, p_fonte text,
  p_chiave_richiesta text, p_lista_attesa boolean
) returns table (id uuid, codice text, inizio timestamptz, durata_minuti int)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  c_tz        constant text     := 'Europe/Rome';
  c_anticipo  constant interval := interval '2 hours';
  c_orizzonte constant int      := 90;
  c_alfabeto  constant text     := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_az uuid; v_tipo text; v_dur int; v_giorno date; v_persona uuid; v_tel text;
  v_fonte text; v_codice text; v_id uuid; v_appto uuid; v_risorsa uuid; r record;
  v_oggi date := (now() at time zone c_tz)::date;
begin
  -- idempotenza (prima del lock): stessa chiave → stessa riga, entrambi i rami
  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  select a.id into v_az from public.aziende a where a.slug = p_slug and a.portale_attivo = true;
  if v_az is null then raise exception 'NEGOZIO_NON_TROVATO'; end if;

  -- tipo + durata del servizio (dev'essere attivo sul negozio)
  select s.tipo, coalesce(ns.durata_minuti, s.durata_predefinita_minuti)
    into v_tipo, v_dur
  from public.negozi_servizi ns join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_az and ns.servizio_codice = p_servizio and ns.attivo = true;
  if v_tipo is null then raise exception 'SERVIZIO_NON_ATTIVO'; end if;

  perform pg_advisory_xact_lock(hashtext(v_az::text));

  -- idempotenza di nuovo, dopo il lock (concorrenza)
  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  v_fonte := case when p_fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale')
                  then p_fonte else 'portale' end;

  -- codice univoco (entrambi i rami)
  loop
    select 'LMP-' || string_agg(substr(c_alfabeto, 1 + floor(random() * length(c_alfabeto))::int, 1), '')
      into v_codice from generate_series(1, 4);
    exit when not exists (select 1 from public.prenotazioni pp where pp.codice = v_codice);
  end loop;

  -- persona (find-or-create) — comune ai due rami; se poi si abortisce, rollback
  v_tel := public.normalizza_telefono(p_telefono);
  select persone.id into v_persona from public.persone where persone.telefono_normalizzato = v_tel;
  if v_persona is null then
    insert into public.persone (telefono_grezzo, nome, email)
    values (p_telefono, p_nome, nullif(btrim(p_email), ''))
    returning persone.id into v_persona;
  else
    update public.persone set nome = p_nome, updated_at = now()
    where persone.id = v_persona and (nome is null or btrim(nome) = '');
  end if;

  -- ═══════════════ RAMO RICHIESTA — niente slot, niente appuntamento ═══════════
  if v_tipo = 'richiesta' then
    insert into public.prenotazioni (
      azienda_id, persona_id, appuntamento_id, servizio_codice, inizio, durata_minuti, stato, fonte,
      per_conto_di, contatto_nome, contatto_telefono, contatto_email, note,
      codice, chiave_richiesta, informativa_accettata_at
    ) values (
      v_az, v_persona, null, p_servizio, null, null, 'in_attesa', v_fonte,
      nullif(btrim(p_per_conto_di), ''), p_nome, p_telefono, nullif(btrim(p_email), ''), nullif(btrim(p_note), ''),
      v_codice, p_chiave_richiesta, now()
    ) returning prenotazioni.id into v_id;
    id := v_id; codice := v_codice; inizio := null; durata_minuti := null;
    return next; return;
  end if;

  -- ═══════════════ RAMO APPUNTAMENTO — comportamento pre-017 ══════════════════
  if p_inizio is null then raise exception 'INIZIO_OBBLIGATORIO'; end if;
  v_giorno := (p_inizio at time zone c_tz)::date;
  if v_giorno < v_oggi or v_giorno > v_oggi + c_orizzonte then raise exception 'FUORI_ORIZZONTE'; end if;
  if p_inizio < now() + c_anticipo then raise exception 'TROPPO_TARDI'; end if;
  if exists (select 1 from public.chiusure where azienda_id = v_az and v_giorno between dal and al) then
    raise exception 'FUORI_ORARIO';
  end if;
  if not exists (
    select 1 from public.orari_apertura o
    where o.azienda_id = v_az and o.giorno = extract(dow from v_giorno)::int
      and (v_giorno + o.apre)   at time zone c_tz <= p_inizio
      and p_inizio + (v_dur * interval '1 minute') <= (v_giorno + o.chiude) at time zone c_tz
  ) then raise exception 'FUORI_ORARIO'; end if;
  if exists (
    select 1 from public.blocchi_slot b
    where b.azienda_id = v_az
      and tstzrange(b.inizio, b.fine) && public.appuntamento_intervallo(p_inizio, v_dur)
  ) then raise exception 'SLOT_OCCUPATO'; end if;

  select r2.id into v_risorsa
  from public.risorse r2
  where r2.azienda_id = v_az and r2.attiva
    and not exists (
      select 1 from public.appuntamenti a
      where a.risorsa_id = r2.id and a.stato in ('in_attesa','prenotato','completato')
        and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
         && public.appuntamento_intervallo(p_inizio, v_dur))
  order by r2.ordine, r2.id
  limit 1;
  if v_risorsa is null then raise exception 'SLOT_OCCUPATO'; end if;

  begin
    insert into public.appuntamenti (
      azienda_id, risorsa_id, inizio, durata_minuti, stato, fonte, tipo, riferimento
    ) values (
      v_az, v_risorsa, p_inizio, v_dur, 'in_attesa', v_fonte, 'controllo_vista', v_codice
    ) returning appuntamenti.id into v_appto;
  exception
    when exclusion_violation then raise exception 'SLOT_OCCUPATO';
  end;

  begin
    insert into public.prenotazioni (
      azienda_id, persona_id, appuntamento_id, servizio_codice, inizio, durata_minuti, stato, fonte,
      per_conto_di, contatto_nome, contatto_telefono, contatto_email, note,
      codice, chiave_richiesta, informativa_accettata_at
    ) values (
      v_az, v_persona, v_appto, p_servizio, p_inizio, v_dur, 'in_attesa', v_fonte,
      nullif(btrim(p_per_conto_di), ''), p_nome, p_telefono, nullif(btrim(p_email), ''), nullif(btrim(p_note), ''),
      v_codice, p_chiave_richiesta, now()
    ) returning prenotazioni.id into v_id;
  exception
    when unique_violation then
      delete from public.appuntamenti where appuntamenti.id = v_appto;
      select p.id, p.codice, p.inizio, p.durata_minuti into r
      from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
      if found then
        id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
        return next; return;
      end if;
      raise;
  end;

  if coalesce(p_lista_attesa, false) then
    insert into public.lista_attesa (persona_id, azienda_id, servizio_codice, giorno_preferito)
    values (v_persona, v_az, p_servizio, v_giorno);
  end if;

  id := v_id; codice := v_codice; inizio := p_inizio; durata_minuti := v_dur; return next;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · `slot_liberi` non ha senso per una richiesta: guardia esplicita → vuoto.
--   (Anche prima tornava vuoto perché la durata è nulla; qui lo diciamo chiaro.)
-- ----------------------------------------------------------------------------
create or replace function public.slot_liberi(p_slug text, p_servizio text, p_giorno date)
returns setof timestamptz
language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare
  c_passo     constant interval := interval '15 minutes';
  c_anticipo  constant interval := interval '2 hours';
  c_orizzonte constant int      := 90;
  c_tz        constant text     := 'Europe/Rome';
  v_azienda   uuid; v_tipo text; v_durata int; v_dur interval; v_dow int;
  v_now timestamptz := now(); v_oggi date := (v_now at time zone c_tz)::date;
  r_fascia record; v_apre_abs timestamptz; v_chiude_abs timestamptz; v_cand timestamptz;
begin
  select id into v_azienda from public.aziende where slug = p_slug and portale_attivo = true;
  if v_azienda is null then return; end if;
  if p_giorno < v_oggi or p_giorno > v_oggi + c_orizzonte then return; end if;
  select s.tipo, coalesce(ns.durata_minuti, s.durata_predefinita_minuti) into v_tipo, v_durata
  from public.negozi_servizi ns join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_azienda and ns.servizio_codice = p_servizio and ns.attivo = true;
  if v_tipo is null then return; end if;
  if v_tipo = 'richiesta' then return; end if;   -- niente slot per le richieste
  if v_durata is null then return; end if;
  v_dur := v_durata * interval '1 minute';
  if exists (select 1 from public.chiusure where azienda_id = v_azienda and p_giorno between dal and al) then return; end if;
  v_dow := extract(dow from p_giorno)::int;
  for r_fascia in select apre, chiude from public.orari_apertura where azienda_id = v_azienda and giorno = v_dow loop
    v_apre_abs   := (p_giorno + r_fascia.apre)   at time zone c_tz;
    v_chiude_abs := (p_giorno + r_fascia.chiude) at time zone c_tz;
    v_cand := v_apre_abs;
    while v_cand + v_dur <= v_chiude_abs loop
      if v_cand >= v_now + c_anticipo
         and exists (
           select 1 from public.risorse r
           where r.azienda_id = v_azienda and r.attiva
             and not exists (
               select 1 from public.appuntamenti a
               where a.risorsa_id = r.id and a.stato in ('in_attesa','prenotato','completato')
                 and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
                  && public.appuntamento_intervallo(v_cand, v_durata)))
         and not exists (
           select 1 from public.blocchi_slot b
           where b.azienda_id = v_azienda
             and b.inizio >= v_apre_abs - interval '1 day' and b.inizio < v_chiude_abs
             and tstzrange(b.inizio, b.fine) && public.appuntamento_intervallo(v_cand, v_durata))
      then
        return next v_cand;
      end if;
      v_cand := v_cand + c_passo;
    end loop;
  end loop;
  return;
end $$;
grant execute on function public.slot_liberi(text, text, date) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · La vetrina pubblica espone anche `tipo`: l'app distingue i due gruppi
--   (appuntamento con durata + griglia slot / richiesta senza) leggendo SOLO la
--   vista, come impone DB-02. `durata_minuti` è già NULL per le richieste.
-- ----------------------------------------------------------------------------
-- NB: `create or replace view` non può riordinare le colonne esistenti — `tipo`
-- va APPESO in fondo (l'app seleziona per nome, l'ordine non conta).
create or replace view public.servizi_pubblici
with (security_invoker = false) as
select
  a.slug,
  s.codice,
  s.etichetta,
  coalesce(ns.durata_minuti, s.durata_predefinita_minuti) as durata_minuti,
  s.ordine,
  s.tipo
from public.negozi_servizi ns
join public.aziende a on a.id = ns.azienda_id
join public.servizi s on s.codice = ns.servizio_codice
where ns.attivo = true and a.portale_attivo = true;
grant select on public.servizi_pubblici to anon;

-- ============================================================================
-- Fine 017. Un negozio offre due tipi di servizio; una richiesta non occupa slot.
-- ============================================================================
