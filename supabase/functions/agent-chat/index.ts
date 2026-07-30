import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFromDocs, buildFromChunks } from "./prompts.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROPOSE_DOCUMENT_TOOL = {
  type: "function",
  function: {
    name: "propose_document",
    description:
      "Propose creating a new knowledge document OR updating an existing one. Use this when the owner shares information that should be saved. If the information belongs in an existing document (e.g. adding a hobby to an existing hobbies.md, extending work experience already in work.md), pass the document_id of that document and rewrite its full content — never create a duplicate. Only omit document_id when the topic genuinely needs its own new file.",
    parameters: {
      type: "object",
      properties: {
        document_id: {
          type: "string",
          description: "The ID of an existing document to update. Omit entirely when creating a new document.",
        },
        title: {
          type: "string",
          description: "Document filename with .md extension, e.g. 'me.md' or 'projects.md'",
        },
        content: {
          type: "string",
          description: "Complete markdown content for the document, ready to save as-is",
        },
        reason: {
          type: "string",
          description: "One sentence explaining why this document improves the knowledge base",
        },
      },
      required: ["title", "content", "reason"],
    },
  },
};

// ─── Embedding (OpenAI) ───────────────────────────────────────────────────────

async function embedText(text: string, apiKey: string, rid: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "<no-body>");
      console.error(`[agent-chat][${rid}] embed http ${res.status}: ${errText.slice(0, 300)}`);
      return null;
    }
    const json = await res.json();
    const emb = json.data?.[0]?.embedding ?? null;
    if (!emb) console.error(`[agent-chat][${rid}] embed returned no embedding: ${JSON.stringify(json).slice(0, 300)}`);
    return emb;
  } catch (err) {
    console.error(`[agent-chat][${rid}] embed threw:`, err);
    return null;
  }
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

const STREAM_HEADERS = {
  ...CORS,
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
};

function jsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

function streamText(text: string): Response {
  const words = text.split(" ");
  const stream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(jsonLine({ content: word + " " }));
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.enqueue(jsonLine({ done: true }));
      controller.close();
    },
  });
  return new Response(stream, { headers: STREAM_HEADERS });
}

type UsageReport = { input: number; output: number };
type ChargeContext = {
  // deno-lint-ignore no-explicit-any
  admin: any;
  userId: string;
  modelId: string;
  modelIdForApi: string;
  role: "agent_chat" | "page_editor";
  requestId: string;
  rid: string;
};

