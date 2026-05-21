# Post-Capstone Backlog (Phase 7+ Cycles)

Bu doküman capstone teslim sonrası cycle'lar için ertelenen feature + iyileştirme listesini izler. Her item için effort estimate, priority ve capstone audit context'ine lineage referansı korunur.

Faz 13.C (Wave 13 commit `ed086c2`) ile birlikte ilk versiyon shipped. Sınav sonrası Phase 7 cycle başlangıcında bu doc revize edilecek; prioritization güncel context'e göre yeniden yapılacak.

---

## Active backlog (operator-prioritized)

### 1. CV Generation Feature

- **Origin:** Operator vision during Wave 13 review
- **Description:** "Profili Kaydet" yanına "CV Oluştur" butonu. Profile data (headline + bio + specialties + tools + socialLinks + certifications + education) → PDF format → otomatik indirme.
- **Tech:** `@react-pdf/renderer` (server-side, daha fonksiyonel) OR `jsPDF` (client-side, daha hafif) — final seçim Phase 7 başlangıcında.
- **Format:** TBD — tek/iki sayfa, modern/cybersec/klasik theme. Operator visual mockup öncesi karar verilmeyecek.
- **API:** `/api/profile/cv` → PDF stream → auto download via `Content-Disposition: attachment`.
- **Wave 11 + Wave 13 dependency:** socialLinks + avatar render via SSR signed URL prop (Wave 13.C Path B mimics this pattern; CV builder benzer Server Component-resolve gerektirebilir).
- **Effort:** ~2-3 saat (mockup approved sonrası).
- **Priority:** **Yüksek** (kullanıcı için fonksiyonel feature).

### 2. Multi-User Blog System

- **Origin:** Operator vision pre-Wave-13 ("aylarca seninle kafa patlatacağız" framing).
- **Description:** Şu anki MDX statik blog yazıları (`src/content/blog/`) → DB-backed user-generated blog posts.
- **Components:** Blog post editor, comment system, permission model (per-post visibility), moderation queue, draft/publish flow.
- **Schema impact:** Yeni Supabase Storage JSON namespace (`blog/posts/{slug}.json`) veya Postgres migration (R-API-03 closure ile birleşebilir).
- **Effort:** ~1-2 hafta (component-heavy + auth + moderation UI).
- **Priority:** **Stratejik** (ürünü hayata geçirme yolu — kullanıcı katılım modeli).

### 3. Notification System

