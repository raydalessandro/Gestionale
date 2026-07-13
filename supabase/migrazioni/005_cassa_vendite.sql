-- ============================================================================
-- MIGRAZIONE 005 — Fase 4 · Cassa & Vendite (v0.5)
-- ============================================================================
-- Additiva: si applica DOPO 001–004. Incollare nel SQL Editor una volta.
-- Fonte di dominio: docs/dominio-cassa-documenti.md (anatomia dei documenti
-- reali) + docs/dominio-ottica.md §9-bis (giornata contabile) +
-- docs/dominio-fiscale.md §2–3 (aliquote, RT).
--
-- Principio architetturale: VISTA NON è la stampante fiscale. Registra la
-- vendita coi riferimenti del documento emesso dall'RT e fa la quadratura.
--
-- Cosa introduce:
--   1. metodi_pagamento — vocabolario aperto per azienda
--   2. vendite — con righe/pagamenti jsonb documentati, aliquota per riga
--   3. resi — con le causali del dominio
--   4. chiusure_cassa — una per giorno, quadratura in jsonb
--   5. movimenti_cassa — petty cash e incameri, APPEND-ONLY
--   6. prossimo_numero esteso a VE- e RE-
--   7. ordini_occhiali.caparra_incamerata_il
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · METODI DI PAGAMENTO — ogni negozio attiva i suoi
-- ────────────────────────────────────────────────────────────────────────────
create table public.metodi_pagamento (
  id           uuid primary key default uuid_generate_v4(),
  azienda_id   uuid not null references public.aziende (id) on delete cascade,
  nome         text not null,
  tipo         text not null check (tipo in
               ('contanti','elettronico','buono','bonifico',
                'assicurazione','caparra','altro')),
  tracciabile  boolean not null default true,  -- per il codice spesa AA del TS
  attivo       boolean not null default true,
  ordine       smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (azienda_id, nome)
);

comment on column public.metodi_pagamento.tracciabile is
  'false solo per i contanti: serve alla detraibilità delle prestazioni (codice AA).';

