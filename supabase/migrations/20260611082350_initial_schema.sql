-- nandzz MVP Schema
-- Safe to re-run — all statements are idempotent

-- 1. Create profiles table
create table if not exists public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  username       text unique not null,
  display_name   text,
  tagline        text,
  bio            text,
  avatar_url          text,
  background_url      text,
  background_position text default '50% 50%',
  website_url         text,
  social_links   jsonb default '{}',
  created_at     timestamptz default now()
);

-- Migrations for existing databases
alter table public.profiles add column if not exists social_links jsonb default '{}';
alter table public.profiles add column if not exists background_url text;
alter table public.profiles add column if not exists background_position text default '50% 50%';

-- 2. Create spaces table
create table if not exists public.spaces (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  title             text not null,
  description       text,
  url               text,
  html_url          text,
  preview_image_url text,
  is_public         boolean default true,
  likes_count       integer default 0,
  hashtags          text[]  not null default '{}',
  created_at        timestamptz default now()
);

-- Migrations for existing databases
alter table public.spaces add column if not exists likes_count integer default 0;
alter table public.spaces drop column if exists type;
alter table public.spaces add column if not exists pdf_url text;
alter table public.spaces add column if not exists preview_gradient text default 'violet';
alter table public.spaces add column if not exists preview_title text;
alter table public.spaces add column if not exists hashtags text[] not null default '{}';
alter table public.spaces add column if not exists image_url text;
alter table public.spaces add column if not exists video_url text;
alter table public.spaces add column if not exists markdown_content text;

-- GIN index for fast hashtag filtering (WHERE 'react' = ANY(hashtags))
create index if not exists spaces_hashtags_gin
  on public.spaces using gin(hashtags);

-- Full-text search: stored tsvector + GIN index (title + description only)
-- Note: hashtags are intentionally excluded — array_to_string is STABLE not IMMUTABLE,
-- which PostgreSQL rejects in generated columns. Hashtags are searchable via the GIN index above.
alter table public.spaces
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) stored;

create index if not exists spaces_search_vector_idx
  on public.spaces using gin(search_vector);

-- 3. Enable RLS
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;

-- 4. Profiles policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 5. Spaces policies
drop policy if exists "Public spaces are viewable by everyone" on public.spaces;
create policy "Public spaces are viewable by everyone"
  on public.spaces for select
  using (is_public = true);

drop policy if exists "Users can view their own spaces" on public.spaces;
create policy "Users can view their own spaces"
  on public.spaces for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own spaces" on public.spaces;
create policy "Users can insert their own spaces"
  on public.spaces for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own spaces" on public.spaces;
create policy "Users can update their own spaces"
  on public.spaces for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own spaces" on public.spaces;
create policy "Users can delete their own spaces"
  on public.spaces for delete
  using (auth.uid() = user_id);

-- 6. Auto-create profile on signup
-- For email/password signups: uses username/display_name from metadata.
-- For OAuth (Google, etc): skips insert; app redirects to /setup-username.
-- Reads the signup_credit_grant.amount setting from app_settings (admin-configurable).
-- Falls back to 100 if app_settings is missing — happens during first-time apply.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_profile_id uuid;
  v_grant      int := 100;
