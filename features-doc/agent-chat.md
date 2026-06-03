# Agent Chat

A personal AI agent for each Nandzz profile. Visitors can ask questions about the profile owner; the agent answers strictly from the owner's published documents.

---

## Where documents live

Documents are **rows in Supabase**, not files on disk.

| Table | What it stores |
|---|---|
| `agent_documents` | The document rows (title, content, visibility, status, sort_order, …) |
| `agent_document_chunks` | Chunks derived from each document, with OpenAI embeddings for RAG |

The document title (e.g. `me.md`, `soul.md`) is a display label — it has no filesystem meaning. Nothing is ever written to disk.

The `src/lib/agent/templates.ts` file contains starter-content strings (the template bodies) that pre-fill the editor when the owner clicks "Use template". These are static — bundled with the app, never modified.

---

## System prompts

Two prompts live in `supabase/functions/agent-chat/prompts.ts`:

| Template | Used when | Behaviour |
|---|---|---|
| `VISITOR_TEMPLATE` | Public visitors | Strict representative mode. Agent answers only from documents, uses third-person language ("Felipe has shared…"), refuses to speculate or reveal internals. |
| `OWNER_TEMPLATE` | Profile owner (advisor mode) | Personal knowledge advisor. Speaks directly to the owner. Proactively suggests capturing conversation content into documents. Warns about sensitive/private information. Answers questions about the full knowledge base. Never simulates visitor experience unless explicitly asked. Quota is not consumed. Full document injection always (no RAG) so the advisor has the complete picture. |

Both templates use two `{{placeholders}}`:
- `{{name}}` — replaced with `display_name` (or `username` if unset)
- `{{documents}}` — replaced with the injected document content

---

## Chat flow

```
Browser
  └─ AgentChat.tsx
       └─ POST /api/agent/chat   { messages, username }
            └─ route.ts (Next.js proxy)
                 │  resolves mode server-side:
                 │    user.id === profile.id  → "owner"
                 │    otherwise               → "visitor"
                 └─ POST /functions/v1/agent-chat  { messages, username, mode }
                      └─ Supabase Edge Function (Deno)
                           1. Profile lookup
                           2. Quota check (visitors only)
                           3. RAG retrieval (OpenAI embeddings → match_agent_chunks)
                              └─ Fallback: full-document injection
                           4. Build system prompt (visitor or owner template)
                           5. Stream Claude response (claude-haiku-4-5)
                           6. Log to agent_requests (visitors only)
```

### Mode is server-side only

`mode` is **never trusted from the client**. The Next.js proxy (`/api/agent/chat/route.ts`) resolves it by checking the authenticated session against the profile owner. This prevents visitors from sending `"mode":"owner"` to bypass the quota.

---

## Owner setup flow (AgentStudio)

```
/{username}/agent  →  AgentStudio
  ├─ Left panel: Knowledge
  │    Document list + editor
  │    Save → POST /api/agent/documents (or PUT for updates)
  │              └─ fire-and-forget: POST /api/agent/documents/{id}/embed
  │                   chunks document → batch embeds with OpenAI → inserts agent_document_chunks
  └─ Right panel: Agent Guide (SetupAssistant)
       Rule-based chat that helps the owner write good documents
       Calls /api/agent/setup-chat (no LLM — keyword-matched responses)
```

Owner preview: `/{username}/agent/preview` — auth-gated, redirects to public page if not the owner. Renders `AgentPublic` with an "owner preview" banner. Sends to the same chat endpoint; proxy sets `mode = "owner"`.

---

## RAG pipeline

1. **Chunking** (`src/lib/agent/chunker.ts`): splits on markdown headers, then paragraph breaks if a section exceeds ~375 words. Every chunk is prefixed with `[document title]` so the LLM knows the source.
2. **Embedding** (`src/lib/agent/embeddings.ts`): calls `text-embedding-3-small` (1536 dimensions). Batched for efficiency.
3. **Retrieval**: The edge function embeds the user's last message, calls `match_agent_chunks` RPC (cosine similarity, top-6). Falls back to full-document injection if no embeddings exist or the query returns no results.

---

## Quota

| Plan | Daily messages (24h rolling) |
|---|---|
| free | 50 |
| pro | 1 000 |

Quota only applies to visitor mode. Owner previews are never counted or logged.

---

## File map

```
src/
  app/
    api/agent/
      chat/route.ts              — proxy, resolves mode server-side
      documents/route.ts         — GET list, POST create
      documents/[id]/route.ts    — PUT update, DELETE
      documents/[id]/embed/      — POST chunk+embed a document
      setup-chat/route.ts        — rule-based setup assistant (no LLM)
    [username]/agent/
      page.tsx                   — AgentStudio (owner only)
      preview/page.tsx           — owner preview (auth-gated)
  components/agent/
    AgentChat.tsx                — chat UI (used by both public + preview)
    AgentPublic.tsx              — public-facing layout wrapper
    AgentStudio.tsx              — owner editor + guide layout
    SetupAssistant.tsx           — guide panel chat UI
  lib/agent/
    chunker.ts                   — markdown → chunks
    embeddings.ts                — OpenAI embedding helpers
    templates.ts                 — starter document content strings

supabase/functions/agent-chat/
  index.ts                       — edge function handler
  prompts.ts                     — VISITOR_TEMPLATE, OWNER_TEMPLATE, build helpers
```
