-- ============================================================================
-- 011 · Prenotazioni: persone, richieste, registro, lista d'attesa + slot_liberi
-- ----------------------------------------------------------------------------
-- Additiva e idempotente. Le tabelle su cui poggia tutto il portale + la
-- funzione che calcola gli orari liberi. Modello di identità: vedi
-- docs/decisioni/ID-01-identita.md. Le tre regole che contano qui:
--   • `persone` è di Limpidia (nessun azienda_id, chiave = telefono normalizzato);
--   • `clienti` resta del negozio (non si tocca);
--   • il negozio NON legge MAI `persone` (RLS senza policy): ci arrivano solo le
--     funzioni security definer, e il dato di contatto si COPIA sulla prenotazione.
-- Qui NON si prenota (la scrittura è G7): si costruisce e si legge.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · normalizza_telefono — una sola chiave per lo stesso numero
-- ----------------------------------------------------------------------------
-- '340 1234567', '+39 340 1234567' e '3401234567' devono produrre la STESSA
-- chiave, o diventano tre persone. Best-effort per numeri italiani; un prefisso
-- internazionale diverso da +39 si lascia com'è.
-- ----------------------------------------------------------------------------
-- ⚠️ MODIFICARE QUESTA FUNZIONE RICHIEDE UNA MIGRAZIONE DI RICALCOLO.
-- Alimenta la colonna GENERATA e memorizzata `persone.telefono_normalizzato`,
-- con sopra un indice UNICO. Se la logica cambia (es. un prefisso estero), le
-- righe già scritte conservano la vecchia normalizzazione e le nuove usano la
-- nuova: l'indice unico non se ne accorge e la stessa persona esiste due volte.
-- Qualsiasi modifica va accompagnata da un UPDATE che forza il ricalcolo di
-- telefono_normalizzato su tutte le righe esistenti. La sentinella
-- `diag_normalizza_telefono` (sotto) è la guardia di questa promessa.
-- ----------------------------------------------------------------------------
create or replace function public.normalizza_telefono(p text)
returns text language sql immutable as $$
  with pulito as (select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g') as s)
  select case
    when s = ''            then ''
    when s like '+39%'     then '+39' || substring(s from 4)
    when s like '0039%'    then '+39' || substring(s from 5)
    when s like '+%'       then s                                   -- altro internazionale
    when length(s) >= 11 and s like '39%' then '+39' || substring(s from 3)
    else '+39' || s                                                 -- nazionale nudo
  end
  from pulito;
$$;
comment on function public.normalizza_telefono(text) is
  'Chiave di dedup di una persona: porta un numero italiano in forma +39XXXXXXXXXX. Alimenta la colonna generata persone.telefono_normalizzato (indice unico): MODIFICARLA richiede una migrazione di ricalcolo su tutte le righe. Limite noto: un fisso di famiglia condiviso collassa due persone in una (si risolve con per_conto_di sulla prenotazione).';

-- Sentinella (stessa famiglia di appuntamento_intervallo/diag_intervallo_immutabile):
-- normalizza_telefono DEVE restare IMMUTABLE (una colonna generata stored la
-- richiede) e la sua FORMA DEL CORPO non deve cambiare in silenzio — un cambio
-- sdoppierebbe le identità già scritte senterror. Questa RPC espone i due fatti
-- da verificare a contratto: volatilità 'i' e presenza dei marcatori del corpo
-- (regexp_replace + prefisso +39). Se cambiano, serve la migrazione di ricalcolo.
create or replace function public.diag_normalizza_telefono()
returns table (volatile_immutabile boolean, corpo_ok boolean)
language sql stable security definer set search_path = public, pg_catalog as $$
  select p.provolatile = 'i',
         p.prosrc ilike '%regexp_replace%' and p.prosrc ilike '%+39%'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalizza_telefono';
$$;
-- Diagnostica: non serve al pubblico. Il test la chiama col service role.
revoke execute on function public.diag_normalizza_telefono() from anon, public;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · persone — di LIMPIDIA, non del negozio. Nessun azienda_id.
-- ----------------------------------------------------------------------------
create table if not exists public.persone (
  id                    uuid primary key default uuid_generate_v4(),
  telefono_grezzo       text not null,
  -- chiave di dedup GENERATA: nessuno può inserire una forma non normalizzata.
  telefono_normalizzato text generated always as (public.normalizza_telefono(telefono_grezzo)) stored unique,
  nome                  text not null,
  email                 text,
  auth_user_id          uuid references auth.users (id) on delete set null,
  ottico_di_riferimento uuid references public.aziende (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · prenotazioni — la RICHIESTA (non la visita). Il dato di contatto è COPIATO
--     qui, perché il negozio non legge mai `persone`.
-- ----------------------------------------------------------------------------
create table if not exists public.prenotazioni (
  id                uuid primary key default uuid_generate_v4(),
  azienda_id        uuid not null references public.aziende (id) on delete cascade,
  persona_id        uuid not null references public.persone (id) on delete restrict,
  cliente_id        uuid references public.clienti (id) on delete set null,
  appuntamento_id   uuid references public.appuntamenti (id) on delete set null,
  servizio_codice   text not null references public.servizi (codice) on delete restrict,
  inizio            timestamptz not null,
  durata_minuti     int not null check (durata_minuti > 0),
  -- stati della RICHIESTA (non della visita: quella è l'appuntamento).
  stato             text not null default 'in_attesa'
                    check (stato in ('in_attesa','accettata','rifiutata','annullata')),
  fonte             text not null default 'portale'
                    check (fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale')),
  per_conto_di      text,
  -- copia del contatto AL MOMENTO della prenotazione: l'ottico vede chi ha
  -- prenotato senza che gli si apra nessuna finestra su `persone`.
  contatto_nome     text not null,
  contatto_telefono text not null,
  contatto_email    text,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · persone_riferimento_registro — append-only. L'unica cosa che fra un anno
--     spiega «perché questa persona risulta di Bianchi?».
-- ----------------------------------------------------------------------------
create table if not exists public.persone_riferimento_registro (
  id              uuid primary key default uuid_generate_v4(),
  persona_id      uuid not null references public.persone (id) on delete restrict,
  da_azienda_id   uuid references public.aziende (id) on delete set null,
  a_azienda_id    uuid not null references public.aziende (id) on delete restrict,
  prenotazione_id uuid references public.prenotazioni (id) on delete set null,
  utente_id       uuid references public.utenti (id) on delete set null,
  quando          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · lista_attesa — se uno slot si libera, chi è in lista riceve l'avviso.
--     L'avviso vero è G8; la tabella nasce ora.
-- ----------------------------------------------------------------------------
create table if not exists public.lista_attesa (
  id              uuid primary key default uuid_generate_v4(),
  persona_id      uuid not null references public.persone (id) on delete cascade,
  azienda_id      uuid not null references public.aziende (id) on delete cascade,
  servizio_codice text not null references public.servizi (codice) on delete restrict,
  giorno_preferito date,
  stato           text not null default 'in_attesa'
                  check (stato in ('in_attesa','avvisata','chiusa')),
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · Indici
-- ----------------------------------------------------------------------------
create index if not exists idx_prenotazioni_azienda on public.prenotazioni (azienda_id, inizio);
create index if not exists idx_prenotazioni_persona on public.prenotazioni (persona_id, inizio);
create index if not exists idx_lista_attesa_azienda on public.lista_attesa (azienda_id, servizio_codice);
create index if not exists idx_registro_persona on public.persone_riferimento_registro (persona_id, quando);

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · Append-only / niente delete fisica
-- ----------------------------------------------------------------------------
-- Il registro non si modifica né si cancella: è la memoria dei passaggi.
create or replace function public.blocca_modifica() returns trigger
language plpgsql as $$
begin
  raise exception 'operazione vietata su %: la tabella è append-only', TG_TABLE_NAME;
end $$;

drop trigger if exists trg_registro_append_only on public.persone_riferimento_registro;
create trigger trg_registro_append_only
  before update or delete on public.persone_riferimento_registro
  for each row execute function public.blocca_modifica();

-- Le prenotazioni non si cancellano MAI: una disdetta cambia stato. Quelle date
-- sono la materia prima dei richiami a un anno.
drop trigger if exists trg_prenotazioni_no_delete on public.prenotazioni;
create trigger trg_prenotazioni_no_delete
  before delete on public.prenotazioni
  for each row execute function public.blocca_modifica();

-- Coerenza tenant (008) sulle FK incrociate verso tabelle con azienda_id.
drop trigger if exists trg_coerenza_prenotazioni on public.prenotazioni;
create trigger trg_coerenza_prenotazioni
  before insert or update on public.prenotazioni
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','appuntamento_id','appuntamenti');

drop trigger if exists trg_coerenza_registro on public.persone_riferimento_registro;
create trigger trg_coerenza_registro
  before insert on public.persone_riferimento_registro
  for each row execute function public.assicura_coerenza_tenant('prenotazione_id','prenotazioni');

-- ────────────────────────────────────────────────────────────────────────────
-- 8 · Sicurezza — la parte più importante
-- ----------------------------------------------------------------------------
-- Supabase concede select ad anon per default: si revoca su TUTTE. Poi:
--   • persone e registro: RLS attiva SENZA policy → nessuno legge, nemmeno
--     l'ottico autenticato. Ci arrivano solo le funzioni security definer.
--   • prenotazioni e lista_attesa: l'ottico legge SOLO le proprie.
-- ----------------------------------------------------------------------------
alter table public.persone                       enable row level security;
alter table public.prenotazioni                  enable row level security;
alter table public.persone_riferimento_registro  enable row level security;
alter table public.lista_attesa                  enable row level security;

revoke select on public.persone                      from anon;
revoke select on public.prenotazioni                 from anon;
revoke select on public.persone_riferimento_registro from anon;
revoke select on public.lista_attesa                 from anon;

-- persone e registro: NESSUNA policy (intenzionale). Nessun select per nessuno.

drop policy if exists "prenotazioni: della propria azienda" on public.prenotazioni;
create policy "prenotazioni: della propria azienda" on public.prenotazioni
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

drop policy if exists "lista_attesa: della propria azienda" on public.lista_attesa;
create policy "lista_attesa: della propria azienda" on public.lista_attesa
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- ────────────────────────────────────────────────────────────────────────────
-- 9 · slot_liberi — gli orari di inizio liberi per un servizio in un giorno.
-- ----------------------------------------------------------------------------
-- security definer + eseguibile da anon: solo così l'anonimo ottiene il calcolo
-- senza leggere appuntamenti/prenotazioni/blocchi (che gli sono revocati).
-- Costanti (commentate, non sparse): passo 15', anticipo 2h, orizzonte 90 giorni.
-- Fuso: gli orari di apertura sono ora di PARETE italiana; li si àncora a
-- Europe/Rome con `at time zone` (che applica le regole di ora legale del
-- giorno), poi si genera in tempo ASSOLUTO — così non nascono orari inesistenti
-- né se ne saltano nel giorno del cambio d'ora.
-- ----------------------------------------------------------------------------
create or replace function public.slot_liberi(p_slug text, p_servizio text, p_giorno date)
returns setof timestamptz
language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare
  c_passo     constant interval := interval '15 minutes';   -- passo dei candidati
  c_anticipo  constant interval := interval '2 hours';       -- anticipo minimo
  c_orizzonte constant int      := 90;                       -- giorni massimi
  c_tz        constant text     := 'Europe/Rome';
  v_azienda   uuid;
  v_durata    int;
  v_dur       interval;
  v_dow       int;
  v_now       timestamptz := now();
  v_oggi      date := (v_now at time zone c_tz)::date;
  r_fascia    record;
  v_apre_abs  timestamptz;
  v_chiude_abs timestamptz;
  v_cand      timestamptz;
begin
  -- 1 · azienda pubblicata
  select id into v_azienda from public.aziende where slug = p_slug and portale_attivo = true;
  if v_azienda is null then return; end if;

  -- orizzonte: niente passato, niente oltre 90 giorni (no lavoro a vuoto)
  if p_giorno < v_oggi or p_giorno > v_oggi + c_orizzonte then return; end if;

  -- 2 · durata del servizio ATTIVO per quel negozio (deroga o predefinita)
  select coalesce(ns.durata_minuti, s.durata_predefinita_minuti) into v_durata
  from public.negozi_servizi ns
  join public.servizi s on s.codice = ns.servizio_codice
  where ns.azienda_id = v_azienda and ns.servizio_codice = p_servizio and ns.attivo = true;
  if v_durata is null then return; end if;
  v_dur := v_durata * interval '1 minute';

  -- 3 · chiusura (ferie/festività) che copre il giorno
  if exists (select 1 from public.chiusure where azienda_id = v_azienda and p_giorno between dal and al) then
    return;
  end if;

  v_dow := extract(dow from p_giorno)::int;   -- 0=domenica … 6=sabato

  -- 4/5/6 · candidati per fascia, filtrati
  for r_fascia in
    select apre, chiude from public.orari_apertura where azienda_id = v_azienda and giorno = v_dow
  loop
    -- istanti assoluti dell'apertura/chiusura di QUEL giorno in ora italiana
    v_apre_abs   := (p_giorno + r_fascia.apre)   at time zone c_tz;
    v_chiude_abs := (p_giorno + r_fascia.chiude) at time zone c_tz;
    v_cand := v_apre_abs;
    while v_cand + v_dur <= v_chiude_abs loop
      if v_cand >= v_now + c_anticipo
         -- appuntamenti: uso `appuntamento_intervallo` (008) così il predicato &&
         -- combacia con l'indice GiST parziale del vincolo di non-sovrapposizione
         -- e diventa una index-condition, non una scansione riga per riga.
         and not exists (
           select 1 from public.appuntamenti a
           where a.azienda_id = v_azienda and a.stato in ('prenotato','completato')
             and public.appuntamento_intervallo(a.inizio, a.durata_minuti)
              && public.appuntamento_intervallo(v_cand, v_durata))
         -- prenotazioni/blocchi: nessun indice GiST sull'intervallo, ma il btree
         -- (azienda_id, inizio) sì. I due limiti di data rendono usabile il btree
         -- (una manciata di righe del giorno, non tutta la storia del negozio).
         -- Il margine di 1 giorno copre una riga che inizia prima e sconfina.
         and not exists (
           select 1 from public.prenotazioni p
           where p.azienda_id = v_azienda and p.stato in ('in_attesa','accettata')
             and p.inizio >= v_apre_abs - interval '1 day' and p.inizio < v_chiude_abs
             and tstzrange(p.inizio, p.inizio + (p.durata_minuti * interval '1 minute'))
              && tstzrange(v_cand, v_cand + v_dur))
         and not exists (
           select 1 from public.blocchi_slot b
           where b.azienda_id = v_azienda
             and b.inizio >= v_apre_abs - interval '1 day' and b.inizio < v_chiude_abs
             and tstzrange(b.inizio, b.fine) && tstzrange(v_cand, v_cand + v_dur))
      then
        return next v_cand;
      end if;
      v_cand := v_cand + c_passo;
    end loop;
  end loop;
  return;
end $$;

comment on function public.slot_liberi(text, text, date) is
  'Orari di inizio liberi per un servizio in un giorno: orari di apertura meno appuntamenti (prenotato/completato), prenotazioni (in_attesa/accettata) e blocchi. security definer perché l''anon non legge quelle tabelle. Passo 15'', anticipo 2h, orizzonte 90 giorni, fuso Europe/Rome.';

-- L'anon (e l'utente autenticato) possono calcolare gli slot; NON leggere le tabelle.
grant execute on function public.slot_liberi(text, text, date) to anon, authenticated;

-- ============================================================================
-- Fine 011. persone e registro chiusi a tutti (solo security definer);
-- prenotazioni/lista_attesa solo al proprio tenant; slot_liberi aperto all'anon.
-- ============================================================================
