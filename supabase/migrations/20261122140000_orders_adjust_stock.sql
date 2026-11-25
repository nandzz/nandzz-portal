-- Orders, Phase 2: atomic stock adjustment for the Products tab (+/- buttons).
-- A read-then-write from the browser could overwrite a unit an order just
-- held; this adds the delta in one statement, clamped to 0…1,000,000.
-- Owner = auth.uid(); only products in stock mode.

create or replace function public.owner_adjust_stock(p_product_id uuid, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  q   int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_delta is null or p_delta not between -100000 and 100000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'detail', '{}'::jsonb);
  end if;
  update public.products
     set stock_qty = least(1000000, greatest(0, stock_qty + p_delta))
   where id = p_product_id and owner_user_id = uid and stock_mode = 'stock'
  returning stock_qty into q;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'detail', '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'stock_qty', q);
end;
$$;

revoke all on function public.owner_adjust_stock(uuid, int) from public, anon;
grant execute on function public.owner_adjust_stock(uuid, int) to authenticated;
