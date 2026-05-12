-- Rate limit state shared across Vercel function instances.
-- Backs src/lib/rate-limiter.ts (Phase 1.5.9 R-02 architectural fix).
-- Closes R-02 (High, A04) — per-instance globalThis Map → Postgres shared state.
-- See docs/audit/phase-1-a-final.md R-02 row + A-20 cluster amendment.
--
-- Schema: public (consistent with attack-events.sql operational namespace).
-- Access: service_role only (server-side adapter writes/reads; no client-side access).
-- Atomic increment via INSERT ... ON CONFLICT DO UPDATE (single-statement guarantee).
-- Apply: Supabase dashboard SQL editor (no CLI / migrations/ in use).

create table if not exists public.rate_limits (
  bucket text not null,
  key text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (bucket, key)
);

create index if not exists rate_limits_reset_at_idx
  on public.rate_limits (reset_at);

alter table public.rate_limits enable row level security;

-- No policies created: RLS-enabled without policies denies all non-service-role
-- access. service_role bypasses RLS unconditionally. This matches the
-- server-side-adapter-only access pattern. Authenticated and anon roles cannot
-- read or write rate-limit state.
