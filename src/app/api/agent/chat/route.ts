import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEntitlements } from "@/lib/plan";
import { getFeatureFlags } from "@/lib/featureFlags";

// Thin proxy → Supabase Edge Function (agent-chat).
// Business logic lives in supabase/functions/agent-chat/index.ts:
//   RAG retrieval, system prompt assembly, OpenAI streaming.
//
// mode is resolved server-side: "owner" only when the authenticated session
// user is the actual profile owner. Never trusted from the client body.
//
// Gating differs by mode:
//   - owner (AgentStudio testing/advisor): if the owner has an active `agent`
//     widget instance, usage bills through its monthly credit allowance (then
//     paid credits); otherwise it falls back to a legacy direct paid-credits
//     charge that requires MIN_CREDITS_FOR_CHAT.
//   - visitor (the public "Talk to X" widget card / `/[username]/agent`):
//     HARD GATE on the owner's plan including widgets (plan.hasWidgets) plus an
//     enabled `agent` instance.
// Whenever an `agent` instance is in play, agent_can_serve pauses the agent
// once that instance's included credits AND the owner's paid credits are both
// exhausted for the billing period (usage is billed to the owner, not visitors).

const MAX_MESSAGE_CHARS = 30000;
// Refuse owner-mode requests if the caller has fewer than this many paid_credits.
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

// Finds the owner's live (enabled + entitled) `agent` widget instance.
// Mirrors the lookup the agent-chat edge fn already does for the calendar
// widget's booking context (loadBookingContext).
async function resolveAgentInstanceId(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string
): Promise<string | null> {
  const { data: rows } = await admin
    .from("widget_instances")
    .select("id, catalog:widget_catalog(slug)")
    .eq("user_id", ownerId)
    .eq("enabled", true);

  const agentRow = (rows ?? []).find((r) => {
    const cat = Array.isArray(r.catalog) ? r.catalog[0] : r.catalog;
    return (cat as { slug?: string } | undefined)?.slug === "agent";
  });
  if (!agentRow) return null;

  // Widget access is now the owner's plan entitlement (has_widgets), not a
  // per-instance subscription.
  const entitlements = await getUserEntitlements(ownerId);
  return entitlements.hasWidgets ? agentRow.id : null;
}

export async function POST(req: NextRequest) {
  // AI master switch — the agent is fully hidden while off.
  if (!(await getFeatureFlags()).ai) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  // Every chat requires a signed-in caller — owners are billed in credits,
  // visitors are metered against the owner's widget token cap, but either way
  // we need to know who's chatting and keep abuse tied to a real account.
  if (!user) {
    return new Response(
      JSON.stringify({ error: "AUTH_REQUIRED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const admin = createAdminClient();

  const [{ data: profile }, { data: caller }] = await Promise.all([
    admin.from("profiles").select("id").eq("username", username).single(),
    admin.from("profiles").select("id, paid_credits").eq("id", user.id).single(),
  ]);

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isOwner = profile.id === user.id;

  if (!preview && isOwner) {
    mode = "owner";
  }

  let agentInstanceId: string | null = null;

  if (mode === "owner") {
    // Owner using AgentStudio. If they have an active `agent` widget instance,
    // usage bills through its monthly credit allowance (then their paid
    // credits), same as the public widget. If not (testing without a
    // subscription), fall back to the legacy direct paid-credits charge, which
    // still requires a minimum balance.
    agentInstanceId = await resolveAgentInstanceId(admin, profile.id);
    if (!agentInstanceId && (caller?.paid_credits ?? 0) < MIN_CREDITS_FOR_CHAT) {
      return new Response(
        JSON.stringify({ error: "INSUFFICIENT_CREDITS", buy_url: "/dashboard/credits" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    // HARD GATE: the agent only exists for visitors while the owner has an
    // active `agent` widget subscription with the instance enabled.
    agentInstanceId = await resolveAgentInstanceId(admin, profile.id);
    if (!agentInstanceId) {
      return new Response(
        JSON.stringify({ error: "AGENT_UNAVAILABLE" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

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

  // Monthly credit allowance gate. Whenever the usage bills through an `agent`
  // widget instance, the agent pauses once that instance's included credits AND
  // the owner's paid credits are both exhausted for the current billing period.
  if (agentInstanceId) {
    const { data: canServe } = await admin.rpc("agent_can_serve", {
      p_instance_id: agentInstanceId,
      p_owner_user_id: profile.id,
    });
    if (canServe === false) {
      return new Response(
        JSON.stringify({ error: "AGENT_LIMIT_REACHED" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
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
      instance_id: agentInstanceId,
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
