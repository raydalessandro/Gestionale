-- ============================================================================
-- 024 · Prescrizioni — B2 dell'Era 2
-- ----------------------------------------------------------------------------
-- Scheda clinico-operativa unica: sezioni Occhiali/LAC/Plano, scadenza sticky,
-- vocabolari M2, LAC definitiva per occhio e ponte verso B4.
--
-- Fonti: M2 §1–§4 e §10 annotazioni 4–5 · piano Era 2 §B2 · RV-01.
-- Decisioni di regia: `prove_lac` NON entra in B2 (Y/M5); `tipo` è legacy,
-- non si modifica né si usa nelle nuove letture. Additive sui dati e nomi.
-- ============================================================================

begin;

-- ── 1 · `prescrizioni`: la scheda unica ────────────────────────────────────
-- `tipo` resta il marcatore legacy: la nuova verità è nelle sezioni. Le righe
-- storiche vengono proiettate senza cambiarne il tipo né la semantica.
alter table public.prescrizioni
  add column if not exists ha_occhiali boolean not null default false,
  add column if not exists ha_lac boolean not null default false,
  add column if not exists plano boolean not null default false,
  add column if not exists data_scadenza date,
  add column if not exists scadenza_modificata boolean not null default false,
  add column if not exists oculista_id uuid references public.oculisti(id) on delete set null,
  add column if not exists derivata_da uuid references public.prescrizioni(id) on delete set null,
  add column if not exists tipologia_od text,
  add column if not exists tipologia_os text,
  add column if not exists od_add numeric(4,2),
  add column if not exists os_add numeric(4,2),
  add column if not exists od_visus text,
  add column if not exists os_visus text,
  add column if not exists notazione text,
  add column if not exists speciali text[] not null default '{}'::text[],
  add column if not exists speciali_note text,
  add column if not exists od_invariato boolean not null default false,
  add column if not exists os_invariato boolean not null default false,
  add column if not exists appaiamento boolean not null default false;

-- Retrocompatibilità in lettura: la proiezione dalle righe storiche è una sola
-- volta; gli inserimenti B2 impostano le sezioni in modo esplicito.
update public.prescrizioni
   set ha_occhiali = (tipo = 'occhiali'),
       ha_lac = (tipo = 'lac'),
       data_scadenza = coalesce(
         data_scadenza,
         (data_visita + (validita_mesi || ' months')::interval)::date
       )
 where (ha_occhiali = false and ha_lac = false)
    or data_scadenza is null;

-- ── 2 · RV-01: vincoli esistenti soltanto ALLARGATI ─────────────────────────
-- Ogni dominio conserva i valori legacy e aggiunge quelli M2. Il drop+add è
-- nella stessa transazione, con nomi v2 e commento del motivo.
alter table public.prescrizioni
  drop constraint if exists prescrizioni_origine_check,
  drop constraint if exists chk_prescrizioni_origine_v2,
  add constraint chk_prescrizioni_origine_v2
    check (origine in (
      'interna', 'esterna', 'lenti_precedenti',
      'check_up', 'lenti_cliente', 'ricetta_oculistica', 'prescrizione_precedente'
    ));
comment on constraint chk_prescrizioni_origine_v2 on public.prescrizioni is
  '024/RV-01: dominio origine allargato; conserva interna, esterna e lenti_precedenti, aggiunge le quattro origini M2.';

alter table public.prescrizioni
  drop constraint if exists prescrizioni_uso_check,
  drop constraint if exists chk_prescrizioni_uso_v2,
  add constraint chk_prescrizioni_uso_v2
    check (uso is null or uso in (
      'lontano', 'vicino', 'progressivo', 'bifocale', 'office',
      'intermedio', 'progressiva', 'trifocale', 'mista'
    ));
comment on constraint chk_prescrizioni_uso_v2 on public.prescrizioni is
  '024/RV-01: dominio uso/tipologia allargato; conserva progressivo legacy e aggiunge intermedio, progressiva, trifocale e mista M2.';

alter table public.prescrizioni
  drop constraint if exists prescrizioni_od_prisma_base_check,
  drop constraint if exists chk_prescrizioni_od_prisma_base_v2,
  add constraint chk_prescrizioni_od_prisma_base_v2
    check (od_prisma_base is null or od_prisma_base in (
      'alto', 'basso', 'nasale', 'temporale',
      'interna', 'esterna', 'superiore', 'inferiore'
    )),
  drop constraint if exists prescrizioni_os_prisma_base_check,
  drop constraint if exists chk_prescrizioni_os_prisma_base_v2,
  add constraint chk_prescrizioni_os_prisma_base_v2
    check (os_prisma_base is null or os_prisma_base in (
      'alto', 'basso', 'nasale', 'temporale',
      'interna', 'esterna', 'superiore', 'inferiore'
    ));
comment on constraint chk_prescrizioni_od_prisma_base_v2 on public.prescrizioni is
  '024/RV-01: basi prisma OD allargate; conserva alto/basso/nasale/temporale e aggiunge interna/esterna/superiore/inferiore M2.';
comment on constraint chk_prescrizioni_os_prisma_base_v2 on public.prescrizioni is
  '024/RV-01: basi prisma OS allargate; conserva alto/basso/nasale/temporale e aggiunge interna/esterna/superiore/inferiore M2.';

