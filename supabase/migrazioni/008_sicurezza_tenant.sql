-- ============================================================================
-- MIGRAZIONE 008 — Sicurezza e isolamento tenant (G2)
-- ============================================================================
-- Additiva e IDEMPOTENTE: si rieseguе senza danno. Si applica DOPO 001–007.
-- Nasce dal momento in cui il DB smette di essere raggiunto solo da utenti
-- autenticati: il portale scriverà con SERVICE ROLE, e il service role
-- BYPASSA la RLS. Tutto ciò che oggi è protetto solo da una policy va quindi
-- protetto anche da un vincolo che il service role non può aggirare.
-- Solo SQL: nessuna tabella del portale, nessuna rotta, nessun TypeScript.
-- Motivazioni per blocco in docs/fasi/fase-008-sicurezza.md.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0 · ESTENSIONE — serve al vincolo EXCLUDE del punto 4 (azienda_id dentro GIST)
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists btree_gist;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · DB-01 · Coerenza tenant sulle FK incrociate
-- ----------------------------------------------------------------------------
-- La RLS impedisce a un UTENTE di vedere altre aziende, ma il service role la
-- bypassa: niente vieterebbe di inserire un appuntamento dell'azienda A che
-- punta a un cliente dell'azienda B. Questa funzione, per ogni FK verso una
-- tabella con azienda_id, verifica che la riga puntata sia della STESSA azienda
-- della riga che si scrive. NON dipende da auth.uid() (altrimenti il service
-- role la aggirerebbe per costruzione): confronta gli azienda_id reali.
-- SECURITY DEFINER così legge l'azienda della riga riferita a prescindere dalla
-- RLS del chiamante (serve per dare il messaggio giusto anche a un utente).
-- ----------------------------------------------------------------------------
create or replace function public.assicura_coerenza_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j            jsonb := to_jsonb(NEW);
  mia_azienda  uuid  := (j ->> 'azienda_id')::uuid;
  i            int   := 0;   -- ATTENZIONE: TG_ARGV in PL/pgSQL è 0-based
  fk_col       text;
  ref_tab      text;
  fk_val       uuid;
  ref_azienda  uuid;
begin
  -- TG_ARGV arriva a coppie: (colonna_fk, tabella_riferita), ... — indici 0-based
  while i < TG_NARGS loop
    fk_col  := TG_ARGV[i];
    ref_tab := TG_ARGV[i + 1];
    fk_val  := nullif(j ->> fk_col, '')::uuid;

    if fk_val is not null then
      execute format('select azienda_id from public.%I where id = $1', ref_tab)
        into ref_azienda using fk_val;

      if ref_azienda is distinct from mia_azienda then
        raise exception
          'Violazione isolamento tenant: %.% punta a % di azienda % ma la riga è di azienda %',
          TG_TABLE_NAME, fk_col, ref_tab,
          coalesce(ref_azienda::text, '∅'), coalesce(mia_azienda::text, '∅')
          using errcode = '23514';
      end if;
    end if;

    i := i + 2;
  end loop;

  return NEW;
end;
$$;

comment on function public.assicura_coerenza_tenant() is
  'DB-01: nega le FK incrociate fra tenant (difesa contro il service role, che bypassa la RLS). Indipendente da auth.uid(). I trigger passano le coppie (colonna_fk, tabella_riferita) via TG_ARGV.';

-- Trigger su TUTTE le 11 tabelle con azienda_id che hanno FK verso altre
-- tabelle con azienda_id (enumerate da schema.sql + migrazioni 002–007, poi
-- verificate su information_schema). Elenco completo nella PR.
drop trigger if exists trg_tenant on public.appuntamenti;
create trigger trg_tenant before insert or update on public.appuntamenti
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','utente_id','utenti');

drop trigger if exists trg_tenant on public.chiusure_cassa;
create trigger trg_tenant before insert or update on public.chiusure_cassa
  for each row execute function public.assicura_coerenza_tenant('chiusa_da','utenti');

drop trigger if exists trg_tenant on public.fermi;
create trigger trg_tenant before insert or update on public.fermi
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','prodotto_id','prodotti','utente_id','utenti');

