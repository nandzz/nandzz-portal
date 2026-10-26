-- Business Agent knowledge = the existing agent documents + semantic search,
-- the same pipeline the old agent chat uses (agent_documents → embed-document
-- edge function → agent_document_chunks, text-embedding-3-small, HNSW). The
-- separate agent_knowledge table with keyword search goes away.
-- Customers only ever see PUBLIC, ACTIVE documents.

-- 1. Move the knowledge entries into agent_documents (embedded afterwards by
--    the embed-document edge function).
insert into public.agent_documents (user_id, title, content, visibility, status, created_at, updated_at)
select owner_user_id, title, body, 'public', 'active', created_at, updated_at
from public.agent_knowledge;

drop function if exists agent_api.search_knowledge(text, text);
drop table public.agent_knowledge;

-- 2. Semantic search. The worker embeds the customer's question (same model)
--    and passes it as a JSON array. Below the similarity floor, or without an
--    embedding, the agent gets the business's whole public knowledge instead
--    (same fallback as agent-chat), capped so the prompt stays small.
create or replace function agent_api.search_knowledge(p_token text, p_query text, p_embedding text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc       record;
  emb      public.vector(1536);
  best     float;
  hits     jsonb;
  floor_   constant float := 0.35;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'search_knowledge');

  if p_embedding is not null then
    emb := p_embedding::public.vector(1536);
    select coalesce(jsonb_agg(jsonb_build_object('content', h.content, 'similarity', round(h.similarity::numeric, 3))
                              order by h.similarity desc), '[]'::jsonb),
           max(h.similarity)
    into hits, best
    from (
      select c.content, 1 - (c.embedding operator(public.<=>) emb) as similarity
      from public.agent_document_chunks c
      join public.agent_documents d on d.id = c.document_id
      where c.user_id = sc.owner_user_id
        and d.visibility = 'public' and d.status = 'active'
        and c.embedding is not null
      order by c.embedding operator(public.<=>) emb
      limit 6
    ) h;
    if best >= floor_ then
      return jsonb_build_object('mode', 'matches', 'results', hits);
    end if;
  end if;

  return jsonb_build_object('mode', 'all', 'results', coalesce((
    select jsonb_agg(jsonb_build_object('title', d.title, 'content', left(d.content, 4000))
                     order by d.sort_order, d.created_at)
    from (
      select title, content, sort_order, created_at
      from public.agent_documents
      where user_id = sc.owner_user_id and visibility = 'public' and status = 'active'
      order by sort_order, created_at
      limit 30
    ) d
  ), '[]'::jsonb));
end;
$$;

revoke all on function agent_api.search_knowledge(text, text, text) from public, anon, authenticated;
grant execute on function agent_api.search_knowledge(text, text, text) to agent_runtime;
