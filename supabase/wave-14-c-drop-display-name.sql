-- Wave 14 Faz 14.C — Drop display_name column from identity.users
-- Idempotent migration for future production Postgres deploy.
-- Operator-approved Q3-B (clean code, full column removal); Q2-A locked
-- silent-ignore for the live Supabase JSON storage layer (Wave 11 precedent).
--
-- Pre-conditions:
--   - identity.users table exists (created by platform-backbone-v1.sql)
--   - display_name column was previously NOT NULL; this migration drops it
--     unconditionally because the application no longer reads or writes
--     the field after Wave 14.C.
--
-- Z.10 honesty: at the time of authoring (HEAD prior to this commit), the
-- identity.users table has NEVER been deployed to production. The
-- platform-backbone-v1.sql blueprint is dead code awaiting future
-- deployment (R-API-03 backlog item). This migration is staged for the
-- day that deploy happens — schema parity with the application code.

begin;

alter table if exists identity.users
  drop column if exists display_name;

commit;
