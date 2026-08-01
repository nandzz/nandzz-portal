-- MCP: personal access tokens for the Nandzz MCP server.
-- Users generate a token from the Portal, paste it into their MCP client
-- (Claude Desktop / Code). The edge function validates by hashing the
-- provided token and looking it up here.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  -- SHA-256 hex of the plaintext token. Plaintext is returned exactly once
  -- at issue time and never stored.
  token_hash   text not null unique,
  -- Short human-facing prefix so users can identify tokens in the UI without
  -- exposing the secret. Format: "nz_mcp_" + first 6 hex chars.
  token_prefix text not null,
  name         text,
  scopes       text[] not null default array['publish','read']::text[],
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz
);

create index if not exists idx_mcp_tokens_user on public.mcp_tokens(user_id);

alter table public.mcp_tokens enable row level security;

-- Owner reads their own token metadata (never the hash).
drop policy if exists "Users read their own mcp tokens" on public.mcp_tokens;
create policy "Users read their own mcp tokens"
  on public.mcp_tokens for select
  using (auth.uid() = user_id);

-- No client insert/update/delete policy — mutations go through the RPCs below.

-- Issue a new token. Returns the plaintext token exactly once —
-- caller MUST save it immediately. Called from the Portal.
create or replace function public.mcp_issue_token(
  p_name       text default null,
  p_expires_at timestamptz default null
)
returns table (token text, prefix text, id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_raw    text;
  v_prefix text;
  v_hash   text;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  v_raw    := 'nz_mcp_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_prefix := substr(v_raw, 1, 13);
  v_hash   := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  insert into public.mcp_tokens (user_id, token_hash, token_prefix, name, expires_at)
  values (v_uid, v_hash, v_prefix, nullif(p_name, ''), p_expires_at)
  returning public.mcp_tokens.id into v_id;

  return query select v_raw, v_prefix, v_id;
end;
$$;

revoke all on function public.mcp_issue_token(text, timestamptz) from public;
grant execute on function public.mcp_issue_token(text, timestamptz) to authenticated;

-- Validate a token and return the owning user_id (or NULL if invalid).
-- Called from the edge function via service role. Updates last_used_at on hit.
create or replace function public.mcp_verify_token(p_raw text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_row  public.mcp_tokens%rowtype;
begin
  if p_raw is null or p_raw = '' then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_raw, 'sha256'), 'hex');
  select * into v_row from public.mcp_tokens where token_hash = v_hash;

  if not found then return null; end if;
  if v_row.revoked_at is not null then return null; end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then return null; end if;

  update public.mcp_tokens set last_used_at = now() where id = v_row.id;

  return v_row.user_id;
end;
$$;

revoke all on function public.mcp_verify_token(text) from public;
grant execute on function public.mcp_verify_token(text) to service_role;

-- Revoke a token owned by the caller.
create or replace function public.mcp_revoke_token(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.mcp_tokens
     set revoked_at = now()
   where id = p_id and user_id = v_uid and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.mcp_revoke_token(uuid) from public;
grant execute on function public.mcp_revoke_token(uuid) to authenticated;
