# Feature-Based Architecture Migration

Living roadmap for moving the Portal from a layer-based structure (`components/`,
`lib/`, `app/api/`) to **feature-based** modules under `src/features/`, where each
feature owns its data access and **UI never touches Supabase directly**.

Status: **✅ MIGRATION COMPLETE — all 8 features shipped + `auth` gap closed** (`social` + `collections` + `comments` + `profile` + `spaces` + `booking` + `agent` + `analytics`/layout-chrome, and now `auth`). Every UI feature now owns its data access through a server-only `data/` layer and zod-validated Server Actions; no client component imports `@/lib/supabase/*` directly (lint-enforced under `src/features/*/components/**`). Auth is now migrated too: the login/signup/reset/change-password/phone/delete-account UI lives under `features/auth/`, with session-mutating Supabase Auth calls wrapped in a client-side `auth.ts` (outside `components/`, mirroring `analytics/auth.ts`) so they preserve exact browser-session behavior, and the setup-username profile claim folded into a `claimSignupProfile` Server Action.

---

## 1. Why (context)

The layout was never the real problem — the missing **data-access boundary** was:

- ~259 `.from()` + 15 `.rpc()` calls across ~100 files; **37 inside `"use client"`
  components**. Table names, `auth.getUser()` checks, and error handling inlined next
  to JSX.
- Three uncoordinated data paths with no rule: direct browser-client `.from()` in
  components, raw `fetch('/api/*')` (39 places), and Server Actions (only 2 existed).
- No repository/service layer, no react-query/SWR, no zod.

Goal: each feature exposes a small public API; reads go through a server-only `data/`
layer, mutations through zod-validated Server Actions. Fix the boundary **as** we
colocate — one feature per PR, app shippable throughout.

---

## 2. Target layout & conventions

```
src/features/<feature>/
  components/    "use client"/presentational only — NO @/lib/supabase import (lint-enforced)
  data/          server-only reads: `import "server-only"`; take a SupabaseClient arg
  actions/       "use server" mutations; zod-validated; return a discriminated result
  hooks/         optional client hooks
  schemas.ts     zod schemas
  types.ts       feature-owned types (optional; shared types stay in @/lib/types for now)
  index.ts       CLIENT-SAFE barrel (components, action/type re-exports)
  server.ts      SERVER-ONLY barrel (data/ read helpers)
```

**Non-negotiable rules**
1. **Split barrels.** `index.ts` must be safe to import from a Client Component.
   Anything that transitively pulls `import "server-only"` (i.e. the `data/` layer)
   goes in `server.ts` only. Server Components import reads from `@/features/<f>/server`;
   everyone imports components/actions from `@/features/<f>`.
2. **Actions use the SSR server client** (`@/lib/supabase/server`), not the admin
   client, so RLS stays the real guard. The in-action `auth.getUser()` check is
   defense-in-depth. Use the admin client only where a route legitimately must bypass
   RLS (and document why).
3. **Discriminated result contract** (mirrors `lib/actions/publish-space.ts`):
   `{ ok: true, ...data } | { ok: false, error: CODE, message? }`. Client reconciles
   local optimistic state from the `ok:true` payload; on `ok:false` reverts and, for
   `UNAUTHENTICATED`, routes to `/login`.
4. **zod at the action boundary.** Server Actions are POST-reachable independently of
   the UI — validate every input. IDs are Postgres `gen_random_uuid()` → use `z.uuid()`
   (zod v4 enforces RFC-4122 variant bits; test fixtures must be real v4 UUIDs).
5. **Keep `router.refresh()`** in mutation components (inside the transition) for
   cross-view consistency, on top of reconciling from the action result.

**Stays shared (do not move into features):** `components/ui/`, `components/layout/`,
`lib/supabase/`, `lib/utils.ts`, `lib/i18n/`, `contexts/`, `lib/types.ts` (for now).

---

## 3. Per-feature recipe (the loop executes this, one feature per iteration)

1. **Scaffold** `src/features/<f>/{components,data,actions,index.ts,server.ts}` (+`schemas.ts`).
2. **Move components** in; delete their `@/lib/supabase/*` imports.
3. **Extract data access**: every `.from()/.rpc()` becomes either a `data/` read
   (server-only, takes a `SupabaseClient`) or an `actions/` mutation (`"use server"`,
   zod-validated, discriminated result). Replace client `fetch('/api/*')` **mutations**
   with actions. Keep `/api/*` routes only where a real HTTP endpoint is required
   (webhooks, MCP, public widget embed) — do not convert those.
4. **Rewire imports**: point route/page/component imports at the feature barrels;
   route server-page reads through `@/features/<f>/server`. Delete the old files.
5. **Guardrail**: the ESLint `no-restricted-imports` rule in `eslint.config.mjs` already
   globs `src/features/*/components/**` — no per-feature change needed; it auto-covers
   new features. (Widen beyond `features/` only once a whole domain is migrated.)
6. **Tests**: add colocated `*.test.ts` for each new action + data module (see the
   `features/social` tests for the Supabase-stub pattern). `server-only` is aliased to a
   no-op in `vitest.config.ts` so `data/` layers are testable.