begin
  if new.raw_user_meta_data->>'username' is not null then
    -- Look up the admin-configured signup grant.
    if to_regclass('public.app_settings') is not null then
      select coalesce((value->>'amount')::int, v_grant)
        into v_grant
      from public.app_settings
      where key = 'signup_credit_grant';
      v_grant := coalesce(v_grant, 100);
    end if;

    insert into public.profiles (id, username, display_name, free_space_credits)
    values (
      new.id,
      new.raw_user_meta_data->>'username',
      coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
      v_grant
    )
    returning id into v_profile_id;

    -- Skip ledger write if the credits tables don't exist yet (first-time apply ordering).
    if v_profile_id is not null
       and to_regclass('public.credit_ledger') is not null
       and v_grant > 0 then
      insert into public.credit_ledger (
        user_id, delta, bucket, reason,
        balance_after_free, balance_after_paid, metadata
      ) values (
        v_profile_id, v_grant, 'free_space', 'signup_grant',
        v_grant, 0, jsonb_build_object('source', 'email_signup')
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('space-images', 'space-images', true, 5242880, array['image/jpeg','image/png','image/gif','image/webp'])
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('space-previews', 'space-previews', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('space-html', 'space-html', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('space-pdfs', 'space-pdfs', true, 10485760, array['application/pdf'])
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('profile-backgrounds', 'profile-backgrounds', true, 1572864, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('space-assets', 'space-assets', true, 2097152, array['image/jpeg','image/png','image/gif','image/webp'])
  on conflict (id) do nothing;

-- Storage policies for avatars
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for space previews
drop policy if exists "Space preview images are publicly accessible" on storage.objects;
create policy "Space preview images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'space-previews');

drop policy if exists "Users can upload space previews" on storage.objects;
create policy "Users can upload space previews"
  on storage.objects for insert
  with check (bucket_id = 'space-previews' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update space previews" on storage.objects;
create policy "Users can update space previews"
  on storage.objects for update
  using (bucket_id = 'space-previews' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete space previews" on storage.objects;
create policy "Users can delete space previews"
  on storage.objects for delete
  using (bucket_id = 'space-previews' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for space HTML files
drop policy if exists "Space HTML files are publicly accessible" on storage.objects;
create policy "Space HTML files are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'space-html');

drop policy if exists "Users can upload space HTML" on storage.objects;
create policy "Users can upload space HTML"
  on storage.objects for insert
  with check (bucket_id = 'space-html' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update space HTML" on storage.objects;
create policy "Users can update space HTML"
  on storage.objects for update
  using (bucket_id = 'space-html' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete space HTML" on storage.objects;
create policy "Users can delete space HTML"
  on storage.objects for delete
  using (bucket_id = 'space-html' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for space PDF files
drop policy if exists "Space PDF files are publicly accessible" on storage.objects;
create policy "Space PDF files are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'space-pdfs');

drop policy if exists "Users can upload space PDFs" on storage.objects;
create policy "Users can upload space PDFs"
  on storage.objects for insert
  with check (bucket_id = 'space-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update space PDFs" on storage.objects;
create policy "Users can update space PDFs"
  on storage.objects for update
  using (bucket_id = 'space-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete space PDFs" on storage.objects;
create policy "Users can delete space PDFs"
  on storage.objects for delete
  using (bucket_id = 'space-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Tags system — REMOVED
-- Hashtags are now stored as text[] directly on spaces.hashtags.
-- Run these once to clean up existing deployments:

drop table if exists public.space_tags;
drop table if exists public.tags;

-- 9. Likes system

-- Create likes table
create table if not exists public.space_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  space_id uuid references public.spaces(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, space_id)
);

alter table public.space_likes enable row level security;

-- RLS: Anyone can view likes
drop policy if exists "Likes are viewable by everyone" on public.space_likes;
create policy "Likes are viewable by everyone"
  on public.space_likes for select using (true);

-- RLS: Authenticated users can like
drop policy if exists "Users can like spaces" on public.space_likes;
create policy "Users can like spaces"
  on public.space_likes for insert with check (auth.uid() = user_id);

-- RLS: Users can unlike their own
drop policy if exists "Users can unlike spaces" on public.space_likes;
create policy "Users can unlike spaces"
  on public.space_likes for delete using (auth.uid() = user_id);

-- Function to update likes_count
create or replace function public.update_likes_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.spaces set likes_count = likes_count + 1 where id = NEW.space_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    -- greatest(0, ...) prevents likes_count from going negative under concurrent deletes
    update public.spaces set likes_count = greatest(0, likes_count - 1) where id = OLD.space_id;
    return OLD;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_likes_count() from public, anon, authenticated;

drop trigger if exists on_like_change on public.space_likes;
create trigger on_like_change
  after insert or delete on public.space_likes
  for each row execute procedure public.update_likes_count();

-- 10. Collections

create table if not exists public.collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  is_public boolean default true,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Add is_default column for existing databases
alter table public.collections add column if not exists is_default boolean default false;

create table if not exists public.collection_spaces (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.collections(id) on delete cascade not null,
  space_id uuid references public.spaces(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(collection_id, space_id)
);

alter table public.collections enable row level security;
alter table public.collection_spaces enable row level security;

-- Collections RLS
drop policy if exists "Public collections are viewable by everyone" on public.collections;
create policy "Public collections are viewable by everyone"
  on public.collections for select
  using (is_public = true);

drop policy if exists "Users can view their own collections" on public.collections;
create policy "Users can view their own collections"
  on public.collections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own collections" on public.collections;
create policy "Users can create their own collections"
  on public.collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own collections" on public.collections;
create policy "Users can update their own collections"
  on public.collections for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own collections" on public.collections;
create policy "Users can delete their own collections"
  on public.collections for delete
  using (auth.uid() = user_id);

-- Collection spaces RLS
drop policy if exists "Collection spaces are viewable if collection is accessible" on public.collection_spaces;
create policy "Collection spaces are viewable if collection is accessible"
  on public.collection_spaces for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.is_public = true or c.user_id = auth.uid())
    )
  );

drop policy if exists "Users can add spaces to their own collections" on public.collection_spaces;
create policy "Users can add spaces to their own collections"
  on public.collection_spaces for insert
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can remove spaces from their own collections" on public.collection_spaces;
create policy "Users can remove spaces from their own collections"
  on public.collection_spaces for delete
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

-- Storage policies for space assets (images attached to HTML spaces)
drop policy if exists "Space assets are publicly accessible" on storage.objects;
create policy "Space assets are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'space-assets');

drop policy if exists "Users can upload space assets" on storage.objects;
create policy "Users can upload space assets"
  on storage.objects for insert
  with check (bucket_id = 'space-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update space assets" on storage.objects;
create policy "Users can update space assets"
  on storage.objects for update
  using (bucket_id = 'space-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete space assets" on storage.objects;
create policy "Users can delete space assets"
  on storage.objects for delete
  using (bucket_id = 'space-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for profile backgrounds
drop policy if exists "Profile backgrounds are publicly accessible" on storage.objects;
create policy "Profile backgrounds are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-backgrounds');

drop policy if exists "Users can upload their own background" on storage.objects;
create policy "Users can upload their own background"
  on storage.objects for insert
  with check (bucket_id = 'profile-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own background" on storage.objects;
create policy "Users can update their own background"
  on storage.objects for update
  using (bucket_id = 'profile-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own background" on storage.objects;
create policy "Users can delete their own background"
  on storage.objects for delete
  using (bucket_id = 'profile-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for space images (image-type spaces)
drop policy if exists "Space images are publicly accessible" on storage.objects;
create policy "Space images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'space-images');

drop policy if exists "Users can upload space images" on storage.objects;
create policy "Users can upload space images"
  on storage.objects for insert
  with check (bucket_id = 'space-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update space images" on storage.objects;
create policy "Users can update space images"
  on storage.objects for update
  using (bucket_id = 'space-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete space images" on storage.objects;
create policy "Users can delete space images"
  on storage.objects for delete
  using (bucket_id = 'space-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Billing / Stripe (run after Stripe integration is set up)
-- ============================================================

-- Add billing columns to profiles
alter table public.profiles add column if not exists plan_tier text default 'free' check (plan_tier in ('free', 'pro'));
alter table public.profiles add column if not exists stripe_customer_id text;

-- Index for webhook lookups by Stripe customer
create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

-- ============================================================
-- Agents: knowledge documents + RAG chunks per profile
-- ============================================================

-- pgvector: required for embeddings. Enable once per project.
create extension if not exists vector;

create table if not exists public.agent_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'active' check (status in ('active', 'outdated', 'needs_review')),
  is_sensitive boolean not null default false,
  -- Controls injection order into the system prompt (lower = earlier).
  -- Identity docs (me.md, soul.md) should have low values; supplementary docs higher.
  sort_order integer not null default 100,
  -- Automatically maintained by Postgres — shows content size without a query.
  char_count integer generated always as (char_length(content)) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.agent_documents enable row level security;

-- Owner has full access to all their documents (including private).
drop policy if exists "owner_all_agent_docs" on public.agent_documents;
create policy "owner_all_agent_docs" on public.agent_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone (including anon) can read public active documents — needed by the Edge
-- Function running as service-role, but also correct for direct queries.
drop policy if exists "public_read_agent_docs" on public.agent_documents;
create policy "public_read_agent_docs" on public.agent_documents
  for select using (visibility = 'public' and status = 'active');

-- Auto-update updated_at on every row modification.
create or replace function public.agent_documents_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_documents_updated_at on public.agent_documents;
create trigger agent_documents_updated_at
  before update on public.agent_documents
  for each row execute function public.agent_documents_set_updated_at();

create index if not exists idx_agent_documents_user_id
  on public.agent_documents(user_id);

-- Prompt-build query: public active docs ordered by sort_order then created_at.
create index if not exists idx_agent_documents_prompt
  on public.agent_documents(user_id, sort_order, created_at)
  where visibility = 'public' and status = 'active';

-- ── Chunks ──────────────────────────────────────────────────────────────────
-- Each document is split into chunks for RAG retrieval.
-- Embeddings use OpenAI text-embedding-3-small (1536 dims).
-- chat route does: embed(query) → cosine similarity → top-k chunks → system prompt.

create table if not exists public.agent_document_chunks (
  id           uuid    primary key default gen_random_uuid(),
  document_id  uuid    references public.agent_documents(id) on delete cascade not null,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  chunk_index  integer not null,
  content      text    not null,
  embedding    vector(1536),        -- null until OPENAI_API_KEY is set
  created_at   timestamptz default now()
);

alter table public.agent_document_chunks enable row level security;

drop policy if exists "owner_all_chunks" on public.agent_document_chunks;
create policy "owner_all_chunks" on public.agent_document_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_chunks_document_id
  on public.agent_document_chunks(document_id);

create index if not exists idx_chunks_user_id
  on public.agent_document_chunks(user_id);

-- HNSW index: approximate nearest-neighbor, no need to tune lists size.
-- Will be empty until rows have embeddings — that is fine.
create index if not exists idx_chunks_embedding_hnsw
  on public.agent_document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ── RPC: similarity search ───────────────────────────────────────────────────
-- Called by the chat route to retrieve the most relevant chunks for a query.
create or replace function match_agent_chunks(
  p_user_id  uuid,
  p_embedding vector(1536),
  p_top_k    integer default 6
)
returns table (content text, similarity float)
language sql stable
set search_path = public
as $$
  select
    content,
    1 - (embedding <=> p_embedding) as similarity
  from public.agent_document_chunks
  where user_id  = p_user_id
    and embedding is not null
  order by embedding <=> p_embedding
  limit p_top_k;
$$;

-- ── Agent requests (quota tracking, analytics, billing) ─────────────────────
-- Logged by the Edge Function on every chat request.
-- Service role only — RLS blocks all direct client access.

create table if not exists public.agent_requests (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        references public.profiles(id) on delete cascade not null,
  messages_count integer     not null default 1,
  tokens_used    integer,                    -- populated once Claude reports usage
  model          text,
  created_at     timestamptz default now()
);

alter table public.agent_requests enable row level security;

-- Deny all direct client access; only the service-role key (Edge Function) can write.
drop policy if exists "no_direct_client_access_agent_requests" on public.agent_requests;
create policy "no_direct_client_access_agent_requests"
  on public.agent_requests for all
  using (false) with check (false);

-- Rolling 24-hour quota check: count by profile + recency.
create index if not exists idx_agent_requests_quota
  on public.agent_requests(profile_id, created_at desc);

-- ============================================================
-- Performance indexes (critical for scale)
-- Run these once; all are idempotent via CREATE INDEX IF NOT EXISTS
-- ============================================================

-- Explore page: public spaces ordered by recency
create index if not exists idx_spaces_public_created
  on public.spaces(created_at desc)
  where is_public = true;

-- Dashboard & profile page: spaces by owner
create index if not exists idx_spaces_user_id
  on public.spaces(user_id);

-- Liked-spaces lookup per user
create index if not exists idx_space_likes_user_id
  on public.space_likes(user_id);

-- Default-collection lookup (used on every authenticated page)
create index if not exists idx_collections_user_default
  on public.collections(user_id, is_default);

-- Spaces inside a collection
create index if not exists idx_collection_spaces_collection_id
  on public.collection_spaces(collection_id);

-- =====================================================
-- Follows
-- =====================================================

-- Add follower/following counters to profiles
alter table public.profiles add column if not exists followers_count integer default 0;
alter table public.profiles add column if not exists following_count integer default 0;

-- Follows join table
create table if not exists public.user_follows (
  id          uuid default gen_random_uuid() primary key,
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

create index if not exists user_follows_follower_id_idx on public.user_follows(follower_id);
create index if not exists user_follows_following_id_idx on public.user_follows(following_id);

alter table public.user_follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.user_follows;
create policy "Follows are viewable by everyone"
  on public.user_follows for select using (true);

drop policy if exists "Users can follow others" on public.user_follows;
create policy "Users can follow others"
  on public.user_follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow" on public.user_follows;
create policy "Users can unfollow"
  on public.user_follows for delete using (auth.uid() = follower_id);

-- Trigger: keep followers_count / following_count in sync
create or replace function public.update_follow_counts()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = NEW.following_id;
    update public.profiles set following_count  = following_count  + 1 where id = NEW.follower_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles set followers_count = greatest(0, followers_count - 1) where id = OLD.following_id;
    update public.profiles set following_count  = greatest(0, following_count  - 1) where id = OLD.follower_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_follow_counts() from public, anon, authenticated;

drop trigger if exists on_follow_change on public.user_follows;
create trigger on_follow_change
  after insert or delete on public.user_follows
  for each row execute function public.update_follow_counts();

-- Feed index: quickly fetch public spaces for a set of user_ids
create index if not exists idx_spaces_user_id_public_created
  on public.spaces(user_id, created_at desc)
  where is_public = true;

-- =====================================================
-- Comments
-- =====================================================

alter table public.spaces add column if not exists comments_count integer default 0;

create table if not exists public.space_comments (
  id         uuid default gen_random_uuid() primary key,
  space_id   uuid references public.spaces(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  parent_id  uuid references public.space_comments(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  likes_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.comment_likes (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.space_comments(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, comment_id)
);

-- comment_mentions: indexed for future notifications, populated at insert time
create table if not exists public.comment_mentions (
  id                  uuid default gen_random_uuid() primary key,
  comment_id          uuid references public.space_comments(id) on delete cascade not null,
  mentioned_user_id   uuid references public.profiles(id) on delete cascade not null
);

-- Indexes
create index if not exists idx_space_comments_space_toplevel
  on public.space_comments(space_id, created_at asc)
  where parent_id is null;

create index if not exists idx_space_comments_parent_id
  on public.space_comments(parent_id, created_at asc)
  where parent_id is not null;

create index if not exists idx_comment_likes_user_id
  on public.comment_likes(user_id);

create index if not exists idx_comment_mentions_user
  on public.comment_mentions(mentioned_user_id);

-- RLS
alter table public.space_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_mentions enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.space_comments;
create policy "Comments are viewable by everyone"
  on public.space_comments for select using (true);

drop policy if exists "Authenticated users can comment" on public.space_comments;
create policy "Authenticated users can comment"
  on public.space_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.space_comments;
create policy "Users can delete their own comments"
  on public.space_comments for delete
  using (auth.uid() = user_id);

drop policy if exists "Comment likes are viewable by everyone" on public.comment_likes;
create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select using (true);

drop policy if exists "Users can like comments" on public.comment_likes;
create policy "Users can like comments"
  on public.comment_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike comments" on public.comment_likes;
create policy "Users can unlike comments"
  on public.comment_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Comment mentions are viewable by everyone" on public.comment_mentions;
create policy "Comment mentions are viewable by everyone"
  on public.comment_mentions for select using (true);

drop policy if exists "System can insert mentions" on public.comment_mentions;
create policy "System can insert mentions"
  on public.comment_mentions for insert
  with check (
    exists (
      select 1 from public.space_comments c
      where c.id = comment_id and c.user_id = auth.uid()
    )
  );

-- Trigger: keep comment likes_count in sync
create or replace function public.update_comment_likes_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.space_comments set likes_count = likes_count + 1 where id = NEW.comment_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.space_comments set likes_count = greatest(0, likes_count - 1) where id = OLD.comment_id;
    return OLD;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_comment_likes_count() from public, anon, authenticated;

drop trigger if exists on_comment_like_change on public.comment_likes;
create trigger on_comment_like_change
  after insert or delete on public.comment_likes
  for each row execute procedure public.update_comment_likes_count();

-- Trigger: keep spaces.comments_count in sync (counts all comments + replies)
create or replace function public.update_space_comments_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.spaces set comments_count = comments_count + 1 where id = NEW.space_id;
  elsif TG_OP = 'DELETE' then
    update public.spaces set comments_count = greatest(0, comments_count - 1) where id = OLD.space_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_space_comments_count() from public, anon, authenticated;

drop trigger if exists on_comment_change on public.space_comments;
create trigger on_comment_change
  after insert or delete on public.space_comments
  for each row execute function public.update_space_comments_count();

-- =====================================================
-- Space Views / Analytics
-- =====================================================

-- Denormalized view counter on spaces
alter table public.spaces add column if not exists views_count integer default 0;

-- Raw view events
-- viewed_date is a plain date column (not generated) so the unique index is IMMUTABLE-safe.
-- The server action populates it at insert time using UTC date.
create table if not exists public.space_views (
  id          uuid default gen_random_uuid() primary key,
  space_id    uuid references public.spaces(id) on delete cascade not null,
  viewer_id   uuid references public.profiles(id) on delete set null,
  viewed_at   timestamptz default now() not null,
  viewed_date date not null default current_date
);

-- Performance indexes
create index if not exists idx_space_views_space_id
  on public.space_views(space_id);
create index if not exists idx_space_views_space_viewed_at
  on public.space_views(space_id, viewed_at desc);

-- One view per logged-in user per space per day (prevents self-inflation)
create unique index if not exists idx_space_views_unique_user_day
  on public.space_views(space_id, viewer_id, viewed_date)
  where viewer_id is not null;

alter table public.space_views enable row level security;

-- Anyone (including anon) can insert a view
drop policy if exists "Anyone can record a space view" on public.space_views;
create policy "Anyone can record a space view"
  on public.space_views for insert
  with check (true);

-- Only the space owner can read their space's view data
drop policy if exists "Space owners can read their own space views" on public.space_views;
create policy "Space owners can read their own space views"
  on public.space_views for select
  using (
    exists (
      select 1 from public.spaces s
      where s.id = space_id and s.user_id = auth.uid()
    )
  );

-- Trigger: keep views_count in sync
create or replace function public.update_views_count()
returns trigger as $$
begin
  update public.spaces set views_count = views_count + 1 where id = NEW.space_id;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_views_count() from public, anon, authenticated;

drop trigger if exists on_space_view on public.space_views;
create trigger on_space_view
  after insert on public.space_views
  for each row execute procedure public.update_views_count();

-- =====================================================
-- Notifications
-- =====================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('new_comment', 'new_reply', 'comment_mention')),
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert"
  on public.notifications for insert
  with check (auth.uid() is not null);

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- Enable Realtime for live bell updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ============================================================
-- WhatsApp / Phone identity helper
-- ============================================================

-- Returns the user ID for a verified phone number, or NULL if not found.
-- Used by the WhatsApp webhook to identify callers without exposing auth.users.
create or replace function public.get_user_id_by_verified_phone(phone_number text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id
  from auth.users
  where replace(phone, '+', '') = replace(phone_number, '+', '')
    and phone_confirmed_at is not null
  limit 1;
$$;

revoke execute on function public.get_user_id_by_verified_phone(text) from anon, authenticated;
grant  execute on function public.get_user_id_by_verified_phone(text) to service_role;

-- ============================================================
-- Credits System
-- Replaces the binary free/pro plan_tier with a credits economy.
--
-- Two buckets per user:
--   free_space_credits — granted on signup, space-publish only
--   paid_credits       — bought via Stripe, spendable on spaces OR LLM
--
-- All credit movements are recorded in credit_ledger (append-only).
-- All mutations go through SECURITY DEFINER RPCs — no direct writes.
-- ============================================================

-- ----- Credits: profile columns ---------------------------------------------
-- Must come first — RLS policies on later tables (app_settings, credit_packs,
-- llm_models, credit_ledger) all reference profiles.is_admin.

alter table public.profiles
  add column if not exists free_space_credits int not null default 0;
alter table public.profiles
  add column if not exists paid_credits int not null default 0;
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ----- app_settings: admin-tunable knobs ------------------------------------
-- Read by triggers and server code at runtime. Edited from nandzz-admin.
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Anyone reads settings" on public.app_settings;
create policy "Anyone reads settings"
  on public.app_settings for select
  using (true);

drop policy if exists "Admins manage settings" on public.app_settings;
create policy "Admins manage settings"
  on public.app_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Seed defaults (idempotent).
insert into public.app_settings (key, value, description) values
  ('signup_credit_grant',
   jsonb_build_object('amount', 100),
   'Free credits granted to new signups (deposited in the free_space bucket).')
on conflict (key) do nothing;

insert into public.app_settings (key, value, description) values
  ('publish_space_cost',
   jsonb_build_object('amount', 10),
   'Credits deducted when a user publishes a space. Free credits are spent first, then paid.')
on conflict (key) do nothing;

-- ----- credit_ledger -------------------------------------------------------

create table if not exists public.credit_ledger (
  id                       bigserial primary key,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  delta                    int not null,
  bucket                   text not null check (bucket in ('free_space', 'paid')),
  reason                   text not null check (reason in (
                             'signup_grant',
                             'admin_grant',
                             'admin_revoke',
                             'stripe_purchase',
                             'publish_space',
                             'llm_agent_chat',
                             'llm_page_editor',
                             'refund',
                             'backfill'
                           )),
  balance_after_free       int not null,
  balance_after_paid       int not null,
  stripe_event_id          text,
  stripe_payment_intent_id text,
  related_entity_type      text,
  related_entity_id        text,
  metadata                 jsonb not null default '{}',
  created_at               timestamptz not null default now()
);

create unique index if not exists credit_ledger_stripe_event_uniq
  on public.credit_ledger(stripe_event_id)
  where stripe_event_id is not null;

create index if not exists credit_ledger_user_created
  on public.credit_ledger(user_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists "Users read their own ledger" on public.credit_ledger;
create policy "Users read their own ledger"
  on public.credit_ledger for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
-- No INSERT/UPDATE/DELETE policy — writes only via SECURITY DEFINER RPCs.

-- ----- credit_packs --------------------------------------------------------

create table if not exists public.credit_packs (
  id                uuid primary key default gen_random_uuid(),
  stripe_product_id text,
  stripe_price_id   text,
  name              text not null,
  credits           int not null check (credits > 0),
  price_cents       int not null check (price_cents >= 0),
  currency          text not null default 'usd',
  sort_order        int not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists credit_packs_active_sort
  on public.credit_packs(sort_order)
  where active = true;

alter table public.credit_packs enable row level security;

drop policy if exists "Active packs visible to all" on public.credit_packs;
create policy "Active packs visible to all"
  on public.credit_packs for select
  using (active = true);

drop policy if exists "Admins manage packs" on public.credit_packs;
create policy "Admins manage packs"
  on public.credit_packs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ----- llm_models ----------------------------------------------------------

create table if not exists public.llm_models (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null,
  model_id               text not null,
  display_name           text not null,
  -- Per-1k tokens, fractional. e.g. 0.0300 means each 1000 input tokens costs 0.03 credits.
  input_credits_per_1k   numeric(10, 4) not null,
  output_credits_per_1k  numeric(10, 4) not null,
  -- Default model for a given role. Nullable — only one active default per role.
  default_for_role       text check (default_for_role in ('agent_chat', 'page_editor')),
  active                 boolean not null default true,
  sort_order             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (provider, model_id)
);

-- Only one active default per role at a time.
create unique index if not exists llm_models_default_role_uniq
  on public.llm_models(default_for_role)
  where default_for_role is not null and active = true;

alter table public.llm_models enable row level security;

drop policy if exists "Active models visible to all" on public.llm_models;
create policy "Active models visible to all"
  on public.llm_models for select
  using (active = true);

drop policy if exists "Admins manage models" on public.llm_models;
create policy "Admins manage models"
  on public.llm_models for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Seed launch models — 3× markup on raw OpenAI/Anthropic cost at 100 credits = $1.
-- gpt-4.1-nano: $0.10/M in, $0.40/M out → 0.03/1k in, 0.12/1k out.
-- claude-sonnet-4-6: ~$3/M in, ~$15/M out → 0.90/1k in, 4.50/1k out. Seeded inactive
--   until the page-editor call site is wired.
insert into public.llm_models (provider, model_id, display_name, input_credits_per_1k, output_credits_per_1k, default_for_role, active, sort_order)
values
  ('openai',    'gpt-4.1-nano',       'GPT-4.1 Nano',      0.0300, 0.1200, 'agent_chat',  true,  10),
  ('anthropic', 'claude-sonnet-4-6',  'Claude Sonnet 4.6', 0.9000, 4.5000, 'page_editor', false, 20)
on conflict (provider, model_id) do nothing;

-- ----- llm_usage -----------------------------------------------------------

create table if not exists public.llm_usage (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  model_id        uuid not null references public.llm_models(id) on delete restrict,
  role            text not null check (role in ('agent_chat', 'page_editor')),
  input_tokens    int not null check (input_tokens >= 0),
  output_tokens   int not null check (output_tokens >= 0),
  credits_charged int not null check (credits_charged >= 0),
  message_id      text,
  request_id      uuid,
  space_id        uuid references public.spaces(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists llm_usage_user_created
  on public.llm_usage(user_id, created_at desc);
create index if not exists llm_usage_model_created
  on public.llm_usage(model_id, created_at desc);
-- Idempotency: same request_id should not double-charge.
create unique index if not exists llm_usage_request_uniq
  on public.llm_usage(request_id)
  where request_id is not null;

alter table public.llm_usage enable row level security;

drop policy if exists "Users read their own usage" on public.llm_usage;
create policy "Users read their own usage"
  on public.llm_usage for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ----- spaces: client_request_id for idempotent publish --------------------

alter table public.spaces
  add column if not exists client_request_id uuid;
create unique index if not exists spaces_client_request_uniq
  on public.spaces(user_id, client_request_id)
  where client_request_id is not null;

-- ----- RPCs ----------------------------------------------------------------

-- Publish a space and deduct credits atomically.
-- Returns the new space row + remaining balances.
-- p_cost = NULL → read app_settings.publish_space_cost (admin-tunable).
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

  -- Lock the profile row to serialize concurrent publishes.
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

-- Refuse the LLM call early if user has fewer than p_min paid_credits.
create or replace function public.assert_min_credits(
  p_user_id uuid,
  p_min     int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid int;
begin
  select paid_credits into v_paid from public.profiles where id = p_user_id;
  if v_paid is null then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;
  if v_paid < p_min then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_min_credits(uuid, int) from public;
grant execute on function public.assert_min_credits(uuid, int) to authenticated, service_role;

-- Charge for an LLM call after the response is known. Best-effort —
-- a small overdraft is allowed because we already paid the vendor.
create or replace function public.charge_llm_usage(
  p_user_id       uuid,
  p_model_id      uuid,
  p_role          text,
  p_input_tokens  int,
  p_output_tokens int,
  p_message_id    text,
  p_request_id    uuid,
  p_space_id      uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model         public.llm_models%rowtype;
  v_credits       int;
  v_profile       public.profiles%rowtype;
  v_new_paid      int;
  v_ledger_reason text;
begin
  if p_role not in ('agent_chat', 'page_editor') then
    raise exception 'invalid role' using errcode = 'P0001';
  end if;

  -- Idempotency: if this request_id is already charged, return 0 and do nothing.
  if p_request_id is not null
     and exists (select 1 from public.llm_usage where request_id = p_request_id) then
    return 0;
  end if;

  select * into v_model from public.llm_models where id = p_model_id;
  if not found then
    raise exception 'model not found' using errcode = 'P0001';
  end if;

  v_credits := ceil(
    (p_input_tokens::numeric  / 1000.0) * v_model.input_credits_per_1k
  + (p_output_tokens::numeric / 1000.0) * v_model.output_credits_per_1k
  )::int;
  if v_credits < 0 then v_credits := 0; end if;

  v_ledger_reason := case p_role
    when 'agent_chat'  then 'llm_agent_chat'
    when 'page_editor' then 'llm_page_editor'
  end;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_new_paid := v_profile.paid_credits - v_credits;

  update public.profiles set paid_credits = v_new_paid where id = p_user_id;

  insert into public.llm_usage (
    user_id, model_id, role, input_tokens, output_tokens, credits_charged,
    message_id, request_id, space_id
  ) values (
    p_user_id, p_model_id, p_role, p_input_tokens, p_output_tokens, v_credits,
    p_message_id, p_request_id, p_space_id
  );

  insert into public.credit_ledger (
    user_id, delta, bucket, reason,
    balance_after_free, balance_after_paid,
    related_entity_type, related_entity_id, metadata
  ) values (
    p_user_id, -v_credits, 'paid', v_ledger_reason,
    v_profile.free_space_credits, v_new_paid,
    'llm_usage', p_request_id::text,
    jsonb_build_object(
      'model_id', p_model_id,
      'model', v_model.provider || '/' || v_model.model_id,
      'input_tokens', p_input_tokens,
      'output_tokens', p_output_tokens
    )
  );

  return v_credits;
end;
$$;

revoke all on function public.charge_llm_usage(uuid, uuid, text, int, int, text, uuid, uuid) from public;
grant execute on function public.charge_llm_usage(uuid, uuid, text, int, int, text, uuid, uuid) to service_role;

-- Grant credits — used by Stripe webhook AND admin grant flow.
-- Idempotent on stripe_event_id.
create or replace function public.grant_credits(
  p_user_id          uuid,
  p_bucket           text,
  p_amount           int,
  p_reason           text,
  p_stripe_event_id  text default null,
  p_payment_intent_id text default null,
  p_metadata         jsonb default '{}'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_new_free int;
  v_new_paid int;
begin
  if p_bucket not in ('free_space', 'paid') then
    raise exception 'invalid bucket' using errcode = 'P0001';
  end if;
  if p_amount = 0 then
    return false;
  end if;
  if p_reason not in (
    'signup_grant','admin_grant','admin_revoke','stripe_purchase','refund','backfill'
  ) then
    raise exception 'invalid reason' using errcode = 'P0001';
  end if;

  if p_stripe_event_id is not null
     and exists (select 1 from public.credit_ledger where stripe_event_id = p_stripe_event_id) then
    return false;
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_new_free := v_profile.free_space_credits;
  v_new_paid := v_profile.paid_credits;

  if p_bucket = 'free_space' then
    v_new_free := v_new_free + p_amount;
  else
    v_new_paid := v_new_paid + p_amount;
  end if;

  -- admin_revoke must not drive the touched bucket negative. Refunds are
  -- allowed to — that's by design when a paid charge is reversed. Only the
  -- bucket being moved is checked, because the other bucket may already be
  -- negative from a prior refund and shouldn't block an unrelated revoke.
  if p_reason = 'admin_revoke'
     and (
       (p_bucket = 'free_space' and v_new_free < 0)
       or (p_bucket = 'paid' and v_new_paid < 0)
     ) then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  if p_bucket = 'free_space' then
    update public.profiles set free_space_credits = v_new_free where id = p_user_id;
  else
    update public.profiles set paid_credits = v_new_paid where id = p_user_id;
  end if;

  insert into public.credit_ledger (
    user_id, delta, bucket, reason,
    balance_after_free, balance_after_paid,
    stripe_event_id, stripe_payment_intent_id, metadata
  ) values (
    p_user_id, p_amount, p_bucket, p_reason,
    v_new_free, v_new_paid,
    p_stripe_event_id, p_payment_intent_id, coalesce(p_metadata, '{}'::jsonb)
  );

  return true;
end;
$$;

revoke all on function public.grant_credits(uuid, text, int, text, text, text, jsonb) from public;
grant execute on function public.grant_credits(uuid, text, int, text, text, text, jsonb) to service_role;


-- ============================================================
-- Monetisation audit fixes
-- ============================================================

-- ----- claim_signup_profile: OAuth signup grant ---------------------------
-- The handle_new_user trigger only fires for email/password signups where
-- raw_user_meta_data carries the chosen username. OAuth (Google, etc.) lands
-- on /setup-username where the user picks a name client-side — that flow used
-- to insert directly into profiles and skipped the welcome grant entirely.
-- This RPC routes OAuth signup through the same grant logic the trigger uses.
create or replace function public.claim_signup_profile(
  p_username     text,
  p_display_name text default null
)
returns table (
  profile_id         uuid,
  free_space_credits int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_grant    int  := 100;
  v_existing public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_username is null
     or length(p_username) < 3 or length(p_username) > 30
     or p_username !~ '^[a-z0-9_-]+$' then
    raise exception 'INVALID_USERNAME' using errcode = 'P0001';
  end if;

  -- Idempotency: a user who refreshes mid-claim shouldn't be granted twice.
  select * into v_existing from public.profiles where id = v_uid;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.free_space_credits;
    return;
  end if;

  select coalesce((value->>'amount')::int, 100) into v_grant
  from public.app_settings where key = 'signup_credit_grant';
  v_grant := coalesce(v_grant, 100);
  if v_grant < 0 then v_grant := 0; end if;

  begin
    insert into public.profiles (id, username, display_name, free_space_credits)
    values (
      v_uid,
      p_username,
      coalesce(nullif(p_display_name, ''), p_username),
      v_grant
    );
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
  end;

  if v_grant > 0 then
    insert into public.credit_ledger (
      user_id, delta, bucket, reason,
      balance_after_free, balance_after_paid, metadata
    ) values (
      v_uid, v_grant, 'free_space', 'signup_grant',
      v_grant, 0, jsonb_build_object('source', 'oauth_setup')
    );
  end if;

  return query select v_uid, v_grant;
end;
$$;

revoke all on function public.claim_signup_profile(text, text) from public;
grant execute on function public.claim_signup_profile(text, text) to authenticated;

-- ----- assert_chat_rate_limit: per-IP+per-owner throttle ------------------
-- Agent chat bills the profile owner regardless of who's chatting. Without a
-- throttle anyone on the internet can drain an owner's paid_credits. This is
-- a simple fixed-window counter keyed by `ip:profile_id` (or similar).
create table if not exists public.chat_rate_limits (
  key          text        primary key,
  count        int         not null default 0,
  window_start timestamptz not null default now()
);

alter table public.chat_rate_limits enable row level security;
-- No client policies — service role only.
drop policy if exists "no_client_access_chat_rate_limits" on public.chat_rate_limits;
create policy "no_client_access_chat_rate_limits"
  on public.chat_rate_limits for all
  using (false) with check (false);

create or replace function public.assert_chat_rate_limit(
  p_key            text,
  p_max            int,
  p_window_seconds int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.chat_rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when public.chat_rate_limits.window_start
               < v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.chat_rate_limits.count + 1
        end,
        window_start = case
          when public.chat_rate_limits.window_start
               < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.chat_rate_limits.window_start
        end
  returning count into v_count;

  if v_count > p_max then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

revoke all on function public.assert_chat_rate_limit(text, int, int) from public;
grant execute on function public.assert_chat_rate_limit(text, int, int) to service_role;

-- Defaults for the throttle. Admin-tunable via app_settings.
insert into public.app_settings (key, value, description) values
  ('chat_rate_limit',
   jsonb_build_object('per_ip_per_owner_hourly', 30, 'per_owner_hourly', 240),
   'Hourly chat caps to prevent owner-credit drain abuse.')
on conflict (key) do nothing;

-- ----- save_llm_model: atomic default-role swap --------------------------
-- The llm_models_default_role_uniq partial index rejects any UPDATE that lands
-- two active rows as default for the same role. Switching defaults needed two
-- manual edits with a unique-violation in between. This RPC clears the old
-- default and writes the new row in one transaction.
create or replace function public.save_llm_model(
  p_id                   uuid,
  p_display_name         text,
  p_input_credits_per_1k numeric,
  p_output_credits_per_1k numeric,
  p_default_for_role     text,
  p_active               boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_default_for_role is not null
     and p_default_for_role not in ('agent_chat', 'page_editor') then
    raise exception 'invalid role' using errcode = 'P0001';
  end if;

  -- Clear any other active row that holds the same role default. Keeps the
  -- partial unique index happy during the swap.
  if p_default_for_role is not null and p_active then
    update public.llm_models
       set default_for_role = null,
           updated_at       = now()
     where default_for_role = p_default_for_role
       and id <> p_id
       and active = true;
  end if;

  update public.llm_models
     set display_name           = p_display_name,
         input_credits_per_1k   = p_input_credits_per_1k,
         output_credits_per_1k  = p_output_credits_per_1k,
         default_for_role       = p_default_for_role,
         active                 = p_active,
         updated_at             = now()
   where id = p_id;
end;
$$;

revoke all on function public.save_llm_model(uuid, text, numeric, numeric, text, boolean) from public;
grant execute on function public.save_llm_model(uuid, text, numeric, numeric, text, boolean) to service_role;

-- Existing users keep their default 0 balance. Only new signups get the
-- welcome grant (via the handle_new_user trigger for email signups, and via
-- claim_signup_profile for OAuth signups). If you ever want to retroactively
-- credit existing users, do it from the admin dashboard (Users → Grant credits).
--
-- NOTE: plan_tier column is intentionally NOT dropped yet.
-- Drop it in a follow-up edit after all UI references are removed and deployed.
