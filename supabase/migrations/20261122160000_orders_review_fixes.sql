-- Orders: fixes from the first review (features-doc/orders-plan.md).
--  1. Stock given back on cancel/reject/item replace = what each line really
--     took (new order_items.stock_held), not the ordered quantity. Before, a
--     product switched to stock mode after an order could gain phantom units.
--  2. A retried request with the same client_request_id waits for the first
--     call (advisory lock) and returns its order, instead of a unique error.
--  3. The max-pending-per-customer check is serialised per customer.
--  4. A missing fulfilment_method is a clean 'bad_method', not a NOT NULL error.

alter table public.order_items
  add column if not exists stock_held int not null default 0 check (stock_held >= 0);

-- Rows written before this column existed: their stock-mode products did take
-- the ordered quantity (open orders only; closed ones never give back).
update public.order_items i
   set stock_held = i.quantity
  from public.orders o, public.products p
 where o.id = i.order_id and p.id = i.product_id
   and o.status not in ('cancelled', 'rejected', 'completed')
   and p.stock_mode = 'stock' and i.stock_held = 0;

-- return type changes (void → int), so drop first
drop function if exists orders_private.hold_stock(public.products, int, date, boolean);

create or replace function orders_private.hold_stock(p_product public.products, p_qty int, p_day date, p_enforce_daily boolean)
returns int
language plpgsql
set search_path = ''
as $$
declare
  used bigint;
begin
  if p_product.stock_mode = 'stock' then
    update public.products set stock_qty = stock_qty - p_qty
     where id = p_product.id and stock_qty >= p_qty;
    if not found then
      perform orders_private.fail('sold_out', jsonb_build_object('product_id', p_product.id,
        'available', (select stock_qty from public.products where id = p_product.id)));
    end if;
    return p_qty;
  elsif p_product.stock_mode = 'daily' and p_enforce_daily then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily:' || p_product.id::text || ':' || p_day::text, 0));
    select coalesce(sum(i.quantity), 0) into used
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where i.product_id = p_product.id
       and o.fulfil_on = p_day
       and o.status not in ('cancelled', 'rejected');
    if used + p_qty > p_product.daily_capacity then
      perform orders_private.fail('sold_out', jsonb_build_object('product_id', p_product.id,
        'available', greatest(0, p_product.daily_capacity - used), 'date', p_day));
    end if;
  end if;
  return 0;
end;
$$;

-- Give back exactly what each line took (order_items.stock_held), never the
-- ordered quantity: a product switched to stock mode after the order was placed
-- got nothing taken, so it must get nothing back. Lines are zeroed, so a second
-- release can't add stock twice. Daily capacity frees itself (cancelled and
-- rejected orders aren't counted).
create or replace function orders_private.release_stock(p_order_id uuid)
returns void
language sql
set search_path = ''
as $$
  -- `held` reads the values before `zeroed` changes them (one snapshot).
  with held as (
    select i.id, i.product_id, i.stock_held
      from public.order_items i
     where i.order_id = p_order_id and i.stock_held > 0
       for update
  ), zeroed as (
    update public.order_items i set stock_held = 0 from held h where i.id = h.id
  )
  update public.products p
     set stock_qty = least(1000000, p.stock_qty + x.qty)
    from (select h.product_id, sum(h.stock_held) as qty
            from held h
           where h.product_id is not null
           group by h.product_id) x
   where p.id = x.product_id and p.stock_qty is not null;
$$;