drop trigger if exists trg_tenant on public.movimenti_cassa;
create trigger trg_tenant before insert or update on public.movimenti_cassa
  for each row execute function public.assicura_coerenza_tenant('utente_id','utenti');

drop trigger if exists trg_tenant on public.movimenti_magazzino;
create trigger trg_tenant before insert or update on public.movimenti_magazzino
  for each row execute function public.assicura_coerenza_tenant('prodotto_id','prodotti','utente_id','utenti');

drop trigger if exists trg_tenant on public.ordini_lac;
create trigger trg_tenant before insert or update on public.ordini_lac
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','prescrizione_id','prescrizioni');

drop trigger if exists trg_tenant on public.ordini_occhiali;
create trigger trg_tenant before insert or update on public.ordini_occhiali
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','prescrizione_id','prescrizioni','ispezionata_da','utenti');

drop trigger if exists trg_tenant on public.prescrizioni;
create trigger trg_tenant before insert or update on public.prescrizioni
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','utente_id','utenti');

drop trigger if exists trg_tenant on public.resi;
create trigger trg_tenant before insert or update on public.resi
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','utente_id','utenti','vendita_id','vendite','busta_id','ordini_occhiali');

drop trigger if exists trg_tenant on public.richiami;
create trigger trg_tenant before insert or update on public.richiami
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','utente_id','utenti');

drop trigger if exists trg_tenant on public.vendite;
create trigger trg_tenant before insert or update on public.vendite
  for each row execute function public.assicura_coerenza_tenant('cliente_id','clienti','utente_id','utenti','busta_id','ordini_occhiali','ordine_lac_id','ordini_lac');

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · DB-03 · Flag di pubblicazione (anticipato: la vista del punto 2 lo usa)
-- ----------------------------------------------------------------------------
-- Un ottico sospeso, o che chiede di non comparire, deve sparire dalla vetrina
-- SENZA che si tocchino i suoi dati. Default false: si compare solo se qualcuno
-- lo decide.
-- ----------------------------------------------------------------------------
alter table public.aziende
  add column if not exists portale_attivo boolean not null default false;

comment on column public.aziende.portale_attivo is
  'DB-03: se true, il negozio compare nella vetrina pubblica (vista negozi_pubblici). Default false: nessuno compare finché non lo si decide.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · DB-02 · Lettura pubblica di aziende SOLO tramite vista di vetrina
-- ----------------------------------------------------------------------------
-- La tabella aziende contiene anche partita IVA, ragione sociale, email, stato
-- abbonamento, moduli attivi, scadenza: MAI esposti a un anonimo. Il portale
-- mostra solo i dati di vetrina, e solo dei negozi pubblicati.
-- ----------------------------------------------------------------------------
revoke select on public.aziende from anon;

-- La vista è di proprietà del ruolo di migrazione: legge aziende con i privilegi
-- del proprietario (non security_invoker) ed espone SOLO le colonne di vetrina
-- dei negozi con portale_attivo. L'anon riceve select sulla vista, mai sulla
-- tabella. NB: il `telefono` NON è nell'elenco degli esposti (vedi PR/doc).
create or replace view public.negozi_pubblici
with (security_invoker = false)
as
select
  slug,
  coalesce(nome_pubblico, nome) as nome_pubblico,
  tagline,
  logo_url,
  indirizzo,
  citta,
  cap,
  provincia,
  brand
from public.aziende
where portale_attivo = true;

comment on view public.negozi_pubblici is
  'DB-02: vetrina pubblica. Solo slug/nome_pubblico/tagline/logo_url/indirizzo/citta/cap/provincia/brand dei negozi con portale_attivo=true. Mai partita_iva, ragione_sociale, email, stato_abbonamento, moduli_attivi, data_scadenza, id, telefono.';

