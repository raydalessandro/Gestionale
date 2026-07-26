-- ============================================================================
-- 012 · Il percorso di prenotazione — crea_prenotazione (G7)
-- ----------------------------------------------------------------------------
-- La prima SCRITTURA del portale. Additiva e idempotente. Qui si crea la
-- richiesta (stato 'in_attesa'); l'ottico la accetta in G8. La scrittura è
-- esposta ad `anon` ma passa SEMPRE da un'azione server (rate limit + rivalida):
-- vedi app/(portale)/.../azioni.ts. La funzione qui è la difesa di ultima
-- istanza — atomica, con distinti errori riconoscibili.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Tre colonne su prenotazioni (la tabella nasce vuota nella 011: i NOT NULL
--     non hanno righe da riempire).
-- ----------------------------------------------------------------------------
alter table public.prenotazioni add column if not exists codice text;
alter table public.prenotazioni add column if not exists chiave_richiesta text;
alter table public.prenotazioni add column if not exists informativa_accettata_at timestamptz;

-- Unicità: `codice` è il riferimento leggibile (da dire al telefono);
-- `chiave_richiesta` è la chiave di idempotenza del doppio invio.
create unique index if not exists uq_prenotazioni_codice on public.prenotazioni (codice);
create unique index if not exists uq_prenotazioni_chiave on public.prenotazioni (chiave_richiesta);

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Niente due richieste sullo stesso slot (a livello DB, come gli appuntamenti
--     nella 008). Riusa la funzione IMMUTABLE `appuntamento_intervallo` (inizio,
--     durata_minuti) → tstzrange, e con essa CREA l'indice GiST che serve alla
--     sottoquery di slot_liberi sulle prenotazioni. Solo gli stati che occupano
--     lo slot (in_attesa/accettata) sono vincolati.
-- ----------------------------------------------------------------------------
alter table public.prenotazioni drop constraint if exists prenotazioni_niente_sovrapposizioni;
alter table public.prenotazioni add constraint prenotazioni_niente_sovrapposizioni
  exclude using gist (
    azienda_id with =,
    public.appuntamento_intervallo(inizio, durata_minuti) with &&
  ) where (stato in ('in_attesa','accettata'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · slot_liberi: la sottoquery prenotazioni ora usa `appuntamento_intervallo`
--     così il predicato && combacia col nuovo indice GiST (index-condition). Il
--     limite di data messo in G6 resta: ridondante ma innocuo. (Redefinizione in
--     questa migrazione nuova; la 011 non si tocca.)
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
         and not exists (
           select 1 from public.appuntamenti a
           where a.azienda_id = v_azienda and a.stato in ('prenotato','completato')
             and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
              && public.appuntamento_intervallo(v_cand, v_durata))
         and not exists (
           select 1 from public.prenotazioni p
           where p.azienda_id = v_azienda and p.stato in ('in_attesa','accettata')
             and p.inizio >= v_apre_abs - interval '1 day' and p.inizio < v_chiude_abs
             and public.appuntamento_intervallo(p.inizio, p.durata_minuti)
              && public.appuntamento_intervallo(v_cand, v_durata))
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
-- 4 · crea_prenotazione — la scrittura, atomica e idempotente.
-- ----------------------------------------------------------------------------
-- Errori distinti e riconoscibili (il percorso guidato dice ALLA persona quale
-- cosa è andata storta): NEGOZIO_NON_TROVATO, SERVIZIO_NON_ATTIVO, FUORI_ORIZZONTE,
-- TROPPO_TARDI, FUORI_ORARIO, SLOT_OCCUPATO.
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
  c_alfabeto  constant text     := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- niente O 0 I 1
  v_az uuid; v_dur int; v_giorno date; v_persona uuid; v_tel text;
  v_fonte text; v_codice text; v_id uuid; r record;
  v_oggi date := (now() at time zone c_tz)::date;
begin
  -- 1 · IDEMPOTENZA per prima cosa: un secondo invio (doppio tocco / rete) NON
  --     crea un'altra riga, restituisce quella già scritta.
  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  -- 2 · negozio pubblicato
  select a.id into v_az from public.aziende a where a.slug = p_slug and a.portale_attivo = true;
  if v_az is null then raise exception 'NEGOZIO_NON_TROVATO'; end if;

  -- 3 · serializza: due richieste sullo stesso negozio non si calpestano
  perform pg_advisory_xact_lock(hashtext(v_az::text));

  -- ri-controllo idempotenza dopo il lock (un concorrente può aver inserito)
  select p.id, p.codice, p.inizio, p.durata_minuti into r
  from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
  if found then
    id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
    return next; return;
  end if;

  -- 4 · disponibilità ricontrollata DENTRO la transazione (non fidarsi del browser)
  select coalesce(ns.durata_minuti, s.durata_predefinita_minuti) into v_dur
  from public.negozi_servizi ns join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_az and ns.servizio_codice = p_servizio and ns.attivo = true;
  if v_dur is null then raise exception 'SERVIZIO_NON_ATTIVO'; end if;

  v_giorno := (p_inizio at time zone c_tz)::date;
  if v_giorno < v_oggi or v_giorno > v_oggi + c_orizzonte then
    raise exception 'FUORI_ORIZZONTE';
  end if;
  if p_inizio < now() + c_anticipo then raise exception 'TROPPO_TARDI'; end if;
  if exists (select 1 from public.chiusure where azienda_id = v_az and v_giorno between dal and al) then
    raise exception 'FUORI_ORARIO';
  end if;
  -- l'intervallo [inizio, inizio+durata] deve stare dentro una fascia del giorno
  if not exists (
    select 1 from public.orari_apertura o
    where o.azienda_id = v_az and o.giorno = extract(dow from v_giorno)::int
      and (v_giorno + o.apre)   at time zone c_tz <= p_inizio
      and p_inizio + (v_dur * interval '1 minute') <= (v_giorno + o.chiude) at time zone c_tz
  ) then raise exception 'FUORI_ORARIO'; end if;
  -- sovrapposizioni con appuntamenti e blocchi (le prenotazioni le cattura l'EXCLUDE)
  if exists (
    select 1 from public.appuntamenti a
    where a.azienda_id = v_az and a.stato in ('prenotato','completato')
      and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
       && public.appuntamento_intervallo(p_inizio, v_dur)
  ) then raise exception 'SLOT_OCCUPATO'; end if;
  if exists (
    select 1 from public.blocchi_slot b
    where b.azienda_id = v_az
      and tstzrange(b.inizio, b.fine) && public.appuntamento_intervallo(p_inizio, v_dur)
  ) then raise exception 'SLOT_OCCUPATO'; end if;

  -- 5 · persona sul telefono normalizzato (aggiorna il nome SOLO se era vuoto)
  v_tel := public.normalizza_telefono(p_telefono);
  select persone.id into v_persona from public.persone where persone.telefono_normalizzato = v_tel;
  if v_persona is null then
    insert into public.persone (telefono_grezzo, nome, email)
    values (p_telefono, p_nome, nullif(btrim(p_email), ''))
    returning id into v_persona;
  else
    update public.persone set nome = p_nome, updated_at = now()
    where id = v_persona and (nome is null or btrim(nome) = '');
  end if;

  -- fonte dal vocabolario (default 'portale')
  v_fonte := case when p_fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale')
                  then p_fonte else 'portale' end;

  -- codice leggibile e unico, senza caratteri ambigui
  loop
    select 'LMP-' || string_agg(substr(c_alfabeto, 1 + floor(random() * length(c_alfabeto))::int, 1), '')
      into v_codice from generate_series(1, 4);
    exit when not exists (select 1 from public.prenotazioni pp where pp.codice = v_codice);
  end loop;

  -- 6 · inserimento: l'EXCLUDE cattura la doppia sullo stesso slot; la chiave
  --     richiesta cattura il doppio invio concorrente (idempotenza).
  begin
    insert into public.prenotazioni (
      azienda_id, persona_id, servizio_codice, inizio, durata_minuti, stato, fonte,
      per_conto_di, contatto_nome, contatto_telefono, contatto_email, note,
      codice, chiave_richiesta, informativa_accettata_at
    ) values (
      v_az, v_persona, p_servizio, p_inizio, v_dur, 'in_attesa', v_fonte,
      nullif(btrim(p_per_conto_di), ''), p_nome, p_telefono, nullif(btrim(p_email), ''), nullif(btrim(p_note), ''),
      v_codice, p_chiave_richiesta, now()
    ) returning prenotazioni.id into v_id;
  exception
    when exclusion_violation then
      raise exception 'SLOT_OCCUPATO';
    when unique_violation then
      -- concorrente con la STESSA chiave_richiesta → idempotenza
      select p.id, p.codice, p.inizio, p.durata_minuti into r
      from public.prenotazioni p where p.chiave_richiesta = p_chiave_richiesta;
      if found then
        id := r.id; codice := r.codice; inizio := r.inizio; durata_minuti := r.durata_minuti;
        return next; return;
      end if;
      raise; -- collisione di codice (rarissima): rilancia
  end;

  -- 7 · lista d'attesa, se richiesta
  if coalesce(p_lista_attesa, false) then
    insert into public.lista_attesa (persona_id, azienda_id, servizio_codice, giorno_preferito)
    values (v_persona, v_az, p_servizio, v_giorno);
  end if;

  -- 8 · ritorno
  id := v_id; codice := v_codice; inizio := p_inizio; durata_minuti := v_dur;
  return next;
end $$;

comment on function public.crea_prenotazione(text,text,timestamptz,text,text,text,text,text,text,text,boolean) is
  'Crea una richiesta di prenotazione (stato in_attesa), atomica e idempotente per chiave_richiesta. Ricontrolla la disponibilità dentro la transazione (advisory lock sull''azienda). Errori distinti: NEGOZIO_NON_TROVATO, SERVIZIO_NON_ATTIVO, FUORI_ORIZZONTE, TROPPO_TARDI, FUORI_ORARIO, SLOT_OCCUPATO. La scrittura reale passa da un''azione server con rate limit; questa è la difesa di ultima istanza.';

grant execute on function public.crea_prenotazione(text,text,timestamptz,text,text,text,text,text,text,text,boolean) to anon, authenticated;

-- ============================================================================
-- Fine 012. La richiesta esiste nel DB; l'ottico la accetta in G8.
-- ============================================================================
