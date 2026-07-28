-- ============================================================================
-- 018 · «Prendi come cliente» — il percorso di scrittura che la 011 non esponeva
-- ----------------------------------------------------------------------------
-- La G8 chiude il giro: l'ottico accetta una richiesta dal portale (solo
-- `appuntamenti`/`prenotazioni`, dentro il tenant → nessuna migrazione) e poi,
-- come ATTO SEPARATO, può prendersi la persona come cliente.
--
-- Quest'ultimo passo tocca due tabelle che la 011 ha chiuso a chiave (ID-01):
--   • `persone`                      → RLS attiva SENZA policy: nessuno scrive;
--   • `persone_riferimento_registro` → idem, e in più append-only.
-- «Ci arrivano solo le funzioni security definer» (commento della 011). Questo È
-- il percorso di scrittura mancante: una funzione definer, con le guardie DENTRO.
-- Niente service role lato app; niente policy nuove che aprano quelle tabelle.
--
-- Additiva e idempotente. Nessuna colonna nuova, nessun dato riscritto.
--
-- Include il fix del difetto annotato in docs/agenti/TODO-ray.md §7: il trigger
-- di coerenza del registro non poteva funzionare (vedi punto 1) — la G8 è la
-- consegna che lo chiude, perché è la prima a scriverci davvero.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · FIX (TODO §7) · coerenza del registro dei passaggi
-- ----------------------------------------------------------------------------
-- La 011 aveva messo sul registro il trigger tenant generico
-- `assicura_coerenza_tenant('prenotazione_id','prenotazioni')`. Ma quel
-- controllo confronta la FK con `NEW.azienda_id` della riga, e il registro NON
-- ha `azienda_id`: `mia_azienda` risultava NULL e, con una prenotazione
-- valorizzata, `ref_azienda is distinct from NULL` → SEMPRE vero → 23514 su
-- OGNI insert. Il registro era inscrivibile.
--
-- La coerenza giusta per questa tabella è diversa e specifica: il registro
-- racconta un PASSAGGIO tra due aziende (da_azienda → a_azienda), quindi la
-- da_azienda è legittimamente altrui (o nulla). L'unico vincolo sensato: la
-- prenotazione che AUTORIZZA il passaggio dev'essere di chi si prende la persona
-- (a_azienda_id).
-- ----------------------------------------------------------------------------
create or replace function public.coerenza_registro_riferimento()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_pren_az uuid;
begin
  if NEW.prenotazione_id is not null then
    select azienda_id into v_pren_az from public.prenotazioni where id = NEW.prenotazione_id;
    if v_pren_az is distinct from NEW.a_azienda_id then
      raise exception
        'Registro passaggi: la prenotazione % è di azienda %, ma il passaggio è verso %',
        NEW.prenotazione_id, coalesce(v_pren_az::text, '∅'), coalesce(NEW.a_azienda_id::text, '∅')
        using errcode = '23514';
    end if;
  end if;
  return NEW;
end $$;
comment on function public.coerenza_registro_riferimento() is
  'TODO §7: coerenza del registro dei passaggi. Il registro non ha azienda_id (spanna due aziende), quindi il trigger tenant generico non si applica: qui si verifica solo che la prenotazione che autorizza il passaggio sia dell''azienda ricevente (a_azienda_id).';

drop trigger if exists trg_coerenza_registro on public.persone_riferimento_registro;
create trigger trg_coerenza_registro
  before insert on public.persone_riferimento_registro
  for each row execute function public.coerenza_registro_riferimento();

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Un cliente PROPRIO con lo stesso telefono normalizzato — per PROPORRE il
--     collegamento invece del doppione (§6.1). Nove volte su dieci è già passato.
-- ----------------------------------------------------------------------------
-- security definer ma inchiodata a get_azienda_id(): non vede oltre il proprio
-- tenant. Serve perché `normalizza_telefono` non è usabile in un filtro PostgREST.
-- ----------------------------------------------------------------------------
create or replace function public.cliente_per_telefono(p_telefono text)
returns table (id uuid, nome text, cognome text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select c.id, c.nome, c.cognome
  from public.clienti c
  where c.azienda_id = public.get_azienda_id()
    and c.telefono is not null
    and public.normalizza_telefono(c.telefono) = public.normalizza_telefono(p_telefono)
  order by c.created_at
  limit 1;
$$;
comment on function public.cliente_per_telefono(text) is
  'G8 §6.1: un cliente della PROPRIA azienda (get_azienda_id) con lo stesso telefono normalizzato, per proporre il collegamento invece di creare un doppione. Ritorna al più uno (il più vecchio).';
revoke execute on function public.cliente_per_telefono(text) from anon, public;
grant  execute on function public.cliente_per_telefono(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · L'ATTO · prendi la persona di una prenotazione ACCETTATA come cliente.
-- ----------------------------------------------------------------------------
-- Fa, atomicamente, i cinque passi della §6:
--   (a) collega un cliente esistente (proprio) o ne crea uno nuovo
--       — nome/telefono/fonte dalla prenotazione, NIENTE consenso commerciale;
--   (b) riempie appuntamenti.cliente_id e prenotazioni.cliente_id;
--   (c) imposta persone.ottico_di_riferimento su quest'azienda;
--   (d) scrive la riga nel registro (da chi, a chi, quale prenotazione, chi ha premuto).
--
-- Guardie DENTRO (non ci si fida del chiamante): la prenotazione è di chi chiama
-- (get_azienda_id) ed è 'accettata'. Idempotente: se già presa, ritorna il
-- cliente già collegato senza doppioni né seconda riga di registro.
--
-- security definer: è l'unico modo sancito di scrivere persone/registro. Owner
-- del progetto → bypassa la RLS di quelle due tabelle; le guardie qui sotto
-- fanno il lavoro che la RLS non può fare (persone non ha azienda_id).
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- Fine 018. L'ottico può accettare una richiesta e, se vuole, prendersi la
-- persona come cliente: l'unico percorso di scrittura verso persone/registro è
-- questa funzione, con le guardie dentro. Fino a quel gesto, la persona non è di
-- nessuno.
-- ============================================================================
