-- ============================================================================
-- 014 · Le sale — l'appuntamento è di una SALA; la sala è del negozio (G-014)
-- ----------------------------------------------------------------------------
-- La 013 aveva lasciato `risorsa_id` nullable con l'esclusione su
-- `coalesce(risorsa_id, azienda_id)`: una cucitura. Qui la si porta a livello
-- vero, finché costa poco — tocca gli stessi due pezzi che la 013 ha appena
-- riscritto (il vincolo di esclusione e `slot_liberi`). Con UNA sola sala il
-- comportamento resta identico a oggi.
--
-- Additiva e idempotente. Solo SQL: nessuna interfaccia. Aprire la seconda
-- poltrona di un negozio sarà, dopo questa, una sola riga in `risorse`.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Tabella `risorse` (le sale). RLS come le altre tabelle del negozio;
--     l'anonimo non le vede mai — ci arriva solo `slot_liberi` (security definer).
-- ----------------------------------------------------------------------------
create table if not exists public.risorse (
  id         uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  nome       text not null,
  ordine     int  not null default 1,
  attiva     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_risorse_azienda on public.risorse (azienda_id, ordine, id);

alter table public.risorse enable row level security;
drop policy if exists "risorse: della propria azienda" on public.risorse;
create policy "risorse: della propria azienda" on public.risorse
  for all
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());
revoke select on public.risorse from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Ogni negozio ne ha almeno una, sempre.
--   • riempimento: una 'Sala 1' per OGNI azienda che non ne ha (idempotente);
--   • trigger su aziende: un negozio nasce con la sua sala QUALUNQUE strada
--     abbia usato (registrazione, seed, script, inserimento a mano). Nel trigger,
--     non in crea_azienda_con_titolare: quella coprirebbe una strada sola.
-- ----------------------------------------------------------------------------
insert into public.risorse (azienda_id, nome, ordine)
select a.id, 'Sala 1', 1
from public.aziende a
where not exists (select 1 from public.risorse r where r.azienda_id = a.id);

create or replace function public.crea_sala_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.risorse (azienda_id, nome, ordine) values (NEW.id, 'Sala 1', 1);
  return NEW;
end $$;

drop trigger if exists trg_sala_default on public.aziende;
create trigger trg_sala_default after insert on public.aziende
  for each row execute function public.crea_sala_default();

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · `appuntamenti.risorsa_id` diventa obbligatoria.
--   • riempi le righe esistenti con la sala predefinita (ordine minimo) del loro
--     negozio; poi FK verso `risorse` e NOT NULL;
--   • aggiungi la coppia (risorsa_id → risorse) al trigger di coerenza tenant
--     della 008: la sala dev'essere dello STESSO negozio dell'appuntamento.
-- ----------------------------------------------------------------------------
update public.appuntamenti a
set risorsa_id = (
  select r.id from public.risorse r
  where r.azienda_id = a.azienda_id
  order by r.ordine, r.id
  limit 1
)
where a.risorsa_id is null;

alter table public.appuntamenti drop constraint if exists appuntamenti_risorsa_id_fkey;
alter table public.appuntamenti add constraint appuntamenti_risorsa_id_fkey
  foreign key (risorsa_id) references public.risorse(id);
alter table public.appuntamenti alter column risorsa_id set not null;

-- coerenza tenant (008): la sala è dello stesso negozio dell'appuntamento.
drop trigger if exists trg_tenant on public.appuntamenti;
create trigger trg_tenant before insert or update on public.appuntamenti
  for each row execute function public.assicura_coerenza_tenant(
    'cliente_id','clienti','utente_id','utenti','risorsa_id','risorse');

