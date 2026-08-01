-- OAuth 2.1 for the Nandzz MCP server (per MCP spec 2025-06-18).
-- - Dynamic Client Registration (RFC 7591)
-- - Authorization Code + PKCE (S256 only)
-- - Access tokens are stored in mcp_tokens (already exists) — this migration
--   only adds the pre-authorization pieces (clients + short-lived codes) plus
--   a service-role variant of the token issuer.

create extension if not exists pgcrypto with schema extensions;

-- ── mcp_oauth_clients ───────────────────────────────────────────────────────
-- Public clients (Claude Desktop, etc.) registered via DCR. No client_secret —
-- security comes from PKCE + registered redirect_uris.

create table if not exists public.mcp_oauth_clients (
  id            uuid primary key default gen_random_uuid(),
  client_name   text,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

alter table public.mcp_oauth_clients enable row level security;
-- No client policies — all access via service role.

-- ── mcp_oauth_codes ─────────────────────────────────────────────────────────
-- Single-use authorization codes. 10-minute TTL.

create table if not exists public.mcp_oauth_codes (
  code                  text primary key,
  client_id             uuid not null references public.mcp_oauth_clients(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null check (code_challenge_method = 'S256'),
  scopes                text[] not null default array['publish','read']::text[],
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_mcp_oauth_codes_expires on public.mcp_oauth_codes(expires_at);

alter table public.mcp_oauth_codes enable row level security;
-- No client policies — service role only.

-- ── RPC: issue an oauth code (called from consent handler with user JWT) ────
create or replace function public.mcp_issue_oauth_code(
  p_client_id             uuid,
  p_redirect_uri          text,
  p_code_challenge        text,
  p_code_challenge_method text,
  p_scopes                text[]
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_ok   boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_code_challenge_method <> 'S256' then
    raise exception 'INVALID_CHALLENGE_METHOD' using errcode = 'P0001';
  end if;

  -- Redirect URI must be one of the client's registered URIs.
  select p_redirect_uri = any(redirect_uris) into v_ok
    from public.mcp_oauth_clients
    where id = p_client_id;
  if v_ok is null then
    raise exception 'INVALID_CLIENT' using errcode = 'P0001';
  end if;
  if not v_ok then
    raise exception 'INVALID_REDIRECT_URI' using errcode = 'P0001';
  end if;

  v_code := 'oc_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.mcp_oauth_codes (
    code, client_id, user_id, redirect_uri,
    code_challenge, code_challenge_method, scopes, expires_at
  ) values (
    v_code, p_client_id, v_uid, p_redirect_uri,
    p_code_challenge, p_code_challenge_method,
    coalesce(p_scopes, array['publish','read']::text[]),
    now() + interval '10 minutes'
  );

  return v_code;
end;
$$;

revoke all on function public.mcp_issue_oauth_code(uuid, text, text, text, text[]) from public;
grant execute on function public.mcp_issue_oauth_code(uuid, text, text, text, text[]) to authenticated;

-- ── RPC: atomically consume a code (single-use, called from /token) ─────────
create or replace function public.mcp_consume_oauth_code(
  p_code         text,
  p_client_id    uuid,
  p_redirect_uri text
)
returns table (user_id uuid, code_challenge text, scopes text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mcp_oauth_codes%rowtype;
begin
  select * into v_row from public.mcp_oauth_codes
  where code = p_code
  for update;

  if not found then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;
  if v_row.consumed_at is not null then
    raise exception 'CODE_ALREADY_USED' using errcode = 'P0001';
  end if;
  if v_row.expires_at < now() then
    raise exception 'CODE_EXPIRED' using errcode = 'P0001';
  end if;
  if v_row.client_id <> p_client_id then
    raise exception 'CLIENT_MISMATCH' using errcode = 'P0001';
  end if;
  if v_row.redirect_uri <> p_redirect_uri then
    raise exception 'REDIRECT_MISMATCH' using errcode = 'P0001';
  end if;

  update public.mcp_oauth_codes set consumed_at = now() where code = p_code;

  return query select v_row.user_id, v_row.code_challenge, v_row.scopes;
end;
$$;

revoke all on function public.mcp_consume_oauth_code(text, uuid, text) from public;
grant execute on function public.mcp_consume_oauth_code(text, uuid, text) to service_role;

-- ── RPC: service-role variant of mcp_issue_token ────────────────────────────
-- The token endpoint runs with service role (no user session) but needs to
-- mint a token for the user identified by the auth code.

create or replace function public.mcp_issue_token_for_user(
  p_user_id    uuid,
  p_name       text default 'OAuth grant',
  p_scopes     text[] default array['publish','read']::text[],
  p_expires_at timestamptz default null
)
returns table (token text, prefix text, id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_raw    text;
  v_prefix text;
  v_hash   text;
  v_id     uuid;
begin
  if p_user_id is null then
    raise exception 'user_id required' using errcode = 'P0001';
  end if;

  v_raw    := 'nz_mcp_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_prefix := substr(v_raw, 1, 13);
  v_hash   := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  insert into public.mcp_tokens (user_id, token_hash, token_prefix, name, scopes, expires_at)
  values (
    p_user_id, v_hash, v_prefix,
    nullif(p_name, ''),
    coalesce(p_scopes, array['publish','read']::text[]),
    p_expires_at
  )
  returning public.mcp_tokens.id into v_id;

  return query select v_raw, v_prefix, v_id;
end;
$$;

revoke all on function public.mcp_issue_token_for_user(uuid, text, text[], timestamptz) from public;
grant execute on function public.mcp_issue_token_for_user(uuid, text, text[], timestamptz) to service_role;
