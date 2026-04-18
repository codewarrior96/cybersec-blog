# Execution Plan

This file is the short operational checkpoint for the current migration work.

It exists so we can stop safely and continue later without losing context.

---

## Current Safe State

- The site is still running on the current stable runtime path.
- `SOC_IDENTITY_STORE` still defaults to `supabase`.
- The new Postgres identity/session path is prepared, but not active yet.
- No live auth or data flow has been cut over to Postgres yet.
- The current app should keep working after commit and push.

---

## What Was Completed

### 1. Data migration groundwork

- Added a feature-flagged Postgres identity/session store:
  - `src/lib/supabase-product-db.ts`
  - `src/lib/soc-store-supabase-postgres.ts`

- Updated adapter routing:
  - `src/lib/soc-store-adapter.ts`

- Added compatibility shadow sync:
  - `src/lib/soc-store-supabase.ts`

### 2. SQL backbone updates

- Updated:
  - `supabase/platform-backbone-v1.sql`

- Important addition:
  - `identity.users.role`

### 3. Backfill tooling

- Added identity backfill script:
  - `scripts/backfill-identity-postgres.mjs`

- Added npm command:
  - `npm run backfill:identity`

### 4. Documentation updates

- `README.md`
- `docs/data-flow-map-and-migration-plan.md`
- `docs/postgres-migration-execution-roadmap.md`

---

## Why The Site Still Works

The new migration code is prepared behind a gate.

Nothing switches to Postgres unless we explicitly do all of the following:

1. add `DATABASE_URL`
2. apply the Supabase schema
3. run the backfill
4. switch `SOC_IDENTITY_STORE=postgres`

Until then, the app continues using the current stable path.

---

## Next Exact Steps

### Phase 1: Identity migration

1. Add `DATABASE_URL` to `.env.local`
   - use Supabase `Session pooler`
   - port `5432`

2. Bootstrap the professional Supabase migration flow
   - install/use Supabase CLI
   - initialize repo migration structure
   - create `supabase/config.toml`
   - create `supabase/migrations/`

3. Turn `supabase/platform-backbone-v1.sql` into a real migration

4. Apply the schema to Supabase

5. Run identity backfill in dry-run mode
   - `npm run backfill:identity`

6. Run identity backfill in apply mode
   - `npm run backfill:identity -- --apply`

7. Run the printed `setval(...)` SQL for `identity.users`

8. Enable Postgres identity mode
   - set `SOC_IDENTITY_STORE=postgres`

9. Run smoke tests
   - login
   - register
   - logout
   - session restore
   - `/api/auth/session`
   - `/api/users`

---

## Rules We Will Not Break

1. No big-bang migration
2. No breaking current UX
3. No blind cutover without smoke tests
4. No deleting the current path before the new path is verified
5. Storage stays for files only in the final architecture

---

## Immediate Blocker

Before the next real migration step, we need:

- `DATABASE_URL` in `.env.local`

That is the single missing prerequisite for the professional Supabase-side execution.

---

## After Phase 1

Once identity and sessions are stable on Postgres, continue in this order:

1. portfolio profile
2. certifications + education
3. reports
4. telemetry events
5. incidents + operational graph
6. legacy cleanup
7. hardening and observability

---

## Confidence Check

At this checkpoint:

- migration direction is clear
- rollback path is clear
- current app behavior is preserved
- repo summary is updated
- next execution step is unambiguous