-- Vincoli nuovi della scheda M2. NOT VALID protegge ogni nuova scrittura senza
-- rigettare retroattivamente eventuali righe cliniche storiche incomplete.
alter table public.prescrizioni
  drop constraint if exists chk_prescrizioni_tipologia_occhi_v1,
  add constraint chk_prescrizioni_tipologia_occhi_v1
    check (
      (tipologia_od is null or tipologia_od in ('lontano','vicino','intermedio','bifocale','progressiva','office','trifocale'))
      and
      (tipologia_os is null or tipologia_os in ('lontano','vicino','intermedio','bifocale','progressiva','office','trifocale'))
    ) not valid,
  drop constraint if exists chk_prescrizioni_od_prisma_coppia_v1,
  add constraint chk_prescrizioni_od_prisma_coppia_v1
    check ((od_prisma is null) = (od_prisma_base is null)) not valid,
  drop constraint if exists chk_prescrizioni_os_prisma_coppia_v1,
  add constraint chk_prescrizioni_os_prisma_coppia_v1
    check ((os_prisma is null) = (os_prisma_base is null)) not valid,
  drop constraint if exists chk_prescrizioni_notazione_v1,
  add constraint chk_prescrizioni_notazione_v1
    check (notazione is null or notazione in ('tabo','internazionale')) not valid;

comment on constraint chk_prescrizioni_tipologia_occhi_v1 on public.prescrizioni is
  '024/M2: tipologie per occhio solo per schede miste; i valori di uso legacy rimangono leggibili.';
comment on constraint chk_prescrizioni_od_prisma_coppia_v1 on public.prescrizioni is
  '024/M2: prisma OD e base sono obbligatori insieme; NOT VALID tutela le nuove scritture senza riscrivere la storia.';
comment on constraint chk_prescrizioni_os_prisma_coppia_v1 on public.prescrizioni is
  '024/M2: prisma OS e base sono obbligatori insieme; NOT VALID tutela le nuove scritture senza riscrivere la storia.';
comment on constraint chk_prescrizioni_notazione_v1 on public.prescrizioni is
  '024/M2: notazione TABO o internazionale; null conserva le prescrizioni legacy.';

create index if not exists idx_prescrizioni_oculista
  on public.prescrizioni (oculista_id) where oculista_id is not null;
create index if not exists idx_prescrizioni_derivata
  on public.prescrizioni (derivata_da) where derivata_da is not null;

-- Additiva: la guardia storica resta intatta; B2 aggiunge la propria guardia
-- per le nuove FK, così non si sostituisce alcun oggetto preesistente.
create trigger trg_tenant_prescrizioni_b2 before insert or update on public.prescrizioni
  for each row execute function public.assicura_coerenza_tenant(
    'oculista_id','oculisti', 'derivata_da','prescrizioni'
  );

-- ── 3 · `prescrizioni_lac`: la LAC definitiva, una riga per occhio ─────────
-- Il percorso prove/campioni NON è qui: nasce nel filone Y/M5. Questa tabella
-- è la registrazione diretta della definitiva e il ponte per l'ordine B4.
create table if not exists public.prescrizioni_lac (
  id uuid primary key default uuid_generate_v4(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  prescrizione_id uuid not null references public.prescrizioni(id) on delete cascade,
  occhio text not null check (occhio in ('od','os')),
  tipologia text not null check (tipologia in ('monofocale','multifocale','rigida','semirigida','specialistica')),
  sottotipo text check (sottotipo is null or sottotipo in ('sclerale','ortocheratologia','cheratocono','ibrida','altro')),
  geometria text check (geometria is null or geometria in ('sferica','torica')),
  fornitore text,
  modello text,
  prodotto_id uuid references public.prodotti(id) on delete set null,
  sfero numeric(4,2),
  cilindro numeric(4,2),
  asse smallint check (asse is null or asse between 0 and 180),
  addizione numeric(4,2),
  bc numeric(4,2),
  dia numeric(4,2),
  extra jsonb not null default '{}'::jsonb,
  visus text not null,
  dominante boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prescrizione_id, occhio)
);
comment on table public.prescrizioni_lac is
  '024/M2: LAC definitiva per occhio, inseribile direttamente dalla scheda unica; prove, campioni e conferma da prova sono nel filone Y/M5.';
comment on column public.prescrizioni_lac.extra is
  'Campi dipendenti dal prodotto LAC; non sostituisce i parametri clinici tipizzati della riga.';

create index if not exists idx_prescrizioni_lac_azienda
  on public.prescrizioni_lac (azienda_id, prescrizione_id);
create trigger trg_prescrizioni_lac_updated before update on public.prescrizioni_lac
  for each row execute function public.tocca_updated_at();
create trigger trg_tenant_prescrizioni_lac_b2
  before insert or update on public.prescrizioni_lac
  for each row execute function public.assicura_coerenza_tenant(
    'prescrizione_id','prescrizioni', 'prodotto_id','prodotti'
  );

alter table public.prescrizioni_lac enable row level security;
create policy "prescrizioni_lac: della propria azienda" on public.prescrizioni_lac
  for all to authenticated
  using (azienda_id = public.get_azienda_id())
  with check (azienda_id = public.get_azienda_id());
revoke all on public.prescrizioni_lac from anon;

insert into public._infra_migrazioni (nome) values ('024_prescrizioni')
on conflict (nome) do nothing;

commit;

-- ============================================================================
-- Fine 024. La scheda unica non usa il tipo legacy come verità clinica; le LAC
-- definitive sono normalizzate per occhio e restano protette da RLS e tenant.
-- ============================================================================
