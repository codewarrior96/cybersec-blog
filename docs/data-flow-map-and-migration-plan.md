# Data Flow Map And Postgres Migration Master Plan

## Purpose

This document answers three questions:

1. What data exists in the product today?
2. Where is each data domain stored right now?
3. What is the safest migration order to move the product to a single Postgres-backed source of truth?

The goal is simple:

- `Supabase Postgres` becomes the only source of truth for product data
- `Supabase Storage` remains file/object storage only
- `sqlite` and `memory` remain local/dev fallbacks, not production truth

---

## Executive Summary

Today the project is operational, but the data layer is still hybrid.

### Implementation status

The first migration-safe implementation step is now in place:

- a feature-flagged Postgres identity path exists for users and sessions
- the default runtime behavior is still unchanged
- shadow identity sync keeps current profile/report surfaces compatible while migration is in progress

### Current reality

- `identity`, `sessions`, `profiles`, `certifications`, `education`, and `reports`
  are primarily stored as JSON objects in `Supabase Storage` through the app-state layer
- `alerts`, `attack events`, and `live metrics` still depend on `sqlite` and/or memory fallback
- `attack metrics` have a separate Supabase table path
- the intended future product schema already exists as SQL in:
  - [platform-backbone-v1.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\platform-backbone-v1.sql)

### Strategic conclusion

The product is not at risk because of functionality today, but it is still exposed to:

- split-brain data ownership
- migration complexity growing with every new feature
- storage JSON and relational product state drifting apart

The strongest long-term move is:

1. move core product data to Postgres
2. keep Storage only for binary assets
3. remove JSON state writes from production paths

---

## Current Data Map

## 1. Identity

### Data

- users
- credentials
- roles
- sessions

### Current storage

- Supabase Storage JSON app-state
- sqlite fallback / legacy store
- memory fallback in some failure paths

### Evidence

- [soc-store-supabase.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-supabase.ts)
  - `state/users/by-username/...`
  - `state/users/by-id/...`
  - `state/sessions/...`
- [soc-store-adapter.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-adapter.ts)
  - `authenticateUser`
  - `createSession`
  - `getSessionByToken`
  - `deleteSession`
- [db.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\db.ts)
  - `users`
  - `sessions`

### Problem

Identity is product data and should not live as Storage JSON.

### Target

- `identity.users`
- `identity.sessions`

from [platform-backbone-v1.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\platform-backbone-v1.sql)

---

## 2. Portfolio / Profile

### Data

- profile headline, bio, location, website
- specialties
- tools
- avatar metadata
- certifications
- education

### Current storage

- Supabase Storage JSON app-state
- assets in Storage
- sqlite fallback / legacy store

### Evidence

- [soc-store-supabase.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-supabase.ts)
  - `state/profiles/{userId}/profile.json`
  - `state/profiles/{userId}/certifications/*.json`
  - `state/profiles/{userId}/education/*.json`
  - `state/indexes/certifications/...`
- [portfolio-assets.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\portfolio-assets.ts)
  - binary assets are already separated reasonably
- [db.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\db.ts)
  - `user_profiles`
  - `user_certifications`
  - `user_education`

### Problem

Profile state is business data and should be relational.
Only avatar and certification files should remain in Storage.

### Target

- `content.portfolio_profiles`
- `content.profile_specialties`
- `content.profile_tools`
- `content.portfolio_certifications`
- `content.portfolio_education`

from [platform-backbone-v1.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\platform-backbone-v1.sql)

---

## 3. Reports

### Data

- report title
- report content
- severity
- tags
- archive status
- audit-like archive events

### Current storage

- Supabase Storage JSON app-state
- sqlite fallback / legacy store

### Evidence

- [soc-store-supabase.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-supabase.ts)
  - `state/reports/{id}.json`
- [soc-store-adapter.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-adapter.ts)
  - `listReports`
  - `createReport`
  - `archiveReport`
- [db.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\db.ts)
  - `reports`

### Problem

Reports are operational records and should live in the same relational graph as incidents and telemetry.

### Target

- `operations.reports`
- `operations.report_actions`

from [platform-backbone-v1.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\platform-backbone-v1.sql)

---

## 4. Alerts / Attack Events / Live Metrics

### Data

- attack events
- alert queue
- alert notes
- alert audit trail
- live metrics

### Current storage

- sqlite primary path
- memory fallback
- separate Supabase attack metrics path for some metrics

### Evidence

- [soc-store-adapter.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\soc-store-adapter.ts)
  - `listAlerts`
  - `createAlert`
  - `patchAlert`
  - `recordAttackEvent`
  - `getLiveMetrics`
- [db.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\db.ts)
  - `attack_events`
  - `alerts`
  - `alert_events`
  - `alert_notes`
- [attack-events.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\attack-events.sql)
  - separate Supabase attack event table
- [supabase-attack-metrics.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\supabase-attack-metrics.ts)

### Problem

This is the most hybrid part of the product today.

### Target

- `operations.telemetry_events`
- `operations.incidents`
- incident action log table in a later migration

The SQL backbone already includes:

- `operations.telemetry_events`
- `operations.incidents`

