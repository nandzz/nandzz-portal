# Orders (Encomendas): plan

Owner: Felipe. Repos: `repositories/portal` (DB, dashboard, later the agent RPCs) and `repositories/business-agent` (worker tools, Phase 4). Sections: owner settings 6a, emails 6b, admin portal 6c, phases 7.

## Start here (handoff, 2026-11-23)

**Where it stands:** Phases 1–3 built and live on the DEV database, Phase 3 reviewed + UX pass on 2026-11-23 (see build log); **nothing committed or pushed yet** (portal working tree, branch `main`); **nothing on prod** (no prod migrations, UI dev-only). Not yet checked in the browser.

**Next steps, in order**
1. Verify Products, Orders and Settings live in the browser (`next dev`, business account `nandz` on dev, `/dashboard/orders`). Ask Felipe before driving Chrome.
2. Commit + push portal `main` (ignore the unrelated `deno.lock` change), then bump the submodule pointer in the harness.
3. Phase 4 (agent takes orders), see section 6 and the Phase 4 bullet in section 7. Starting points: worker `business-agent/src/tools.ts` + `prompt.ts` (booking tools are the pattern), `agent_api.*` functions in `supabase/migrations/20261026130000_agent_core.sql` (`agent_private.resolve_scope`, `autonomy`, `phone_matches`), approval round trip `src/features/my-agent/server/notify-worker.ts`. Autonomy keys `new_order` / `cancel_order` already exist in `agent_settings.autonomy`. The DB core to call is `orders_private.create_order(owner, payload, 'agent', 'agent', true, 'pending'|'confirmed')`; idempotency key = the WhatsApp message id.
4. Phase 5 (emails + admin), Phase 6 (go live).

**Code map**
- DB: `supabase/migrations/20261122120000_orders_foundation.sql` (tables, RLS, bucket, all RPCs, expiry cron, alerts), `20261122140000_orders_adjust_stock.sql`, `20261122160000_orders_review_fixes.sql` (`order_items.stock_held`, locks). Private helpers live in schema `orders_private` (not exposed; only `valid_hours` / `valid_address` are executable by clients, for CHECK constraints).
- App: `src/features/orders/` — `types.ts`, `schemas.ts`, `domain/` (status machine mirror, availability, money, orders-view; all unit-tested), `actions/` (products, orders, settings), `server/` (`owner.ts` access gate, loaders), `components/`, `pages/OrdersPage.tsx`, `storage.ts` (browser photo re-encode + upload). Route `src/app/dashboard/orders/[[...section]]/page.tsx`.
- Copy: `orders` section + `nav.orders` in `src/lib/i18n/locales/*` (7 locales), type in `translations.ts`.

**Rules and gotchas**
- Dev-only gate: `FEATURES.orders` / `ORDERS_ENABLED` (from `IS_DEV_ENV` in `next.config.ts`). The route checks the env var inline + dynamic import, like My Agent, so prod bundles nothing.
- `AuthContext.tsx` asks for `subscription_plans.has_orders` only when `FEATURES.orders` is on: prod has no such column yet. Remove that gate at go-live, after `npm run db:push:prod`.
- Every order write goes through the SECURITY DEFINER RPCs (owner = `auth.uid()`, never a parameter); clients can only read `orders` / `order_items` / `order_events`. Prices and totals always come from the DB.
- Access (`server/owner.ts`): creating orders and editing products/settings need the plan (`owner_orders_status`: plan, admin comp, suspension, kill switch). Managing EXISTING orders works even after a downgrade (`ordersOwner({ manageExisting: true })`).
- Stock: held at order time, given back = `order_items.stock_held` only. Daily capacity counts non-cancelled orders of that day. Owner manual orders may break their own scheduling rules, never stock.
- Testing on dev: `supabase db query --linked -f file.sql` inside `begin; … rollback;`, switching to the owner with `set local role authenticated` + `request.jwt.claims` (nandz = `3281fed1-5d1d-4309-83cc-e5a0f88d87f5`). The CLI can't open parallel sessions, so a true parallel race is untested. Clean up anything committed.

