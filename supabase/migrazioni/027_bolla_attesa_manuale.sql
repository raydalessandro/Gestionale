-- ============================================================================
-- 027 · B3 Catalogo & Magazzino — bolla attesa manuale atomica
-- ----------------------------------------------------------------------------
-- La fornitura manuale resta distinta dal trigger B4 post-conferma fiscale.
-- Questa RPC crea insieme intestazione e unica riga attesa: nessun movimento
-- fisico, nessuna giacenza, nessuna bolla orfana se la riga non è valida.
-- ============================================================================

create or replace function public.crea_bolla_attesa_manuale(
  p_fornitore text,
  p_prodotto_id uuid,
  p_quantita integer,
  p_numero_bolla text default null,
  p_lettera_vettura text default null,
  p_riferimento_interno text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_azienda_id uuid := public.get_azienda_id();
  v_bolla_id uuid;
  v_nome_prodotto text;
  v_upc text;
begin
  if nullif(btrim(p_fornitore), '') is null then
    raise exception 'Il fornitore della bolla è obbligatorio.' using errcode = '23514';
  end if;
  if p_quantita < 1 then
    raise exception 'La quantità attesa dev''essere almeno 1.' using errcode = '23514';
  end if;

  select nome, sku into v_nome_prodotto, v_upc
    from public.prodotti
   where id = p_prodotto_id and azienda_id = v_azienda_id;
  if not found then
    raise exception 'Prodotto non trovato nel negozio corrente.' using errcode = '23514';
  end if;

  insert into public.bolle_attese (
    azienda_id, fornitore, numero_bolla, lettera_vettura, riferimento_interno
  ) values (
    v_azienda_id, btrim(p_fornitore), nullif(btrim(p_numero_bolla), ''),
    nullif(btrim(p_lettera_vettura), ''), nullif(btrim(p_riferimento_interno), '')
  ) returning id into v_bolla_id;

  insert into public.bolle_attese_righe (
    bolla_id, prodotto_id, descrizione, upc, q_attesa
  ) values (
    v_bolla_id, p_prodotto_id, v_nome_prodotto, v_upc, p_quantita
  );

  return v_bolla_id;
end;
$$;
comment on function public.crea_bolla_attesa_manuale(text, uuid, integer, text, text, text) is
  '027/M3: fornitura manuale atomica. Crea intestazione e riga attesa senza movimento; il trigger automatico da ordine resta B4.';
revoke all on function public.crea_bolla_attesa_manuale(text, uuid, integer, text, text, text) from public, anon;
grant execute on function public.crea_bolla_attesa_manuale(text, uuid, integer, text, text, text) to authenticated;

insert into public._infra_migrazioni (nome) values ('027_bolla_attesa_manuale')
on conflict (nome) do nothing;

-- ============================================================================
-- Fine 027.
-- ============================================================================
