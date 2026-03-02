# FieldFlow Billing

FieldFlow Billing is a Vite + React + Supabase field-service dashboard for trade businesses, with a strong focus on plumbing, electrical, applicance repair and Refrigeration operations (dispatch, service calls, compliance, inventory usage, and billing visibility).

## Why this exists

Running a trade business often means juggling dispatch, on-site work evidence, compliance paperwork, parts usage, and “what can we invoice right now?” across multiple tools (or WhatsApp + spreadsheets). FieldFlow Billing exists to make that workflow visible, searchable, and team-friendly from the office to the field.

## What problem it solves

- **Operational visibility**: a shared source of truth for job cards, schedules, technician status, time logs, photos, and notes.
- **Compliance workflow**: lightweight tagging (`#gas-coc`, `#pressure-test`, etc.) to surface compliance risks in day-to-day dispatching.
- **Billing readiness**: track what happened on a job (time + parts + evidence) so office staff can invoice without chasing technicians.
- **Field usability**: a technician-first flow (`/tech`) that works on mobile while keeping the owner/dispatcher view (`/dashboard`) comprehensive.

## Tradeoffs made

- **Supabase as the backend**: ships fast (Auth/Postgres/Storage/Functions), but comes with platform coupling and a heavier emphasis on correct RLS policies/migrations.
- **Mostly client-rendered app**: simple static hosting and fast iteration, but less suited to content/SEO use cases and requires disciplined session/state handling.
- **Flexible “tags in notes” for some KPIs**: quick to adopt and easy to search, but less structured than dedicated normalized tables (and needs parsing conventions).
- **Route-specific feature sets**: keeps the technician UI focused, but increases the need for consistent permissioning and shared domain models.

## How it scales

- **Frontend**: static assets can be CDN-cached (Vercel/Netlify/etc.), so traffic spikes are typically not a bottleneck.
- **Database**: Postgres scales through good indexing, query discipline, and (when needed) views/materialized views for dashboard aggregates; multi-tenant separation typically lives in the schema via workspace/company IDs + RLS.
- **Workloads**: long-running or privileged tasks move into Supabase Edge Functions; file-heavy usage (photos) goes to Supabase Storage.
- **Growth levers**: archiving old job cards, partitioning high-volume tables (time entries/messages), and introducing caching for read-heavy KPIs as data volume increases.

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
VITE_MAX_SESSION_HOURS=12
VITE_IDLE_TIMEOUT_MINUTES=120
# Optional (PWA background push / Web Push):
# VITE_WEB_PUSH_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
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

## Deploy Edge Functions

This repo uses Supabase Edge Functions (Deno) under `supabase/functions/`.

If you see `{"code":"NOT_FOUND","message":"Requested function was not found"}` when calling a function, it usually means the function was not deployed to that Supabase project yet.

### Deploy `ai-assistant`

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set OPENAI_API_KEY=...
# optional:
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set OPENAI_BASE_URL=https://api.openai.com/v1

supabase functions deploy ai-assistant
```

Verify browser CORS preflight (should be 2xx and echo the origin):

```sh
curl -i -X OPTIONS 'https://YOUR_PROJECT.supabase.co/functions/v1/ai-assistant' \
  -H 'Origin: https://fieldflow-billing.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization, content-type'
```

### Background push (Android/iOS PWA Web Push)

FieldFlow supports **background push notifications** for installed PWAs (Android Chrome + iOS Safari “Add to Home Screen”).

1) Generate VAPID keys

```sh
npx web-push generate-vapid-keys
```

2) Add the VAPID public key to your web env

- Local: `.env` → `VITE_WEB_PUSH_VAPID_PUBLIC_KEY=...`
- Production (Vercel): set `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`

3) Set Edge Function secrets

```sh
supabase secrets set WEB_PUSH_SUBJECT=mailto:you@yourdomain.com
supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY=...
supabase secrets set WEB_PUSH_VAPID_PRIVATE_KEY=...
```

4) Deploy the test sender function

```sh
supabase functions deploy push-test
```

5) Test in the app

- Go to `/tech/settings`
- Enable “Device notifications”
- Confirm it shows “Background push: Enabled”
- Tap “Test (push)”, then background the app/device and wait for the notification

## Onboarding tutorials (spotlight tour)

On first login (per user + company), FieldFlow can show a step-by-step tutorial that highlights dashboard elements and persists progress in Supabase.

- DB: `public.user_onboarding` (migration in `supabase/migrations/20260222150000_user_onboarding.sql`)
- Tutorial steps: `src/features/onboarding/tutorials/plumberDashboardTutorial.ts`
- Mount point: `src/pages/Dashboard.tsx` (wraps dashboard routes with `OnboardingProvider` + `OnboardingOverlay`)

### Tagging UI targets

Prefer stable data attributes instead of brittle selectors:

```tsx
<div data-tour="plumber-kpis">
  {/* KPI cards grid */}
</div>
```

Then reference it from a step:

```ts
targetSelector: '[data-tour="plumber-kpis"]'
```

### Adding a new tutorial

1) Create a config file in `src/features/onboarding/tutorials/` with a new `tutorial_key`
2) Add `data-tour="..."` attributes to the UI elements you want to spotlight
3) Register the tutorial selection logic in `src/features/onboarding/OnboardingProvider.tsx`

## Plumbing overview notes (how KPIs are computed)

- **Scheduling + dispatch**: uses `job_cards.scheduled_at` + `job_time_entries` (if available) to estimate start/end and detect delays.
- **Compliance flags**: derived from `#tags` in job notes (e.g. open Gas CoCs / Pressure Tests / PIRB CoCs).
- **CSAT**: if captured, stored in notes as a line like `CSAT: 5/5` and surfaced on the plumbing overview.

## Deploy

This is a standard Vite app. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.) and provide the two `VITE_SUPABASE_*` environment variables.