-- Il gestionale (lib/actions.ts) crea appuntamenti manuali SENZA passare la sala:
-- un trigger BEFORE INSERT gliela assegna quando manca — la prima sala attiva
-- LIBERA in quell'intervallo, poi (se piene) la prima attiva — così il NOT NULL
-- non fa mai fallire un inserimento legittimo. `crea_prenotazione` valorizza già
-- `risorsa_id`, quindi qui il trigger non interferisce (esce subito). La scelta
-- della sala in un'interfaccia dedicata è una consegna futura.
create or replace function public.assegna_sala_appuntamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ris uuid;
begin
  if NEW.risorsa_id is not null then return NEW; end if;
  select r.id into v_ris
  from public.risorse r
  where r.azienda_id = NEW.azienda_id and r.attiva
    and not exists (
      select 1 from public.appuntamenti a
      where a.risorsa_id = r.id
        and a.stato in ('in_attesa','prenotato','completato')
        and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
         && public.appuntamento_intervallo(NEW.inizio, NEW.durata_minuti)
    )
  order by r.ordine, r.id
  limit 1;
  if v_ris is null then
    select r.id into v_ris from public.risorse r
    where r.azienda_id = NEW.azienda_id
    order by r.attiva desc, r.ordine, r.id
    limit 1;
  end if;
  NEW.risorsa_id := v_ris;
  return NEW;
end $$;

drop trigger if exists trg_sala_appuntamento on public.appuntamenti;
create trigger trg_sala_appuntamento before insert on public.appuntamenti
  for each row execute function public.assegna_sala_appuntamento();

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · Il vincolo, senza più `coalesce`. Sostituisce quello della 013.
-- ----------------------------------------------------------------------------
alter table public.appuntamenti drop constraint if exists appuntamenti_niente_sovrapposizioni;
alter table public.appuntamenti add constraint appuntamenti_niente_sovrapposizioni
  exclude using gist (
    azienda_id with =,
    risorsa_id with =,
    public.appuntamento_intervallo(inizio, durata_minuti) with &&
  ) where (stato in ('in_attesa','prenotato','completato'));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · `slot_liberi` cambia domanda: non «libero se non si sovrappone a niente»,
--     ma «libero se ALMENO UNA sala attiva è libera» in quell'intervallo.
--     Continua a restituire SOLTANTO gli orari: la sala non riguarda chi prenota.
--     `blocchi_slot`/`chiusure` restano per negozio (vedi limite noto, doc di fase).
-- ----------------------------------------------------------------------------
create or replace function public.slot_liberi(p_slug text, p_servizio text, p_giorno date)
returns setof timestamptz
language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare
  c_passo     constant interval := interval '15 minutes';
  c_anticipo  constant interval := interval '2 hours';
  c_orizzonte constant int      := 90;
  c_tz        constant text     := 'Europe/Rome';
  v_azienda   uuid; v_durata int; v_dur interval; v_dow int;
  v_now timestamptz := now(); v_oggi date := (v_now at time zone c_tz)::date;
  r_fascia record; v_apre_abs timestamptz; v_chiude_abs timestamptz; v_cand timestamptz;
