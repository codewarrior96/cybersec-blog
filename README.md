# CyberSec Blog

CyberSec Blog is a Turkish-first cyber security platform built on Next.js. It combines a premium operations dashboard, threat intelligence surfaces, portfolio management, learning flows, and Sentinel reporting into a single product shell.

## Product surfaces

- `Home`
  - global threat map
  - live telemetry stream
  - response actions and focus cards
- `Sentinel`
  - active reports
  - historical breach database
  - CVE radar and intelligence views
- `Community`
  - learning sets
  - labs, tools, and CTF surfaces
- `Portfolio`
  - operator profile
  - certifications
  - education and identity surfaces

## Current architecture

The app is operational today, but the data layer is still hybrid by design.

### Runtime data sources

- `Supabase Storage JSON app-state`
  - users
  - sessions
  - profiles
  - certifications
  - education
  - reports
- `SQLite`
  - alerts
  - attack events
  - legacy operational state
- `Memory fallback`
  - local/dev and resilience fallback paths
- `Supabase attack metrics tables`
  - selected live attack metric surfaces

### Strategic direction

We are actively moving toward:

- `Supabase Postgres` as the single source of truth for product data
- `Supabase Storage` as file and asset storage only
- feature-flagged migrations so current behavior stays stable while the database backbone is upgraded

## Phase 1 migration status

Phase 1 has started.

Implemented groundwork:

- a documented data flow map and migration master plan
- a feature-flagged Postgres identity path for:
  - users
  - sessions
- an updated Supabase backbone schema draft that now includes application roles on `identity.users`
- shadow sync into app-state so profile and report surfaces keep working during the transition

### Current identity store modes

The identity layer can now be steered with `SOC_IDENTITY_STORE`:

- `supabase`
  - current default
  - uses Supabase Storage JSON app-state for identity-related reads and writes
- `postgres`
  - new migration mode
  - uses Supabase Postgres for users and sessions
  - keeps profile/report compatibility through shadow sync
- `disabled`
  - falls back to sqlite/memory paths

### Identity backfill

Before switching to `SOC_IDENTITY_STORE=postgres`, backfill existing users and sessions:

```bash
npm run backfill:identity
npm run backfill:identity -- --apply
```

The script first runs as a dry-run by default and prints the SQL needed to repair the `identity.users` sequence after apply.

## Core stack

- Next.js 14 App Router
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase (`Storage` today, `Postgres` migration in progress)
- SQLite (`legacy/hybrid operational persistence`)
- Vitest

## Environment

Common variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_APP_STATE_BUCKET=cybersec-app-state
SOC_STORAGE=sqlite
SOC_IDENTITY_STORE=supabase
SOC_ALLOW_CRITICAL_MEMORY_FALLBACK=0
GREYNOISE_API_KEY=
```

## Local development

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Important docs

- [Platform backbone plan](./docs/platform-backbone-plan.md)
- [Data flow map and migration master plan](./docs/data-flow-map-and-migration-plan.md)
- [Postgres migration execution roadmap](./docs/postgres-migration-execution-roadmap.md)
- [Supabase backbone schema](./supabase/platform-backbone-v1.sql)

## What is intentionally not true anymore

The repository should no longer be described as:

- SQLite-only
- demo-user driven
- "Supabase can be removed"

Those statements are outdated.

## Near-term priorities

1. migrate identity and sessions to Postgres safely
2. migrate portfolio/profile data to Postgres
3. migrate reports to Postgres
4. unify telemetry, incidents, and reports into one operational graph
5. keep Storage limited to binary assets only