grant select on public.negozi_pubblici to anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · DB-04 · Nessuna sovrapposizione sugli appuntamenti (a livello DB)
-- ----------------------------------------------------------------------------
-- Portale, sito del negozio e banco scrivono sulla stessa agenda: due porte che
-- leggono lo stesso slot libero nello stesso istante producono una doppia
-- prenotazione, che si vede in negozio davanti al cliente. È un invariante da
-- database, non logica applicativa. Solo gli stati che "occupano" lo slot
-- (prenotato/completato) sono vincolati: un annullato NON blocca lo slot.
-- Rilevamento sovrapposizioni pre-esistenti eseguito prima dell'aggiunta:
-- 0 trovate (risultato nella PR).
--
-- NOTA TECNICA (deroga alla forma letterale della consegna, spiegata nella PR):
-- la forma `tstzrange(inizio, inizio + make_interval(mins => durata_minuti))`
-- messa direttamente nell'EXCLUDE fallisce con "42P17: functions in index
-- expression must be marked IMMUTABLE", perché l'operatore `timestamptz +
-- interval` è STABLE (dipende dal TimeZone per le parti giorno/mese). Per una
-- durata in soli MINUTI su un timestamptz (un istante assoluto) il risultato è
-- però deterministico e indipendente dal fuso: incapsuliamo il calcolo in una
-- funzione IMMUTABLE dedicata — pattern standard per questo vincolo. Semantica
-- identica a quella richiesta.
-- ----------------------------------------------------------------------------
create or replace function public.appuntamento_intervallo(inizio timestamptz, durata_minuti int)
returns tstzrange language sql immutable parallel safe as $$
  select tstzrange(inizio, inizio + (durata_minuti * interval '1 minute'), '[)');
$$;

comment on function public.appuntamento_intervallo(timestamptz, int) is
  'DB-04: intervallo [inizio, inizio+durata) di un appuntamento come tstzrange IMMUTABLE (durata in minuti, sicura sul timestamptz assoluto). Serve al vincolo di non-sovrapposizione.';

alter table public.appuntamenti
  drop constraint if exists appuntamenti_niente_sovrapposizioni;
alter table public.appuntamenti
  add constraint appuntamenti_niente_sovrapposizioni
  exclude using gist (
    azienda_id with =,
    public.appuntamento_intervallo(inizio, durata_minuti) with &&
  ) where (stato in ('prenotato','completato'));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · DB-05 · fonte sugli appuntamenti (da quale porta entra la prenotazione)
-- ----------------------------------------------------------------------------
-- Oggi `fonte` sta solo su clienti e registra la PRIMA acquisizione. Senza
-- questo campo non si sa da quale porta entra ogni singola prenotazione, cioè
-- non si misura niente. Il vincolo di valori è il punto 6.
-- ----------------------------------------------------------------------------
alter table public.appuntamenti
  add column if not exists fonte text not null default 'banco';

comment on column public.appuntamenti.fonte is
  'DB-05: la porta da cui è entrata questa prenotazione (banco, sito_negozio, portale, qr_vetrina, app, convenzione, import). Diverso da clienti.fonte, che è la prima acquisizione del cliente.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · DB-06 · Vocabolario `fonte` allargato (DEROGA al contratto — vedi doc)
-- ----------------------------------------------------------------------------
-- Nuovi: qr_vetrina, sito_negozio, portale. Restano: banco, app, convenzione,
-- import. Esce: 'sito' (collassava tre cose distinte). Questo è l'UNICO punto
-- in cui si tocca il vocabolario del contratto: deroga decisa a monte,
-- motivata in docs/fasi/fase-008-sicurezza.md.
-- Backfill PRIMA del nuovo check, altrimenti l'ADD CONSTRAINT fallirebbe sulle
-- righe 'sito' esistenti.
-- ----------------------------------------------------------------------------
update public.clienti set fonte = 'banco' where fonte = 'sito';

alter table public.clienti drop constraint if exists clienti_fonte_check;
alter table public.clienti add constraint clienti_fonte_check
  check (fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale'));

alter table public.appuntamenti drop constraint if exists appuntamenti_fonte_check;
alter table public.appuntamenti add constraint appuntamenti_fonte_check
  check (fonte in ('banco','app','convenzione','import','qr_vetrina','sito_negozio','portale'));

-- ============================================================================
-- Fine 008. Allineamento del codice al vocabolario fonte (5 punti che citano
-- ancora 'sito') è la CONSEGNA SUCCESSIVA: qui non si tocca TypeScript.
-- ============================================================================
