# Credits

Nandzz monetizes on a **pay-as-you-go credit** model. No subscriptions. Users buy credits in Stripe-backed packs and spend them on:

- **Publishing spaces** — flat 10 credits each
- **AI chat (per profile owner)** — per-token, billed at a 3× markup on raw model cost

The previous Free/Pro tier system has been removed.

---

## The two buckets

Each profile has two credit balances:

| Bucket | Source | Where it can be spent |
|---|---|---|
| `free_space_credits` | Configurable signup grant (default 100, set via admin); admin grants for promos | Space publishing only |
| `paid_credits` | Stripe purchases; admin grants for refunds | Spaces OR LLM tokens |

**Spending order on publish**: free first, then paid. Spending on LLM: paid only.

**Expiry**: never.

```
┌─ profiles.free_space_credits ─┐     ┌─ profiles.paid_credits ─┐
│   100 on signup               │     │   bought from Stripe     │
│   space publish only          │     │   universal              │
└───────────────────────────────┘     └──────────────────────────┘
            │                                  │
            ▼                                  ▼
       publish_space                  publish_space + agent_chat
```

---

## Credit packs (Stripe products)

Seeded in the migration; admin-editable via `nandzz-admin`:

| Pack | Credits | Price | Equivalent |
|---|---|---|---|
| Starter | 500 | $5 | 50 space publishes |
| Plus | 1,750 | $15 | 175 space publishes (+17% bonus credits) |
| Pro | 5,000 | $40 | 500 space publishes (+25% bonus credits) |

Pack records live in `public.credit_packs`. The Stripe Product + Price IDs are populated by the admin "Sync to Stripe" action — Postgres is the source of truth; Stripe is generated from it.

---

## LLM pricing

Per-model rates live in `public.llm_models`. The convention: **3× markup on the raw token cost**, expressed in credits per 1,000 tokens at the rate of $1 = 100 credits.

Worked example for `openai/gpt-4.1-nano`:

| Raw cost | With 3× markup | Credits / 1k (at 100 credits = $1) |
|---|---|---|
| $0.10 / M input | $0.30 / M | 0.0300 |
| $0.40 / M output | $1.20 / M | 0.1200 |

A typical 1k-in / 500-out conversation = `1 × 0.03 + 0.5 × 0.12 = 0.09` credits → rounds up to 1.

Default models per role (admin-configurable via `default_for_role`):

| Role | Default model | Status |
|---|---|---|
| `agent_chat` | `openai/gpt-4.1-nano` | Active |
| `page_editor` | `anthropic/claude-sonnet-4-6` | Seeded inactive — turn on once the editor call site ships |

---

## Flows

### Publish a space

```
SpaceForm (client)
  ├─ uploads files to Supabase Storage (HTML, image, PDF, …)
  └─ publishSpace() server action  ── src/lib/actions/publish-space.ts
       └─ rpc('publish_space_tx', { user_id, space_payload, client_request_id })
            ├─ SELECT … FOR UPDATE on profiles (kills double-click race)
            ├─ idempotency check on (user_id, client_request_id)
            ├─ spend free_space_credits first, then paid_credits
            ├─ INSERT INTO spaces
            └─ INSERT INTO credit_ledger (one row per bucket touched)
```

Failure modes:
- `INSUFFICIENT_CREDITS` (Postgres error) → action returns `{ error: 'INSUFFICIENT_CREDITS' }`; UI shows "Buy credits" banner
- Network retry: same `client_request_id` resolves to the existing space row, no double-charge

### LLM chat

```
AgentChat (client)
  └─ POST /api/agent/chat   ── src/app/api/agent/chat/route.ts
       ├─ rpc('assert_min_credits', { user_id: profile.id, p_min: 1 })
       │    └─ 402 if insufficient — no upstream call
       ├─ generate request_id (UUID)
       └─ POST supabase/functions/agent-chat
            ├─ lookup llm_models where default_for_role = 'agent_chat'
            ├─ stream OpenAI with stream_options.include_usage = true
            ├─ capture terminal event { usage: { prompt_tokens, completion_tokens } }
            └─ rpc('charge_llm_usage', { user_id, model_id, role, input/output tokens, request_id })
                 ├─ idempotency: skip if request_id already charged
                 ├─ debit paid_credits (best-effort — may go slightly negative)
                 └─ INSERT INTO credit_ledger + llm_usage
```

**Why charge post-stream**: token count is unknown until OpenAI reports it. The pre-check (`assert_min_credits`) guards against starting a call with zero balance; the post-charge handles real billing. A user can overdraft by at most one call's worth — the next `assert_min_credits` refuses further use.

### Stripe purchase

```
/dashboard/credits page
  └─ BuyCreditsButton (client)
       └─ POST /api/stripe/create-checkout-session  { credit_pack_id }
            ├─ resolves credit_packs row
            ├─ finds or creates Stripe customer
            └─ creates Checkout Session (mode: 'payment')
                 └─ metadata: { user_id, credit_pack_id, credits, pack_price_cents }

User pays in Stripe-hosted checkout.

Stripe → /api/stripe/webhook  (event: checkout.session.completed)
  └─ verifyEvent(signature)
       └─ rpc('grant_credits', {
              user_id, bucket: 'paid', amount: credits,
              reason: 'stripe_purchase',
              stripe_event_id: event.id,       ── idempotency key
              payment_intent_id,
              metadata: { pack_id, pack_name, pack_price_cents, session_id }
          })
```

**Idempotency**: `credit_ledger.stripe_event_id` has a UNIQUE partial index. The `grant_credits` RPC short-circuits on duplicate events — Stripe can safely retry.

