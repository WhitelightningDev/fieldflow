# FieldFlow Billing

FieldFlow Billing is a Vite + React + Supabase field-service dashboard for trade businesses, with a strong focus on plumbing, electrical, applicance repair and Refrigeration operations (dispatch, service calls, compliance, inventory usage, and billing visibility).

## What you get

- **Owner/office dashboard** (`/dashboard`): overview KPIs, dispatch timeline, live technician status (GPS), job cards, customers, sites, inventory, teams, messages.
- **Technician dashboard** (`/tech`): job flow, time logging, photos, parts used, messaging (feature set varies by route).
- **Plumbing service calls**: logged as plumbing `job_cards` with searchable `#tags` in notes (e.g. `#service-call`, `#gas-coc`, `#pressure-test`, `#pirb-coc`, `#after-hours`).

## Tech stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind
- Supabase (Auth, Postgres, Storage, Edge Functions)

## Local development

1) Install dependencies

```sh
npm i
```

2) Create `.env` in the project root:

```sh
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
```

3) Run the app

```sh
npm run dev
```

Then open the URL printed by Vite.

## Scripts

```sh
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm test         # run vitest
npm run lint     # eslint (note: repo may contain legacy lint errors)
```

## Database / Supabase

- SQL migrations live in `supabase/migrations`.
- Supabase client is in `src/integrations/supabase/client.ts` and reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Generated DB types are in `src/integrations/supabase/types.ts`.

If the dashboard shows “Workspace unavailable”, it’s usually a Supabase policy/migration mismatch rather than an auth issue.

## Plumbing overview notes (how KPIs are computed)

- **Scheduling + dispatch**: uses `job_cards.scheduled_at` + `job_time_entries` (if available) to estimate start/end and detect delays.
- **Compliance flags**: derived from `#tags` in job notes (e.g. open Gas CoCs / Pressure Tests / PIRB CoCs).
- **CSAT**: if captured, stored in notes as a line like `CSAT: 5/5` and surfaced on the plumbing overview.

## Deploy

This is a standard Vite app. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.) and provide the two `VITE_SUPABASE_*` environment variables.
