-- ============================================================================
-- 013 · L'agenda unica — un posto solo decide se uno slot è occupato (G7-bis)
-- ----------------------------------------------------------------------------
-- Con la 011 e la 012 due tabelle decidevano la stessa cosa: `appuntamenti` e
-- `prenotazioni`. Due agende. Il difetto: una richiesta dal portale per le 10
-- non era un appuntamento, così l'ottico vedeva le 10 libere e ci metteva un
-- cliente al banco — alle 10 si presentavano in due.
--
-- La correzione non divide portale-contro-banco, ma slot-contro-pratica:
--   · `appuntamenti` È LO SLOT, sempre, da qualunque porta arrivi.
--   · `prenotazioni` È LA PRATICA (chi ha chiesto, contatto, consenso, codice).
--
-- Additiva e idempotente. Solo SQL: nessuna interfaccia. L'allineamento
-- dell'agenda (mostrare `in_attesa` in modo distinto) è la consegna successiva.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · `appuntamenti` accoglie lo stato «in attesa».
--     Lo slot è impegnato ma nessuno l'ha ancora confermato: l'ottico lo vede
--     nell'agenda e decide.
-- ----------------------------------------------------------------------------
alter table public.appuntamenti drop constraint if exists appuntamenti_stato_check;
alter table public.appuntamenti add constraint appuntamenti_stato_check
  check (stato in ('in_attesa','prenotato','completato','mancato','annullato'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · La cucitura per le due salette. `risorsa_id` nullable, senza FK per ora
--     (la tabella delle risorse arriva con la sua consegna). Il vincolo di
--     non-sovrapposizione diventa per-risorsa: con `risorsa_id` nullo si
--     comporta esattamente come oggi (una poltrona sola); quando ci saranno due
--     salette, basta valorizzarlo.
--
--     Nota roadmap: alcuni negozi hanno DUE SALETTE con due ottici che visitano
--     in contemporanea. Questa migrazione prepara il terreno; il supporto vero
--     (tabella risorse, disponibilità per risorsa, scelta in prenotazione) è una
--     consegna a sé.
-- ----------------------------------------------------------------------------
alter table public.appuntamenti add column if not exists risorsa_id uuid;
comment on column public.appuntamenti.risorsa_id is
  'Saletta/poltrona. Nullo = poltrona unica (comportamento storico). Nessuna FK per ora: la tabella delle risorse arriva con la sua consegna.';

alter table public.appuntamenti drop constraint if exists appuntamenti_niente_sovrapposizioni;
alter table public.appuntamenti add constraint appuntamenti_niente_sovrapposizioni
  exclude using gist (
    azienda_id with =,
    coalesce(risorsa_id, azienda_id) with =,
    public.appuntamento_intervallo(inizio, durata_minuti) with &&
  ) where (stato in ('in_attesa','prenotato','completato'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · `prenotazioni` smette di governare gli slot.
--   · Si elimina il suo EXCLUDE: se restasse, spostare un appuntamento lascerebbe
--     l'esclusione appesa al vecchio orario e quello slot resterebbe bloccato.
--   · `appuntamento_id` diventa NOT NULL, previo riempimento.
--   · `inizio`/`durata_minuti` restano ma cambiano significato: sono QUANTO È
--     STATO CHIESTO. La verità dello slot è l'appuntamento; se l'ottico sposta,
--     i due valori divergono, ed è giusto — la divergenza racconta lo spostamento.
-- ----------------------------------------------------------------------------
alter table public.prenotazioni drop constraint if exists prenotazioni_niente_sovrapposizioni;

-- Riempimento robusto — deve funzionare anche sul residuo dei test (il trigger
-- no-delete impedisce di cancellarle): nessuna riga può restare senza appuntamento,
-- o il NOT NULL fallisce a metà. Lo stato dell'appuntamento SEGUE la pratica: una
-- richiesta risolta come rifiutata/annullata NON occupa lo slot (altrimenti due
-- annullate sovrapposte violerebbero il nuovo EXCLUDE).
do $$
declare
  r record;
  v_appto uuid;
  v_stato_appto text;
begin
  for r in select * from public.prenotazioni where appuntamento_id is null loop
    v_stato_appto := case r.stato
      when 'in_attesa' then 'in_attesa'
      when 'accettata' then 'prenotato'
      else 'annullato'          -- rifiutata / annullata: non occupa
    end;
    insert into public.appuntamenti (
      azienda_id, inizio, durata_minuti, stato, fonte, tipo, riferimento, cliente_id, risorsa_id
    ) values (
      r.azienda_id, r.inizio, least(greatest(r.durata_minuti, 5), 240),
      v_stato_appto, r.fonte, 'controllo_vista', r.codice, r.cliente_id, null
    ) returning id into v_appto;
    update public.prenotazioni set appuntamento_id = v_appto where id = r.id;
  end loop;
end $$;

alter table public.prenotazioni alter column appuntamento_id set not null;

comment on column public.prenotazioni.inizio is
  'QUANTO E'' STATO CHIESTO. La verita'' dello slot e'' l''appuntamento collegato (appuntamento_id); se l''ottico sposta, i due valori divergono e la divergenza racconta lo spostamento.';
comment on column public.prenotazioni.durata_minuti is
  'Durata CHIESTA. La verita'' dello slot e'' l''appuntamento collegato (vedi commento su inizio).';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · `slot_liberi` guarda un posto solo. Sparisce la sottoquery su
--     `prenotazioni`; gli stati che occupano sono ora ('in_attesa','prenotato',
--     'completato') su `appuntamenti`. Una sottoquery in meno per candidato, e
--     quella che resta usa l'indice GiST del vincolo.
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
           where a.azienda_id = v_azienda and a.stato in ('in_attesa','prenotato','completato')
             and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
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
-- 5 · `crea_prenotazione` scrive DUE righe, nella stessa transazione: prima
--     l'APPUNTAMENTO (lo slot, stato 'in_attesa'), poi la PRENOTAZIONE (la
--     pratica) collegata. Se l'appuntamento viola il vincolo di esclusione,
--     l'errore resta 'SLOT_OCCUPATO'. Idempotenza, lock e codice leggibile non
--     cambiano: sono soltanto spostati.
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
  v_fonte text; v_codice text; v_id uuid; v_appto uuid; r record;
  v_oggi date := (now() at time zone c_tz)::date;
begin
  -- 1 · IDEMPOTENZA per prima cosa: un secondo invio NON crea un'altra riga.
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
  if not exists (
    select 1 from public.orari_apertura o
    where o.azienda_id = v_az and o.giorno = extract(dow from v_giorno)::int
      and (v_giorno + o.apre)   at time zone c_tz <= p_inizio
      and p_inizio + (v_dur * interval '1 minute') <= (v_giorno + o.chiude) at time zone c_tz
  ) then raise exception 'FUORI_ORARIO'; end if;
  -- appuntamenti occupanti (ora anche 'in_attesa'): early-out pulito. La difesa
  -- ultima è comunque l'EXCLUDE all'inserimento dell'appuntamento qui sotto.
  if exists (
    select 1 from public.appuntamenti a
    where a.azienda_id = v_az and a.stato in ('in_attesa','prenotato','completato')
      and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
       && public.appuntamento_intervallo(p_inizio, v_dur)
  ) then raise exception 'SLOT_OCCUPATO'; end if;
  -- blocchi: non sono appuntamenti, l'EXCLUDE non li vede → controllo esplicito
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
    returning persone.id into v_persona;
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

  -- 6a · l'APPUNTAMENTO (lo slot). Il vincolo di non-sovrapposizione su
  --      appuntamenti cattura la doppia sullo stesso slot.
  begin
    insert into public.appuntamenti (
      azienda_id, inizio, durata_minuti, stato, fonte, tipo, riferimento, risorsa_id
    ) values (
      v_az, p_inizio, v_dur, 'in_attesa', v_fonte, 'controllo_vista', v_codice, null
    ) returning appuntamenti.id into v_appto;
  exception
    when exclusion_violation then
      raise exception 'SLOT_OCCUPATO';
  end;

  -- 6b · la PRENOTAZIONE (la pratica), collegata all'appuntamento.
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
      -- concorrente con la STESSA chiave_richiesta (irraggiungibile sotto il lock
      -- per la stessa azienda): non lasciare l'appuntamento orfano, poi ritorna
      -- la riga già scritta (idempotenza).
      delete from public.appuntamenti where id = v_appto;
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
  'Crea una richiesta di prenotazione: DUE righe nella stessa transazione — appuntamento (lo slot, stato in_attesa) + prenotazione (la pratica) collegata. Atomica e idempotente per chiave_richiesta; advisory lock sull''azienda. Errori distinti: NEGOZIO_NON_TROVATO, SERVIZIO_NON_ATTIVO, FUORI_ORIZZONTE, TROPPO_TARDI, FUORI_ORARIO, SLOT_OCCUPATO.';

grant execute on function public.crea_prenotazione(text,text,timestamptz,text,text,text,text,text,text,text,boolean) to anon, authenticated;

-- ============================================================================
-- Fine 013. Uno slot è occupato in un posto solo: `appuntamenti`. Una richiesta
-- dal portale e un cliente al banco non possono finire nello stesso orario, e il
-- database lo impedisce da sé.
-- ============================================================================