begin
  select id into v_azienda from public.aziende where slug = p_slug and portale_attivo = true;
  if v_azienda is null then return; end if;
  if p_giorno < v_oggi or p_giorno > v_oggi + c_orizzonte then return; end if;
  select coalesce(ns.durata_minuti, s.durata_predefinita_minuti) into v_durata
  from public.negozi_servizi ns join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_azienda and ns.servizio_codice = p_servizio and ns.attivo = true;
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
         -- almeno una sala attiva è libera in [v_cand, v_cand+durata)
         and exists (
           select 1 from public.risorse r
           where r.azienda_id = v_azienda and r.attiva
             and not exists (
               select 1 from public.appuntamenti a
               where a.risorsa_id = r.id and a.stato in ('in_attesa','prenotato','completato')
                 and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
                  && public.appuntamento_intervallo(v_cand, v_durata)))
         -- il blocco/la chiusura chiudono l'orario per TUTTE le sale (per negozio)
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
-- 6 · `crea_prenotazione` assegna la sala: la PRIMA sala attiva libera in
--     quell'intervallo (ordinata per ordine poi id — deterministica). Se non ce
--     n'è nessuna → SLOT_OCCUPATO. Il resto (idempotenza, lock, codice, contatto)
--     non si tocca: si aggiunge solo la scelta della sala. Sparisce il vecchio
--     pre-controllo «un appuntamento qualsiasi si sovrappone»: con più sale era
--     sbagliato (rifiutava anche se un'altra sala era libera).
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
  v_az uuid; v_dur int; v_giorno date; v_persona uuid; v_tel text;
  v_fonte text; v_codice text; v_id uuid; v_appto uuid; v_risorsa uuid; r record;
  v_oggi date := (now() at time zone c_tz)::date;
begin
  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  select a.id into v_az from public.aziende a where a.slug = p_slug and a.portale_attivo = true;
  if v_az is null then raise exception 'NEGOZIO_NON_TROVATO'; end if;

  perform pg_advisory_xact_lock(hashtext(v_az::text));

  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  select coalesce(ns.durata_minuti, s.durata_predefinita_minuti) into v_dur
  from public.negozi_servizi ns join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_az and ns.servizio_codice = p_servizio and ns.attivo = true;
  if v_dur is null then raise exception 'SERVIZIO_NON_ATTIVO'; end if;

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
  -- il blocco/la chiusura valgono per tutto il negozio (tutte le sale)
  if exists (
    select 1 from public.blocchi_slot b
    where b.azienda_id = v_az
      and tstzrange(b.inizio, b.fine) && public.appuntamento_intervallo(p_inizio, v_dur)
  ) then raise exception 'SLOT_OCCUPATO'; end if;

  -- la sala: prima sala attiva LIBERA in quell'intervallo (deterministica).
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

  v_tel := public.normalizza_telefono(p_telefono);
  select persone.id into v_persona from public.persone where persone.telefono_normalizzato = v_tel;
  if v_persona is null then
    insert into public.persone (telefono_grezzo, nome, email)
    values (p_telefono, p_nome, nullif(btrim(p_email), ''))
    returning persone.id into v_persona;
  else
    update public.persone set nome = p_nome, updated_at = now()
    where id = v_persona and (nome is null or btrim(nome) = '');
  end if;

  v_fonte := case when p_fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale')
                  then p_fonte else 'portale' end;

  loop
    select 'LMP-' || string_agg(substr(c_alfabeto, 1 + floor(random() * length(c_alfabeto))::int, 1), '')
      into v_codice from generate_series(1, 4);
    exit when not exists (select 1 from public.prenotazioni pp where pp.codice = v_codice);
  end loop;

  begin
    insert into public.appuntamenti (
      azienda_id, risorsa_id, inizio, durata_minuti, stato, fonte, tipo, riferimento
    ) values (
      v_az, v_risorsa, p_inizio, v_dur, 'in_attesa', v_fonte, 'controllo_vista', v_codice
    ) returning appuntamenti.id into v_appto;
  exception
    when exclusion_violation then
      raise exception 'SLOT_OCCUPATO';
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
      delete from public.appuntamenti where id = v_appto;
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

  id := v_id; codice := v_codice; inizio := p_inizio; durata_minuti := v_dur;
  return next;
end $$;

comment on function public.crea_prenotazione(text,text,timestamptz,text,text,text,text,text,text,text,boolean) is
  'Crea una richiesta: appuntamento (in_attesa, in una SALA attiva libera scelta deterministicamente) + prenotazione collegata, nella stessa transazione. Atomica e idempotente per chiave_richiesta; advisory lock sull azienda. Errori: NEGOZIO_NON_TROVATO, SERVIZIO_NON_ATTIVO, FUORI_ORIZZONTE, TROPPO_TARDI, FUORI_ORARIO, SLOT_OCCUPATO.';

grant execute on function public.crea_prenotazione(text,text,timestamptz,text,text,text,text,text,text,text,boolean) to anon, authenticated;

-- ============================================================================
-- Fine 014. Ogni appuntamento sta in una sala, ogni negozio ha almeno una sala.
-- Aprire la seconda poltrona = una riga in `risorse`: niente migrazioni, niente
-- riscrittura del calcolo slot, niente tocco all'agenda.
--
-- LIMITE NOTO (doc di fase): `blocchi_slot` e `chiusure` restano PER NEGOZIO —
-- chiudere un orario lo chiude per tutte le sale. Con una sala è invisibile; con
-- due è una semplificazione consapevole. Il blocco per singola sala sarà una
-- consegna a sé.
-- ============================================================================