7. **Verify** (all must pass): `npx tsc --noEmit`, `npx eslint src/features`,
   `npx vitest run src/features/<f>`.
8. **Update this doc's checklist**, then **commit directly to `main`** (no branches,
   no push — per project instruction). One commit per feature.

---

## 4. Requirements / one-time setup (done in the pilot)

- [x] `zod` dependency added (v4).
- [x] ESLint guardrail (`no-restricted-imports`, `@/lib/supabase/*`) scoped to
  `src/features/*/components/**`.
- [x] `server-only` aliased to `src/test/server-only-stub.ts` in `vitest.config.ts`.
- [x] Discriminated-result + split-barrel conventions established by `features/social`.

---

## 5. Migration checklist (order = isolation & value)

| # | Feature | Scope highlights | Status |
|---|---------|------------------|--------|
| 0 | **social** (likes+follows) | LikeButton, FollowButton; reads across 5 server pages | ✅ done (pilot) |
| 1 | **collections** | AddToCollectionDialog, StarButton, NewCollectionForm, CollectionActions; `is_public:false` invariant | ✅ done |
| 2 | **comments** | `features/comments/*` — post/reply/like/mentions actions + reads; delete kept as `/api` route (admin-authorized); dead notification props pruned from prop chain | ✅ done |
| 3 | **profile** | ProfileBackground, EditProfileDialog, ProfileHeader, GalleryModal, settings/brand pages, **FollowList** (deferred client list); storage uploads kept client-side | ✅ done |
| 4 | **spaces** | biggest — done across two sub-PRs (4a display+lifecycle, 4b editors) | ✅ done |
| 4a | **spaces — display + lifecycle** | SpaceCard, SpaceGrid, SpacePreview, SpaceOwnerMenu, Delete/DuplicateSpaceButton, Share*; `deleteSpace` (folds `lib/delete-space.ts`) + `duplicateSpace` (folds the `/api/spaces/[id]/duplicate` route) actions; cross-feature `profile.setSectionVisibility` + `collections.removeSpaceFromCollection`. Fixed a latent bug: SpaceCard's inline delete skipped storage cleanup — the folded action always cleans up | ✅ done |
| 4b | **spaces — editors** | HtmlSpaceEditor, MarkdownSpaceEditor, AiAssistantPanel, builders/ + `hooks/useContentBuilderForm`, HashtagPicker, PreviewCropper, passive viewers (Pdf/Markdown/Video/Iframe/ViewTracker). New: `publishSpace` (folds `lib/actions/publish-space.ts`), `updateSpace`, `resolveAiEditJob`, `loadHashtagSuggestions` actions + `data/hashtags` read + `server.ts`. Client-only `storage.ts` (all space uploads: html/pdf/image/preview) and `realtime.ts` (ai-edit job subscriptions) live outside `components/` per the guardrail. **Kept as routes** (real HTTP endpoints, not simple mutations): `/api/spaces/[id]/ai-edit(+/[jobId])` async job, `/api/spaces/[id]/assets` (GrapeJS asset manager). Deleted dead `TagPicker` stub | ✅ done |
| 5 | **booking / widgets** | all of `components/widgets/**` → `features/booking/components/**` (calendar/ + agent/ + WidgetStrip/AddWidgetButton/widgetIcon). Data access `features/booking/domain/server.ts` → `data/widgets.ts` (admin-client public reads; behind `server.ts`). UI-only helpers `chime.ts` + `calendarStats.ts` folded into the feature. New `createWidgetInstance` + `updateWidgetInstance` actions (fold + delete `POST /api/widgets/instances` and `PATCH /api/widgets/instances/[id]` — no GET consumers). Client-only `realtime.ts` (widget_bookings INSERT subscription) + `storage.ts` (staff/location avatar uploads) live outside `components/` per the guardrail. **Kept as routes** (real public HTTP endpoints): `/api/widgets/[instanceId]/availability` (GET), `/api/widgets/[instanceId]/book` (POST), `/api/widgets/bookings/[token]` (GET/PATCH/DELETE, token-auth). **Shared I/O-free domain logic stays in `@/features/booking/domain/*`** (`calendar`, `messages`, `emails`, `contact`, `booking-errors`, `notify`) — like `@/lib/types`/`@/lib/utils`, the kept routes + their tests depend on those paths | ✅ done |
| 6 | **agent** | AgentChat(+Overlay), AgentStudio, AgentSettings, AgentPublic, SetupAssistant. New: `createAgentDocument`, `updateAgentDocument`, `deleteAgentDocument`, `embedAgentDocument`, `loadAgentDocuments`, `saveAgentSettings` actions (fold the `/api/agent/documents/*` + `/api/agent/settings` internal mutation routes) + `data/documents` read + `server.ts`. **Kept as routes** (LLM streaming — can't be Server Actions): `/api/agent/chat`, `/api/agent/setup-chat`. Shared I/O-free logic (`lib/agent/templates`, prompt builders) stays in `@/lib/agent/*` like `lib/utils` | ✅ done |
| 7 | **analytics + layout chrome** | Chrome (Navbar, Sidebar, MobileTabBar, NotificationBell, AiJobsIndicator) + analytics UI (ViewsChart, AnalyticsPeriodControl) → `features/analytics/components/**`. Analytics reads `lib/analytics.ts` → `data/analytics.ts` (admin-client aggregates behind `server.ts`); root-layout SSR profile seed → `data/profiles.ts`. New actions: `recordSpaceView` (folds `lib/actions/record-view.ts`; admin insert so anonymous views count, owner guarded server-side), `markNotificationsRead`, `deleteAiJob`. Browser-only chrome concerns live OUTSIDE `components/` per the guardrail: `auth.ts` (Supabase Auth session + reactive profile read — the chrome CANNOT import `@/lib/supabase/*`, so getUser/onAuthStateChange/signOut are wrapped here) and `realtime.ts` (notification + AI-job subscriptions with their paired mount reads). AppChrome stays in `components/layout/` (shared shell) but now sources chrome from `@/features/analytics` and its profile read from `@/features/analytics/auth`. **Kept**: no analytics `/api/*` routes existed to keep. Dead `ProGate.tsx` left in `components/analytics/` (unused, out of scope) | ✅ done |
| 8 | **auth** | `components/auth/*` (AuthForm, ForgotPasswordForm, ResetPasswordForm, ChangePasswordForm, PhoneVerificationForm) + a new extracted `DeleteAccount` → `features/auth/components/**`; login/forgot-password/reset-password/settings pages rewired to the barrel. **All session-mutating Supabase Auth calls stay client-side** in `features/auth/auth.ts` (outside `components/`, mirroring `analytics/auth.ts`): `signInWithPassword`, `signUpWithMetadata`, `signInWithGoogle` (OAuth redirect), `sendPasswordResetEmail`, `updateUserPassword`, `updateUserPhone`, `verifyPhoneOtp`, `hasActiveSession`/`getPhoneInfo` (live-session reads), `signOutUser`. Reason: these mutate the live browser session the chrome observes via `onAuthStateChange` — converting them to Server Actions would set cookies server-side without notifying the browser client, a behavior change (safety-first: behavior preserved exactly). **One Server Action**: `claimSignupProfile` folds setup-username's `claim_signup_profile` RPC + getUser check — a pure data write that sets no auth cookies (zod-validated, discriminated result). **Kept as a route**: `DELETE /api/account/delete` (needs the admin client to remove the auth user); `DeleteAccount` calls it then `signOutUser`. No `data/`/`server.ts` (no server-only reads) | ✅ done |

---

## 6. Deferrals & gotchas (read before each iteration)

- **FollowList** — ✅ done in the profile migration: the client component now calls a
  `loadFollowList` Server Action (offset-paginated) instead of a browser `.from()` join.
  Same pattern used for `GalleryModal` (`loadGalleryPage`) and the settings/brand pages
  (`loadMyProfile`).
- **Storage uploads pattern (established by profile):** the 1.5 MB avatar/cover/logo
  image cap exceeds the default Server-Action body limit, and there is no
  `serverActions.bodySizeLimit` override — so uploads stay **client-side** (browser →
  Supabase, in a feature module OUTSIDE `components/` so the guardrail is satisfied:
  `features/profile/storage.ts`). Only the resulting relational row-write goes through a
  Server Action. Reuse this split for the **booking** feature's Staff/Location uploads.
- **Pre-existing failing tests** (NOT caused by this migration — confirmed identical on
  clean `main`; do not chase them): `src/app/api/widgets/[instanceId]/availability/route.test.ts`,
  `src/app/api/widgets/bookings/[token]/route.test.ts`, `src/components/spaces/SpaceGrid.test.tsx`.
  Also a pre-existing lint error in `ProfileHeader.tsx` (`react-hooks/set-state-in-effect`
  on the avatar effect). Scope verification to `src/features/**` to avoid the noise.
- **Next.js 16 is modified** (see `AGENTS.md`): read `node_modules/next/dist/docs/` before
  using an unfamiliar Server-Action / cache API rather than assuming training-data behavior.
- **collections**: preserve the `is_public: false` default on every collection insert
  (DB default is still `true`) — see the collections memory.

---

## 7. Autonomous loop operating instructions

When continuing this migration unattended:

1. Read this doc's checklist; pick the **first `⬜ todo`** feature.
2. Execute the **§3 recipe** for exactly **one** feature per iteration. Do not batch.
3. Verify scoped to `src/features/**` (§3.7). If anything is red, **stop the loop** and
   report — do not commit a broken feature.
4. On green: update the checklist row to ✅, then **commit directly to `main`** (no
   branches — per project instruction). One commit per feature. **Never push, never
   open a PR** without explicit user approval.
5. Stop the loop and ask the user when a feature needs a product decision (e.g. a client
   list that needs a new fetch pattern, or a `/api/*` route whose fate is unclear).
6. Keep commits small and messages descriptive; end with the Co-Authored-By trailer.
