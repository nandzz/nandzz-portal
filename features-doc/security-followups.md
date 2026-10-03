# Security follow-ups (open)

Leftovers from the 2026-10-03 security audit. The critical items were fixed in
migration `20261003160000_security_hardening_and_indexes` and commit `3f9032d`.
That fix locked definer RPCs to service_role, guarded the protected profiles
columns, sandboxed the `/sandbox` route, validated `html_url` and restricted
MCP OAuth redirects. The items below are known and accepted for now.

## 1. `profiles` is publicly readable in full — Medium

**Problem:** The SELECT policy `"Public profiles are viewable by everyone"` is
`using (true)` with no column restriction. Anyone holding the anon key can read
these columns for every user: `stripe_customer_id`, `plan_stripe_subscription_id`,
`paid_credits`, `plan_credits`, `plan_slug`, `plan_status`, `is_admin`,
`has_used_trial`, `comp_*` and `address`. This is an information leak, not
privilege escalation. Writes to these columns are blocked by the
`profiles_protect_columns` trigger.

**Why it's not a one-liner:** Hiding columns means revoking SELECT on the table
and granting only the safe columns. That breaks every `select("*")` and every
`profiles(*)` join made with the anon or session client. There are about 12
call sites:

- `src/app/[username]/(profile)/page.tsx`, `contents`, `gallery`, `links`
- `src/app/[username]/booking/[instanceId]/page.tsx`
- `src/app/[username]/agent/page.tsx`, `agent/preview/page.tsx`
- `src/app/dashboard/agent/page.tsx`
- `src/features/profile/data/profiles.ts`
- `src/features/analytics/AuthContext.tsx`, `auth.ts`, `data/profiles.ts`.
  These need the user's **own** private fields: credits and plan.

**Plan:**

1. Public pages select an explicit list of public columns. Consider a shared
   `PUBLIC_PROFILE_COLUMNS` constant.
2. Reads of your own private fields go through a `get_my_profile()` definer RPC
   that is granted to `authenticated`. Alternatively, use the admin client
   server-side after `getUser()`.
3. In a migration, `revoke select on public.profiles from anon, authenticated`,
   then `grant select (<public columns>) ... to anon, authenticated`.
4. Re-test every profile page, the dashboard, booking and agent pages, and
   sign-up (`claim_signup_profile`).

## 2. No rate limiting on public booking endpoints — Medium

**Problem:** These endpoints have no throttle:

- `POST /api/widgets/[instanceId]/book`
- `availability`
- `bookings/[token]/*`

Fields such as `customer_email`, `customer_phone`, `customer_name` and `notes`
are not validated for format or length. A script can flood an owner's calendar
and use our SES and Twilio to send branded confirmation emails and WhatsApp
reminders to arbitrary third parties. That burns sender reputation and Twilio
spend.

**Plan:**

1. Add per-IP and per-instance limits using the existing DB counter pattern
   (`assert_chat_rate_limit`, used in `src/app/api/agent/chat/route.ts`). Take
   the client IP from the last `x-forwarded-for` entry, as agent chat does.
2. Add a zod schema for the booking body that checks email and E.164 phone
   format and caps field lengths. Wrap `req.json()` in try/catch.
3. Optionally add Cloudflare Turnstile on the booking funnel. This needs a
   Cloudflare account and a site key plus secret key (an owner decision).

## 3. Anonymous `space_views` inserts — Low

**Problem:** The `space_views` INSERT policy is `with check (true)` for anon,
and the view tracker inserts directly from the browser. A script can inflate
view counts and analytics without limit. The `update_views_count` trigger also
writes to `spaces` on every insert.

**Plan:**

1. Move view recording into a server route or action that dedups per
   viewer/IP and space/day. The unique index on
   `(space_id, viewer_id, viewed_date)` already exists. Add a rate limit too.
2. Drop the anon INSERT policy and insert through the admin client.

## Smaller items noted

- `anthropic-webhook` edge function:
  - It logs the raw body on signature failure.
  - It has no `webhook-timestamp` replay window (±5 min).
- Secret comparisons that are not constant-time:
  - `booking-notifications/index.ts`
  - `agent-chat` (`x-internal-proxy-secret`)
- MCP OAuth tokens are issued with `expires_at: null`. Consider a TTL plus
  refresh.
- The MCP token endpoint consumes the code before checking PKCE. It should
  verify first.
- `auth/signout` accepts GET, so a third-party page can log users out (CSRF
  logout). Make it POST only.
- `/api/pdf` proxies any path on the Supabase host. Restrict it to
  `/storage/v1/object/public/`.
- `next.config.ts` inlines `SUPABASE_SERVICE_ROLE_KEY` through `env`. It is
  safe only while every reference stays server-only. Prefer the
  `.env.production` write in `amplify.yml`.
- The plan checkout does not block a second active subscription.
- Global CSP has `'unsafe-inline' 'unsafe-eval'`.
- The admin booking dashboard pulls up to 20k rows into JS
  (`nandzz-admin` `features/booking/page.tsx`). Replace it with an aggregate
  RPC.
- Booking customer search uses a leading-wildcard `ilike`. Add `pg_trgm`
  when the volume warrants it.
