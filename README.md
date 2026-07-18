# nandzz

**The home for AI-generated web apps.**

nandzz is a platform where you can save, host, and share the web apps you build with AI tools like Claude or ChatGPT. Drop in raw HTML or link a URL — your creation gets its own Space, a public page where the world can discover and like it.

---

## What is a Space?

A **Space** is a shared web app. It has:

- A title and description
- A URL or uploaded HTML file
- A preview image
- A like count
- A public profile page for its author

---

## Features

- **Upload HTML or link a URL** — paste your AI-generated code or point to any live URL
- **Public feed** — browse what the community is building on the Explore page
- **User profiles** — public pages with all Spaces from a given creator
- **Likes** — upvote the Spaces you find useful or cool
- **Dark mode** — full light/dark theme support
- **Auth** — email/password sign up and login via Supabase

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Base UI variant) |
| Auth & DB | Supabase |
| Storage | Supabase Storage |

---

## Getting Started

### 1. Prerequisites

- **Node.js 20+** and npm
- Access to the **cloud DEV Supabase project** (anon + service-role keys)
- Supabase CLI (installed as a devDependency, no global install needed) — used for `db push` and `functions deploy` against the cloud project

> Dev runs against a cloud Supabase dev project, not a local stack. No Docker needed.

### 2. Clone and install

```bash
git clone https://github.com/nandzz/nandzz.git
cd nandzz/Portal
npm install
```

### 3. Configure env

Two env files live next to `package.json` (both gitignored). Copy from `.env.example` if they don't exist:

| File | Purpose |
|---|---|
| `.env.local` | **Day-to-day dev** — points at the **cloud DEV** Supabase project. Used by `npm run dev`. |
| `.env.production.local` | **Optional, prod-mirror testing** — points at the live PROD Supabase project. Used by `npm run dev:prod` to verify a change against real data before deploying. |

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from **Supabase Dashboard → (project) → Settings → API**. Configure Google OAuth in the Supabase Dashboard (Authentication → Providers → Google) — no env vars needed for that on the cloud project.

### 4. Run dev

```bash
npm run dev
```

Starts Next.js at [http://localhost:3000](http://localhost:3000), wired to the cloud DEV Supabase project. Emails go out for real (the dev project is configured with real SMTP) — sign up with an address you control.

### 5. Useful scripts

```bash
npm run dev               # Next dev against the cloud DEV Supabase project
npm run dev:prod          # Next dev against the cloud PROD Supabase project
npm run db:push           # apply supabase/migrations/ to the linked cloud project
npm run functions:deploy  # deploy edge functions to the linked cloud project
```

### 6. Editing the schema

`supabase-schema.sql` at the repo root is the canonical schema. To apply changes to the cloud DEV project you have two options:

1. **SQL editor** — paste the new statements into the cloud Supabase Studio's SQL editor and run. The schema is idempotent (`if not exists`, `add column if not exists`), so re-runs are safe.
2. **CLI** — author a migration in `supabase/migrations/` and run `npm run db:push` against the linked DEV project.

Always apply schema changes to **DEV first**, verify the app still works, then repeat on PROD.

### 7. Edge function secrets

Cloud edge function secrets are managed via the Supabase Dashboard (Edge Functions → (function) → Secrets) or `supabase secrets set --project-ref <ref>`. Local `supabase/functions/.env` is no longer used in this workflow.

### 8. Testing against production

Before deploying, sanity-check the change against real prod data:

```bash
npm run dev:prod
```

This loads `.env.production.local` (real Supabase URL, real service-role key, real Stripe webhook) and runs Next dev. **Read-mostly testing only — any mutation is a real prod write.**

---

## Project Structure

```
src/
  app/                  # Next.js App Router pages
    dashboard/          # Authenticated user area (create, edit spaces)
    explore/            # Public feed of all spaces
    profile/[username]/ # Public user profiles
    space/[id]/         # Individual space viewer
    login/              # Auth page
  components/
    spaces/             # SpaceCard, SpaceForm, SpaceGrid, LikeButton
    layout/             # Navbar, Footer
    profile/            # ProfileHeader, ProfileTabs
    ui/                 # shadcn/ui primitives
  lib/
    supabase/           # Client and server Supabase helpers
    types.ts            # Shared TypeScript types
```

---

## License

MIT
