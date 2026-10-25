-- Business Agent: database side of the Agent MCP (mcp-agent).
--
-- Trust model (roadmap → "Agent MCP security"):
--   * mcp-agent connects as the dedicated login role `agent_runtime`. That role
--     can only execute functions in `agent_api`; no table grants anywhere.
--   * Every agent_api function takes the worker's signed run token and verifies
--     it HERE (HMAC-SHA256, secret in Vault). The business/customer scope comes
--     only from the verified token, never from parameters or session settings,
--     so a leaked agent_runtime password alone can't act for anyone.
--   * One token = one tool call: it names the tool, expires within 60 s and its
--     nonce is single-use.
--
-- Out of band (secrets never live in migrations), once per project:
--   alter role agent_runtime with login password '<random>';
--   select vault.create_secret('<random>', 'agent_run_token_secret');
-- The same token secret goes to the worker (AGENT_RUN_TOKEN_SECRET); the
-- agent_runtime connection string goes to the mcp-agent edge function (AGENT_DB_URL).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_runtime') then
    create role agent_runtime nologin noinherit connection limit 20;
  end if;
end $$;

alter role agent_runtime set statement_timeout = '5s';
alter role agent_runtime set search_path = '';

-- Private: token verification + nonce ledger. Nobody but the owner touches it.
create schema if not exists agent_private;
revoke all on schema agent_private from public, anon, authenticated, agent_runtime;

create table if not exists agent_private.used_nonces (
  nonce      uuid primary key,
  expires_at timestamptz not null
);
create index if not exists used_nonces_expires_at_idx on agent_private.used_nonces (expires_at);
revoke all on agent_private.used_nonces from public, anon, authenticated, agent_runtime;

create or replace function agent_private.b64url_decode(p text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select decode(
    translate(p, '-_', '+/') || repeat('=', (4 - length(p) % 4) % 4),
    'base64'
  )
$$;

-- Token: "v1.<b64url(json)>.<b64url(hmac_sha256(secret, 'v1.' || <b64url(json)>))>"
-- json = {"pn": phone_number_id, "wa": customer_wa_id, "tool": name, "n": uuid, "exp": unix seconds}
-- Returns the verified claims, or raises 'agent_token_invalid'.
create or replace function agent_private.verify_run_token(p_token text, p_tool text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  parts    text[];
  secret   text;
  expected bytea;
  claims   jsonb;
  exp_at   timestamptz;
begin
  parts := string_to_array(coalesce(p_token, ''), '.');
  if array_length(parts, 1) <> 3 or parts[1] <> 'v1' or length(p_token) > 2048 then
    raise exception 'agent_token_invalid' using errcode = '28000';
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'agent_run_token_secret';
  if secret is null or length(secret) < 32 then
    raise exception 'agent_token_secret_missing';
  end if;

  expected := extensions.hmac(convert_to('v1.' || parts[2], 'utf8'), convert_to(secret, 'utf8'), 'sha256');
  -- Compare digests of both sides so the comparison time doesn't depend on
  -- how many leading bytes of the signature matched.
  if extensions.digest(agent_private.b64url_decode(parts[3]), 'sha256')
     <> extensions.digest(expected, 'sha256') then
    raise exception 'agent_token_invalid' using errcode = '28000';
  end if;

  claims := convert_from(agent_private.b64url_decode(parts[2]), 'utf8')::jsonb;

  if claims->>'tool' is distinct from p_tool
     or coalesce(claims->>'pn', '') = ''
     or coalesce(claims->>'wa', '') = ''
     or claims->>'n' is null
     or jsonb_typeof(claims->'exp') is distinct from 'number' then
    raise exception 'agent_token_invalid' using errcode = '28000';
  end if;

  exp_at := to_timestamp((claims->>'exp')::double precision);
  if exp_at < now() or exp_at > now() + interval '60 seconds' then
    raise exception 'agent_token_expired' using errcode = '28000';
  end if;

  -- Single use.
  insert into agent_private.used_nonces (nonce, expires_at)
  values ((claims->>'n')::uuid, exp_at)
  on conflict (nonce) do nothing;
  if not found then
    raise exception 'agent_token_replayed' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'phone_number_id', claims->>'pn',
    'customer_wa_id',  claims->>'wa',
    'tool',            claims->>'tool'
  );
end;
$$;

revoke all on function agent_private.verify_run_token(text, text) from public, anon, authenticated, agent_runtime;
revoke all on function agent_private.b64url_decode(text) from public, anon, authenticated, agent_runtime;

-- Public surface for mcp-agent. Not exposed through PostgREST (not in the API
-- schemas); reachable only by agent_runtime over a direct connection.
create schema if not exists agent_api;
revoke all on schema agent_api from public, anon, authenticated;
grant usage on schema agent_api to agent_runtime;
alter default privileges in schema agent_api revoke execute on functions from public;

-- Phase 0 probe: proves the chain worker → mcp-agent → Postgres and measures
-- the hop. Returns only the verified scope (customer masked) and DB time.
create or replace function agent_api.ping(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope jsonb := agent_private.verify_run_token(p_token, 'ping');
begin
  return jsonb_build_object(
    'ok', true,
    'phone_number_id', scope->>'phone_number_id',
    'customer', left(scope->>'customer_wa_id', -4) || '••••',
    'db_time', now()
  );
end;
$$;

revoke all on function agent_api.ping(text) from public, anon, authenticated;
grant execute on function agent_api.ping(text) to agent_runtime;

-- Expired nonces are useless (their tokens fail the exp check): purge them.
select cron.schedule(
  'agent-purge-used-nonces',
  '*/10 * * * *',
  $$delete from agent_private.used_nonces where expires_at < now() - interval '5 minutes'$$
);
