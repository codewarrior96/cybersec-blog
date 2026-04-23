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
