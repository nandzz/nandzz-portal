-- publish_space_tx: restore the original null-safe cost handling.
--
-- Prod drifted from the initial schema — the app_settings lookup was dropped
-- and p_cost got a default of 10, but the body still trusted p_cost to be
-- non-null. When callers (including the MCP edge function) explicitly passed
-- p_cost = null, `least(free, null)` returned `free`, then `null - free`
-- cascaded into every downstream int, and the UPDATE tried to write
-- paid_credits = NULL — which trips the NOT NULL constraint.
--
-- This re-establishes the pattern from 20260611082350_initial_schema.sql:
-- p_cost defaults to null; when null, look it up from app_settings; coalesce
-- to 10 if still unset. Signature is unchanged (grants stay valid).

create or replace function public.publish_space_tx(
  p_user_id           uuid,
  p_space_payload     jsonb,
  p_client_request_id uuid,
  p_cost              int default null
)
returns table (
  space_id           uuid,
  free_space_credits int,
  paid_credits       int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile         public.profiles%rowtype;
  v_cost            int;
  v_use_free        int;
  v_use_paid        int;
  v_new_free        int;
  v_new_paid        int;
  v_existing_space  uuid;
  v_new_space_id    uuid;
begin
  if p_user_id is null then
    raise exception 'user_id required' using errcode = 'P0001';
  end if;

  if p_cost is null then
    select coalesce((value->>'amount')::int, 10)
      into v_cost
    from public.app_settings
    where key = 'publish_space_cost';
    v_cost := coalesce(v_cost, 10);
  else
    v_cost := p_cost;
  end if;

  if v_cost < 0 then
    raise exception 'cost must be non-negative' using errcode = 'P0001';
  end if;

  -- Idempotent retry: if a row already exists for this client_request_id, return it.
  if p_client_request_id is not null then
    select id into v_existing_space
    from public.spaces
    where user_id = p_user_id and client_request_id = p_client_request_id;

    if v_existing_space is not null then
      select p.free_space_credits, p.paid_credits
        into v_new_free, v_new_paid
      from public.profiles p where p.id = p_user_id;
      return query select v_existing_space, v_new_free, v_new_paid;
      return;
    end if;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_use_free := least(v_profile.free_space_credits, v_cost);
  v_use_paid := v_cost - v_use_free;

  if v_use_paid > v_profile.paid_credits then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  v_new_free := v_profile.free_space_credits - v_use_free;
  v_new_paid := v_profile.paid_credits - v_use_paid;

  update public.profiles
  set free_space_credits = v_new_free,
      paid_credits       = v_new_paid
  where id = p_user_id;

  insert into public.spaces (
    user_id, title, description, url, html_url, pdf_url, image_url, video_url,
    markdown_content, preview_image_url, preview_gradient, preview_title,
    is_public, hashtags, client_request_id
  )
  values (
    p_user_id,
    p_space_payload->>'title',
    p_space_payload->>'description',
    p_space_payload->>'url',
    p_space_payload->>'html_url',
    p_space_payload->>'pdf_url',
    p_space_payload->>'image_url',
    p_space_payload->>'video_url',
    p_space_payload->>'markdown_content',
    p_space_payload->>'preview_image_url',
    coalesce(p_space_payload->>'preview_gradient', 'violet'),
    p_space_payload->>'preview_title',
    coalesce((p_space_payload->>'is_public')::boolean, true),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_space_payload->'hashtags')),
      '{}'::text[]
    ),
    p_client_request_id
  )
  returning id into v_new_space_id;

  if v_use_free > 0 then
    insert into public.credit_ledger (
      user_id, delta, bucket, reason,
      balance_after_free, balance_after_paid,
      related_entity_type, related_entity_id, metadata
    ) values (
      p_user_id, -v_use_free, 'free_space', 'publish_space',
      v_new_free, v_new_paid,
      'space', v_new_space_id::text, jsonb_build_object('cost', v_cost)
    );
  end if;
  if v_use_paid > 0 then
    insert into public.credit_ledger (
      user_id, delta, bucket, reason,
      balance_after_free, balance_after_paid,
      related_entity_type, related_entity_id, metadata
    ) values (
      p_user_id, -v_use_paid, 'paid', 'publish_space',
      v_new_free, v_new_paid,
      'space', v_new_space_id::text, jsonb_build_object('cost', v_cost)
    );
  end if;

  return query select v_new_space_id, v_new_free, v_new_paid;
end;
$$;

revoke all on function public.publish_space_tx(uuid, jsonb, uuid, int) from public;
grant execute on function public.publish_space_tx(uuid, jsonb, uuid, int) to authenticated, service_role;