## Build log
**Phase 1 (database), live on dev:** Migration `20261122120000_orders_foundation.sql`; TS types in `src/features/orders/types.ts`, status mirror `domain/status.ts`; `hasOrders` entitlement (Pro + demos). Checked on dev in a rolled-back transaction: pricing/totals, stock hold + release, daily capacity, idempotency, every scheduling rule, status machine, expiry cron + alerts, kill switch, RLS (other owners, anon, direct writes, spoofed owner/paths, private fns all denied). Not tested: a true parallel race (the CLI can't open parallel sessions); protection = product row lock `for update` + conditional stock update + advisory locks per day.

**Phase 2 (Products tab), dev:** route `/dashboard/orders/[[...section]]` behind `FEATURES.orders` (`ORDERS_ENABLED`, dev only, inline check + dynamic import like My Agent), Sidebar + Navbar entry, `loading.tsx`. Products tab = search + status pills + category pills over ONE grid; card with photo, price, stock badge, atomic +/- stock (`owner_adjust_stock`, migration `20261122140000`, live dev) and an actions menu (edit, visible/draft, archive/restore, delete); editor dialog (up to 6 photos re-encoded in the browser = no EXIF, cover + reorder; details; availability mode stock/daily/unlimited, min/max, lead time, date window, weekdays; visible switch). Actions in `actions/products.ts` gate on `owner_orders_status()` (plan, comp, suspension, kill switch). Copy: `orders` dictionary section + `nav.orders`, all 7 locales.

**Code review 2026-11-22 (two rounds), fixed:** client plan query only asks for `has_orders` when `FEATURES.orders` is on (prod DB has no column yet; `AuthContext.tsx`, remove the gate at go-live after `db:push:prod`); stock given back = what each line really took (`order_items.stock_held`, migration `20261122160000_orders_review_fixes`, live dev); retries with the same `client_request_id` wait on an advisory lock and return the first order; max-pending-per-customer check locked per customer; missing method = `bad_method`; product editor: retry after a failed photo step updates instead of re-creating, photos registered all-or-nothing, archived products stay archived, unsaved-changes guard, untouched stock count is never written back (orders may have taken units meanwhile), failed photo removal is reported.

**Phase 3 (Orders + Settings tabs), dev:**
- Settings tab (`components/SettingsTab.tsx`, `actions/settings.ts` upsert through the owner's client, `server/load-settings.ts`): taking orders (switch, pause until + message, currency, timezone, max orders/day), pickup (address, weekly hours via `WeeklyHoursEditor` or "any time", slot size), delivery (fee, free over, minimum, area, hours, slot), timing (lead time, days ahead, confirm-within, customer cancel cutoff), customers (ask email, payment instructions, allergens, cancellation policy), link to My Agent settings. First save seeds currency/timezone from the booking calendar. All days switched off is refused (empty hours would mean "open every day").
- Orders tab (`OrdersTab.tsx`, `server/load-orders.ts`: all open orders + 60 days of history, capped): counters (New / To prepare / Ready / Today), search (name, phone, #number), status pills, list grouped by handover day (Today/Tomorrow/date), pending count badge on the tab.
- Order dialog (`OrderSheet.tsx`): next-step buttons from `domain/orders-view.ts` (confirm/reject, preparing, ready, out for delivery, picked up/delivered, cancel with optional reason), items (edit = re-price at today's prices via `owner_replace_order_items`), customer + handover (tel / WhatsApp / mailto / Google Maps links; edit), payment (mark paid cash/card/transfer, unpaid), internal note, history from `order_events`.
- New order dialog (`ManualOrderDialog.tsx` + `ItemPicker.tsx` + `OrderFields.tsx`): one request id per dialog (no double orders), discard guard.
- Access: creating orders and editing products/settings need the plan; status changes, edits, payment and history of EXISTING orders keep working after a downgrade or suspension (`ordersOwner({ manageExisting: true })`).
- Copy: ~190 new strings in all 7 locales. Not done yet: live bell/banner for `new_order` (comes with agent orders, Phase 4).

**Review + UX pass 2026-11-23 (Phase 3), done:** item edit no longer keeps lines of archived products (the DB refuses them, so saving failed); reject/cancel reason resets each time; closing the order sheet with an open editor or unsaved internal note asks first; history loads with neutral skeleton bars. Orders list: one-tap next step on every open row (`primaryStep`: Confirm / Start preparing / Picked up / Out for delivery / Delivered; reject and cancel stay in the sheet because they take a reason); the Today counter now really filters to today (removable "Today ×" chip, active counter outlined); open orders from past days get an "Overdue" tag; after creating a manual order its sheet opens; success/error lines fade out. 3 new strings + `itemsLostNote` reworded, 7 locales.
**Forms pass 2026-11-23 (mobile):** one shared `Field` (`components/shared.tsx`) for every Orders form: "(optional)" inline after the label (wraps, never cut off), hints and errors under the control, CSS subgrid so a wrapping label never pushes its input below the neighbours'. Phone layouts: date on its own row with From/To side by side; address = street, apartment, then city + narrow postcode; product price + unit and min + max side by side. Customer inputs have `autoComplete="off"` (the owner types the customer's data; the browser must not fill in the owner's own). Selects, quantity, line-note and hours inputs use 16px text on phones so iOS doesn't zoom on focus; selects match `<Input>` height.
**Phone, history, loading, navigation 2026-11-23:** customer phone = country selector + national number, stored E.164 (same helpers as booking, `features/booking/domain/phone.ts`); the selector is now ONE shared component `features/booking/components/PhoneCountrySelect.tsx`, also used by the booking widget and the profile WhatsApp field (their two copies removed). Default country = the business timezone's (`regionForTimeZone`), else the UI language. Older free-text phones (no `+`) open under the default country. History = timeline, newest first, dot colour = status badge hue, day label only when the day changes. `loading.tsx` picks the skeleton from the path (orders / products / settings layouts). Browser back/forward now switches the tab (pathname sync, like the booking workspace). `FieldGroup` in `shared.tsx` for label + controls blocks (photos, availability, weekdays).
**Visual pass in Chrome 2026-11-23 (desktop + 390px phone frame):** order sheet: "Customer" and "Pickup/Delivery" cards side by side (stacked on phones) with Call / WhatsApp / Email buttons and the handover address (pickup address too); payment = one row (Paid/Not paid + amount, "Mark as paid: Cash · Card · Bank transfer"); wa.me gets the default dial code for older phones saved without "+". Orders, New order and the product editor now use the owner-panel convention `ResponsivePanel` (moved from My Agent to `components/ui/responsive-panel.tsx`): bottom sheet on phones with the actions pinned in a footer, dialog above `sm`; the discard confirm works on top of the sheet (tested). Phones: counters in one compact row, search + icon-only New button on one line, tab labels always shown (icons hidden), subtitle wraps. List: time column no longer wraps, pills = Active / Completed / Cancelled (the counters cover New / To prepare / Ready), empty Active says "No open orders right now". "optional" hints replaced by the inline marker (unit, pause message, max orders per day); shorter search placeholder.
Open questions from the review (unchanged code): owner-made orders and item edits skip the per-product **daily capacity** (`hold_stock` only enforces it when `p_rules`), so a manual order can exceed "10 a day"; editing items re-prices **every** line at today's price, not only the changed ones.

The plan below was revised three times, the last pass a security review (revision log at the end).

## 1. Goal

Small businesses (bakeries, home kitchens, florists, shops that sell to order) list **products** in Nandzz and receive **orders** for a later pickup or delivery. In v1 the orders come from the **WhatsApp agent** (My Agent) and from the owner typing them in by hand. The owner runs everything from an **Orders dashboard**. No payment in v1, but every table and status is shaped so Stripe can be added without a rewrite.

Out of scope for v1: online payment, a public shop page on the profile, product variants with their own stock, multiple pickup locations, sending product photos in WhatsApp. Section 9 covers them.

## 2. What we reuse (don't rebuild)

| Need | Existing piece |
|---|---|
| Dev-only gate | `FEATURES.businessAgent` pattern: build-time env checked inline in the route + dynamic import of `features/<x>/pages/*` (Turbopack doesn't fold `FEATURES.x`) |
| Plan gating | `subscription_plans` flags + `lib/plan.ts` + DB `user_has_entitlement()` |
| Atomic create with checks | `create_booking_tx` style: one SECURITY DEFINER RPC does every check and the insert in one transaction |
| Agent access | `agent_api.*` RPCs over `agent_runtime`, run token verified in-DB (`agent_private.resolve_scope`), autonomy in `agent_settings.autonomy` (`off / pending / confirm`), customer match `phone_matches(…, wa_id)` |
| Owner decides, agent tells the customer | `agent_approvals` + `server/notify-worker.ts` → worker `/internal/approval-decided` |
| Owner alerts | `notifications` table + bell + live banner (`BookingAlerts.tsx`, `realtime.ts`) |
| Currency list + symbol | `features/booking/domain/messages.ts` (`WIDGET_CURRENCIES`, `currencySymbol`, `suggestedCurrencyForLocale`) |
| Images | public bucket + owner-scoped storage policies (`20261101170000_storage_owner_scoped_select.sql`), `space-images` limits as a model |
| UI conventions | PageShell, per-route `loading.tsx` with neutral bars, no component scrollbars, bounded-height lists built for 15+ items, all copy in 7 locales |

## 3. Data model (one migration, dev first)

Money is always **integer cents + currency code**, prices **tax-inclusive** (EU consumer prices). Times the owner thinks in (fulfilment day/time) are stored as **local date + time in the order settings' timezone**.

### `order_settings` (one row per owner)
- `owner_user_id` pk → profiles
- `accepting_orders bool default false` (master switch; agent and manual orders both check it)
- `currency text` (default from the booking calendar config, else `suggestedCurrencyForLocale`)
- `timezone text` (default from the calendar config / owner)
- Pickup: `pickup_enabled bool`, `pickup_address text`, `pickup_lat/lng` (optional, Places), `pickup_hours jsonb` (per weekday ranges, same shape as booking hours)
- Delivery: `delivery_enabled bool`, `delivery_fee_cents int`, `free_delivery_over_cents int null`, `delivery_min_order_cents int null`, `delivery_area text` (plain words the agent shows: "Within Milano, inside the ring road"), `delivery_hours jsonb`
- `default_lead_time_hours int default 24` (how long before fulfilment an order must be placed)
- `max_days_ahead int default 30`
- `pending_expiry_hours int default 24` (a pending order not confirmed by then auto-cancels and frees its stock)
- `notes_for_customers text` (allergens, how payment works today: "pay at pickup in cash or card")

### `products`
- `id uuid`, `owner_user_id`, `name` (1–120), `description` (≤ 2000), `category text null` (free text, used for grouping)
- `price_cents int >= 0`, `unit_label text null` ("each", "kg", "box of 6")
- `status` `draft | active | archived`
- Availability:
  - `stock_mode` `unlimited | stock | daily`
    - `stock`: `stock_qty int` units on hand, decremented when ordered
    - `daily`: `daily_capacity int` max units per fulfilment day (made-to-order, the classic encomenda case: "10 cakes a day")
  - `min_qty int default 1`, `max_qty int null` per order
  - `lead_time_hours int null` (overrides the default: a wedding cake needs 72 h)
  - `available_from date null`, `available_until date null` (seasonal: panettone in December)
  - `fulfilment_weekdays int[] null` (only on these days; null = every open day)
- `sort_order int`, `created_at`, `updated_at`
- `product_images`: `id`, `product_id` (cascade), `path`, `position`, `width`, `height`. Max 6 per product.

### `orders`
- `id uuid`, `owner_user_id`, `order_number int` (per owner, from `order_counters`, shown as `#0042`), unique (owner, number)
- `status` `pending | confirmed | preparing | ready | out_for_delivery | completed | cancelled | rejected`
- `source` `agent | manual` (later `web`)
- Customer: `customer_name`, `customer_phone` (E.164), `customer_email null`, `customer_user_id null`, `agent_thread_id null` → agent_threads
- Fulfilment: `fulfilment_method` `pickup | delivery`, `fulfil_on date`, `fulfil_from time null`, `fulfil_to time null`, `delivery_address jsonb null` `{line1, line2, city, postal_code, notes, lat, lng}`
- Money (snapshot at creation): `currency`, `subtotal_cents`, `delivery_fee_cents`, `total_cents`
- **Payment (reserved for Stripe, independent of `status`)**: `payment_status` `unpaid | paid | refunded | partially_refunded` default `unpaid`, `payment_method` `null | cash | card_in_person | bank_transfer | online`, `paid_at`, `amount_paid_cents`
- `customer_note` (≤ 1000), `internal_note` (owner only), `cancel_reason`
- `client_request_id text null` unique per owner (idempotency, see 6)
- Timestamps: `created_at`, `updated_at`, `confirmed_at`, `ready_at`, `completed_at`, `cancelled_at`, `expires_at` (pending only)

### `order_items`
- `id`, `order_id` (cascade), `product_id null` (on delete set null), **snapshots** `name`, `unit_label`, `unit_price_cents`, plus `quantity` (1–999), `line_total_cents`, `note` (≤ 300, "write 'Happy birthday Ana'")
- Max 30 lines per order.

### `order_events` (timeline + audit)
- `order_id`, `actor` `owner | agent | customer | system`, `type` (`created | status | edited | address | payment | note`), `from_status`, `to_status`, `data jsonb`, `created_at`

### `order_counters`
- `owner_user_id` pk, `last_number int` (bumped with `update … returning` inside the create RPC)

### Status machine (enforced in SQL, mirrored in `features/orders/domain/status.ts`)
```
pending ──confirm──▶ confirmed ──▶ preparing ──▶ ready ──▶ completed          (pickup)
   │                     │             │           └──▶ out_for_delivery ──▶ completed  (delivery)
   ├──reject──▶ rejected │             │
   └──expire/cancel──────┴─────────────┴──▶ cancelled
```
- `preparing` is optional (confirmed → ready is allowed).
- Stock is **held from creation** (also while pending, so two customers can't both get the last cake) and **given back** on `cancelled` / `rejected`. Never given back after `completed`.
- Payment never moves `status`. In the Stripe phase, a setting "payment required" will simply keep an order `pending` until `payment_status = paid`.

### Security (RLS + grants)
- RLS on every table. Owner **reads** own rows (`owner_user_id = auth.uid()`); `products`, `product_images`, `order_settings` owner **writes** directly (simple CRUD, plain columns).
- `orders` / `order_items` / `order_events`: **no direct writes** for `authenticated`. All changes go through RPCs so the status machine, stock and totals can't be bypassed (same idea as `20261105120000_booking_tables_read_only_for_clients`).
- No `anon` access at all in v1. Grants per `infra/rpc_grants_locked_by_default`: explicit `grant execute … to authenticated` only on owner RPCs; `agent_api.*` only to `agent_runtime`.
- Every RPC also checks `user_has_entitlement(owner, 'orders')` and `accepting_orders`, so a downgraded or paused business stops taking orders even from the agent.

### RPCs
| RPC | Caller | Does |
|---|---|---|
| `create_order_tx(owner, payload, source, actor)` (private core) | wrappers below | validates products (owner's, `active`, in date window, weekday, lead time, min/max qty), method enabled, date inside open hours and `max_days_ahead`, delivery minimum; **prices from DB only**; holds stock (`update … set stock_qty = stock_qty - q where stock_qty >= q`) or checks daily capacity under `pg_advisory_xact_lock(hashtext(product_id || fulfil_on))`; numbers the order; writes items + `created` event; returns the order with totals |
| `owner_create_order(payload)` | dashboard (manual order) | wrapper, `source = manual`, status `confirmed` |
| `owner_set_order_status(order_id, to, reason)` | dashboard | transition check, stock release on cancel/reject, timestamps, event, customer notice (see 7) |
| `owner_update_order(order_id, patch)` | dashboard | address, fulfilment date/time, notes, payment status/method (manual "mark as paid"); items edit only while `pending`/`confirmed`, re-balancing stock |
| `expire_pending_orders()` | pg_cron every 15 min | pending past `expires_at` → `cancelled` (actor system), stock back, owner notification |

Locale-aware helpers in SQL are kept minimal; display formatting stays in TS.

### Storage
- New public bucket `product-images`: 5 MB, `image/jpeg|png|webp`. Path `${owner}/${product_id}/${uuid}.webp`.
- Policies: insert/update/delete only inside the owner's folder; select scoped to owner (public URL still serves the file, like the other buckets after `20261101170000`).
- Browser resizes to max 1600 px WebP before upload. Deleting an image/product removes the files in the same server action.

### Notifications
- Extend `notifications_type_check` with `new_order`, `order_cancelled`, `order_expired`. Trigger on `orders` insert / status change, payload carries number, customer, total, `fulfil_on`, timezone (same shape habits as booking alerts) so the bell + live banner work.

## 4. Gating and plans

- **Dev only** first: `ORDERS_ENABLED` build-time env set like `BUSINESS_AGENT_ENABLED`; route pages check it inline and dynamic-import `features/orders/pages/*`. Verify a prod build ships zero Orders chunks (same check as My Agent on 2026-10-27).
- Plan flag `has_orders` on `subscription_plans` + `user_has_entitlement('orders')` + `PlanEntitlements.hasOrders`. Default Pro only (decision Q1). Demo perk: yes, so demos can show it.
- Admin: `nandzz-admin` PlanEditor gets the new flag.

## 5. Dashboard (owner)

Route `/dashboard/orders/[[...section]]`, Sidebar + Navbar entry "Orders" in the Business section next to Booking. Feature folder `src/features/orders/` (`domain/`, `data/`, `actions/`, `components/`, `pages/`, `server/`). Copy in a new `orders` dictionary section, **all 7 locales**, via a `useOrdersT()` hook like My Agent. Every sub-route has its own `loading.tsx`.

Tabs:
1. **Orders** (landing)
   - Top: counters "New (pending)", "To prepare", "Ready", "Today's pickups/deliveries".
   - Status chips: New · Active (confirmed + preparing) · Ready · Done · Cancelled; search by name/phone/number.
   - List **grouped by fulfilment day** (Today, Tomorrow, then dates), bounded height, rows show number, customer, items summary, total, method icon, time, status, unpaid badge. Built for 50+ orders a day.
   - **Order sheet**: items with notes, totals, customer (phone with WhatsApp link, "Open conversation" → My Agent Assistance when `agent_thread_id`), fulfilment (date/time, pickup point or address + Google Maps link), timeline from `order_events`, internal note, payment (Mark as paid + method).
   - Actions by status: Confirm / Reject (with reason) for pending; Preparing → Ready → Out for delivery → Completed; Cancel with reason; Edit address / date; Edit items (pending/confirmed only).
   - **New order** button: manual order for phone/Instagram/in-shop orders (product picker, quantities, customer, method, date).
2. **Products**
   - Grid of cards (cover image, name, price, availability badge: "12 in stock", "8/10 today", "Sold out", "Draft", "Seasonal").
   - Editor: images (upload, reorder, delete, max 6), name, description, category, price + unit, availability (mode, stock or daily capacity, min/max per order, lead time, date window, weekdays), status. Quick inline "+/- stock" and "Sold out" toggle on the card.
   - Empty state with a short guide (the agent can only sell what's here).
3. **Settings**
   - Accepting orders switch (with "paused" banner across the tab), currency, timezone, pickup (address via Places, hours), delivery (fee, free-over, minimum, area text, hours), default lead time, max days ahead, pending expiry, notes for customers.
   - Agent behaviour lives in **My Agent → Settings** as new capability rows (see 6) so all autonomy stays in one place; this tab links there.

## 6. WhatsApp agent

### New autonomy capabilities (`agent_settings.autonomy`)
- `new_order`: `off | pending | confirm` (default `pending`: owner confirms in the dashboard)
- `cancel_order`: `off | pending | confirm` (default `confirm` while the order is still `pending`; once confirmed always goes to the owner)
Migration adds the keys to existing rows; `agent_private.autonomy()` already reads any key.

### `agent_api` RPCs (token-verified, scope from the token only)
| RPC | Returns / does |
|---|---|
| `list_products(token)` | active, currently orderable products: id, name, short description, price, unit, availability summary, earliest fulfilment date; plus order settings the customer needs (methods, delivery fee/min/area, notes, currency). Never `internal` fields. Empty with `accepting=false` when paused/not entitled |
| `product_availability(token, product_ids, date)` | per product: orderable that day? remaining units; if not, the next days that work |
| `create_order(token, items, method, fulfil_on, from, to, address, customer_name, note, request_id)` | wraps `create_order_tx`; `customer_phone` = verified `wa_id`, `agent_thread_id` from token; status from autonomy (`pending` → also an approval row so the existing approve/notify loop works; `confirm` → `confirmed`); idempotent on `request_id` |
| `my_orders(token)` | the customer's open orders at this business (made in this chat OR `phone_matches(customer_phone, wa_id)`), minimal columns |
| `cancel_order(token, order_id)` | ownership check + autonomy + only `pending`/`confirmed`, else `too_late` |
| `update_order_address(token, order_id, address)` | only own order, only before `out_for_delivery` |

Abuse limits inside `create_order`: max 3 open (`pending`) orders per customer per business, max 30 lines, quantity caps. A spammer can't lock all the stock.

### Worker (`business-agent`)
- `tools.ts`: tool defs + handlers for the six RPCs (strict schemas, nullable fields, like the booking tools). Worker validates ids against `list_products` output and returns helpful errors ("unknown product_id, use one from list_products").
- `prompt.ts`: an "orders" section, only included when the business has orders enabled (from `get_context`). Rules: ask what they want → quantities → pickup or delivery → day (and time window) → for delivery **ask for the full address** → read back a summary **with the total returned by the tool, never a computed one** → create only after an explicit yes. Prices only from tools. Say how payment works using `notes_for_customers` (no payment links in v1).
- `get_context` returns `orders_enabled` so booking-only businesses see no order tools (fewer tokens, no confusion).
- Owner decisions: `owner_set_order_status` confirm/reject on an agent order → `notify-worker` → worker writes the customer message (reuse the approval-decided endpoint with a `kind: 'order'`).

### Customer messages on status changes
- Inside the 24 h WhatsApp window: the agent sends a short message (confirmed, rejected + reason, ready for pickup, out for delivery).
- Outside it: needs a Meta-approved template; v1 skips and the dashboard shows "customer not notified (WhatsApp window closed)" so the owner can text them. Email when `customer_email` is set reuses the booking-notifications edge fn pattern later (Phase 5).

## 6a. Everything the owner configures (single list)

Where it lives in brackets. Anything not here is fixed by Nandzz (platform limits, set from the admin portal, see 6c).

| Area | Setting | Default |
|---|---|---|
| General [Orders → Settings] | Accepting orders on/off | off |
| | Pause until a date + message the agent gives ("Back on 3 Jan") | none |
| | Currency (warns that existing prices aren't converted) | calendar currency / locale |
| | Timezone | calendar / profile |
| | Max orders per day, whole business (kitchen capacity) | unlimited |
| Pickup | On/off, address (Places), pickup hours per weekday, time-slot size (30/60 min or "any time that day") | on, 60 min |
| Delivery | On/off, fee, free over amount, minimum order, area text, delivery hours, time-slot size | off |
| Scheduling | Default lead time, max days ahead | 24 h, 30 days |
| Confirmation | Pending expiry (hours) | 24 h |
| | Agent: new order `off / pending / confirm`, cancel `off / pending / confirm` [My Agent → Settings] | pending / confirm |
| Customer policy | Cancel cutoff (hours before fulfilment a customer can still cancel through the agent) | 24 h |
| | Ask the customer for an email (optional / required / never) | optional |
| | Texts: payment instructions, allergens & ingredients note, cancellation policy (shown by the agent and in emails) | empty |
| Notifications [Orders → Settings → Notifications] | Owner: email on new order, on customer cancel, on pending about to expire, daily summary of tomorrow's orders (each on/off) | new order + expiry on |
| | Customer emails per event (received, confirmed, rejected, cancelled, ready, out for delivery) | all on |
| Products [Products tab] | name, description, category, images, price + unit, status, stock mode + numbers, min/max per order, lead time, date window, weekdays | |
| Categories | order of categories (drag) | alphabetical |

Settings that are both owner and plan bound (product count, monthly orders) show "x of y used" with an upgrade CTA.

## 6b. Emails

**Yes, emails are needed**, but we **don't build a new email system**: the booking emails already run fully inside Supabase (DB triggers → pgmq queue → `*/1` drain → `booking-notifications` edge fn → **Amazon SES**, templates as editable HTML in `app_settings`, edited in admin `/email-templates`). Orders plug into the same pipeline.

Who gets what:
| Event | Customer (only if `customer_email` set and the owner left it on) | Owner |
|---|---|---|
| Order created (pending) | "We received your order #0042" with items, total, day, method, payment instructions | "New order #0042" + link to the dashboard |
| Created already confirmed / confirmed | "Your order is confirmed" | — |
| Rejected / cancelled by owner | with the reason | — |
| Cancelled by customer (agent) | confirmation | "Order #0042 was cancelled" |
| Pending expires in 2 h / expired | — / "Your order could not be confirmed" | reminder / expired notice |
| Ready for pickup / out for delivery | yes | — |
| Daily summary (evening, owner tz) | — | tomorrow's orders, if setting on |

How:
- `orders.customer_locale` (agent: the customer's language; manual: owner picks, default owner locale) so customer emails go out in their language. Owner emails in the owner's locale. All 7 locales seeded.
- Trigger on `orders` insert / status change and on settings-driven events enqueues `{kind, order_id, event_id}` on a new pgmq queue `order_notifications`; the **existing drain** gets an `order` branch (or a sibling `order-notifications` edge fn sharing `ses.ts`/`render.ts`, decision at build time; same cron model, no http fan-out). Next.js never sends emails.
- Templates: new `app_settings` row `order_email_template`, shape `customer | business → kind → locale → {subject, html}`, seeded by migration, edited in admin `/email-templates` (new "Orders" tab), same variables approach (`{{order_number}}`, `{{items_table}}`, `{{total}}`, `{{fulfilment}}`, `{{business_avatar}}`, brand colours, Nandzz footer).
- Dedupe: one email per `(order_id, event_id, recipient)`, send log table `order_email_log` (status, SES message id, error) for admin reports.
- Reply-to = the business contact email, so customers answer the business, not Nandzz.
- WhatsApp stays the main channel for agent orders; email is the receipt.
- Pre-req that already exists: SES configured in the edge fn (`booking-notifications/ses.ts`). The Next-side `email.ts` (still Resend) is not used by Orders.

## 6c. Admin portal (nandzz-admin), Nandzz controls

Everything Nandzz decides is edited in the admin portal, never hard-coded and never editable by owners. Admin keeps its prod/dev switch.

| Admin page | Controls |
|---|---|
| **Features** (`/features`) | Global runtime switch `orders_enabled` (app_settings) checked by every order RPC and the agent: one click stops new orders platform-wide without a deploy. Agent order tools on/off separately (`orders_agent_enabled`). |
| **Plans** (`/plans`) | `has_orders` flag per plan; limits per plan: `orders_product_limit`, `orders_monthly_limit` (null = unlimited). |
| **Platform limits** (Features → Orders) | `orders_limits` app_setting: max images per product (6), max lines per order (30), max quantity per line (999), max pending orders per customer (3), max pending expiry (72 h), max days ahead cap (365), customer emails per address per day (10). RPCs read them; defaults in code only as fallback. |
| **Users** (`/users/[id]` → Orders panel) | Per business: comp access (like widget comp grants), override limits, **suspend orders** with reason (business sees a banner; RPCs refuse), counts (products, orders by status, last order). |
| **Email templates** | Orders tab: customer/business templates per event and locale, live preview, test send. |
| **Reports** | Orders adoption (businesses with orders on, with ≥1 order), volume per day, order value (sum of totals, flagged "not processed by Nandzz"), confirm/reject/expiry rates, email send failures, abuse signals (one phone with many expired/cancelled orders across businesses). |
| **WhatsApp** | Later: Meta templates for order status messages (same HX mapping as the reminder template). |

Rules for admin:
- Admin-only data lives in its own table `order_admin_controls (owner_user_id pk, suspended, suspended_reason, limit overrides, comp_until, updated_by, updated_at)`: owners can read their own row (to show the banner) but never write it.
- Admin sees **aggregates** by default. Order detail with end-customer data (names, phones, addresses) only when the business turned on Support access (same rule as `find_profile`), and every admin read of order detail is written to an audit log.
- Every admin change is logged (who, what, before/after).

## 7. Phases (each ends with typecheck + lint + tests; dev only until Phase 6)

**Phase 1: Database** (portal)
- Migration: tables, enums/checks, indexes (`orders(owner_user_id, fulfil_on)`, `orders(owner_user_id, status)`, `order_items(product_id)`), RLS, bucket + policies, counters, RPCs, notification types, `has_orders` flag + entitlement, autonomy keys, expiry cron.
- `npm run db:push:dev`. SQL checks on dev: two parallel orders for the last unit (only one wins), daily capacity race, cancel gives stock back, a non-owner can't read/write anything, `anon` gets nothing.
- Types in `lib/types.ts`, `plan.ts` mapping.

**Phase 2: Products tab**
- Domain (`availability.ts`: is a product orderable on a date, lead time in the business timezone) with unit tests; actions (create/update/archive/delete, image upload/remove/reorder); UI; 7-locale copy.

**Phase 3: Orders + Settings tabs**
- Data loaders, list + sheet, status actions, manual order, edit order, settings form, bell + live banner for `new_order`, Sidebar/Navbar entry, skeletons. Tests for status machine and totals.

**Phase 4: Agent**
- `agent_api` order RPCs (portal migration) + worker tools + prompt section + autonomy rows in My Agent Settings + owner decision → customer message. Test end to end in the **Debug WhatsApp** view (`npm run debug`): browse, order pickup, order delivery with address, sold out, too-early date, cancel, owner confirm/reject.

**Phase 5: Emails + admin**
- Emails (6b): queue, drain branch, seeded templates in 7 locales, send log, owner/customer toggles, daily summary cron; redeploy the edge fn on dev.
- Admin (6c): Features switch + limits, Plans fields, Users → Orders panel (comp, overrides, suspend), Email templates Orders tab, Reports, audit log.
- Customer WhatsApp status messages, pending-expiry alerts, "customer not notified" hint.

**Phase 6: Go live**
- Prod migration (`npm run db:push:prod`, remember it applies every pending migration), flag on, plan copy (pricing page, `pricing.md`, `llms.txt`, `/guide`) in 7 locales, legal update (privacy: order + address data; terms: Nandzz is not the seller, the business is responsible for products, allergens, consumer rights and taxes), admin flag. Worker deploy is already a My Agent go-live dependency.

## 8. Payment gap (Stripe later, what's already prepared)

- Money as cents + currency, totals computed server-side, `payment_status` separate from `status`: nothing in v1 needs to change.
- The business must receive the money, so this will be **Stripe Connect** (connected account per business, Nandzz optional application fee), not the Nandzz platform account used for plans.
- Future pieces: `order_payments` table (`order_id`, Checkout Session / PaymentIntent ids, amount, status, refunds), a separate Connect webhook endpoint, setting `payment_required` (order stays `pending` until paid; stock hold uses the same expiry), agent tool `send_payment_link`, refunds from the order sheet.

## 9. Later (not v1)

Product options/variants (size, flavour with price deltas), public order page on the profile (`/[username]/order`), sending product photos in WhatsApp, multiple pickup points (reuse booking locations), orders analytics (revenue, top products), unified customers view across bookings and orders, Meta templates for status messages, MCP tools (kept out on purpose, like the booking widget).

## 10. Open decisions (defaults in brackets, used unless Felipe says otherwise)

1. Which plan gets Orders? [Pro only, demos as perk]
2. Do pending orders hold stock? [Yes, until confirm/reject or expiry after 24 h]
3. Agent default for new orders? [`pending`, owner confirms]
4. Keep delivery addresses forever? [Keep with the order; offer an auto-purge of address + phone N months after completion in Phase 6 if the lawyer asks]
5. Name in the UI: "Orders" / IT "Ordini" / PT "Encomendas"? [Yes]
6. Plan limits for Pro (products / orders per month)? [unlimited for now, fields exist in admin]
7. Should the agent always ask for an email? [optional, owner setting]
8. Separate edge fn for order emails or a branch in `booking-notifications`? [branch, shared SES/render code; split later if it grows]

## Revision log

**Pass 1 (gaps and edge cases), changed:**
- Added `daily` stock mode: encomendas are made to order, so "10 a day" matters more than units on hand.
- Snapshots on `order_items` (name, price, unit) so price edits or product deletion never change past orders; products can be archived.
- Stock held while `pending` + auto-expiry cron, otherwise two chats could sell the last item.
- Added `rejected` (owner said no) apart from `cancelled`, and `out_for_delivery` for delivery orders.
- Added lead time, date window, weekdays, `max_days_ahead`, delivery minimum and free-delivery threshold.
- Added owner edit of items/address/date (customers change their minds) with stock re-balancing.
- Added manual orders: owners also take orders by phone and Instagram; one dashboard for all.
- Order list grouped by fulfilment day and built for volume (bounded height, no component scrollbars).

**Pass 2 (security, agent, payments), changed:**
- Orders tables are read-only for clients; every write goes through RPCs (status machine, stock and totals can't be skipped).
- Prices and totals only from the DB; the agent reads back the tool's total, never its own math.
- Customer phone from the verified `wa_id`, never from the model; agent sees only its customer's orders.
- Idempotency key on agent `create_order` (worker retries must not double-order).
- Abuse limits: max 3 pending orders per customer, line and quantity caps.
- Entitlement + `accepting_orders` checked inside the RPCs, not only in the UI.
- Order tools only when the business has orders on (`get_context`), so booking-only agents don't change.
- Payment kept orthogonal to status and planned on Stripe Connect (money to the business), with the exact future tables listed.
- 24 h WhatsApp window called out: no silent failures, the dashboard says when the customer wasn't told.
- Legal items added to go-live (seller responsibility, address data).

**Pass 3 (after adding owner configuration, emails and admin; security review of the whole plan), changed or made explicit:**

Database and RPCs
- Owner RPCs take **no owner id parameter**: owner = `auth.uid()`, and every `order_id` is re-checked `owner_user_id = auth.uid()`. The core `create_order_tx` is private (revoked from everyone, called only by wrappers).
- Every SECURITY DEFINER function: `set search_path = ''`, schema-qualified names, `revoke all … from public, anon` then explicit grants.
- Owner-writable tables get `with check (owner_user_id = auth.uid())` and CHECK constraints (price ≥ 0, stock ≥ 0, lengths, fee ≥ 0) so a hand-crafted request can't write junk. Product limit enforced by a trigger, not just the UI.
- `product_images` insert checks the product is the owner's **and** the path starts with the owner's folder.
- Admin-only fields (suspend, overrides) in a separate table owners can't write. Owners can never flip their own entitlement or suspension.
- Totals stored as `bigint` cents (quantity × price can't overflow).
- Races: owner confirm vs expiry cron vs customer cancel all use conditional updates (`where status = 'pending'`) and lock the order row (`for update`) before stock changes; daily capacity uses `pg_advisory_xact_lock(hashtextextended(product_id || fulfil_on, 0))`.
- Idempotency key built by the **worker** from the WhatsApp message id, never by the model.
- Orders are not added to the Realtime publication; live alerts go through `notifications` (RLS owner-only).
- Dashboard search: never interpolate user text into PostgREST `.or()` / `ilike` filter strings (filter injection); escape `%`, `_`, `,`, `(`, `)` or search through an RPC.
- Account deletion must also delete `product-images` files and order rows; add Orders to the existing deletion routine.

Agent
- Prompt injection can't change prices, stock, status or scope: all of that is decided in SQL from the verified token. Prompt rules are UX only.
- Agent responses include an address only for the chat customer's own orders.
- A manual order with a phone number becomes visible/cancellable from that number's WhatsApp chat (same rule as bookings by phone). Documented, intended.

Emails
- Every template variable is **HTML-escaped** in the renderer (customer notes, names and product descriptions are user text); subject variables have newlines stripped (header injection).
- Emails go only to an address the customer gave for that order, at most one per event, and capped per address per day (admin limit), so the agent can't be used to spam a third party's inbox.
- No tokenized "manage your order" links in v1 (no public order page yet), so nothing in an email grants access.

Storage and privacy
- Images re-encoded to WebP in the browser (drops EXIF/GPS of home kitchens); bucket keeps size + MIME limits server-side.
- Admin sees customer data only with Support access, with an audit log; reports are aggregates.
- Order data retention and the address purge option go to the lawyer with the go-live legal update (privacy + terms: Nandzz is not the seller; prohibited products in the acceptable-use terms, admin can suspend).

Nothing found that requires changing the overall design; these items are now build requirements for Phases 1, 4 and 5.
