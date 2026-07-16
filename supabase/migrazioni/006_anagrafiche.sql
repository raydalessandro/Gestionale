-- ============================================================================
-- MIGRAZIONE 006 — Pass anagrafiche (dalle schermate CIAO!/MIM del 16/07)
-- ============================================================================
-- Additiva: si applica DOPO 001–005. Fonte: docs/anagrafiche-campi.md
-- (decisioni) + docs/dominio-ottica.md §14 (anatomia dati di catena).
-- Zero flussi toccati: solo vocabolario delle voci.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CLIENTI — l'anagrafica completa, nel disegno di CIAO!
-- ────────────────────────────────────────────────────────────────────────────
alter table public.clienti
  add column if not exists secondo_nome     text,
  add column if not exists sesso            text check (sesso in ('M','F')),
  add column if not exists indirizzo2       text,   -- scala / appartamento / c-o
  add column if not exists nazione          text,   -- null = Italia
  add column if not exists telefono_casa    text,
  add column if not exists telefono_lavoro  text,
  add column if not exists lingua           text,   -- null = italiano
  add column if not exists tutore_legale    text,   -- nome del tutore (minori)
  add column if not exists canale_preferito text
      check (canale_preferito in ('telefono','whatsapp','sms','email','cartaceo')),
  add column if not exists non_contattare   boolean not null default false;

comment on column public.clienti.canale_preferito is
  'Canale con cui il cliente vuole essere contattato: precompila i richiami. (CIAO! usa flag multipli; noi scegliamo il preferito, che guida la telefonata.)';
comment on column public.clienti.non_contattare is
  'Esclude il cliente dalle proposte COMMERCIALI del motore richiami; sulle operative (la sua merce) resta un avviso, non un blocco.';

-- Il blocco Assicurazione / Azienda convenzionata visto in CIAO! arriva con
-- la Fase 5 (registro convenzioni + FK), non come testo libero qui.

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · PRESCRIZIONI — la distanza naso-pupillare
-- ────────────────────────────────────────────────────────────────────────────
alter table public.prescrizioni
  add column if not exists od_dnp numeric(4,1) check (od_dnp is null or (od_dnp between 20 and 45)),
  add column if not exists os_dnp numeric(4,1) check (os_dnp is null or (os_dnp between 20 and 45));

comment on column public.prescrizioni.od_dnp is
  'DNP in mm (metà della PD): serve alla busta per il montaggio.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · PRODOTTI — il quinto department e il ricambio LAC
-- ────────────────────────────────────────────────────────────────────────────
-- MIM lavora per department con IVA e processi propri: sole, montature vista,
-- lenti oftalmiche, LAC, accessori. Ci mancava il SOLE come tipo distinto
-- (occhiale finito, 22%, flussi da pronto-moda).
alter table public.prodotti drop constraint if exists prodotti_tipo_check;
alter table public.prodotti add constraint prodotti_tipo_check
  check (tipo in ('lac','soluzione','montatura','sole','lente','accessorio','servizio'));

alter table public.prodotti
  add column if not exists ricambio_giorni integer
      check (ricambio_giorni is null or ricambio_giorni > 0);

comment on column public.prodotti.ricambio_giorni is
  'Solo LAC: frequenza di ricambio (1 giornaliere, 14 quindicinali, 30 mensili…). Raffinerà la stima di esaurimento del motore richiami.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · UTENTI — il vocabolario dei ruoli (enforcement in fase hardening)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.utenti drop constraint if exists utenti_ruolo_check;
update public.utenti set ruolo = 'ottico'  where ruolo = 'optometrista';
update public.utenti set ruolo = 'addetto' where ruolo = 'staff';
alter table public.utenti alter column ruolo set default 'addetto';
alter table public.utenti add constraint utenti_ruolo_check
  check (ruolo in ('titolare','responsabile','ottico','addetto'));

comment on column public.utenti.ruolo is
  'Vocabolario fissato il 16/07: titolare, responsabile, ottico, addetto. La matrice permessi è in docs (enforcement come hardening pre-pilota).';

-- ============================================================================
-- Fine 006. Form e ritocchi UI in docs/fasi/fase-4b-anagrafiche.md
-- ============================================================================
