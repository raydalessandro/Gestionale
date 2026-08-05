-- ============================================================================
-- 020 · Bonifica — S0 dell'Era 2 (igiene dei grant + il registro che manca)
-- ----------------------------------------------------------------------------
-- Prima busta dell'Era 2. Chiude i rilievi della mappa giro-2 (05/08) e allinea
-- ENTRAMBI gli ambienti (test e produzione) con la STESSA migrazione.
--
-- Idempotente e additiva: nessun rename, nessun drop di dati. Le revoche
-- riportano i privilegi allo stato che la RLS già presupponeva — oggi «la RLS
-- salva, ma sei a una politica distratta dal buco».
--
-- ⚠️ VP-01 — LE QUATTRO VISTE DEL PORTALE NON SI TOCCANO.
-- `revoke ... on all tables in schema public` in PostgreSQL comprende ANCHE LE
-- VISTE: usarlo spegnerebbe il portale pubblico. Per questo il punto (b) cicla
-- esplicitamente sulle sole tabelle ordinarie (`relkind in ('r','p')`), e il
-- punto (f) VERIFICA che le quattro viste conservino il grant ad anon,
-- fallendo rumorosamente in caso contrario.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- (e1) `_infra_migrazioni` — il registro delle migrazioni.
--      In test esiste (fermo a 015); in produzione NON esiste. Stessa struttura
--      dello script `scripts/applica-migrazioni.ts`: nome (PK) + applied_at.
--      Creato PRIMA della revoca, così il ciclo (b) lo copre.
-- ----------------------------------------------------------------------------
create table if not exists public._infra_migrazioni (
  nome       text primary key,
  applied_at timestamptz not null default now()
);
comment on table public._infra_migrazioni is
  'Registro delle migrazioni applicate. REGOLA PERMANENTE (Era 2): le migrazioni passano SOLO dalla strada che registra (script/connettore), mai a mano dal dashboard.';

-- ────────────────────────────────────────────────────────────────────────────
-- (a) `_riparazioni_dati` — il segnaposto della 019 non deve essere cancellabile.
--     Chi lo toglie ri-arma lo slittamento di 2 ore degli appuntamenti da banco.
--     RLS attiva SENZA policy: nessuno legge né scrive, tranne il service role
--     (bypassa la RLS) e il proprietario.
-- ----------------------------------------------------------------------------
alter table public._riparazioni_dati enable row level security;
revoke all on public._riparazioni_dati from anon;
revoke all on public._riparazioni_dati from authenticated;
comment on table public._riparazioni_dati is
  'Marker delle riparazioni-dati una-tantum (019: fuso appuntamenti da banco). RLS senza policy + nessun grant: solo il service role. Cancellarne una riga RI-ARMEREBBE la riparazione corrispondente.';

-- ────────────────────────────────────────────────────────────────────────────
-- (b) Igiene dei grant: `anon` non ha nulla da fare sulle TABELLE.
--     Il portale pubblico legge SOLO le quattro viste (definer) e due funzioni
--     (`slot_liberi`, `crea_prenotazione`, security definer): nessuna tabella.
--     Verificato sul codice: `lib/portale/negozio.ts`, `lib/portale/slot.ts`,
--     `app/(portale)/ottica/[slug]/prenota/*`.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')          -- SOLO tabelle: le viste restano (VP-01)
  loop
    execute format('revoke all on public.%I from anon', r.relname);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- (c) Le funzioni-trigger non sono API: `anon` non le esegue.
--
--     ⚠️ DIFFERENZA RILEVATA DAL RITO (verbalizzata in PR). La consegna dice
--     «revoke execute da anon»: da solo NON basta. Le tre funzioni hanno
--     EXECUTE concesso a PUBLIC (ACL `=X/postgres`), e anon lo eredita: dopo il
--     solo `revoke ... from anon`, `has_function_privilege('anon', …)` resta
--     TRUE (verificato in dry-run: atteso 0, ottenuto 3). Per ottenere ciò che
--     la consegna VUOLE si revoca anche a PUBLIC; `authenticated` e
--     `service_role` conservano il proprio grant ESPLICITO, quindi non
--     perdono nulla.
--
--     Sicurezza dei trigger: PostgreSQL NON verifica il privilegio EXECUTE
--     quando un trigger scatta (il controllo avviene alla CREATE TRIGGER), e
--     comunque le tre funzioni sono `security definer`. Verificato in dry-run
--     facendo scattare i trigger dopo la revoca.
-- ----------------------------------------------------------------------------
revoke execute on function public.assicura_coerenza_tenant()  from public, anon;
revoke execute on function public.crea_sala_default()         from public, anon;
revoke execute on function public.assegna_sala_appuntamento() from public, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- (d) `risorse`: l'unica policy dello schema rimasta su PUBLIC. Ricreata
--     IDENTICA nel predicato, ristretta ad `authenticated` come tutte le altre.
-- ----------------------------------------------------------------------------
drop policy if exists "risorse: della propria azienda" on public.risorse;
create policy "risorse: della propria azienda" on public.risorse
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- ────────────────────────────────────────────────────────────────────────────
-- (e2) Backfill del registro: 001 → 020. `on conflict do nothing` — in test
--      completa il buco 016→019, in produzione scrive tutta la storia.
--      Da qui in avanti ogni migrazione registra sé stessa.
-- ----------------------------------------------------------------------------
insert into public._infra_migrazioni (nome) values
  ('001_schema_base'),
  ('002_ordini_buste'),
  ('003_catalogo_magazzino'),
  ('004_agenda_richiami'),
  ('005_cassa_vendite'),
  ('006_anagrafiche'),
  ('007_caparra_incasso'),
  ('008_sicurezza_tenant'),
  ('009_fonte_ordini'),
  ('010_orari_servizi'),
  ('011_prenotazioni'),
  ('012_crea_prenotazione'),
  ('013_agenda_unica'),
  ('014_sale'),
  ('015_ambiente_test'),
  ('016_fix_crea_prenotazione_id_ambiguo'),
  ('017_servizi_richiesta'),
  ('018_prendi_come_cliente'),
  ('019_fuso_appuntamenti_banco'),
  ('020_bonifica')
on conflict (nome) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- (f) GUARDIA VP-01: le quattro viste del portale devono ancora essere
--     leggibili da `anon`. Se una revoca le avesse toccate, qui si ferma tutto.
-- ----------------------------------------------------------------------------
do $$
declare
  v_mancanti text;
begin
  select string_agg(v, ', ') into v_mancanti
  from unnest(array['negozi_pubblici','orari_pubblici','chiusure_pubbliche','servizi_pubblici']) as v
  where not has_table_privilege('anon', 'public.' || v, 'SELECT');

  if v_mancanti is not null then
    raise exception 'VP-01 VIOLATA: anon ha perso SELECT sulle viste del portale: %', v_mancanti;
  end if;
end $$;

-- ============================================================================
-- Fine 020. `anon` tocca solo ciò che deve (le quattro viste e le due RPC
-- definer), il segnaposto della 019 non è più cancellabile, e i due ambienti
-- hanno lo stesso registro delle migrazioni.
-- ============================================================================
