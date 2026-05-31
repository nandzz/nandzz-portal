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
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if new.raw_user_meta_data->>'username' is not null then
    insert into public.profiles (id, username, display_name)
    values (
      new.id,
      new.raw_user_meta_data->>'username',
      coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Storage buckets
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
$$ language plpgsql security definer;

drop trigger if exists on_like_change on public.space_likes;
create trigger on_like_change
  after insert or delete on public.space_likes
  for each row execute procedure public.update_likes_count();

-- 9. Collections

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

drop table if exists public.agent_document_chunks cascade;
drop table if exists public.agent_documents cascade;
create table public.agent_documents (
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

create policy "owner_all_agent_docs" on public.agent_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-update updated_at on every row modification.
create or replace function public.agent_documents_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create table public.agent_document_chunks (
  id           uuid    primary key default gen_random_uuid(),
  document_id  uuid    references public.agent_documents(id) on delete cascade not null,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  chunk_index  integer not null,
  content      text    not null,
  embedding    vector(1536),        -- null until OPENAI_API_KEY is set
  created_at   timestamptz default now()
);

alter table public.agent_document_chunks enable row level security;

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
