-- ============================================================================
-- 026 · B3 Catalogo & Magazzino — correzioni di interoperabilità TEST
-- ----------------------------------------------------------------------------
-- Applica su ambienti che hanno già ricevuto 025 le revoche EXECUTE delle
-- funzioni-trigger e la sola eccezione referenziale necessaria alla cascade
-- tenant → prodotti → righe bolla durante svuota_dati_di_test().
-- Nessun rename/drop di dati o nomi.
-- ============================================================================

create or replace function public.assicura_tenant_riga_bolla_b3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  azienda_bolla uuid;
begin
  select azienda_id into azienda_bolla from public.bolle_attese where id = new.bolla_id;
  if azienda_bolla is null then
    -- La cascade di cancellazione del tenant può eseguire ON DELETE SET NULL
    -- su prodotto_id quando il padre bolla è già stato cancellato. Non è una
    -- scrittura applicativa e non deve rendere impossibile il cleanup TEST.
    if TG_OP = 'UPDATE'
       and old.prodotto_id is not null
       and new.prodotto_id is null
       and pg_trigger_depth() > 1 then
      return new;
    end if;
    raise exception using errcode = '23514', message = 'Bolla attesa non trovata.';
  end if;
  if new.prodotto_id is not null and not exists (
    select 1 from public.prodotti where id = new.prodotto_id and azienda_id = azienda_bolla
  ) then
    raise exception using errcode = '23514', message = 'Prodotto di un tenant diverso dalla bolla.';
  end if;
  return new;
end;
$$;

-- Una funzione trigger non è un endpoint API; rimane invocabile soltanto dal
-- trigger PostgreSQL, mai da PUBLIC, anon o authenticated.
revoke all on function public.assicura_tenant_riga_bolla_b3() from public, anon, authenticated;
revoke all on function public.guida_stato_bolla_attesa_b3() from public, anon, authenticated;
revoke all on function public.guarda_quantita_riga_bolla_b3() from public, anon, authenticated;
revoke all on function public.guida_stato_pratica_difetto_b3() from public, anon, authenticated;

insert into public._infra_migrazioni (nome) values ('026_catalogo_magazzino_correzioni')
on conflict (nome) do nothing;

-- ============================================================================
-- Fine 026.
-- ============================================================================
