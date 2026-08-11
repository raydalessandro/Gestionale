-- ============================================================================
-- 023 · Igiene delle funzioni: le trigger escono dall'API, il search_path si pinna
-- ----------------------------------------------------------------------------
-- Due rilievi del linter, dalla stessa lettura che ha prodotto la 022.
--
-- (a) FUNZIONI-TRIGGER ESPOSTE COME ENDPOINT. `coerenza_registro_riferimento()`
--     risultava invocabile perfino da `anon` via `/rest/v1/rpc/…`;
--     `assicura_coerenza_tenant()`, `crea_sala_default()` e
--     `assegna_sala_appuntamento()` da `authenticated`. Una funzione-trigger
--     non è un endpoint di nessuno: nasce per essere chiamata dal trigger, e
--     l'esposizione è un effetto collaterale dei grant, non una scelta. È la
--     stessa famiglia del buco EXECUTE trovato dal rito in S0.
--
--     Si chiude PER CATEGORIA, non per nome: il ciclo qui sotto passa su tutte
--     le funzioni di `public` che tornano `trigger`. Così le quattro nominate
--     sono coperte, e con loro ogni funzione-trigger futura che qualcuno
--     dimenticasse di revocare — che è il modo in cui questo buco è nato.
--
--     ⚠️ PERIMETRO, misurato prima di scrivere: `prorettype = 'trigger'` separa
--     esattamente le trigger dalle RPC vere. Delle cinque funzioni del rilievo
--     (b), tre TORNANO trigger (`tocca_updated_at`,
--     `applica_movimento_magazzino`, `blocca_modifica`) e due NO
--     (`appuntamento_intervallo`, `normalizza_telefono`): queste ultime restano
--     chiamabili. `crea_prenotazione`, `registra_consenso` e le altre RPC non
--     sono nemmeno sfiorate dal ciclo.
--
--     ⚠️ PERCHÉ NON ROMPE I TRIGGER, e questa è la domanda che vale la
--     migrazione: Postgres controlla EXECUTE sulla funzione quando il TRIGGER
--     SI CREA, non quando SCATTA. A trigger creato, la funzione gira senza che
--     il privilegio di chi ha scritto la riga venga guardato. Verificato dal
--     vivo prima di applicare (vedi il messaggio di commit), non dato per
--     buono: se fosse falso, ogni insert di un ottico si fermerebbe.
--
-- (b) SEARCH_PATH MUTABILE su cinque funzioni vecchie. È l'igiene che la 021 ha
--     dato a tutte le funzioni nuove, portata a ritroso: senza `search_path`
--     pinnato, una funzione risolve i nomi col percorso del CHIAMANTE, e uno
--     schema piazzato davanti a `public` può farle chiamare un'altra cosa.
--
--     ⚠️ Due delle cinque vivono dentro strutture immutabili:
--     `normalizza_telefono` alimenta la colonna GENERATA
--     `persone.telefono_normalizzato`, e `appuntamento_intervallo` sta
--     nell'EXCLUDE degli appuntamenti e nel suo indice GiST. `alter function …
--     set search_path` non tocca né il corpo né la volatilità, quindi il valore
--     calcolato non cambia e gli indici restano validi — ma è esattamente il
--     genere di affermazione che va misurata invece che creduta, e lo è stata.
-- ============================================================================

-- ── (a) le funzioni-trigger escono dall'API ─────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public', r.firma);
    execute format('revoke execute on function %s from anon', r.firma);
    execute format('revoke execute on function %s from authenticated', r.firma);
  end loop;
end $$;

-- ── (b) il search_path si pinna sulle cinque vecchie ────────────────────────
-- Si passa anche qui per il catalogo invece che per una lista scritta a mano:
-- la lista invecchierebbe, e il criterio «è nostra, è in public, non ha
-- search_path» è quello giusto. `security definer` o meno non cambia il
-- rilievo: il percorso di risoluzione va fissato comunque.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and (p.proconfig is null
            or not exists (select 1 from unnest(p.proconfig) c where c like 'search\_path=%'))
  loop
    execute format('alter function %s set search_path = public, pg_catalog', r.firma);
  end loop;
end $$;

comment on function public.normalizza_telefono(text) is
  'Riduce un telefono alla sua forma di confronto (solo cifre, prefisso italiano normalizzato). Alimenta la colonna GENERATA persone.telefono_normalizzato: il suo risultato è parte di un vincolo, quindi il corpo non si tocca senza una migrazione che ne renda conto. Dalla 023 ha il search_path pinnato.';

insert into public._infra_migrazioni (nome) values ('023_igiene_funzioni')
on conflict (nome) do nothing;

-- ============================================================================
-- Fine 023. Le funzioni-trigger non sono più raggiungibili da fuori, e nessuna
-- funzione di `public` risolve più i nomi col percorso di chi la chiama.
-- ============================================================================
