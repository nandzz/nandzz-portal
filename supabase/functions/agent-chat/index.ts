import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFromDocs, buildFromChunks } from "./prompts.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Tool definition (owner mode only) ───────────────────────────────────────

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

async function embedText(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch {
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
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
      } finally {
        if (!sentDone) controller.enqueue(jsonLine({ done: true }));
        controller.close();

        // Charge credits AFTER the stream completes. Best-effort —
        // a failure here must not affect the user-visible response.
        if (usage && usage.input + usage.output > 0) {
          try {
            await charge.admin.rpc("charge_llm_usage", {
              p_user_id: charge.userId,
              p_model_id: charge.modelId,
              p_role: charge.role,
              p_input_tokens: usage.input,
              p_output_tokens: usage.output,
              p_message_id: null,
              p_request_id: charge.requestId,
            });
          } catch (err) {
            console.error("[agent-chat] charge_llm_usage failed:", err);
          }
        }
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // verify_jwt=true only proves the caller has *some* Supabase-issued JWT
  // (any anon/user key qualifies), which is not enough here: rate limits and
  // credit pre-checks live in the Next.js proxy, and this function bills the
  // profile owner regardless of who's chatting. A shared secret set only in
  // the proxy env locks out direct-to-edge callers so those guards can't be
  // bypassed.
  const expectedProxySecret = Deno.env.get("INTERNAL_PROXY_SECRET");
  if (!expectedProxySecret) {
    console.error("[agent-chat] INTERNAL_PROXY_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-internal-proxy-secret") !== expectedProxySecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let messages: { role: string; content: string }[];
  let username: string;
  let mode: "visitor" | "owner";
  let profileIdFromCaller: string | null = null;
  let requestIdFromCaller: string | null = null;

  try {
    const body = await req.json();
    messages = body.messages;
    username = body.username;
    mode = body.mode ?? "visitor";
    profileIdFromCaller = body.profile_id ?? null;
    requestIdFromCaller = body.request_id ?? null;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIKey) {
    return streamText(
      "This agent is not yet configured. The profile owner needs to add an OPENAI_API_KEY to activate AI responses."
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Profile lookup
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .single();

  if (!profile) {
    return streamText("This profile doesn't exist.");
  }

  // Trust the caller's profile_id only if it matches the looked-up profile.
  // (The proxy at src/app/api/agent/chat/route.ts is the only legitimate caller.)
  if (profileIdFromCaller && profileIdFromCaller !== profile.id) {
    return new Response(JSON.stringify({ error: "profile_id mismatch" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const displayName: string = profile.display_name || profile.username;

  // 2. Lookup the active agent-chat model.
  const { data: modelRow } = await admin
    .from("llm_models")
    .select("id, provider, model_id")
    .eq("default_for_role", "agent_chat")
    .eq("active", true)
    .maybeSingle();

  if (!modelRow) {
    return streamText(
      `${displayName}'s agent is temporarily unavailable. No active chat model is configured.`
    );
  }

  // 3. Build system prompt
  //    Owner: full document injection — the advisor needs the complete picture.
  //    Visitor: RAG first, fall back to full-doc injection.
  let systemPrompt: string;

  if (mode === "owner") {
    const { data: docs } = await admin
      .from("agent_documents")
      .select("id, title, content, visibility, status")
      .eq("user_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    systemPrompt = buildFromDocs(displayName, docs ?? [], "owner");
  } else {
    const lastUserMessage = messages[messages.length - 1]?.content ?? "";
    const queryEmbedding = await embedText(lastUserMessage, openAIKey);

    if (queryEmbedding) {
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

      const chunkTexts: string[] = chunksResult.error
        ? []
        : (chunksResult.data as { content: string; similarity: number }[]).map((c) => c.content);
      const responseStyle: string | undefined = styleResult.data?.content ?? undefined;

      if (chunkTexts.length > 0) {
        systemPrompt = buildFromChunks(displayName, chunkTexts, "visitor", responseStyle);
      } else {
        const { data: docs } = await admin
          .from("agent_documents")
          .select("title, content")
          .eq("user_id", profile.id)
          .eq("visibility", "public")
          .eq("status", "active")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        systemPrompt = buildFromDocs(displayName, docs ?? [], "visitor");
      }
    } else {
      const { data: docs } = await admin
        .from("agent_documents")
        .select("title, content")
        .eq("user_id", profile.id)
        .eq("visibility", "public")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      systemPrompt = buildFromDocs(displayName, docs ?? [], "visitor");
    }
  }

  // 4. Log request (analytics) — non-blocking, separate from credit charge.
  if (mode === "visitor") {
    try {
      await admin
        .from("agent_requests")
        .insert({ profile_id: profile.id, messages_count: messages.length });
    } catch (err) { console.error("[agent-chat] Failed to log request:", err); }
  }

  // 5. Stream response — credits are debited from the profile owner after the
  //    stream completes and OpenAI has reported real token counts.
  return streamOpenAI(systemPrompt, messages, openAIKey, mode === "owner", {
    admin,
    userId: profile.id,
    modelId: modelRow.id,
    modelIdForApi: modelRow.model_id,
    role: "agent_chat",
    requestId: requestIdFromCaller ?? crypto.randomUUID(),
  });
});
