-- ============================================================================
-- VISTA GESTIONALE — SCHEMA v0.1 · "Il cuore"
-- ============================================================================
-- Questo file è IL CONTRATTO tra tutte le app dell'ottico:
-- gestionale, sito pubblico LAC, app white-label, demo, tool agente.
-- Chi parla col negozio, parla con queste tabelle.
--
-- Vocabolario condiviso (già in uso nella demo — non cambiarlo a cuor leggero):
--   fonte  ∈ banco | sito | app | convenzione | import
--   stati LAC    : da_ordinare → ordinato → arrivato → consegnato (| annullato)
--   stati busta  : preventivo → lavorazione → pronta → consegnata (| annullata)
--   numerazione  : buste "BL-2026-0141", ordini LAC "OL-2026-0032"
--
-- Setup: incolla tutto nel SQL Editor di Supabase ed esegui una volta.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Trigger comune: updated_at sempre fresco
-- ----------------------------------------------------------------------------
create or replace function public.tocca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1 · AZIENDE — il tenant. Un'azienda = un'insegna (oggi un negozio;
--     domani, per le multi-sede, arriverà `punti_vendita` senza toccare le FK).
--     La demo lo anticipava già: SELECT * FROM aziende WHERE slug = $1.
-- ============================================================================
create table public.aziende (
  id                uuid primary key default uuid_generate_v4(),
  slug              text unique not null,          -- chiave di integrazione: /sito/[slug], app, demo
  nome              text not null,                 -- "Ottica Aurora"
  ragione_sociale   text,
  partita_iva       text,
  email             text not null,
  telefono          text,
  indirizzo         text,
  citta             text,
  cap               text,
  provincia         text,

  -- Branding white-label: stessa shape di Tenant.brand nella demo.
  -- chiavi: primary, accent, accentSoft, surface, textSoft, textFaint
  brand             jsonb not null default '{
    "primary":  "#1C1714",
    "accent":   "#A67C42",
    "accentSoft":"#EFE4D3",
    "surface":  "#F6F1EA",
    "textSoft": "#6B5D50",
    "textFaint":"#B9AA97"
  }'::jsonb,
  logo_url          text,
  nome_pubblico     text,                          -- come appare su sito/app, se diverso da `nome`
  tagline           text,

  -- Abbonamento VISTA
  stato_abbonamento text not null default 'trial'
                    check (stato_abbonamento in ('trial','attivo','sospeso','cancellato')),
  moduli_attivi     text[] not null default array['dashboard','clienti','prescrizioni'],
  data_scadenza     timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_aziende_slug on public.aziende (slug);
