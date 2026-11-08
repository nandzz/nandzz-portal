# Pricing: Free · Starter · Pro (plan)

Status (2026-11-08): **steps 1–4 built, committed, NOT pushed / not on prod.** Dev DB migrated.
Remaining: Google review button (merge branch, gate on `hasGoogleReview`), "Sync to Stripe" for Starter (dev, then prod),
prod migration BEFORE pushing portal `main` (the pricing copy already names Starter), notify Free users about styling.
Not live-verified: /dashboard/subscription (signed-in).

## Lineup (agreed)

| | Free | Starter €5/mo · €50/yr | Pro €27/mo · €270/yr |
|---|---|---|---|
| Contents, gallery, links | 25 contents | Unlimited | Unlimited |
| Styling (bg/button colours, booking button style, Brand page) | ❌ | ✅ | ✅ |
| Gallery caption styles | Plain (`none`) only | ✅ | ✅ |
| "Create your page" Nandzz badge on profile | Shown | Hidden | Hidden |
| Analytics (visitors + per content) | ❌ | ✅ | ✅ |
| Google review button | ❌ | ✅ | ✅ |
| Booking (Today tab, staff, email reminders) | ❌ | ❌ | ✅ |
| WhatsApp reminders | ❌ | ❌ | ✅ |
| MCP | ❌ | ❌ | ✅ |

Demo profiles keep booking as a perk (unchanged).

## Current state (what we build on)

- Catalog: `subscription_plans` (slug check = `free | pro`), flags `space_limit`, `has_widgets`, `has_mcp`, `has_analytics`. Pro = €27 / €270 (`20261002120000_single_plan_annual.sql`).
- Gating: `src/lib/plan.ts` (`getUserPlan`, `FREE_FALLBACK`) + DB `user_has_entitlement(user, 'widgets'|'mcp'|'analytics')`.
- `PlanSlug = "free" | "pro"` in `src/lib/types.ts`.
- Webhook maps **Stripe price id → slug** (`stripe-webhook/handler.ts` `lookupPlanSlugByPrice`), so reusing the slug `starter` is safe even though old Pro subs carry `plan_slug='starter'` in metadata.
- Styling is **not gated** today: `update-background.ts` (`updateBackground`, `updateProfileStyle`), `update-brand.ts`, `update-profile-layout.ts`, `/dashboard/brand`; read on the public profile via the column allowlist in `features/profile/data/public-profile.ts`.
- Badge = `ProfileVisitorCta` rendered by `AppChrome` for visitor profiles (always shown today).
- Checkout: `api/stripe/plan-checkout` always creates a **new** Checkout subscription; plan changes otherwise go through the Stripe portal (`api/stripe/portal`).
- Google review button lives on branch `google-review-button` (dev migrated, prod not).

## Implementation steps

### 1. Database (one migration, dev → prod via `npm run db:push:dev` / `:prod`)
- Slug check → `free | starter | pro`.
- New flags on `subscription_plans`: `has_styling bool`, `hide_branding bool`, `has_google_review bool` (default false).
- Insert `starter` row: €5 / €50, `space_limit null`, `has_styling/hide_branding/has_analytics/has_google_review = true`, `has_widgets/has_mcp = false`, `sort_order 15`.
- Pro row: set the three new flags true. Free row: all false, `space_limit 25`.
- Demos get `styling` as a perk (like `widgets`).
- Extend `user_has_entitlement` with `'styling' | 'branding' | 'google_review'` (keep grants as-is, see infra/rpc_grants_locked_by_default).
- Do **not** clear stored style columns of Free users — they are ignored on render, restored on upgrade.

### 2. Types + plan helper
- `PlanSlug` add `"starter"`; `SubscriptionPlan` + `PlanEntitlements` add `hasStyling`, `hideBranding`, `hasGoogleReview`.
- `plan.ts`: map new columns; `FREE_FALLBACK` all false.

### 3. Gate styling (server-side first)
- Actions `updateBackground`, `updateProfileStyle`, `updateBrand`, caption-style part of `update-profile-layout` → reject unless `hasStyling` (allow resetting to default).
- UI: Style picker + `/dashboard/brand` show a locked preview with "Upgrade to Starter" CTA (owner can preview, not save).
- Public render: `public-profile.ts` resolves owner entitlement and nulls `background_color`, `brand_colors`, `booking_button_style`, non-`none` `gallery_caption_style`, background image when not entitled. Keep the column allowlist — return a derived `can_style` / `hide_branding`, never plan_* columns.

### 4. Badge
- Pass `hideBranding` from the profile page to `AppChrome`; skip `ProfileVisitorCta` for Starter/Pro owners. Demo pages keep their claim chip.
- Logged-in visitor Navbar unchanged (it's app chrome, not the badge).

### 5. Analytics
- Already gated by `hasAnalytics` (`dashboard/analytics`, Sidebar). Only the flag on Starter changes. Check `Navbar.tsx` / `AuthContext.tsx` uses for Pro-specific wording.
- Keep recording `profile_views` for everyone (data ready on upgrade).

### 6. Google review button
- Merge `google-review-button` into portal `main` after `db:push:prod`; gate the setting + render on `hasGoogleReview`.

### 7. Billing / Stripe
- Admin `nandzz-admin` `plans/PlanEditor.tsx` + `actions.ts`: edit new flags; create Starter, then "Sync to Stripe" (monthly + annual price) in dev, then prod.
- `plan-checkout`: if the user already has an active paid sub, **don't open a second Checkout** — switch the existing subscription's price (Starter ↔ Pro) with proration, or send them to the portal with a configured plan-switch. Needed to avoid double billing.
- Configure Stripe Customer Portal to allow switching between Starter and Pro prices.
- Webhook: no logic change (price-id lookup); add a test for the Starter price + Starter→Pro update event.
- Booking checks that assume "paid = Pro" must use `hasWidgets`, never `slug !== 'free'` — grep for it.

### 8. Surfaces & copy (all 7 locales)
- `SubscriptionView.tsx`: three plan cards (hardcoded `planSlug="pro"` at ~L203, `p.slug === "pro"` at ~L419).
- `pricing/PricingClient.tsx` (3 columns, Pro = popular), `pricing.md/route.ts`, `llms.txt`, FAQ schema, `/guide`.
- Upgrade prompts: content cap (Free), Style picker / Brand (Free), booking (Starter → Pro), analytics (Free).
- Legal/terms: plan names + prices if listed.

### 9. Existing users
- Free users with > 25 contents: keep them, block new ones (current cap behaviour).
- Free users with custom styles: stored, not rendered. Send a one-off email/notice before launch.
- Pro subscribers: unchanged.

## Order of rollout
1. Migration + types + helper (dev). 2. Gating (styling, badge, review). 3. Admin + Stripe dev products, checkout switch. 4. Pricing/subscription UI + i18n. 5. Test on dev end-to-end (Free → Starter → Pro → cancel). 6. Prod migration, Stripe sync, deploy, notify users.

## Open questions
- Trial: keep `trial_days` on Pro only, or also Starter?
- Notice period for Free users losing their custom style (suggest 30 days).
