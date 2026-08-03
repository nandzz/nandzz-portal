import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Thin proxy → Supabase Edge Function (agent-chat).
// Business logic lives in supabase/functions/agent-chat/index.ts:
//   RAG retrieval, system prompt assembly, OpenAI streaming.
//
// mode is resolved server-side: "owner" only when the authenticated session
// user is the actual profile owner. Never trusted from the client body.
//
// Credits are charged to whoever is chatting — the caller, not the profile
// owner. Owner mode (owner chatting with their own agent) bills the owner
// because they are the caller. The pre-check below refuses early when the
// caller is out of paid_credits. The actual debit happens inside the edge
// function after OpenAI reports token usage.

const MAX_MESSAGE_CHARS = 30000;
// Refuse the request if the caller has fewer than this many paid_credits.
// A typical short chat (~1k in / 500 out on gpt-4.1-nano with 3× markup) bills ≈1 credit.
const MIN_CREDITS_FOR_CHAT = 1;

// Defaults if app_settings.chat_rate_limit is missing. Per-IP guards casual
// abuse; per-owner caps a coordinated flood aimed at a specific agent.
const DEFAULT_PER_IP_PER_OWNER_HOURLY = 30;
const DEFAULT_PER_OWNER_HOURLY = 240;

// Amplify sits behind CloudFront, which appends the true client IP as the
// LAST entry of X-Forwarded-For. Any earlier entry is attacker-controlled
// (a client can send its own XFF and CloudFront preserves it), so the
// leftmost value would let anyone rotate the rate-limit key at will.
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const { messages, username, preview } = await req.json();

  if (
    !Array.isArray(messages) ||
    messages.some((m) => typeof m.content === "string" && m.content.length > MAX_MESSAGE_CHARS)
  ) {
    return new Response(JSON.stringify({ error: "Message too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let mode: "visitor" | "owner" = "visitor";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Every chat is billed to the caller, so anonymous visitors are refused
  // outright — a signed-in account is required to identify who to charge and
  // to keep abuse tied to a real user, not just an IP.
  if (!user) {
    return new Response(
      JSON.stringify({ error: "AUTH_REQUIRED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const admin = createAdminClient();

  // Look up the agent's owner (for id + enabled state) and the caller (for paid_credits) in parallel.
  const [{ data: profile }, { data: caller }] = await Promise.all([
    admin.from("profiles").select("id, agent_enabled").eq("username", username).single(),
    admin.from("profiles").select("id, paid_credits").eq("id", user.id).single(),
  ]);

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isOwner = profile.id === user.id;

  // A disabled agent is hidden from the profile; block direct API calls to it too.
  // The owner can always reach their own agent (studio advisor + preview).
  if (!isOwner && !profile.agent_enabled) {
    return new Response(JSON.stringify({ error: "Agent not available" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!preview && isOwner) {
    mode = "owner";
  }

  // Owners chatting with their own agent still pay (they're the caller), but
  // skip the abuse throttle — they're testing their own agent. Everyone else
  // passes through the per-IP and per-owner caps.
  if (mode !== "owner") {
    const { data: rlSetting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "chat_rate_limit")
      .maybeSingle();
    const rlValue = (rlSetting?.value ?? {}) as {
      per_ip_per_owner_hourly?: number;
      per_owner_hourly?: number;
    };
    const perIpMax = rlValue.per_ip_per_owner_hourly ?? DEFAULT_PER_IP_PER_OWNER_HOURLY;
    const perOwnerMax = rlValue.per_owner_hourly ?? DEFAULT_PER_OWNER_HOURLY;

    const ip = getClientIp(req);
    const perIpKey = `ip:${ip}:owner:${profile.id}`;
    const perOwnerKey = `owner:${profile.id}`;

    const [{ error: ipErr }, { error: ownerErr }] = await Promise.all([
      admin.rpc("assert_chat_rate_limit", {
        p_key: perIpKey,
        p_max: perIpMax,
        p_window_seconds: 3600,
      }),
      admin.rpc("assert_chat_rate_limit", {
        p_key: perOwnerKey,
        p_max: perOwnerMax,
        p_window_seconds: 3600,
      }),
    ]);

    if (ipErr?.message?.includes("RATE_LIMITED") || ownerErr?.message?.includes("RATE_LIMITED")) {
      return new Response(
        JSON.stringify({ error: "RATE_LIMITED", retry_after_seconds: 3600 }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "3600" } }
      );
    }
  }

  // Pre-check: the caller (who will be charged) must have at least one paid credit.
  // Doing it here (not inside the edge function) lets us fail fast with 402 — no stream open.
  if ((caller?.paid_credits ?? 0) < MIN_CREDITS_FOR_CHAT) {
    return new Response(
      JSON.stringify({ error: "INSUFFICIENT_CREDITS", buy_url: "/dashboard/credits" }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  const requestId = crypto.randomUUID();
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-chat`;

  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  if (!proxySecret) {
    console.error("[api/agent/chat] INTERNAL_PROXY_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const upstream = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-proxy-secret": proxySecret,
    },
    body: JSON.stringify({
      messages,
      username,
      mode,
      profile_id: profile.id,
      caller_user_id: user.id,
      request_id: requestId,
      role: "agent_chat",
    }),
  });

  const streamHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  };

  if (!upstream.ok) {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(JSON.stringify({ content: "Something went wrong. Please try again." }) + "\n"));
          c.enqueue(enc.encode(JSON.stringify({ done: true }) + "\n"));
          c.close();
        },
      }),
      { headers: streamHeaders }
    );
  }

  return new Response(upstream.body, { headers: streamHeaders });
}