create trigger trg_aziende_updated before update on public.aziende
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 2 · UTENTI — lo staff. id = auth.users.id (Supabase Auth).
-- ============================================================================
create table public.utenti (
  id          uuid primary key references auth.users (id) on delete cascade,
  azienda_id  uuid not null references public.aziende (id) on delete cascade,
  email       text unique not null,
  nome        text not null,
  ruolo       text not null default 'staff'
              check (ruolo in ('titolare','optometrista','staff')),
  attivo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_utenti_azienda on public.utenti (azienda_id);
create trigger trg_utenti_updated before update on public.utenti
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 3 · CLIENTI — l'anagrafica. `fonte` dice da dove è arrivato il cliente:
--     è la stessa colonna che alimenta il ROI dashboard della demo.
-- ============================================================================
create table public.clienti (
  id                 uuid primary key default uuid_generate_v4(),
  azienda_id         uuid not null references public.aziende (id) on delete cascade,

  nome               text not null,
  cognome            text not null,
  data_nascita       date,
  codice_fiscale     text,          -- servirà per Tessera Sanitaria / fatturazione (fase fiscale)
  email              text,
  telefono           text,
  indirizzo          text,
  citta              text,
  cap                text,
  provincia          text,

  fonte              text not null default 'banco'
                     check (fonte in ('banco','sito','app','convenzione','import')),

  -- GDPR: il trattamento per il servizio è base contrattuale;
  -- il consenso esplicito serve per il marketing (→ modulo Recall).
  consenso_marketing boolean not null default false,
  data_consenso      timestamptz,

  note               text,
  tags               text[] not null default '{}',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_clienti_azienda  on public.clienti (azienda_id);
create index idx_clienti_cognome  on public.clienti (azienda_id, cognome, nome);
create trigger trg_clienti_updated before update on public.clienti
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 4 · PRESCRIZIONI — il dato ottico. Una riga per rilevazione, storico per
--     cliente. Campi ripresi 1:1 dal dominio legacy (VisitePrescrizioniModule):
--     sfero/cilindro/asse/prisma per OD e OS, addizione; per LAC raggio+diametro.
--     Convenzioni: cilindro in notazione negativa; asse 0–180.
-- ============================================================================
create table public.prescrizioni (
  id              uuid primary key default uuid_generate_v4(),
  azienda_id      uuid not null references public.aziende (id) on delete cascade,
  cliente_id      uuid not null references public.clienti (id) on delete cascade,

  tipo            text not null check (tipo in ('occhiali','lac')),
  data_visita     date not null default current_date,
  utente_id       uuid references public.utenti (id) on delete set null,  -- chi ha rilevato
  origine         text not null default 'interna'
                  check (origine in ('interna','esterna')),               -- esterna = ricetta oculista
  esaminatore     text,                                                   -- nome del medico, se esterna
  uso             text check (uso in ('lontano','vicino','progressivo','bifocale','office')),

  -- Refrazione (condivisa occhiali/LAC)
  od_sfero        numeric(4,2),
  od_cilindro     numeric(4,2),
  od_asse         smallint check (od_asse between 0 and 180),
  os_sfero        numeric(4,2),
  os_cilindro     numeric(4,2),
  os_asse         smallint check (os_asse between 0 and 180),
  addizione       numeric(3,2),          -- progressive / bifocali / LAC multifocali

  -- Solo occhiali: prisma
  od_prisma       numeric(4,2),
  od_prisma_base  text check (od_prisma_base in ('alto','basso','nasale','temporale')),
  os_prisma       numeric(4,2),
  os_prisma_base  text check (os_prisma_base in ('alto','basso','nasale','temporale')),

  -- Solo LAC: geometria (default legacy: 8.6 / 14.2)
  od_raggio       numeric(4,2),
  od_diametro     numeric(4,2),
  os_raggio       numeric(4,2),
  os_diametro     numeric(4,2),

  validita_mesi   smallint not null default 12,
  note            text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_prescrizioni_cliente on public.prescrizioni (cliente_id, data_visita desc);
create index idx_prescrizioni_azienda on public.prescrizioni (azienda_id);
create trigger trg_prescrizioni_updated before update on public.prescrizioni
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 5 · PRODOTTI — il catalogo. `visibile_sito = true` è ciò che il sito
--     pubblico LAC espone. `parametri` (jsonb) per LAC documenta le
--     disponibilità: { "poteri": [...], "raggi": [8.6], "diametri": [14.2],
--     "confezione": "×6" }.
-- ============================================================================
create table public.prodotti (
  id             uuid primary key default uuid_generate_v4(),
  azienda_id     uuid not null references public.aziende (id) on delete cascade,

  tipo           text not null
                 check (tipo in ('lac','soluzione','montatura','lente','accessorio','servizio')),
  marca          text,
  nome           text not null,
  descrizione    text,
  sku            text,
  prezzo         numeric(10,2) not null default 0,
  visibile_sito  boolean not null default false,
  attivo         boolean not null default true,
  parametri      jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index idx_prodotti_sku on public.prodotti (azienda_id, sku) where sku is not null;
create index idx_prodotti_azienda on public.prodotti (azienda_id, tipo);
create trigger trg_prodotti_updated before update on public.prodotti
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 6 · ORDINI_LAC — la pipeline LAC. QUI atterrano gli ordini del sito e
--     dell'app (fonte = 'sito' | 'app'): oggi la demo li simula con
--     localStorage, domani scrive su questa tabella via endpoint server.
--
--     `righe` (jsonb) — shape del contratto, una riga per prodotto/occhio:
--     [{
--        "prodotto_id":  "uuid | null",
--        "descrizione":  "Acuvue Oasys mensili ×6",
--        "occhio":       "OD" | "OS" | null,
--        "parametri":    { "sfero": -5.25, "cilindro": null, "asse": null,
--                          "raggio": 8.6, "diametro": 14.2, "addizione": null },
--        "quantita":     1,
--        "prezzo":       28.00
--     }]
-- ============================================================================
create table public.ordini_lac (
  id               uuid primary key default uuid_generate_v4(),
  azienda_id       uuid not null references public.aziende (id) on delete cascade,
  cliente_id       uuid references public.clienti (id) on delete set null,
  prescrizione_id  uuid references public.prescrizioni (id) on delete set null,

  numero           text not null,                        -- "OL-2026-0032"
  fonte            text not null default 'banco'
                   check (fonte in ('banco','sito','app','convenzione')),
  stato            text not null default 'da_ordinare'
                   check (stato in ('da_ordinare','ordinato','arrivato','consegnato','annullato')),

  righe            jsonb not null default '[]'::jsonb,
  totale           numeric(10,2) not null default 0,
  acconto          numeric(10,2) not null default 0,

  data_arrivo_prevista date,
  data_consegna    timestamptz,
  note             text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (azienda_id, numero)
);

create index idx_ordini_lac_stato   on public.ordini_lac (azienda_id, stato);
create index idx_ordini_lac_cliente on public.ordini_lac (cliente_id);
create trigger trg_ordini_lac_updated before update on public.ordini_lac
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- 7 · ORDINI_OCCHIALI — la busta lavoro. Campi dal workflow legacy a 6 step:
--     cliente+Rx → montatura → lenti/trattamenti → garanzie → centratura → busta.
-- ============================================================================
create table public.ordini_occhiali (
  id                uuid primary key default uuid_generate_v4(),
  azienda_id        uuid not null references public.aziende (id) on delete cascade,
  cliente_id        uuid references public.clienti (id) on delete set null,
  prescrizione_id   uuid references public.prescrizioni (id) on delete set null,

  numero            text not null,                       -- "BL-2026-0141"
  fonte             text not null default 'banco'
                    check (fonte in ('banco','sito','app','convenzione')),
  stato             text not null default 'lavorazione'
                    check (stato in ('preventivo','lavorazione','pronta','consegnata','annullata')),

  -- Montatura
  montatura_marca   text,
  montatura_modello text,
  montatura_colore  text,
  montatura_calibro text,                                -- es. "52▢18 145"
  montatura_upc     text,
  prezzo_montatura  numeric(10,2) not null default 0,

  -- Lenti (coppia)
  lente_tipo        text check (lente_tipo in ('monofocale','progressiva','bifocale','office')),
  lente_materiale   text,
  lente_indice      text,                                -- "1.50" | "1.60" | "1.67" | "1.74"
  trattamenti       text[] not null default '{}',        -- es. {antiriflesso, idrorepellente, blu}
  prezzo_lenti      numeric(10,2) not null default 0,

  -- Centratura
  od_dnp            numeric(4,1),
  os_dnp            numeric(4,1),
  od_altezza        numeric(4,1),
  os_altezza        numeric(4,1),

  garanzia          text,
  prezzo_extra      numeric(10,2) not null default 0,
  sconto            numeric(10,2) not null default 0,
  totale            numeric(10,2) not null default 0,
  acconto           numeric(10,2) not null default 0,
  saldo             numeric(10,2) generated always as (totale - acconto) stored,

  laboratorio       text,
  data_promessa     date,
  data_consegna     timestamptz,
  note              text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (azienda_id, numero)
);

create index idx_buste_stato   on public.ordini_occhiali (azienda_id, stato);
create index idx_buste_cliente on public.ordini_occhiali (cliente_id);
create trigger trg_buste_updated before update on public.ordini_occhiali
  for each row execute function public.tocca_updated_at();

-- ============================================================================
-- RLS — ogni riga vive dentro la sua azienda. Punto.
-- ============================================================================
alter table public.aziende         enable row level security;
alter table public.utenti          enable row level security;
alter table public.clienti         enable row level security;
alter table public.prescrizioni    enable row level security;
alter table public.prodotti        enable row level security;
alter table public.ordini_lac      enable row level security;
alter table public.ordini_occhiali enable row level security;

-- L'azienda dell'utente loggato (security definer per leggere `utenti` senza ricorsione)
create or replace function public.get_azienda_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select azienda_id from public.utenti where id = auth.uid()
$$;

revoke execute on function public.get_azienda_id() from public, anon;
grant  execute on function public.get_azienda_id() to authenticated;

-- AZIENDE: vedo e aggiorno solo la mia (insert solo via onboarding, sotto)
create policy "azienda: select propria" on public.aziende
  for select to authenticated using (id = public.get_azienda_id());
create policy "azienda: update propria" on public.aziende
  for update to authenticated
  using (id = public.get_azienda_id())
  with check (id = public.get_azienda_id());

-- UTENTI: vedo i colleghi, aggiorno il mio profilo
create policy "utenti: select colleghi" on public.utenti
  for select to authenticated using (azienda_id = public.get_azienda_id());
create policy "utenti: update proprio profilo" on public.utenti
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and azienda_id = public.get_azienda_id());

-- Tabelle di dominio: tutto, ma solo dentro la propria azienda
create policy "clienti: della propria azienda" on public.clienti
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "prescrizioni: della propria azienda" on public.prescrizioni
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "prodotti: della propria azienda" on public.prodotti
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "ordini_lac: della propria azienda" on public.ordini_lac
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "ordini_occhiali: della propria azienda" on public.ordini_occhiali
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- ============================================================================
-- ONBOARDING — crea azienda + titolare in un colpo solo (security definer:
-- bypassa le policy solo per questo passaggio controllato).
-- ============================================================================
create or replace function public.crea_azienda_con_titolare(
  p_nome_azienda text,
  p_slug         text,
  p_nome_utente  text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_azienda uuid;
  v_email   text;
begin
  if auth.uid() is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if exists (select 1 from public.utenti where id = auth.uid()) then
    raise exception 'UTENTE_GIA_REGISTRATO';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');

  insert into public.aziende (nome, slug, email)
  values (p_nome_azienda, lower(p_slug), v_email)
  returning id into v_azienda;

  insert into public.utenti (id, azienda_id, email, nome, ruolo)
  values (auth.uid(), v_azienda, v_email, p_nome_utente, 'titolare');

  return v_azienda;
end;
$$;

revoke execute on function public.crea_azienda_con_titolare(text, text, text) from public, anon;
grant  execute on function public.crea_azienda_con_titolare(text, text, text) to authenticated;

-- ============================================================================
-- INTEGRAZIONE (promemoria di architettura, non DDL)
-- ----------------------------------------------------------------------------
-- · Sito pubblico e app scrivono ordini con fonte='sito'|'app' passando da un
--   endpoint server che usa la SERVICE_ROLE key (mai la service key nel client,
--   mai scritture anon dirette). L'endpoint risolve l'azienda dallo slug.
-- · In una prossima iterazione: vista pubblica read-only del catalogo
--   (prodotti where visibile_sito and attivo) per il sito, con grant ad anon.
--
-- PROSSIME TABELLE (mappa — il nome è già deciso, il DDL arriverà col modulo):
-- · punti_vendita        → multi-sede (FK verso aziende, nulla da migrare)
-- · appuntamenti         → agenda visite
-- · richiami             → modulo Recall (tipo, canale, esito, valore generato)
-- · voucher_convenzioni  → la gara dei fondi (fondo, valore, aperto_at,
--                          stato da_contattare|vinto|perso, esito)
-- · vendite              → cassa / scontrini
-- · movimenti_magazzino  → carico/scarico, i "fermi" della demo
-- · comunicazioni        → log messaggi WhatsApp/SMS/email verso i clienti
-- ============================================================================