create or replace function orders_private.write_items(
  p_order_id uuid, p_owner uuid, p_items jsonb, p_day date, p_rules boolean, p_now_local timestamp,
  p_settings public.order_settings, p_lead_ref time
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  it        jsonb;
  idx       bigint;
  pid       uuid;
  qn        numeric;
  qty       int;
  note      text;
  pr        public.products%rowtype;
  subtotal  bigint := 0;
  line      bigint;
  max_lines int := orders_private.limit_int('max_lines_per_order', 30);
  max_qty   int := orders_private.limit_int('max_qty_per_line', 999);
  lead      int;
  ready_at  timestamp;
  held      int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform orders_private.fail('no_items');
  end if;
  if jsonb_array_length(p_items) > max_lines then
    perform orders_private.fail('too_many_lines', jsonb_build_object('max', max_lines));
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e) <> 'object') then
    perform orders_private.fail('bad_request');
  end if;
  -- the same product twice would dodge per-line limits
  if (select count(distinct e->>'product_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    perform orders_private.fail('duplicate_product');
  end if;

  -- Lines are locked in product-id order so two orders never deadlock; the
  -- original order is kept in order_items.position.
  for it, idx in
    select e.value, e.ord from jsonb_array_elements(p_items) with ordinality e(value, ord)
     order by e.value->>'product_id'
  loop
    begin
      pid := (it->>'product_id')::uuid;
    exception when others then
      perform orders_private.fail('unknown_product', jsonb_build_object('product_id', it->>'product_id'));
    end;
    if coalesce(jsonb_typeof(it->'quantity'), '') <> 'number' then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid));
    end if;
    qn := (it->>'quantity')::numeric;
    if qn <> trunc(qn) or qn < 1 or qn > max_qty then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid, 'max', max_qty));
    end if;
    qty := qn::int;
    note := nullif(btrim(coalesce(it->>'note', '')), '');
    if note is not null and length(note) > 300 then
      perform orders_private.fail('note_too_long', jsonb_build_object('product_id', pid));
    end if;

    select * into pr from public.products where id = pid and owner_user_id = p_owner for update;
    if not found or pr.status = 'archived' or (p_rules and pr.status <> 'active') then
      perform orders_private.fail('unknown_product', jsonb_build_object('product_id', pid));
    end if;
    if (p_rules and (qty < pr.min_qty or (pr.max_qty is not null and qty > pr.max_qty))) then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid,
        'min', pr.min_qty, 'max', least(coalesce(pr.max_qty, max_qty), max_qty)));
    end if;

    if p_rules then
      if (pr.available_from is not null and p_day < pr.available_from)
         or (pr.available_until is not null and p_day > pr.available_until)
         or (pr.fulfilment_weekdays is not null and not (extract(dow from p_day)::smallint = any (pr.fulfilment_weekdays))) then
        perform orders_private.fail('product_unavailable_on_day', jsonb_build_object('product_id', pid, 'date', p_day));
      end if;
      lead := coalesce(pr.lead_time_hours, p_settings.default_lead_time_hours);
      ready_at := p_day + coalesce(p_lead_ref, '23:59:59'::time);
      if ready_at < p_now_local + make_interval(hours => lead) then
        perform orders_private.fail('too_soon', jsonb_build_object('product_id', pid, 'lead_time_hours', lead));
      end if;
    end if;

    held := orders_private.hold_stock(pr, qty, p_day, p_rules);

    line := pr.price_cents::bigint * qty;
    subtotal := subtotal + line;
    insert into public.order_items (order_id, owner_user_id, product_id, name, unit_label, unit_price_cents, quantity, line_total_cents, note, position, stock_held)
    values (p_order_id, p_owner, pr.id, pr.name, pr.unit_label, pr.price_cents, qty, line, note, idx::int - 1, held);
  end loop;

  return subtotal;
end;
$$;

create or replace function orders_private.create_order(
  p_owner uuid, p_payload jsonb, p_source text, p_actor text, p_rules boolean, p_status text
)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  s          public.order_settings%rowtype;
  o          public.orders%rowtype;
  reason     text;
  method     text := p_payload->>'fulfilment_method';
  day        date;
  t_from     time;
  t_to       time;
  addr       jsonb := nullif(p_payload->'delivery_address', 'null'::jsonb);
  now_local  timestamp;
  num        int;
  subtotal   bigint;
  fee        bigint := 0;
  req_id     text := nullif(btrim(coalesce(p_payload->>'client_request_id', '')), '');
  phone      text := nullif(btrim(coalesce(p_payload->>'customer_phone', '')), '');
  hours      jsonb;
  expiry_h   int;
  lead_ref   time;
  cname      text := btrim(coalesce(p_payload->>'customer_name', ''));
  cemail     text := lower(nullif(btrim(coalesce(p_payload->>'customer_email', '')), ''));
  cnote      text := nullif(btrim(coalesce(p_payload->>'customer_note', '')), '');