async function streamOpenAI(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  ownerMode: boolean,
  charge: ChargeContext
): Promise<Response> {
  const openAIMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const body: Record<string, unknown> = {
    model: charge.modelIdForApi,
    // Owner mode needs more tokens to draft full document content.
    max_tokens: ownerMode ? 2048 : 1024,
    messages: openAIMessages,
    stream: true,
    // Required to receive the terminal usage event without a separate API call.
    stream_options: { include_usage: true },
  };

  if (ownerMode) {
    body.tools = [PROPOSE_DOCUMENT_TOOL];
    body.tool_choice = "auto";
  }

  const openAiStart = Date.now();
  console.log(`[agent-chat][${charge.rid}] openai request: model=${charge.modelIdForApi} owner=${ownerMode} messages=${openAIMessages.length} system_len=${systemPrompt.length}`);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log(`[agent-chat][${charge.rid}] openai response: status=${res.status} ok=${res.ok} has_body=${!!res.body} ms=${Date.now() - openAiStart}`);

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "<no-body>");
    console.error(`[agent-chat][${charge.rid}] openai failed body: ${errText.slice(0, 500)}`);
    return streamText("I'm having trouble connecting right now. Please try again in a moment.");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sentDone = false;

      // Tool call accumulator — OpenAI streams arguments as deltas
      let toolCallName: string | null = null;
      let toolCallArgs = "";
      let usage: UsageReport | null = null;
      let contentDeltas = 0;
      let firstDeltaAt: number | null = null;
      const streamStart = Date.now();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") {
              if (data === "[DONE]") {
                // Flush any accumulated tool call before closing
                if (toolCallName && toolCallArgs) {
                  try {
                    const input = JSON.parse(toolCallArgs);
                    controller.enqueue(
                      jsonLine({ action: { type: toolCallName, ...input } })
                    );
                  } catch {
                    // malformed tool JSON — skip
                  }
                }
                if (!sentDone) {
                  controller.enqueue(jsonLine({ done: true }));
                  sentDone = true;
                }
              }
              continue;
            }

            try {
              const event = JSON.parse(data);

              // Terminal usage event has empty choices but a populated usage field.
              if (event.usage && typeof event.usage.prompt_tokens === "number") {
                usage = {
                  input: event.usage.prompt_tokens ?? 0,
                  output: event.usage.completion_tokens ?? 0,
                };
              }

              const choice = event.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta;

              // Regular text content
              if (delta?.content) {
                if (firstDeltaAt === null) {
                  firstDeltaAt = Date.now();
                  console.log(`[agent-chat][${charge.rid}] first content delta after ${firstDeltaAt - streamStart}ms`);
                }
                contentDeltas++;
                controller.enqueue(jsonLine({ content: delta.content }));
              }

              // Tool call streaming — accumulate name + arguments
              if (delta?.tool_calls?.[0]) {
                const tc = delta.tool_calls[0];
                if (tc.function?.name) {
                  toolCallName = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCallArgs += tc.function.arguments;
                }
              }

              // finish_reason signals the end of this chunk sequence
              if (choice.finish_reason === "stop") {
                controller.enqueue(jsonLine({ done: true }));
                sentDone = true;
              } else if (choice.finish_reason === "tool_calls") {
                // Emit the completed tool call
                if (toolCallName && toolCallArgs) {
                  try {
                    const input = JSON.parse(toolCallArgs);
                    controller.enqueue(
                      jsonLine({ action: { type: toolCallName, ...input } })
                    );
                  } catch {
                    // malformed tool JSON — skip
                  }
                  toolCallName = null;
                  toolCallArgs = "";
                }
                controller.enqueue(jsonLine({ done: true }));
                sentDone = true;
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        console.error(`[agent-chat][${charge.rid}] stream loop threw:`, err);
      } finally {
        if (!sentDone) controller.enqueue(jsonLine({ done: true }));
        controller.close();
        console.log(`[agent-chat][${charge.rid}] stream done: total_ms=${Date.now() - streamStart} content_deltas=${contentDeltas} tool_call=${toolCallName ?? "none"} usage=${usage ? `${usage.input}/${usage.output}` : "none"} sent_done=${sentDone}`);

        // Charge credits AFTER the stream completes. Best-effort —
        // a failure here must not affect the user-visible response.
        if (usage && usage.input + usage.output > 0) {
          try {
            const { error: chargeErr } = await charge.admin.rpc("charge_llm_usage", {
              p_user_id: charge.userId,
              p_model_id: charge.modelId,
              p_role: charge.role,
              p_input_tokens: usage.input,
              p_output_tokens: usage.output,
              p_message_id: null,
              p_request_id: charge.requestId,
            });
            if (chargeErr) {
              console.error(`[agent-chat][${charge.rid}] charge_llm_usage rpc error:`, chargeErr);
            } else {
              console.log(`[agent-chat][${charge.rid}] charge ok: in=${usage.input} out=${usage.output}`);
            }
          } catch (err) {
            console.error(`[agent-chat][${charge.rid}] charge_llm_usage threw:`, err);
          }
        } else {
          console.warn(`[agent-chat][${charge.rid}] no usage reported — skipping charge`);
        }
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}

// ─── Retrieval fallback helpers ───────────────────────────────────────────────
// Cosine-similarity floor. If the best RAG chunk scores below this, we treat
// retrieval as low-confidence and fall back to loading every published
// document. Tunable — text-embedding-3-small in this corpus generally sits
// around ~0.4 for relevant hits.
const LOW_CONFIDENCE_SIMILARITY = 0.35;

// Broad "tell me everything" queries are systematically under-served by
// top-k retrieval: each of the 6 chunks may look topically relevant, but
// together they miss most of what the visitor is asking for. When we spot
// one, skip RAG and hand the model the full document set.
function isBroadOverviewQuery(text: string): boolean {
  const q = text.toLowerCase().trim();
  if (q.length === 0) return false;
  // Extremely short openers ("hi", "who?", "about you") — treat as broad.
  if (q.length <= 12 && /\b(hi|hello|hey|who|about|start)\b/.test(q)) return true;
  return /\b(summar[iy][sz]e|summary|overview|everything|all (about|the|your)|tell me about|who (are|is)|introduce (yourself|him|her|them)|what do you know|know about|full picture|complete picture|walk me through)\b/.test(q);
}

async function loadPublicDocs(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
) {
  return await admin
    .from("agent_documents")
    .select("title, content")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const rid = crypto.randomUUID().slice(0, 8);
  const t0 = Date.now();
  const url = new URL(req.url);
  console.log(`[agent-chat][${rid}] --- request in --- method=${req.method} path=${url.pathname} origin=${req.headers.get("origin") ?? "none"} ua=${(req.headers.get("user-agent") ?? "").slice(0, 60)}`);

  if (req.method === "OPTIONS") {
    console.log(`[agent-chat][${rid}] OPTIONS preflight`);
    return new Response(null, { headers: CORS });
  }

  // verify_jwt=true only proves the caller has *some* Supabase-issued JWT
  // (any anon/user key qualifies), which is not enough here: rate limits and
  // credit pre-checks live in the Next.js proxy, and this function trusts
  // caller_user_id from the body to decide who to bill. A shared secret set
  // only in the proxy env locks out direct-to-edge callers so nobody can
  // spoof caller_user_id and drain someone else's credits.
  const expectedProxySecret = Deno.env.get("INTERNAL_PROXY_SECRET");
  if (!expectedProxySecret) {
    console.error(`[agent-chat][${rid}] INTERNAL_PROXY_SECRET not configured`);
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const providedSecret = req.headers.get("x-internal-proxy-secret");
  const secretOk = providedSecret === expectedProxySecret;
  console.log(`[agent-chat][${rid}] proxy secret: provided=${providedSecret ? `present(len=${providedSecret.length})` : "MISSING"} expected_len=${expectedProxySecret.length} match=${secretOk} authz=${req.headers.get("authorization") ? "present" : "MISSING"} apikey=${req.headers.get("apikey") ? "present" : "MISSING"}`);
  if (!secretOk) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let messages: { role: string; content: string }[];
  let username: string;
  let mode: "visitor" | "owner";
  let profileIdFromCaller: string | null = null;
  let callerUserId: string | null = null;
  let requestIdFromCaller: string | null = null;

  try {
    const body = await req.json();
    messages = body.messages;
    username = body.username;
    mode = body.mode ?? "visitor";
    profileIdFromCaller = body.profile_id ?? null;
    callerUserId = body.caller_user_id ?? null;
    requestIdFromCaller = body.request_id ?? null;
  } catch (err) {
    console.error(`[agent-chat][${rid}] JSON parse failed:`, err);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.log(`[agent-chat][${rid}] body: username=${username ?? "MISSING"} mode=${mode} messages=${Array.isArray(messages) ? messages.length : `NOT_ARRAY(${typeof messages})`} profile_id_from_caller=${profileIdFromCaller ?? "null"} caller_user_id=${callerUserId ?? "null"} request_id=${requestIdFromCaller ?? "null"}`);

  // The proxy is the only legitimate caller, and it always sets caller_user_id
  // (the authenticated user chatting with the agent). Refuse if it's missing —
  // without it we don't know who to bill, and defaulting to the profile owner
  // would let anyone drain someone else's credits.
  if (!callerUserId) {
    console.error(`[agent-chat][${rid}] caller_user_id missing — refusing`);
    return new Response(JSON.stringify({ error: "caller_user_id required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaSrk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  console.log(`[agent-chat][${rid}] env: OPENAI=${openAIKey ? "set" : "MISSING"} SUPABASE_URL=${supaUrl ? "set" : "MISSING"} SERVICE_ROLE=${supaSrk ? "set" : "MISSING"}`);

  if (!openAIKey) {
    console.warn(`[agent-chat][${rid}] returning placeholder — OPENAI_API_KEY missing`);
    return streamText(
      "This agent is not yet configured. The profile owner needs to add an OPENAI_API_KEY to activate AI responses."
    );
  }

  const admin = createClient(supaUrl!, supaSrk!);

  // 1. Profile lookup
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .single();

  console.log(`[agent-chat][${rid}] profile lookup: username=${username} found=${!!profile} id=${profile?.id ?? "null"} display_name=${profile?.display_name ?? "null"} err=${profileErr?.message ?? "none"} err_code=${profileErr?.code ?? "none"}`);

  if (!profile) {
    console.warn(`[agent-chat][${rid}] returning "profile doesn't exist" for username=${username}`);
    return streamText("This profile doesn't exist.");
  }

  // Trust the caller's profile_id only if it matches the looked-up profile.
  // (The proxy at src/app/api/agent/chat/route.ts is the only legitimate caller.)
  if (profileIdFromCaller && profileIdFromCaller !== profile.id) {
    console.error(`[agent-chat][${rid}] profile_id mismatch: caller=${profileIdFromCaller} looked_up=${profile.id}`);
    return new Response(JSON.stringify({ error: "profile_id mismatch" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const displayName: string = profile.display_name || profile.username;

  // 2. Lookup the active agent-chat model.
  const { data: modelRow, error: modelErr } = await admin
    .from("llm_models")
    .select("id, provider, model_id")
    .eq("default_for_role", "agent_chat")
    .eq("active", true)
    .maybeSingle();

  console.log(`[agent-chat][${rid}] model lookup: found=${!!modelRow} id=${modelRow?.id ?? "null"} provider=${modelRow?.provider ?? "null"} model_id=${modelRow?.model_id ?? "null"} err=${modelErr?.message ?? "none"}`);

  if (!modelRow) {
    console.warn(`[agent-chat][${rid}] returning "no model configured"`);
    return streamText(
      `${displayName}'s agent is temporarily unavailable. No active chat model is configured.`
    );
  }

  // 3. Build system prompt
  //    Owner: full document injection — the advisor needs the complete picture.
  //    Visitor: RAG first, fall back to full-doc injection.
  let systemPrompt: string;
  let branch: string;

  if (mode === "owner") {
    branch = "owner-full-docs";
    const { data: docs, error: docsErr } = await admin
      .from("agent_documents")
      .select("id, title, content, visibility, status")
      .eq("user_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    console.log(`[agent-chat][${rid}] owner docs: count=${docs?.length ?? 0} err=${docsErr?.message ?? "none"}`);
    systemPrompt = buildFromDocs(displayName, docs ?? [], "owner");
  } else {
    const lastUserMessage = messages[messages.length - 1]?.content ?? "";
    const wantsBroadOverview = isBroadOverviewQuery(lastUserMessage);
    console.log(`[agent-chat][${rid}] visitor: last_user_message_len=${lastUserMessage.length} broad_overview=${wantsBroadOverview}`);

    if (wantsBroadOverview) {
      // Path A: intent-based fallback — skip RAG for "summarize everything"
      // style queries where top-k retrieval reliably misses the point.
      branch = "visitor-fulldocs-intent";
      const { data: docs, error: docsErr } = await loadPublicDocs(admin, profile.id);
      console.log(`[agent-chat][${rid}] fulldocs (broad intent): count=${docs?.length ?? 0} err=${docsErr?.message ?? "none"}`);
      systemPrompt = buildFromDocs(displayName, docs ?? [], "visitor");
    } else {
      const queryEmbedding = await embedText(lastUserMessage, openAIKey, rid);
      console.log(`[agent-chat][${rid}] embed: ok=${!!queryEmbedding} dims=${queryEmbedding?.length ?? 0}`);

      if (!queryEmbedding) {
        branch = "visitor-fallback-noembed";
        const { data: docs, error: docsErr } = await loadPublicDocs(admin, profile.id);
        console.log(`[agent-chat][${rid}] fallback docs (embed failed): count=${docs?.length ?? 0} err=${docsErr?.message ?? "none"}`);
        systemPrompt = buildFromDocs(displayName, docs ?? [], "visitor");
      } else {
        // Always fetch response-style.md so it's guaranteed in the system prompt,
        // even when content comes from RAG chunks rather than full documents.
        const [chunksResult, styleResult] = await Promise.all([
          admin.rpc("match_agent_chunks", {
            p_user_id: profile.id,
            p_embedding: queryEmbedding,
            p_top_k: 6,
          }),
          admin
            .from("agent_documents")
            .select("content")
            .eq("user_id", profile.id)
            .eq("title", "response-style.md")
            .eq("visibility", "public")
            .eq("status", "active")
            .maybeSingle(),
        ]);

        const chunkRows: { content: string; similarity: number }[] = chunksResult.error
          ? []
          : ((chunksResult.data as { content: string; similarity: number }[]) ?? []);
        const topSim = chunkRows.length > 0 ? chunkRows[0].similarity : 0;
        console.log(`[agent-chat][${rid}] rag: chunks_count=${chunkRows.length} top_sim=${topSim.toFixed(3)} chunks_err=${chunksResult.error?.message ?? "none"} style_found=${!!styleResult.data} style_err=${styleResult.error?.message ?? "none"}`);

        const lowConfidence = chunkRows.length === 0 || topSim < LOW_CONFIDENCE_SIMILARITY;

        if (lowConfidence) {
          branch = chunkRows.length === 0 ? "visitor-fallback-nochunks" : "visitor-fallback-lowconfidence";
          const { data: docs, error: docsErr } = await loadPublicDocs(admin, profile.id);
          console.log(`[agent-chat][${rid}] fallback docs (${branch}): count=${docs?.length ?? 0} err=${docsErr?.message ?? "none"}`);
          systemPrompt = buildFromDocs(displayName, docs ?? [], "visitor");
        } else {
          branch = "visitor-rag";
          const chunkTexts = chunkRows.map((c) => c.content);
          const responseStyle: string | undefined = styleResult.data?.content ?? undefined;
          systemPrompt = buildFromChunks(displayName, chunkTexts, "visitor", responseStyle);
        }
      }
    }
  }

  console.log(`[agent-chat][${rid}] branch=${branch} system_prompt_len=${systemPrompt.length} setup_ms=${Date.now() - t0}`);

  // 4. Log request (analytics) — non-blocking, separate from credit charge.
  if (mode === "visitor") {
    try {
      const { error: insErr } = await admin
        .from("agent_requests")
        .insert({ profile_id: profile.id, messages_count: messages.length });
      if (insErr) console.error(`[agent-chat][${rid}] agent_requests insert error:`, insErr);
    } catch (err) { console.error(`[agent-chat][${rid}] Failed to log request:`, err); }
  }

  // 5. Stream response — credits are debited from the caller (whoever is
  //    chatting) after the stream completes and OpenAI has reported real token
  //    counts. In owner mode, caller == profile owner, so the owner pays for
  //    their own testing; in visitor mode, the visitor pays.
  return streamOpenAI(systemPrompt, messages, openAIKey, mode === "owner", {
    admin,
    userId: callerUserId,
    modelId: modelRow.id,
    modelIdForApi: modelRow.model_id,
    role: "agent_chat",
    requestId: requestIdFromCaller ?? crypto.randomUUID(),
    rid,
  });
});
