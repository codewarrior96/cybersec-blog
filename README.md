# siberlab.dev — Cybersecurity Portfolio + Eğitim Platformu

> Capstone projesi. Endüstri-grade audit disiplini ile geliştirilen Next.js 14 tabanlı siber güvenlik portföyü ve eğitim platformu.
> Üretim ortamı: **[siberlab.dev](https://siberlab.dev)** · 491+ commit · 530+ test · 5-fazlı audit closure · 0E/0W lint baseline

[![tests](https://img.shields.io/badge/vitest-530%20passing-brightgreen)]()
[![e2e](https://img.shields.io/badge/playwright-9%20active%20%2B%209%20skip-blue)]()
[![lint](https://img.shields.io/badge/eslint-0E%20%2F%200W-success)]()
[![phases](https://img.shields.io/badge/audit%20phases-5-blueviolet)]()
[![closure](https://img.shields.io/badge/inventory%20closed-50%2F60%20(83%25)-success)]()

---

## Özet

**siberlab.dev**, siber güvenlik öğrenme yolculuğunu destekleyen bir portföy + eğitim platformudur. Next.js 14 (App Router) ile geliştirilmiş; **gerçek production deploy** üzerinde çalışır (Vercel + Supabase + Resend). Kullanıcılar gerçek hesap açıp, ücretsiz eğitim laboratuvarlarında temel Linux komutlarını öğrenir ve operatör profillerini yönetir.

Bu proje aynı zamanda **endüstri-grade audit disiplini** demonstrasyonudur. 5-fazlı denetim (security, lab engine, API contracts, UI accessibility, end-to-end) ile 60+ risk maddesi sistematik olarak analiz edilmiş, kapatılmış veya şeffaf şekilde dokümante edilmiştir. Tüm scope kararları, defense-in-depth pattern'ları ve mentor-error correction lineage'ı izlenebilir audit-trail olarak korunmaktadır.

Hedef kitle: junior security analistleri, siber güvenlik öğrencileri, eğitmenler ve audit-grade engineering practice'i inceleme yapmak isteyen AI/insan reviewer'lar.

---

## Üretim Linki

🌐 **[siberlab.dev](https://siberlab.dev)** — canlı demo

Üretim ortamında deneyebileceğiniz akışlar:

- **`/register`** — gerçek email doğrulama akışı (Resend integration)
- **`/login`** — scrypt-tabanlı kimlik doğrulama, rate-limit korumalı
- **`/community`** — Lab Engine üzerinde xterm.js terminal ile L1 puzzle (cd / ls / cat / chmod)
- **`/portfolio`** — Profil + sertifika + eğitim kayıtları (Supabase Storage JSON persistence)
- **`/zafiyet-taramasi`** — CVE Radar (NIST NVD live feed) + 8 MDX güvenlik yazısı
- **`/home`** — Sentinel Dashboard (3D global threat map, telemetry stream)

---

## Neler Yapıldı (Faz 1–5)

| Faz | Kapsam | Çıktı |
|-----|--------|-------|
| **1** | Güvenlik & kimlik | Auth, session, CSRF, rate-limit, identity-validation, scrypt N=32768 hardening, x-forwarded-for spoofing korunması |
| **2** | Lab Engine | Eğitsel Linux shell simulation (cd / ls / cat / grep / chmod + pipelines + temel quoting) |
| **3** | API & contracts | 28 API route, IDOR kapatma, RLS planlama, external integrations (CVE / GreyNoise / RSS aggregator) |
| **4** | UI & erişilebilirlik | axe-core integration, useFocusTrap (5 modal), aria-label discipline, SectionErrorBoundary composition |
| **5** | End-to-end | Playwright suite (Chromium), production siberlab.dev baseline, 3 user journey, GitHub Actions workflow |

Her faz kendi audit raporunu üretti (Section 2 risk register + Section 9 mentor kararları). Phase 1.5 sonrası 15 hardening sub-cycle çalıştırıldı. Faz 2-5 her biri A → B → C → D pattern'i (audit → infra → mocks → test cases) ile stop-checkpoint disiplinine uydu.

**Detaylı faz raporları:** [`docs/AUDIT_README.md`](docs/AUDIT_README.md) + [`docs/audit/INDEX.md`](docs/audit/INDEX.md)

---

## Bilinçli Kapsam Kararları

Bu proje **transparent scope tightening** disiplini ile geliştirilmiştir. Her kapsam-dışı bırakılan madde inline rationale ile dokümantedir — sessizce göz ardı yerine açıkça "DOC-ACCEPT", "PARTIAL", "DEFERRED" veya "RECLASSIFIED" işaretlenmiştir.

- **Aesthetic tradeoff (R-UI-03):** Siberhacker neon-on-dark teması (`#000000` + `#00ff88` + `#00d4ff`), WCAG AA contrast standardı yerine intentional brand identity olarak korunmuştur. AAA-leaning state-critical accent variant'ları Phase 6'ya ertelendi.
- **Educational shell (R-LAB-08):** Lab Engine POSIX-compliant DEĞİL; eğitsel-fidelity scope (cd / ls / cat / grep / chmod + pipelines). Escape sequences, glob, `$()`, `>` redirect, backtick substitution bilinçli olarak yoktur — Linux fundamentals öğretimi için yeterli kapsamdadır.
- **Demo-grade flag validation (R-LAB-01):** Lab puzzles client-side flag check kullanır (portfolio-demo bağlam, graded competition değil). Server-side refactor Phase 6'ya ertelendi.
- **Platform-backbone deploy (R-API-03):** `supabase/platform-backbone-v1.sql` 21 tablo blueprint olarak hazır; Phase 3.D revision sırasında production Supabase'e **hiç deploy edilmediği** keşfedildi (Z.10 production-vs-blueprint dersi). Future deployment cycle, RLS migration ile birlikte aynı operation'da deploy etmeli.
- **E2E coverage scope (Yol A Z.13):** Faz 5 verified-user setup üç path'i (Resend sandbox / pre-verified user / SERVICE_ROLE_KEY) red ettiği için 3 user journey **PARTIAL closed** + 9 sub-spec `test.skip()` ile dokümante edildi. Tüm skip'ler inline Phase 6 deferral nedeni taşır.
- **6 R-XX OPEN (Faz 1):** R-05 (TOCTOU), R-09 (reserved username breadth), R-10 (displayName homoglyph), R-11 (token-validity oracle rate-limit), R-17 (audit log silent fail), R-18 (email-keyed reset budget) — Low/Medium severity, Phase 1.5 hardening sweep'in dışında kaldı, Phase 6 candidate.
- **npm audit 7 vulnerability:** Hepsi `--force` semver-major bump gerektirir (`next@16`, `react-simple-maps@1.0.0`). Production bundle UNAFFECTED — per-package impact assessment [`docs/audit/phase-1-a-final.md` § 8](docs/audit/phase-1-a-final.md) içinde dokümantedir.

Tüm kapsam kararlarının kanonik kaynağı: [`docs/SCOPE_DECISIONS.md`](docs/SCOPE_DECISIONS.md) (Z.1..Z.13 mentor decisions consolidated).

---

## Test Mimarisi

- **Vitest** — 530 birim/entegrasyon testi, 62 test dosyası, hybrid environment (Node default + jsdom opt-in per-file Faz 4+ component testleri için)
  - axe-core integration, React Testing Library, vitest-axe matchers
  - MSW `onUnhandledRequest: 'error'` — mock-lanmamış network call testi fail ediyor
  - Hermetic discipline: `vi.stubEnv` exclusive, `vi.useFakeTimers` zorunlu time-sensitive testler için
- **Playwright** — 9 aktif E2E + 9 dokümante skip, **Chromium-only**, **üretim siberlab.dev baseline**
  - 3 user journey: auth bootstrap / Lab L1 solve / portfolio cert CRUD
  - GitHub Actions: `.github/workflows/e2e.yml` (workflow_dispatch gated)
- **ESLint** — `next/core-web-vitals` preset, **0 error / 0 warning baseline** (Wave 8 closure)
- **TypeScript** — strict mode, `npx tsc --noEmit` clean on every wave commit
- **Coverage threshold** — 50% baseline (Phase 1), 70% Phase 3, 80% Phase 5

---

## Hızlı Başlangıç

```bash
# Bağımlılıklar
npm install

# Geliştirme sunucusu
npm run dev          # http://localhost:3000

# Doğrulama
npm run test         # 530 vitest tests
npm run lint         # ESLint 0E/0W
npm run build        # production build (env-free per A-17)

# End-to-end
npx playwright test --project=chromium
```

Ortam değişkenleri için `.env.example` referans alınmalıdır. Üretim ortamı Supabase + Resend integration kullanır.

---

## Audit Closure Özeti

| Namespace | Toplam | RESOLVED | PARTIAL | DOC-ACCEPT | DEFERRED / OPEN | RECLASSIFIED / ACCEPTED |
|-----------|--------|----------|---------|------------|-----------------|--------------------------|
| **R-XX** (Faz 1) | 22 | 13 | 0 | 0 | 6 | 3 |
| **R-LAB** (Faz 2) | 15 | 13 | 0 | 1 | 0 | 1 |
| **R-API** (Faz 3) | 15 | 14 | 0 | 0 | 0 | 1 |
| **R-UI** (Faz 4) | 15 | 13 | 1 | 1 | 0 | 0 |
| **R-E2E** (Faz 5) | 13 | 0 | 3 | 0 | 10 | 0 |
| **A-XX** (amendments) | 22 | 20 + 2 ACK | 0 | 0 | 0 | 0 |

**Kümülatif scope-bounded closure:** 50 / 60 inventory item (**83 %**); PARTIAL dahil 53 / 60 (**88 %**).

**Final Tarama** (AI auditor simulation, [`docs/audit/FINAL_SCAN_REPORT.md`](docs/audit/FINAL_SCAN_REPORT.md)): 15 finding (6 DOCUMENTED + 7 NOTE + 2 ACTION); Wave 8'de **her iki ACTION da SHIPPED**, 0 outstanding.

Detaylı namespace-bazlı tablolar ve commit hash referansları: [`docs/AUDIT_README.md`](docs/AUDIT_README.md).

---

## Engineering Pattern'leri

Closure cycle boyunca 18 isimli mühendislik pattern'i isimlendirildi, uygulandı veya genişletildi:

- **Defense-in-depth two-layer** (6 instance): input sanitization + output safe-default rendering
- **Gap-test → regression-guard lifecycle** (2 transition): T-MO-CHMOD-EQ-GAP, T-CAP-A11-GAP
- **Z.10 production-vs-blueprint discipline**: state gathering MUST verify production
- **Mentor-error correction protocol** (6 instance)
- **Honest deferral with explicit reason**
- **axe-smoke per-modal pattern** (7 instance)
- **Belt-and-suspenders nested ErrorBoundary**
- **Bypass-with-justification** (Pattern § 9, Wave 8'de 7 inline-disable instance ile genişledi)

Tüm pattern'ler dosya / cycle referansları ile: [`docs/PATTERN_CATALOG.md`](docs/PATTERN_CATALOG.md).

---

## Repoyu Nasıl Okumalı

Önerilen okuma sırası (kısa → derin):

1. **README.md** (bu dosya) — Türkçe genel bakış, demo link, hızlı başlangıç
2. **[`docs/AUDIT_README.md`](docs/AUDIT_README.md)** — kapsamlı İngilizce audit-grade dokümantasyon (AI auditor first-read)
3. **[`docs/audit/INDEX.md`](docs/audit/INDEX.md)** — 5 faz audit raporu navigatörü + wave closure tablosu
4. **[`docs/SCOPE_DECISIONS.md`](docs/SCOPE_DECISIONS.md)** — Z.1–Z.13 mentor kararları + Wave 5/6/7/8 operatör onayları
5. **[`docs/PATTERN_CATALOG.md`](docs/PATTERN_CATALOG.md)** — 18 mühendislik pattern'i + instance lineage
6. **[`docs/audit/FINAL_SCAN_REPORT.md`](docs/audit/FINAL_SCAN_REPORT.md)** — AI auditor simulation (7 layer scan + finding classification)
7. **Faz audit raporları** (sırayla):
   - [`docs/audit/phase-1-a-final.md`](docs/audit/phase-1-a-final.md) — Security & identity (+ § 8 npm audit state)
   - [`docs/audit/phase-2-a-lab-engine-audit.md`](docs/audit/phase-2-a-lab-engine-audit.md) — Lab Engine
   - [`docs/audit/phase-3-a-api-contracts-audit.md`](docs/audit/phase-3-a-api-contracts-audit.md) — API & contracts
   - [`docs/audit/phase-4-a-ui-a11y-audit.md`](docs/audit/phase-4-a-ui-a11y-audit.md) — UI & accessibility
   - [`docs/audit/phase-5-a-e2e-journeys-audit.md`](docs/audit/phase-5-a-e2e-journeys-audit.md) — E2E journeys
8. **[`docs/audit/phase-1-a-pending-amendments.md`](docs/audit/phase-1-a-pending-amendments.md)** — A-01..A-23 amendment ledger
9. **[`CLAUDE.md`](CLAUDE.md)** — proje konvansiyonları, Faz yol haritası, Testing & Phase Discipline Protocol

Mimari / migration dokümanları (audit-orthogonal):
- [`docs/platform-backbone-plan.md`](docs/platform-backbone-plan.md) — Supabase Postgres backbone narrative
- [`docs/data-flow-map-and-migration-plan.md`](docs/data-flow-map-and-migration-plan.md) — domain-by-domain data flow
- [`docs/postgres-migration-execution-roadmap.md`](docs/postgres-migration-execution-roadmap.md) — Phase 1+ migration steps

---

## Lisans

Bu proje özel bir capstone projesidir. Lisans koşulları operatör tarafından belirlenecektir. Şu an itibarıyla yeniden dağıtım lisansı yoktur.

---

## Acknowledgements

Mentor rehberliğinde, audit-driven engineering discipline'i demonstre etmek için geliştirilen capstone projesi. Wave-based closure cadence, sub-stage stop-checkpoint disiplini ve audit-trail honesty protokolü [`CLAUDE.md`](CLAUDE.md) içinde tekrar kullanılabilir konvansiyon olarak dokümantedir.

---

**Capstone notu:** Bu proje, 491+ commit ve 9 wave closure cycle sonucunda **capstone-teslim-ready** duruma getirilmiştir. Tüm açık ve kapalı maddeler şeffaf şekilde dokümantedir. AI code auditor veya insan reviewer tarafından yapılacak detaylı incelemeler için yukarıdaki "Repoyu Nasıl Okumalı" sırası takip edilmelidir.
