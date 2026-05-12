# CLAUDE.md — Proje Hafızası

> Her Claude oturumunun başında otomatik okunur. Kullanıcıya projeyi baştan anlatmak gerekmez.
> **Kanonik doküman `README.md`** ve `docs/` altındaki migration dosyalarıdır. Bu dosya sadece oturum başı özet olarak davranır.

---

## Proje Kimliği

- **Ad:** CyberSec Blog + Sentinel (SOC Dashboard)
- **Stack:** Next.js 14.2 (App Router) · TypeScript 5 · React 18 · Tailwind 3.4 · Supabase (Postgres + Storage) · Vitest
- **UI dili:** Türkçe · **Kod dili:** İngilizce
- **Repo:** `github.com/codewarrior96/cybersec-blog`
- **Local path:** `C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog`
- **Deployment:** `git push origin main` → Vercel otomatik deploy

---

## Routing

| URL | Görev | Auth |
|-----|-------|------|
| `/` | → `/login` redirect | ✗ |
| `/login` | Breach Terminal hacker temalı giriş | ✗ |
| `/register` | Kullanıcı kaydı | ✗ |
| `/home` | Sentinel Dashboard (3D globe, telemetry, alert cards) | ✓ |
| `/blog` + `/blog/[slug]` | MDX blog listesi ve yazı detayı | ✗ |
| `/zafiyet-taramasi` (SENTINEL) | Raporlar · CVE Radar · Tarihsel Veritabanı | karışık |
| `/community` | Breach Lab (müfredat, xterm.js terminal, CTF) | ✓ |
| `/portfolio` | Profil + sertifikalar + eğitimler | ✓ |
| `/roadmap` | Özellik yol haritası | ✗ |
| `/about` · `/cve-radar` · `/breach-timeline` | Eski URL'ler (redirect) | ✗ |

Navigation bar menüsü: **HOME · BLOG · COMMUNITY · SENTINEL · PROFIL**

---

## API (`src/app/api/**`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/auth/{login,logout,session,register}` | POST/GET | Cookie-based session (scrypt + salt, rate-limited 10/5dk) |
| `/api/alerts` | GET · POST (analyst+) | Alert listesi + oluşturma |
| `/api/alerts/[id]` | PATCH (analyst+) | Status/priority/atama/not güncelleme |
| `/api/reports` | GET · POST · PATCH (analyst+) | Olay raporu CRUD |
| `/api/metrics/live` | GET | Dashboard anlık metrikleri |
| `/api/live-attacks` | GET | Simüle saldırı olayı (demo) |
| `/api/users` | GET/POST (admin) | Kullanıcı listesi + oluşturma |
| `/api/profile/me` | GET/PUT | Profil (display name, bio, rol) |
| `/api/profile/avatar` · `/api/profile/avatar/[userId]` | POST/DELETE · GET | Avatar upload/kaldır/servis |
| `/api/profile/certifications` + `/[id]` + `/assets/[id]` | CRUD | Sertifika kayıtları + asset |
| `/api/profile/education` + `/[id]` | CRUD | Eğitim kayıtları |
| `/api/cves` | GET | NIST NVD CVE (5 dk cache) |
| `/api/cybernews` | GET | RSS agregatör (THN, Krebs, BleepingComputer, SANS, SecurityWeek) |
| `/api/greynoise` | GET | GreyNoise IP intel (API key opsiyonel, fallback mock) |

---

## Veri Katmanı

Hybrid mimari — `SOC_IDENTITY_STORE` bayrağı ile yönetiliyor:

| Mode | Hedef |
|------|-------|
| `supabase` (default) | Supabase Storage JSON app-state (users, sessions, profiles, reports) |
| `postgres` | Supabase Postgres (identity + session migration Phase 1) |
| `disabled` | SQLite/memory fallback |

Alerts, attack_events ve operational state **hâlâ SQLite** (`data/soc.db`) — Postgres migration Phase 2+'ta taşınacak. Memory store (`soc-store-memory.ts`) Vercel ve resilience fallback için.

Detaylı migration planı: [`docs/postgres-migration-execution-roadmap.md`](docs/postgres-migration-execution-roadmap.md), [`docs/data-flow-map-and-migration-plan.md`](docs/data-flow-map-and-migration-plan.md).

---

## Auth / Güvenlik

- **Şifre:** scrypt + 16-byte salt → `salt:hash` formatı
- **Session:** 30 günlük httpOnly cookie (`soc_session`) · SameSite=Lax · secure (prod)
- **Rate limit:** IP başına 10 başarısız giriş / 5 dk (globalThis-persisted, `src/lib/rate-limiter.ts`)
- **RBAC:** admin > analyst > viewer (`src/lib/auth-shared.ts:hasRoleAtLeast`)
- **Client IP:** Trust-proxy gated (`src/lib/client-ip.ts`) — x-forwarded-for spoofing korunur
- **Identity validation:** `src/lib/identity-validation.ts` — username/displayName/password ortak kurallar
- **Upload:** Magic-byte doğrulaması (JPEG/PNG/WEBP/PDF) — `src/lib/portfolio-assets.ts`

---

## Ortam Değişkenleri (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_APP_STATE_BUCKET=cybersec-app-state
DATABASE_URL=                          # Supabase Postgres (Phase 1+)
SOC_STORAGE=sqlite                     # sqlite | memory
SOC_IDENTITY_STORE=supabase            # supabase | postgres | disabled
SOC_ALLOW_CRITICAL_MEMORY_FALLBACK=0
SOC_DEMO_SECRET=                       # zorunlu (R-20) — generation: bkz .env.example
TRUST_PROXY_HEADERS=                   # Vercel için zorunlu — see .env.example
GREYNOISE_API_KEY=                     # opsiyonel, yoksa mock data
```

---

## Tasarım Dili

- **Tema:** `#000000` bg · `#00ff88` neon yeşil · `#00d4ff` cyan · hacker/breach temalı
- **Font:** JetBrains Mono / system-mono
- **Efektler:** Matrix rain · neon glow · scan sweep · kritik alert kırmızı FX
- **CSS:** `src/styles/globals.css` (CSS variables + Tailwind)
- **Mobil:** Responsive

