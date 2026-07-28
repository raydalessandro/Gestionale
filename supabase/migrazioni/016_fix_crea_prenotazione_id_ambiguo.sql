-- ============================================================================
-- 016 · Fix — `id` ambiguo in crea_prenotazione (42702)
-- ----------------------------------------------------------------------------
-- `crea_prenotazione` dichiara `returns table (id uuid, …)`: in PL/pgSQL le
-- colonne di RETURNS TABLE sono variabili OUT *in scope* dentro il corpo. Due
-- query usavano ancora `id` NON qualificato contro tabelle che hanno una colonna
-- `id`, quindi Postgres non sapeva se `id` fosse la variabile OUT o la colonna e
-- alzava `column reference "id" is ambiguous` (42702):
--
--   1) ramo «persona già esistente»:
--        update public.persone … where id = v_persona
--   2) gestore unique_violation (rollback dell'appuntamento orfano):
--        delete from public.appuntamenti where id = v_appto
--
-- Latente perché si vede SOLO quando si passa da quei due rami: un primo
-- inserimento con telefono nuovo entra nel ramo INSERT (già qualificato) e non
-- inciampa; è la SECONDA richiesta con lo stesso telefono (ramo UPDATE) a
-- rompersi. Bug nato in 012, portato avanti da 013/014. Qui si ridefinisce la
-- funzione VIVA (quella di 014) qualificando i due `id`. Nient'altro cambia:
-- stessa firma, stessa logica, stessi codici d'errore.
--
-- Forward-only: 012/014 sono storia già applicata; questa migrazione porta il
-- fix a ogni progetto (test e produzione) per la via normale.
-- ============================================================================

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
    -- FIX 016: `persone.id` qualificato — senza, `id` collide con l'OUT param.
    update public.persone set nome = p_nome, updated_at = now()
    where persone.id = v_persona and (nome is null or btrim(nome) = '');
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
      -- FIX 016: `appuntamenti.id` qualificato — stessa collisione con l'OUT param.
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

-- ============================================================================
-- Fine 016. Firma e comportamento invariati: solo i due `id` ora qualificati.
-- ============================================================================
