-- ============================================================================
-- 019 · Fuso · gli appuntamenti da banco sullo stesso istante del portale
-- ----------------------------------------------------------------------------
-- Difetto preesistente (TODO-ray §6), reso concreto da G8 quando portale e banco
-- convivono nella stessa agenda. `creaAppuntamento` costruiva l'istante con
-- `new Date("gg T hh:mm")` — interpretato nel fuso del PROCESSO (UTC su Vercel):
-- «10:00» digitate al banco diventavano le 10:00 UTC = mezzogiorno a Roma, mentre
-- il portale scrive correttamente le 10:00 di Roma. Stessa ora scritta, due
-- istanti diversi (e si rompe solo in produzione: in locale il fuso è italiano).
--
-- Il codice è già corretto forward (`istanteRomaISO` ancora tutto a Europe/Rome).
-- Qui si riallineano le righe GIÀ scritte dal banco, che sono naïve-UTC.
--
-- MIRATO e SICURO:
--   · solo `fonte = 'banco'` (il portale — qr_vetrina/portale/… — è già corretto);
--   · si escludono le righe demo `seed-g6`, che il seed scriveva GIÀ ancorate a
--     Europe/Rome (spostarle sarebbe un doppio slittamento);
--   · la trasformazione `(inizio at time zone 'UTC') at time zone 'Europe/Rome'`
--     reinterpreta l'orologio di parete come ora italiana e gestisce da sé l'ora
--     legale.
-- IDEMPOTENTE: uno spostamento di istanti NON è ripetibile, quindi è protetto da
-- un marker (`_riparazioni_dati`) — rieseguire la migrazione non sposta due volte.
-- ============================================================================

do $$
begin
  -- marker riusabile per le riparazioni-dati una-tantum (create-if-not-exists).
  if to_regclass('public._riparazioni_dati') is null then
    create table public._riparazioni_dati (
      chiave text primary key,
      quando timestamptz not null default now()
    );
  end if;

  if not exists (select 1 from public._riparazioni_dati where chiave = '019_fuso_appuntamenti_banco') then
    update public.appuntamenti
       set inizio = (inizio at time zone 'UTC') at time zone 'Europe/Rome'
     where fonte = 'banco'
       and coalesce(note, '') <> 'seed-g6';

    insert into public._riparazioni_dati (chiave) values ('019_fuso_appuntamenti_banco');
  end if;
end $$;

-- ============================================================================
-- Fine 019. Un appuntamento «alle 10:00» preso al banco e una richiesta «alle
-- 10:00» dal portale, lo stesso giorno, cadono ora sullo stesso istante — e
-- l'agenda li mostra entrambi alle 10:00. La sentinella è nel contratto.
-- ============================================================================