---

## Blog İçeriği

`src/content/posts/` altında **8 Türkçe MDX yazısı** (SQL injection, XSS, reverse shell, AD saldırıları, buffer overflow, Linux priv-esc, Wireshark, merhaba-dunya).

---

## Dashboard (`src/components/dashboard/`)

- `DashboardLayout.tsx` — orkestratör
- `TelemetryStreamPanel.tsx` — canlı telemetri + alert cards
- `CriticalAlertPanel.tsx` + `CriticalOverlayFx.tsx` — P1 kritik alert FX
- `AttackReportModal.tsx` — saldırı raporu modalı
- `DashboardSkeleton.tsx` — loading state

Global threat map `cobe` 3D globe ile render ediliyor.

---

## Hızlı Başlangıç

```bash
cd "C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog"
npm install
npm run dev           # http://localhost:3000
npm run test          # vitest (3 test dosyası, 6 test)
npm run build         # production build
```

---

## Deploy

```bash
git push origin main  # Vercel otomatik deploy (~1-2 dk)
```

---

## Documentation Hygiene & Out-of-Scope Paths

The following paths exist in this repo but are **NOT** part of the project's authoritative documentation. Do not read them when answering project questions, building context, or producing reports — they will pollute your understanding with personal study material.

- `docs/personal/` — personal exam-preparation notes (Turkish, single-author study material). Out of scope for any agent task.

If a task explicitly directs you to read a personal document (rare), the user will name the file by full path. Do not infer permission from proximity.

---

## Testing & Phase Discipline Protocol

This project is undergoing a 5-phase testing-debt remediation. Coverage is currently ~5% and we are systematically rebuilding it. When operating on test, audit, or quality tasks, follow these rules without exception.

### Phase map

- **Phase 1** — Security & Identity (auth routes, middleware, identity validation, scrypt, rate-limiter)
- **Phase 2** — Lab Engine (SOC machine, command parser, CTF flag validation, filesystem simulation)
- **Phase 3** — API & Contracts (CRUD routes, RLS verification, external integrations: CVE/Greynoise/Resend)
- **Phase 4** — UI & Accessibility (Terminal, Dashboard, mobile drawer, axe-core)
- **Phase 5** — End-to-end (Playwright user journeys)

Each phase is split into sub-stages: **A (audit) → B (infrastructure) → C (mocks/handlers) → D (test cases)**. You only work on the sub-stage explicitly named in the user's prompt.

### Hard rules

1. **Stop checkpoints are sacred.** When a sub-stage's deliverable is complete, you stop and wait for explicit "Go" review. Never auto-continue to the next sub-stage. Never write the next sub-stage's code "to save time."

2. **No code without plan approval.** For any sub-stage that involves writing code, first produce a written plan listing every file you will create or modify, with rationale. Wait for "Go" before touching files.

3. **Audit sub-stages produce REPORTS ONLY.** When a sub-stage is labeled "audit" or "report," produce written analysis. Do NOT write code, tests, configs, or scaffolding — even helpful scaffolding, even if it seems trivial.

4. **Every non-trivial decision needs both:**
```
   // SENIOR ARCHITECT NOTE: [why this approach]
   // REJECTED ALTERNATIVE: [what I considered and why I rejected it]
```
   Applies to code AND to architectural decisions in audit reports.

5. **Determinism is mandatory.** Tests must be hermetic (no real network), idempotent (any order, any count), and produce identical output across local/CI/parallel runs. No `Math.random`, no `Date.now()` without freezing via `vi.useFakeTimers()`, no real timers, no real fetch.

6. **Threat modeling uses OWASP Top 10 as anchor.** When identifying security risks, map each to its OWASP category (A01 Broken Access Control, A02 Cryptographic Failures, A07 Identification & Authentication Failures, A04 Insecure Design, etc.) — not vague labels.

7. **Critique the plan itself.** If the user's roadmap, sub-stage scope, or assumptions look flawed, flag it BEFORE proceeding. Sycophancy is a bug.

8. **No invented context.** If a file or capability you need isn't in the repo, say so explicitly and stop. Do not synthesize plausible-looking code based on what you'd expect to exist.

### Secrets discipline (cybersecurity hard rule)

- **NEVER read `.env`, `.env.local`, `.env.production`, or any `.env*` file** — they contain Supabase service-role key, JWT secrets, API keys.
- **NEVER print, echo, or include** environment variable values in any output.
- If a task seems to require knowledge of an env var (e.g. "what database URL is configured"), mark the question as ⚪ UNCLEAR in the report and ask the human. Do not go fetch it.
- Read `.env.example` only — that file documents variable names without secret values.

### Coding conventions (when code IS written, in later sub-stages)

- TypeScript strict mode, no `any` without justification comment
- Test files colocated as `*.test.ts` next to the unit under test
- MSW handlers live in `src/test/msw/handlers/` (one file per domain)
- Vitest globals enabled (it/expect/describe without imports)
- Use `vi.useFakeTimers()` for any time-sensitive test
- Mock filesystem with `memfs` if needed (don't touch real disk)

### Output format

- **Reports:** 1000-1500 words, H2 sections, markdown tables for risk matrices and DoD test lists
- **Plans:** bullet list of files + rationale, no prose padding
- **Code:** production-quality, no placeholder comments, all imports resolved