create trigger trg_metodi_updated before update on public.metodi_pagamento
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · VENDITE
-- ────────────────────────────────────────────────────────────────────────────
-- righe (jsonb, array):
--   { "prodotto_id": uuid|null, "descrizione": text, "quantita": int>0,
--     "prezzo_unitario": numeric, "sconto": numeric>=0 (importo sul rigo),
--     "aliquota": '4'|'22'|'esente', "dm": boolean }
--   'esente' copre le nature fuori campo (polizze assicurative: EE sull'RT).
--   dm = dispositivo medico con marcatura CE → codice spesa AD (fase fiscale).
-- pagamenti (jsonb, array):
--   { "metodo_id": uuid|null, "nome": text, "importo": numeric>0 }
--   La caparra scalata al saldo è un pagamento { nome: 'Caparra', ... }.
create table public.vendite (
  id              uuid primary key default uuid_generate_v4(),
  azienda_id      uuid not null references public.aziende (id) on delete cascade,
  numero          text not null,                       -- VE-2026-0001 (solo rpc)
  cliente_id      uuid references public.clienti (id) on delete set null,
  utente_id       uuid references public.utenti  (id) on delete set null,

  busta_id        uuid references public.ordini_occhiali (id) on delete set null,
  ordine_lac_id   uuid references public.ordini_lac      (id) on delete set null,

  righe           jsonb not null default '[]'::jsonb,
  pagamenti       jsonb not null default '[]'::jsonb,
  totale          numeric(10,2) not null check (totale >= 0),
  iva_totale      numeric(10,2) not null default 0,

  doc_numero      text,          -- documento commerciale RT: Z-progressivo (es. 1405-0006)
  doc_data        date,
  fattura_numero  text,          -- se emessa fattura
  cf_cliente      text,          -- CF sul documento (Sistema TS)
  opposizione_ts  boolean not null default false,

  origine         text not null default 'cassa'
                  check (origine in ('cassa','riallineamento')),
  data_vendita    timestamptz not null default now(),  -- retrodatabile SOLO se riallineamento
  stato           text not null default 'emessa'
                  check (stato in ('emessa','annullata')),
  note            text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (azienda_id, numero)
);

-- Un ordine si incassa UNA volta (l'annullo libera il posto).
create unique index vendite_busta_unica on public.vendite (busta_id)
  where busta_id is not null and stato = 'emessa';
create unique index vendite_lac_unica on public.vendite (ordine_lac_id)
  where ordine_lac_id is not null and stato = 'emessa';

create index idx_vendite_giorno  on public.vendite (azienda_id, data_vendita desc);
create index idx_vendite_cliente on public.vendite (cliente_id);
create trigger trg_vendite_updated before update on public.vendite
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · RESI — la causale è un dato, mai una vergogna
-- ────────────────────────────────────────────────────────────────────────────
create table public.resi (
  id                  uuid primary key default uuid_generate_v4(),
  azienda_id          uuid not null references public.aziende (id) on delete cascade,
  vendita_id          uuid references public.vendite (id) on delete set null,
  cliente_id          uuid references public.clienti (id) on delete set null,
  utente_id           uuid references public.utenti  (id) on delete set null,

  numero              text not null,                    -- RE-2026-0001 (solo rpc)
  tipo                text not null check (tipo in ('denaro','gestionale')),
  causale             text not null check (causale in
                      ('soddisfatti_rimborsati','errore_checkup','errore_ricetta',
                       'mancato_adattamento_progressive','modifica_wo',
                       'insoddisfazione_estetica','insoddisfazione_funzionalita',
                       'difetto_fabbricazione')),
  importo             numeric(10,2) not null check (importo > 0),
  metodo_rimborso     text,          -- nome del metodo con cui si restituisce (solo tipo 'denaro'): entra nella quadratura serale
  righe               jsonb not null default '[]'::jsonb,  -- come vendite.righe: rientro merce

  doc_numero          text,      -- documento di reso RT
  doc_data            date,
  doc_origine_numero  text,      -- se la vendita d'origine è fuori VISTA
  doc_origine_data    date,
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (azienda_id, numero)
);

create index idx_resi_azienda on public.resi (azienda_id, created_at desc);
create trigger trg_resi_updated before update on public.resi
  for each row execute function public.tocca_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · CHIUSURE DI CASSA — una per giorno, il rito serale
-- ────────────────────────────────────────────────────────────────────────────
-- riepilogo (jsonb, oggetto) — snapshot calcolato alla chiusura:
--   { "quadratura":  [ { "metodo": text, "sistema": numeric,
--                        "dichiarato": numeric, "differenza": numeric,
--                        "causale": text|null } ],
--     "confronto_rt": [ { "aliquota": '4'|'22'|'esente',
--                         "stampante": numeric, "sistema": numeric,
--                         "differenza": numeric } ],
--     "caparre": { "emesse": numeric, "scontate": numeric,
--                  "incamerate": numeric } }
create table public.chiusure_cassa (
  id                uuid primary key default uuid_generate_v4(),
  azienda_id        uuid not null references public.aziende (id) on delete cascade,
  data              date not null,

  fondo_apertura    numeric(10,2) not null,
  contanti_contati  numeric(10,2) not null,   -- fondo incluso, come si conta davvero
  fondo_chiusura    numeric(10,2) not null,
  versamento        numeric(10,2) generated always as
                    (contanti_contati - fondo_chiusura) stored,

  z_numero          text,                      -- numero azzeramento RT
  riepilogo         jsonb not null default '{}'::jsonb,
  note              text,
  chiusa_da         uuid references public.utenti (id) on delete set null,

  created_at        timestamptz not null default now(),
  unique (azienda_id, data)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · MOVIMENTI DI CASSA — petty cash, cassaforte, incameri (append-only)
-- ────────────────────────────────────────────────────────────────────────────
-- Convenzione: importo sempre POSITIVO, il tipo dice la direzione.
--   prelievo             esce dal cassetto (petty cash, con motivo)
--   spesa                esce dal cassetto contro giustificativo
--   versamento_cassaforte contanti dal cassetto alla cassaforte (fuori chiusura)
--   versamento_banca     esce dalla cassaforte verso la banca
--   incamero_caparra     registrazione economica dell'acconto trattenuto
-- Saldo cassaforte = Σ chiusure.versamento + Σ versamento_cassaforte − Σ versamento_banca.
create table public.movimenti_cassa (
  id           uuid primary key default uuid_generate_v4(),
  azienda_id   uuid not null references public.aziende (id) on delete cascade,
  utente_id    uuid references public.utenti (id) on delete set null,
  tipo         text not null check (tipo in
               ('prelievo','spesa','versamento_cassaforte',
                'versamento_banca','incamero_caparra')),
  importo      numeric(10,2) not null check (importo > 0),
  motivo       text not null,
  riferimento  text,                            -- es. BL-2026-0141, n° ricevuta
  created_at   timestamptz not null default now()
);

create index idx_mov_cassa on public.movimenti_cassa (azienda_id, created_at desc);
-- Niente updated_at, niente policy di modifica: un movimento non si tocca.

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · NUMERAZIONE — si estende a VE- e RE-
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.prossimo_numero(p_prefisso text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_azienda uuid;
  v_anno    integer := extract(year from now())::integer;
  v_chiave  text;
  v_valore  integer;
begin
  v_azienda := public.get_azienda_id();
  if v_azienda is null then
    raise exception 'NON_AUTENTICATO';
  end if;
  if p_prefisso not in ('BL','OL','VE','RE') then
    raise exception 'PREFISSO_NON_VALIDO';
  end if;

  v_chiave := p_prefisso || '-' || v_anno::text;

  insert into public.contatori (azienda_id, chiave, valore)
  values (v_azienda, v_chiave, 1)
  on conflict (azienda_id, chiave)
  do update set valore = public.contatori.valore + 1
  returning valore into v_valore;

  return v_chiave || '-' || lpad(v_valore::text, 4, '0');
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · BUSTA — l'incameramento lascia traccia
-- ────────────────────────────────────────────────────────────────────────────
alter table public.ordini_occhiali
  add column if not exists caparra_incamerata_il timestamptz;

comment on column public.ordini_occhiali.caparra_incamerata_il is
  'Valorizzato quando la caparra viene trattenuta per mancato ritiro (trafila: 2 mesi, tentativi documentati). La busta passa ad annullata.';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
alter table public.metodi_pagamento enable row level security;
alter table public.vendite          enable row level security;
alter table public.resi             enable row level security;
alter table public.chiusure_cassa   enable row level security;
alter table public.movimenti_cassa  enable row level security;

create policy "metodi: della propria azienda" on public.metodi_pagamento
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "vendite: della propria azienda" on public.vendite
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "resi: della propria azienda" on public.resi
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

create policy "chiusure: della propria azienda" on public.chiusure_cassa
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());

-- Movimenti di cassa: SOLO lettura e inserimento (immutabilità dal DB).
create policy "mov cassa: select della propria azienda" on public.movimenti_cassa
  for select to authenticated using (azienda_id = public.get_azienda_id());
create policy "mov cassa: insert nella propria azienda" on public.movimenti_cassa
  for insert to authenticated with check (azienda_id = public.get_azienda_id());

-- ============================================================================
-- Fine 005. La UI è specificata in docs/fasi/fase-4-cassa.md
-- ============================================================================
