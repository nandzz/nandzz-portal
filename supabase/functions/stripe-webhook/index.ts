// Stripe webhook → credit grant.
// Runs as a Supabase edge function so credit grants survive Portal outages.
// Register the function URL in Stripe Dashboard → Developers → Webhooks
// per env; each env has its own signing secret.
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, charge.refunded
//
// Secrets (set with `supabase secrets set --project-ref <ref> ...`):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Auto-injected by the runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Business logic lives in `./handler.ts` and is unit-tested there. This file
// is the HTTP adapter: env, signature verification, Stripe/Supabase client
// construction.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=denonext";
import { handleStripeEvent, type Logger } from "./handler.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function newTag(): string {
  return Math.random().toString(36).slice(2, 8);
}

function taggedLogger(tag: string): Logger {
  const prefix = `[stripe-webhook ${tag}]`;
  return {
    info: (msg) => console.log(`${prefix} ${msg}`),
    warn: (msg) => console.warn(`${prefix} ${msg}`),
    error: (msg, err) => console.error(`${prefix} ${msg}`, err ?? ""),
  };
}

serve(async (req) => {
  const tag = newTag();
  const start = Date.now();
  const log = taggedLogger(tag);
  log.info(`${req.method} received`);

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    log.warn(`method not allowed: ${req.method}`);
    return json({ error: "Method Not Allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    log.error(
      `missing secrets — STRIPE_SECRET_KEY:${!!stripeKey} STRIPE_WEBHOOK_SECRET:${!!webhookSecret}`,
    );
    return json({ error: "Stripe not configured" }, 503);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log.warn(`missing stripe-signature header`);
    return json({ error: "Missing stripe-signature header" }, 400);
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    log.error(
      `signature verification failed`,
      err instanceof Error ? err.message : err,
    );
    return json({ error: "Invalid webhook signature" }, 400);
  }

  log.info(`event.id=${event.id} type=${event.type} livemode=${event.livemode}`);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const result = await handleStripeEvent(event, admin, log).catch((err) => {
    log.error(`unhandled error in handler`, err instanceof Error ? err.stack ?? err.message : err);
    return { status: 500, body: { error: "internal" } };
  });

  const totalMs = Date.now() - start;
  log.info(`done in ${totalMs}ms status=${result.status}`);
  return json(result.body, result.status);
});