begin
  -- Idempotency: a retried request returns the order it already created. The
  -- lock makes a retry that arrives while the first call is still running wait
  -- for it, then find its order (instead of failing on the unique index).
  if req_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('order_req:' || p_owner::text || ':' || req_id, 0));
    select * into o from public.orders where owner_user_id = p_owner and client_request_id = req_id;
    if found then return o; end if;
  end if;

  reason := orders_private.blocked_reason(p_owner, p_rules, p_source);
  if reason is not null then perform orders_private.fail(reason); end if;
  select * into s from public.order_settings where owner_user_id = p_owner;
  now_local := now() at time zone s.timezone;

  perform orders_private.check_monthly_limit(p_owner);

  if coalesce(method, '') not in ('pickup', 'delivery') then perform orders_private.fail('bad_method'); end if;
  begin
    day    := (p_payload->>'fulfil_on')::date;
    t_from := nullif(p_payload->>'fulfil_from', '')::time;
    t_to   := nullif(p_payload->>'fulfil_to', '')::time;
  exception when others then
    perform orders_private.fail('bad_date');
  end;
  if day is null or (t_to is not null and (t_from is null or t_to <= t_from)) then
    perform orders_private.fail('bad_date');
  end if;
  if method = 'delivery' then
    if addr is null or not orders_private.valid_address(addr) then perform orders_private.fail('address_required'); end if;
  else
    addr := null;
  end if;
  if length(cname) not between 1 and 120 then perform orders_private.fail('name_required'); end if;
  if cemail is not null and (length(cemail) > 254 or cemail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform orders_private.fail('bad_email');
  end if;
  if phone is not null and (length(phone) > 32 or orders_private.phone_digits(phone) is null) then
    perform orders_private.fail('bad_phone');
  end if;
  if cnote is not null and length(cnote) > 1000 then perform orders_private.fail('note_too_long'); end if;

  if p_rules then
    if (method = 'pickup' and not s.pickup_enabled) or (method = 'delivery' and not s.delivery_enabled) then
      perform orders_private.fail('method_unavailable');
    end if;
    if day < now_local::date or day > now_local::date + least(s.max_days_ahead, orders_private.limit_int('max_days_ahead_cap', 365)) then
      perform orders_private.fail('date_out_of_range', jsonb_build_object('max_days_ahead', s.max_days_ahead));
    end if;
    hours := case when method = 'pickup' then s.pickup_hours else s.delivery_hours end;
    if not orders_private.fits_hours(hours, day, t_from, t_to) then
      perform orders_private.fail('closed', jsonb_build_object('date', day));
    end if;
    -- lead time is measured to the chosen time, else to the day's closing time
    lead_ref := coalesce(t_from, orders_private.day_close(hours, day));
    if s.max_orders_per_day is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orders_day:' || p_owner::text || ':' || day::text, 0));
      if (select count(*) from public.orders x
           where x.owner_user_id = p_owner and x.fulfil_on = day
             and x.status not in ('cancelled', 'rejected')) >= s.max_orders_per_day then
        perform orders_private.fail('day_full', jsonb_build_object('date', day));
      end if;
    end if;
    -- serialised per customer so two simultaneous orders can't both pass
    if phone is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'order_customer:' || p_owner::text || ':' || coalesce(orders_private.phone_digits(phone), ''), 0));
    end if;
    if phone is not null and (
         select count(*) from public.orders x
          where x.owner_user_id = p_owner and x.status = 'pending'
            and orders_private.phone_digits(x.customer_phone) = orders_private.phone_digits(phone))
       >= orders_private.limit_int('max_pending_per_customer', 3) then
      perform orders_private.fail('too_many_pending');
    end if;
    if s.ask_customer_email = 'required' and nullif(btrim(coalesce(p_payload->>'customer_email', '')), '') is null then
      perform orders_private.fail('email_required');
    end if;
  end if;

  insert into public.order_counters (owner_user_id, last_number) values (p_owner, 1)
  on conflict (owner_user_id) do update set last_number = public.order_counters.last_number + 1
  returning last_number into num;

  expiry_h := least(s.pending_expiry_hours, orders_private.limit_int('max_pending_expiry_hours', 72));

  insert into public.orders (
    owner_user_id, order_number, status, source,
    customer_name, customer_phone, customer_email, customer_locale, customer_user_id, agent_thread_id,
    fulfilment_method, fulfil_on, fulfil_from, fulfil_to, delivery_address,
    currency, subtotal_cents, delivery_fee_cents, total_cents,
    customer_note, client_request_id, expires_at, confirmed_at
  ) values (
    p_owner, num, p_status, p_source,
    cname, phone, cemail,
    left(nullif(p_payload->>'customer_locale', ''), 10),
    nullif(p_payload->>'customer_user_id', '')::uuid,
    nullif(p_payload->>'agent_thread_id', '')::uuid,
    method, day, t_from, t_to, addr,
    s.currency, 0, 0, 0,
    cnote, req_id,
    case when p_status = 'pending' then now() + make_interval(hours => expiry_h) end,
    case when p_status = 'confirmed' then now() end
  )
  returning * into o;

  subtotal := orders_private.write_items(o.id, p_owner, p_payload->'items', day, p_rules, now_local, s, lead_ref);

  if method = 'delivery' then
    if p_rules and s.delivery_min_order_cents is not null and subtotal < s.delivery_min_order_cents then
      perform orders_private.fail('below_minimum', jsonb_build_object('minimum_cents', s.delivery_min_order_cents));
    end if;
    fee := case when s.free_delivery_over_cents is not null and subtotal >= s.free_delivery_over_cents
                then 0 else s.delivery_fee_cents end;
  end if;

  update public.orders
     set subtotal_cents = subtotal, delivery_fee_cents = fee, total_cents = subtotal + fee
   where id = o.id
  returning * into o;

  insert into public.order_events (order_id, owner_user_id, actor, type, to_status, data)
  values (o.id, p_owner, p_actor, 'created', o.status, jsonb_build_object('source', p_source));

  return o;
end;
$$;

revoke all on all functions in schema orders_private from public, anon, authenticated;
-- CHECK constraints on owner-written tables call these two validators.
grant execute on function orders_private.valid_hours(jsonb) to authenticated, service_role;
grant execute on function orders_private.valid_address(jsonb) to authenticated, service_role;
