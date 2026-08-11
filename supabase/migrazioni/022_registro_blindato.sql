-- 022 · Il registro delle migrazioni si blinda (rilievo linter, 11/08).
-- Misurato: RLS spenta + grant pieni ad authenticated su TEST e PROD.
-- Cancellare una riga del registro ri-arma quella migrazione al giro
-- successivo del runner: stessa classe della _riparazioni_dati (020).
-- Zero rotture per costruzione: il runner è OWNER della tabella
-- (bypassa la RLS), il passo CI e il service role idem.
alter table public._infra_migrazioni enable row level security;
revoke all on table public._infra_migrazioni from anon, authenticated;

-- Nessuna policy, ed è intenzionale: è il modo con cui questa casa dice «da qui
-- non passa nessuno» (ID-01, come `persone` e il registro dei riferimenti nella
-- 011 §8). Una `using (false)` direbbe lo stesso in modo più fragile.

comment on table public._infra_migrazioni is
  'Registro delle migrazioni applicate: lo tiene scripts/applica-migrazioni.ts, ed è ciò che rende idempotente la strada che registra. Dalla 022 è BLINDATO — RLS attiva senza policy (ID-01) e nessun grant ad anon/authenticated: ci arrivano solo il proprietario (il runner, con l''URI diretto) e il service_role. Il rischio chiuso non è la riservatezza — là dentro ci sono nomi di file e timestamp — ma l''INTEGRITÀ: cancellare una riga ri-arma quella migrazione al giro successivo del runner.';

-- Auto-registrazione, come fa la 021: il runner scriverebbe comunque questa
-- riga, ma averla nel file rende la migrazione completa anche se un giorno
-- venisse applicata per un'altra strada.
insert into public._infra_migrazioni (nome) values ('022_registro_blindato')
on conflict (nome) do nothing;