---

## 5. Community / Content

### Data

- community posts
- blog posts
- CVE feeds

### Current storage

- community uses in-memory local store / seeded content
- blog is content files
- CVE/news are fetched APIs

### Evidence

- [community-store.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\lib\community-store.ts)
- [api/community/route.ts](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\src\app\api\community\route.ts)
- `src/content/posts`

### Problem

Not urgent for data integrity compared to identity/profile/reports.

### Target

Later decision:

- keep seeded/local if intentionally static
- or move community posts to `content.*` tables when collaboration/user posts become product-critical

---

## 6. Learning / Domain System

### Data

- tracks
- modules
- lessons
- lesson progress
- domain memberships
- capabilities

### Current storage

- code/content driven
- no single production relational runtime yet

### Target

- `platform.domains`
- `platform.capabilities`
- `platform.domain_capabilities`
- `platform.user_domain_memberships`
- `platform.user_capabilities`
- `learning.tracks`
- `learning.modules`
- `learning.lessons`
- `learning.lesson_progress`

These already exist in:

- [platform-backbone-v1.sql](C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog\supabase\platform-backbone-v1.sql)

---

## What Must Stay In Storage

Storage is still important, but only for file-like assets.

### Good Storage use cases

- avatar files
- certification documents
- future report attachments
- generated exports
- static file assets

### Bad Storage use cases

- users as JSON
- sessions as JSON
- reports as JSON
- profile core state as JSON
- incident graph as JSON

Rule:

`Storage is for assets, not product truth.`

---

## Current Risk Ranking

## Highest priority

1. identity in Storage JSON
2. sessions in Storage JSON
3. reports in Storage JSON

## High priority

4. portfolio/profile/certification/education JSON state
5. alerts/telemetry hybrid sqlite-memory-supabase split

## Medium priority

6. domain/learning not yet in runtime Postgres
7. community content still local

---

## Postgres Migration Master Plan

## Phase 0 - Safety First

Before any write-path migration:

1. export current Storage JSON objects
2. export sqlite database
3. snapshot current schema/migrations
4. verify restore path locally
5. define cutover rollback rules

Deliverable:

- migration inventory snapshot

---

## Phase 1 - Identity Backbone

### Move

- users
- sessions

### Source today

- Storage JSON
- sqlite fallback

### Target

- `identity.users`
- `identity.sessions`

### Cutover rule

- auth read/write paths stop using Storage JSON
- session verification reads only Postgres

### Why first

Everything else depends on trustworthy identity and session state.

---

## Phase 2 - Profile Backbone

### Move

- core profile
- specialties
- tools
- certifications metadata
- education metadata

### Source today

- Storage JSON
- sqlite fallback

### Target

- `content.portfolio_profiles`
- `content.profile_specialties`
- `content.profile_tools`
- `content.portfolio_certifications`
- `content.portfolio_education`

### Cutover rule

- metadata reads/writes become Postgres-only
- Storage remains only for avatar/certification binary files

---

## Phase 3 - Reports Backbone

### Move

- reports
- report archive actions

### Source today

- Storage JSON
- sqlite fallback

### Target

- `operations.reports`
- `operations.report_actions`

### Cutover rule

- Sentinel reads only Postgres reports
- report creation/archive writes only Postgres

### Why before telemetry/incidents

Reports are high-value user-visible records and easier to stabilize before the heavier event graph.

---

## Phase 4 - Telemetry And Incident Graph

### Move

- telemetry events
- incidents
- incident action log

### Source today

- sqlite
- memory fallback
- separate Supabase attack metrics path

### Target

- `operations.telemetry_events`
- `operations.incidents`
- later `operations.incident_actions`

### Cutover rule

- telemetry ingestion writes Postgres
- incident generation reads Postgres
- live metrics derive from Postgres event graph

---

## Phase 5 - Domain And Learning Runtime

### Move / Activate

- domain memberships
- capabilities
- tracks/modules/lessons/progress

### Target

- `platform.*`
- `learning.*`

### Cutover rule

- route access and dashboard behavior become capability-driven from Postgres

---

## Production Rules After Migration

When the migration is complete, these rules must hold:

1. one source of truth for product data: `Supabase Postgres`
2. one source of truth for assets: `Supabase Storage`
3. no production write path to Storage JSON
4. no production truth depending on sqlite
5. memory remains dev/test fallback only

---

## Suggested Implementation Order

If we want the safest path with the lowest product risk:

1. identity
2. sessions
3. profile metadata
4. certifications/education metadata
5. reports
6. telemetry events
7. incidents
8. domains/capabilities
9. learning progress

---

## Done Criteria

We can say the database layer is strong when:

- auth survives restarts without Storage JSON
- profile/report data no longer depends on app-state JSON objects
- telemetry and incidents share one relational graph
- backups and restore are tested
- RLS policies protect user-scoped data
- new features no longer need to choose between sqlite, memory, and storage JSON

---

## Next Action

The next working session should produce:

1. a field-by-field migration inventory for:
   - identity
   - sessions
   - profiles
   - reports
2. a real migration checklist per table
3. first implementation on `identity.users` and `identity.sessions`

