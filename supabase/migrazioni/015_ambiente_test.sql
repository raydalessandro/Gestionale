-- ============================================================================
-- 015 · Ambiente di test e pulizia del residuo (infra CI)
-- ----------------------------------------------------------------------------
-- Accende la rete di sicurezza già costruita (18 file di contratto + 25 E2E)
-- dando alla CI un modo per ripartire PULITA a ogni giro. Il residuo esiste
-- perché le prenotazioni NON si cancellano (trigger no-delete) e BLOCCANO la
-- persona (FK restrict): nessuna cascade riesce a portarle via. Serve una
-- funzione dedicata, e un CANCELLO POSITIVO che le impedisca di girare fuori dal
-- progetto di test.
--
-- Additiva e idempotente. Sul progetto di PRODUZIONE resta inerte: la tabella
-- `ambiente` è vuota, quindi `svuota_dati_di_test()` si rifiuta di partire.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Il cancello d'ambiente. POSITIVO, non per esclusione: guardare l'URL non
--     basta. La riga ('test') la scrive lo script di provisioning SOLO sul
--     progetto di test (scripts/applica-migrazioni.ts con MARCA_AMBIENTE_TEST=1).
-- ----------------------------------------------------------------------------
create table if not exists public.ambiente (
  nome text primary key
);
alter table public.ambiente enable row level security;
revoke select on public.ambiente from anon;
comment on table public.ambiente is
  'Marcatore d''ambiente. Una riga ''test'' abilita svuota_dati_di_test(). Vuota in produzione (la funzione si rifiuta di partire). La scrive lo script di provisioning solo sul progetto di test.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · La pulizia del residuo delle prove. Security definer (gira come owner:
--     serve a spegnere per un attimo i trigger append-only/no-delete). Cancella
--     SOLO ciò che le prove creano; il seed dimostrativo resta intatto.
--
--     Cosa è «di prova»:
--       • tenant contratto  → slug `test-…`
--       • tenant E2E        → slug `ottica-e2e-…`
--       • utenti auth        → email `…@test.local`
--       • prenotazioni/persone → TUTTE: il seed non ne crea (nascono dalle prove)
--       • appuntamenti        → quelli collegati a una prenotazione (portale) +
--         quelli dei tenant di prova. Gli appuntamenti del seed (fonte 'banco',
--         non collegati) sui negozi dimostrativi NON si toccano.
-- ----------------------------------------------------------------------------
create or replace function public.svuota_dati_di_test()
returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_appti uuid[];
begin
  -- cancello: senza la riga ('test') non si parte. Vale su qualunque URL.
  if not exists (select 1 from public.ambiente where nome = 'test') then
    raise exception
      'svuota_dati_di_test: ambiente non marcato test — rifiuto di cancellare (public.ambiente non contiene la riga ''test'')';
  end if;

  -- gli appuntamenti nati dal portale sono quelli collegati a una prenotazione:
  -- raccolti PRIMA di cancellare le prenotazioni.
  select coalesce(array_agg(appuntamento_id), '{}') into v_appti
  from public.prenotazioni where appuntamento_id is not null;

  -- append-only / no-delete: spenti il tempo della pulizia (gira come owner).
  alter table public.persone_riferimento_registro disable trigger trg_registro_append_only;
  alter table public.prenotazioni                 disable trigger trg_prenotazioni_no_delete;

  -- `where true` esplicito: Supabase tiene acceso sql_safe_updates, che rifiuta
  -- una DELETE senza WHERE ("DELETE requires a WHERE clause"). Qui svuotare
  -- l'intera tabella è voluto — sono tutte righe di prova — ma il predicato deve
  -- comunque esserci.
  delete from public.persone_riferimento_registro where true;
  delete from public.lista_attesa                 where true;
  delete from public.prenotazioni where true;   -- tutte: sono dati di prova
  delete from public.persone     where true;    -- tutte: le crea solo crea_prenotazione

  delete from public.appuntamenti
  where id = any(v_appti)
     or azienda_id in (
       select id from public.aziende
       where slug like 'test-%' or slug like 'ottica-e2e-%'
     );

  -- i tenant di prova: la cascade porta via clienti/ordini/prescrizioni/prodotti/
  -- risorse/appuntamenti residui del negozio.
  delete from public.aziende
  where slug like 'test-%' or slug like 'ottica-e2e-%';

  -- utenti auth delle prove (contratto ed E2E usano @test.local). Il titolare
  -- dimostrativo (@example.com) e gli account veri restano.
  delete from auth.users where email like '%@test.local';

  alter table public.prenotazioni                 enable trigger trg_prenotazioni_no_delete;
  alter table public.persone_riferimento_registro enable trigger trg_registro_append_only;
end $$;

comment on function public.svuota_dati_di_test() is
  'Pulisce il RESIDUO delle prove sul progetto di TEST: prenotazioni/persone (tutte), appuntamenti collegati o dei tenant di prova, tenant test-…/ottica-e2e-…, utenti @test.local. Si rifiuta di partire se public.ambiente non contiene ''test''. Chiamata dalla CI PRIMA del contratto, così un giro fallito non sporca il successivo.';

-- Solo l'infrastruttura (service_role, dalla CI) la chiama. Mai il browser.
revoke all on function public.svuota_dati_di_test() from public;
revoke all on function public.svuota_dati_di_test() from anon, authenticated;
grant execute on function public.svuota_dati_di_test() to service_role;

-- ============================================================================
-- Fine 015. Da qui, con la riga ('test') e i tre segreti su GitHub, la CI può
-- partire pulita a ogni giro sul progetto di test.
-- ============================================================================