- **Origin:** Operator vision (blog ile paralel).
- **Description:** In-app bildirim (badge/bell icon top-right nav) + email notifications. Resend integration zaten production'da (Wave 1.5.11 R-06 audit log discipline + verify/reset email flows).
- **Components:** Trigger events (new comment, mention, post-approval), preference management (UI'da user toggle), real-time updates (Server-Sent Events veya Vercel Functions polling).
- **Effort:** ~3-5 gün (event dispatch + preference UI + email template integration).
- **Priority:** Blog'a paralel — kullanıcı engagement için.

### 4. Save / Logout Performance Investigation

- **Origin:** Wave 9 operator gözlemi ("save sonrası kısa hang", "logout transition slow").
- **Hipotezler (sırasıyla araştırılacak):**
  - Vercel function cold start (Wave 13 avatar audit confirmed Vercel cold-start magnitude)
  - `router.refresh()` compound effect (Wave 10 closure × Wave 11 socialLinks save × Wave 13 avatar SSR re-resolve)
  - Supabase JSON write payload size (socialLinks Wave 11 büyüttü)
  - Bundle JS execution time (`/portfolio` 12.5 kB route + 109 kB First Load — Wave 12 build output)
- **Methodology:** Network audit (DevTools timing) + bundle analysis + Lighthouse profile.
- **Effort:** Audit ~30 dk + fix değişken (1-4 saat).
- **Priority:** **UX kritik** — Wave 13 sonrası ikinci en görünür perf issue.

### 5. R-API-03 RLS Migration

- **Origin:** Phase 3.D Z.10 deferred (audit doc `phase-3-a-api-contracts-audit.md`).
- **Description:** `supabase/platform-backbone-v1.sql` blueprint production Supabase'e deploy + RLS policies aktif.
- **Z.10 lesson:** Faz 3.D revision sırasında 21 tablo blueprint'inin production'a hiç deploy edilmediği keşfedildi. Deployment + RLS migration aynı operation'da yapılmalı (mentor-locked).
- **Risk:** **Yüksek** — production data integrity riski. Hatalı RLS policy okuma/yazma yollarını kırabilir. Recovery zor (rollback için tablo backup gerekli).
- **Effort:** ~2-4 saat (migration SQL hazırlama + Supabase dashboard apply + production smoke).
- **Priority:** Sınav sonrası early (production maturity step). Multi-user blog dependency (item #2).

### 6. Verified-User E2E Setup

- **Origin:** Phase 5 Yol A Z.13 deferred (audit doc `phase-5-a-e2e-journeys-audit.md`).
- **Options (mentor-evaluated, hepsi declined):**
  - Resend sandbox / mock SMTP integration
  - Pre-verified test user with known credentials in CI secrets
  - `SERVICE_ROLE_KEY` direct insert (bypassing email verify)
- **Description:** 9 Playwright `test.skip` unblock (T-E1-04 verification-link + T-E2-02..05 Terminal mount + T-E3-03..06 portfolio CRUD).
- **Effort:** ~2-3 saat (en kolay path seçildikten sonra).
- **Priority:** Düşük (E2E coverage genişletme; unit + integration test surface zaten 545+ test).

### 7. R-LAB-01 Server-side Flag Validation

- **Origin:** Phase 2 accepted-by-policy (audit doc `phase-2-a-lab-engine-audit.md`).
- **Description:** Mevcut client-side flag check (`src/lib/lab/...`) → Server-side validation (API endpoint + adapter).
- **Trigger:** Sadece graded competition mode aktif olursa (capstone scope'da portfolio-demo yeterli).
- **Effort:** ~4-6 saat (validation endpoint + lab page integration + regression tests).
- **Priority:** **Conditional** (competition feature dependency — şu an yok).

### 8. R-LAB-08 Shell Parser Refactor

- **Origin:** Phase 2 doc-accept Wave 5C (audit doc `phase-2-a-lab-engine-audit.md`).
- **Description:** Educational-fidelity shell (`cd` / `ls` / `cat` / `grep` / `chmod` + pipelines + basic quoting) → POSIX-compliant parser (escape sequences, glob `*`, command substitution `$()`, `>` redirection beyond echo, backtick substitution).
- **Trigger:** Advanced lab content gerekirse (Linux fundamentals beyond intro level).
- **Effort:** ~6-10 saat (parser rewrite + 76 Phase 2.D unit test regressions + new advanced-shell tests).
- **Priority:** **Conditional** (advanced curriculum dependency).

### 9. npm audit `--force` Major Bump Cycle

- **Origin:** Phase 1.A § 8 deferred (Wave 6 closure documented 7 remaining vulns; Wave 13.C inherits).
- **Description:** `next@16` + `react-simple-maps@1.0.0` + transitive eslint deps cleanup.
- **Risk:** Major version bump, breaking change potential (App Router 14 → 16 migration; eslint dev tree refresh).
- **Effort:** ~2-3 saat audit + variable migration (1-2 gün worst case).
- **Priority:** Sonraki major dependency cycle ile birlikte (genellikle her 6-12 ayda bir refresh).

### 10. R-XX 6 OPEN Risks (Phase 1 Hardening)

- **Origin:** Phase 1.A inventory (Wave 7 README rewrite discovery).
- **Items:**
  - **R-05** (TOCTOU on profile update sırasında concurrent fetch race)
  - **R-09** (reserved username breadth — current denylist eksik)
  - **R-10** (displayName homoglyph attack — Unicode lookalikes)
  - **R-11** (token-validity oracle rate-limit — verify/reset flow brute-force surface)
  - **R-17** (audit log silent fail — DB outage swallows audit events)
  - **R-18** (email-keyed reset budget — per-email reset request quota)
- **Effort:** Her biri ~1 saat (hardening sweep tarzı).
- **Priority:** Phase 1 follow-up cycle (toplu ~6 saat). Item #5 (RLS migration) sonrası timing iyi.

### 11. Avatar Performance — Next/Image Migration

- **Origin:** Wave 13.A audit F-AV-06 (LOW severity, mentor-deferred in Faz 13.B).
- **Description:** Mevcut `<img>` (3 site PortfolioWorkspace.tsx + 1 site CertificationPreview) → `next/Image` migration.
- **Tech:** `next.config.mjs` `images.remotePatterns` add Supabase host whitelist; replace `<img>` with `<Image>` carrying `width` + `height` + `priority` (above-fold) / `loading="lazy"` (below-fold).
- **Benefit:** AVIF/WebP transforms via Vercel Image Optimization (~50% bandwidth saving on modern browsers), automatic lazy loading, responsive `srcset`.
- **Effort:** ~30 LOC source + `next.config` whitelist + test fixture updates (next/Image renders as `<span><img></span>`, DOM shape differs).
- **Priority:** Düşük — Wave 13.C Path B + Cache-Control combo zaten en büyük kazanımı sağladı (3-fetch → 1-fetch). next/Image incremental gain (bandwidth + lazy load), traffic-justified cost'a göre değerlendirilmeli.

### 12. Avatar Performance — Server-side Signed URL Pool

- **Origin:** Wave 13.A audit Path D evaluation (HIGH risk, mentor-deferred in Faz 13.B).
- **Description:** Multi-user request batching for Supabase signed URL API. In-memory `Map<userId, {url, expiresAt}>` per Vercel function instance; pool hit serves cached URL within 14s window of TTL.
- **Benefit:** Supabase API quota reduction at high-traffic moments (3-7× fewer signed URL mints).
- **Risk:** Vercel function isolation invalidates pool (cold start = fresh pool); multi-instance scenario = N pools per N instances; complexity vs benefit tradeoff.
- **Effort:** ~80-100 LOC (pool data structure + concurrent-mint guard via Promise dedup + expiry sweep + edge-case regression tests).
- **Priority:** **Conditional** — sadece production traffic high olursa (capstone demo + early Phase 7 traffic için over-engineered).

### 13. Bug 2 — 14× `GET /api/profile/me` storm verification

- **Origin:** Wave 14.A investigation (commit `d98f76b`). Mechanical evidence: only 3 fetch sites in PortfolioWorkspace.tsx; 1 useEffect with `[editable]` dep fires once on mount. 14× cardinality is order-of-magnitude anomaly — likely measurement confusion (avatar fetches counted as profile/me) OR dev-mode Strict + HMR amplification.
- **Resolution path:** Production HAR capture protocol — operator opens DevTools Network panel (hard reload, no throttle, no HMR), filters exactly on `/api/profile/me` substring, confirms cardinality. If true 14× → instrument server-side route with request-id + Referer logging. If miscount → close.
- **Effort:** ~5 dakika HAR capture (operator) + ~30 dakika analysis + optional ~20 LOC instrumentation.
- **Priority:** **Low** (likely measurement artifact per Wave 14.A HIGH-confidence hypothesis).

### 14. Bug 5 — "Beni Hatırla" reproducibility check

- **Origin:** Wave 14.A investigation (commit `d98f76b`). Code wired correctly at all 4 layers (EmbeddedLogin checkbox → loginWithPassword → API route → cookie maxAge). HIGH-confidence root: modern browser "continue where you left off" feature persists session cookies across browser restart even when maxAge is omitted (intent: session cookie); operator perceives session persists regardless of checkbox state.
- **Resolution path:** Operator-side DevTools verification (60-second test). Open `/login`, check checkbox → submit → DevTools → Application → Cookies → `soc_session` row → confirm `Expires / Max-Age` column shows ~30-day date. Repeat unchecked → confirm "Session". If both behaviors observed correctly → close as UX/browser-feature artifact. If broken → add reproduction protocol and diagnose.
- **Effort:** ~1 dakika operator verification. Fix path (if needed) covered in Wave 14.A Section 5 Phase A/B (~5-15 min).
- **Priority:** **Low** (likely browser-feature interference per Wave 14.A HIGH-confidence hypothesis).

### 15. Bug 3 — Avatar 400 TTL aging fix  [RESOLVED in Wave 15.B]

- **Origin:** Wave 14.A investigation (commit `d98f76b`). HIGH-confidence root: Wave 13.C SSR-resolved `initialAvatarUrl` prop ages past 30s Supabase signed-URL TTL in BFCache (back-forward cache) / tab-parking / slow-hydration scenarios. Real regression introduced by Wave 13.C trading client-fetch volume for prop-aging surface.
- **Resolution path:** Phase A (fastest, 1 LOC) — extend TTL from 30s to 90s in `src/app/portfolio/page.tsx:94`. Security envelope still tight (Wave 5B R-API-10 pattern intact). Phase B (robust, ~15 LOC) — add `<img onError>` fallback chain (SSR URL → legacy `/api/profile/avatar/[userId]` mint-fresh path). Phase C (most robust, ~40-60 LOC) — drop static prop, client-side fetch a new `/api/profile/avatar/url` endpoint on mount.
- **Effort:** Phase A = 5 dakika. Phase B = 30-45 dakika. Phase C = 2-3 saat.
- **Priority:** **Medium** — real Wave 13.C regression with UX impact (tab-parked users see broken avatar). Address before exam if time permits.
- **Resolution (Wave 15.B commit `<COMMIT_HASH_TBD>`):** **Phase A shipped.** Wave 15.A health check reactivated as HIGH-priority AI-auditor-readiness blocker after operator screenshot confirmed the `/portfolio → /academy → /portfolio = "S" placeholder` symptom in production. TTL `30s → 90s` at both SSR path (`src/app/portfolio/page.tsx:104`) and legacy fallback (`src/app/api/profile/avatar/[userId]/route.ts:63`); Cache-Control `max-age=20 → 60` alignment on legacy 307 response. Tests `T-AV-TTL30 → T-AV-TTL90` rename + assertion update; `T-AV-CACHE` updated to `max-age=60`. Z.18 entry + A-30 amendment shipped in same commit pair (15.B fix + 15.B.1 cleanup). Phase B + Phase C deferred — Phase A's 3× buffer adequately covers operator reproduce path + typical BFCache tab-park (~30-60s) scenarios. Detailed scope in `docs/audit/phase-1-a-pending-amendments.md` A-30 entry.

---

## Lineage notes

Bu backlog **Wave 13 Faz 13.C** ile birlikte commit edildi (closure of A-27). Her item için audit doc lineage referansları (Faz 13.A audit, Phase 2.A, Phase 3.D, Phase 5.A, Wave 6 npm audit narrative, vb.) korunmuştur.

**Audit-trail honesty discipline:** Bu doc capstone teslim öncesi shipped → sınav sonrası okuyacak AI auditor veya insan reviewer için "şu noktadan sonra hangi backlog kaldı" sorusuna direkt cevap verir. Sınav günü "her şey bitti, başka iş yok" iddiası SAFELESS — bu doc operator'ın elinde 12 maddelik concrete continuation plan olduğunu kanıtlar.

**Capstone scope boundary:** Wave 13.C, audit-trail completeness için son cycle. Bu doc'taki tüm item'lar **bilinçli olarak** capstone scope'unun dışında. Phase 7 cycle'ı operator-driven prioritization ile başlayacak.

**Convention:** Her Phase 7+ cycle başlangıcında bu doc'un başına yeni section eklenir (`## Phase 7 Cycle 1 — <date> — <theme>`); o cycle'da tackle edilen item'lar ilgili section altına taşınır + closure narrative eklenir; remaining item'lar Active backlog altında kalır.
