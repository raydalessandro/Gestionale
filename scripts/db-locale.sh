#!/usr/bin/env bash
# Alza un Postgres locale usa-e-getta e applica schema + migrazioni 002→ultima.
# Uso: bash scripts/db-locale.sh   (richiede: postgresql installato, utente root o postgres)
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
rm -rf /tmp/sql /tmp/pgd && mkdir -p /tmp/sql
cp supabase/schema.sql /tmp/sql/000_schema.sql
cp supabase/migrazioni/0*.sql /tmp/sql/
chmod -R a+rX /tmp/sql
su postgres -c "$PGBIN/initdb -D /tmp/pgd -U postgres -A trust >/dev/null && $PGBIN/pg_ctl -D /tmp/pgd -l /tmp/pg.log -o '-p 5433 -k /tmp -c listen_addresses=' start >/dev/null"
sleep 1
su postgres -c "$PGBIN/psql -h /tmp -p 5433 -U postgres -q" << 'SQL' >/dev/null 2>&1
create database limpidia; \c limpidia
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $f$ select '00000000-0000-0000-0000-000000000001'::uuid $f$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
SQL
for F in /tmp/sql/0*.sql; do
  R=$(su postgres -c "$PGBIN/psql -h /tmp -p 5433 -U postgres -d limpidia -v ON_ERROR_STOP=1 -q -f $F" 2>&1 | grep -m1 ERROR || true)
  [ -z "$R" ] && echo "OK  $(basename $F)" || echo "KO  $(basename $F) — $R"
done
echo "psql -h /tmp -p 5433 -U postgres -d limpidia   # per esplorare"