**Refunds** (`charge.refunded` event): the webhook locates the original purchase by `payment_intent_id` and writes a negative-delta `refund` ledger entry. Allows `paid_credits` to drop below zero (rare; admin can write off via grant_credits).

---

## Ledger schema

`public.credit_ledger` is append-only. **No UPDATE or DELETE policy exists** — all writes go through SECURITY DEFINER RPCs.

| Column | Purpose |
|---|---|
| `delta` | Signed; negative = debit |
| `bucket` | `free_space` or `paid` |
| `reason` | Enum check: signup_grant, admin_grant, admin_revoke, stripe_purchase, publish_space, llm_agent_chat, llm_page_editor, refund, backfill |
| `balance_after_free`, `balance_after_paid` | Snapshot — lets the user-facing ledger render without joins |
| `stripe_event_id` | UNIQUE partial index — idempotency for webhook retries |
| `related_entity_*` | Generic FK to spaces / llm_usage rows |

A single publish that spans both buckets writes **two ledger rows** (one per bucket), tied together by `related_entity_id`.

---

## Admin operations

The separate `nandzz-admin` repo (sibling folder at `/Users/felipenandz/Desktop/nandzz-admin/`) handles:

- **Grant or revoke credits** — calls `grant_credits` RPC with reason `admin_grant` / `admin_revoke`. Required field: note explaining why.
- **Edit credit packs** — update name/credits/price/active. Stripe sync button creates a new Stripe Price (Prices are immutable; the new one supersedes).
- **Edit LLM models** — adjust `input_credits_per_1k`, `output_credits_per_1k`, `default_for_role`, `active`. Changes take effect immediately on next request.
- **App settings** — runtime knobs read by triggers and server code (see below).
- **Revenue dashboard** — `credit_ledger` rows where `reason = 'stripe_purchase'` summed by day.
- **Usage dashboard** — `llm_usage` grouped by model + top spenders.

Access control: `profiles.is_admin = true`. Enforced both by Postgres RLS and by `src/middleware.ts` in the admin app.

### app_settings table

Key/value JSONB store for tunable knobs. Currently used by the `handle_new_user` trigger:

| Key | Shape | Default | Used by |
|---|---|---|---|
| `signup_credit_grant` | `{ amount: int }` | `{ amount: 100 }` | `handle_new_user` trigger reads on every signup |

The trigger reads at signup time — changes take effect immediately for the next signup, no deploy needed. Setting `amount: 0` disables the welcome grant entirely. The trigger falls back to 100 if `app_settings` is missing (only relevant on first-time schema apply).

---

## Existing users

**No backfill.** Pre-credits users keep their default `free_space_credits = 0` and `paid_credits = 0`. To publish they must buy a pack. Only new signups (handled by the `handle_new_user` trigger) get the 100-credit welcome grant.

If a specific existing user needs credits — support refund, beta tester goodwill, etc. — grant them from `nandzz-admin` (Users → Grant credits).

The `plan_tier` column is intentionally left in place until a follow-up deploy removes all code references; then a separate edit drops it.

---

## File map

```
src/
  lib/
    actions/publish-space.ts        — server action: rpc('publish_space_tx')
    stripe/server.ts                — Stripe singleton
    types.ts                        — CreditBucket, CreditLedgerEntry, CreditPack
  app/
    api/
      agent/chat/route.ts           — pre-check assert_min_credits, thread request_id
      stripe/
        create-checkout-session/    — accepts credit_pack_id, mode: 'payment'
        webhook/                    — checkout.session.completed → grant_credits
        portal/                     — invoice history (unchanged behaviour)
    dashboard/
      credits/page.tsx              — balance, ledger, buy buttons
      credits/BuyCreditsButton.tsx
      billing/page.tsx              — redirects to /credits (legacy)
      page.tsx                      — low-balance banner replaces space-cap banner
    pricing/                        — public Buy Credits page, packs from DB

supabase-schema.sql                        — credits section appended at end
supabase/
  functions/agent-chat/index.ts            — include_usage + charge_llm_usage RPC

/Users/felipenandz/Desktop/nandzz-admin/   — separate admin repo (sibling)
```

---

## Verification checklist

1. Apply the schema changes to the cloud DEV project (paste into Supabase Studio's SQL editor, or `npm run db:push` from `Portal/`). Sign up a new user → assert `free_space_credits = 100` + signup_grant ledger row.
2. Publish 10 spaces → balance drops by 100. 11th attempt: `INSUFFICIENT_CREDITS` banner with link to /dashboard/credits.
3. Double-click Publish → only one space inserted, only one debit (idempotency via `client_request_id`).
4. Stripe test mode $5 checkout → webhook fires → `paid_credits` +500 + `stripe_purchase` ledger row.
5. Replay the webhook event (`stripe events resend …`) → no duplicate row (idempotency via `stripe_event_id`).
6. Open agent chat, send a short message → `llm_usage` row written, `credit_ledger` debit, balance drops.
7. Drain `paid_credits` to 0 → next chat 402s before any upstream call.
8. In `nandzz-admin`, grant 500 credits → balance bumps, ledger entry `admin_grant` with note metadata.

---

## Future work flagged in the build

- **Page-editor LLM call site** (claude-sonnet) — the model row is seeded `active = false`. Activating it requires adding the Anthropic SDK and a `charge_llm_usage` call with `role = 'page_editor'`.
- **i18n** — credits UI strings are currently English-only. The `translations.ts` namespace `credits.*` should be added once translations are available.
- **BalanceBadge** — a header chip showing live balance is mocked in plan but not shipped; users can see balance via `/dashboard/credits` or the low-balance banner.
- **Auto-refill subscriptions** — out of scope for the MVP credits launch.
