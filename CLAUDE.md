# 🧠 CLAUDE.md — Proje Hafızası (Her oturumda otomatik okunur)

> Bu dosya her Claude oturumunun başında otomatik okunur. Kullanıcıya projeyi baştan anlatmasına gerek yok.

---

## 📌 PROJE KİMLİĞİ

**Ad**: CyberSec Blog + SOC Dashboard
**Dil**: Türkçe UI, TypeScript kod
**Deployment**: Vercel → `git push origin main` yeterli, Vercel otomatik deploy eder
**Repo**: `github.com/codewarrior96/cybersec-blog`
**Local**: `C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog`
**Son commit**: `c852e6e` — `/home` URL fix

---

## 🗺️ ROUTING (Sayfalar)

| URL | Dosya | Ne Gösteriyor |
|-----|-------|---------------|
| `/` | `app/page.tsx` | → `/home`'a redirect |
| `/home` | `app/home/page.tsx` | **Ana SOC Dashboard** (auth gerekli) |
| `/login` | `app/login/page.tsx` | Hacker temalı login ekranı |
| `/blog` | `app/blog/page.tsx` | Blog listesi (arama + filtre) |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | MDX blog yazısı |
| `/zafiyet-taramasi` | `app/zafiyet-taramasi/page.tsx` | CVE Radar + Breach Timeline + APT |
| `/community` | `app/community/page.tsx` | Siber güvenlik eğitim laboratuvarı |
| `/portfolio` | `app/portfolio/page.tsx` | Hakkında / Portfolio |
| `/roadmap` | `app/roadmap/page.tsx` | Özellik yol haritası |
| `/cve-radar` | → `/zafiyet-taramasi` | Redirect |
| `/breach-timeline` | → `/zafiyet-taramasi` | Redirect |
| `/about` | → `/portfolio` | Redirect |

---

## 🧩 DASHBOARD BİLEŞENLERİ (`src/components/dashboard/`)

| Dosya | Görev |
|-------|-------|
| `DashboardLayout.tsx` | Ana orkestratör — tüm widget'ları düzenler, state yönetir |
| `ThreatBanner.tsx` | Üst şerit: tehdit seviyesi (DÜŞÜK→KRİTİK), saat, demo modu |
| `AlertManagementWidget.tsx` | Alert CRUD: listele/yarat/durum güncelle (P1-P4, YENİ→ÇÖZÜLDÜ) |
| `CyberNewsWidget.tsx` | RSS haber akışı (THN, Krebs, BleepingComputer, SANS, SecurityWeek) |
| `ThreatIntelWidget.tsx` | GreyNoise IP istihbaratı — ülke/etiket dağılımı + IP sorgula |
| `CriticalAlertPanel.tsx` | Kritik alert popup + rapor oluşturma butonu |
| `AttackReportModal.tsx` | Saldırı raporu oluşturma (Claude API kaldırıldı → statik açıklamalar) |
| `SocTriageWidget.tsx` | SOC triage panosu, SLA metrikleri (P1=15dk, P2=60dk, P3=240dk) |
| `CveFeedWidget.tsx` | CVSS 9+ CVE listesi (NIST NVD API) |

**DashboardLayout Grid Yapısı:**
```
ROW 1: [Aktif Alertler] [CVSS 9+ CVE] [Gözlemlenen IP] [Son Güncelleme]
ROW 2: [AlertManagementWidget 7/12] | [CyberNewsWidget 5/12]
ROW 3: [ThreatIntelWidget tam genişlik]
```

> ⚠️ `SocTriageWidget` ve `CveFeedWidget` dosyaları mevcut ama dashboard'a henüz entegre edilmedi.

---

## 🔌 API ENDPOINTS (`src/app/api/`)

| Endpoint | Method | Auth | Açıklama |
|----------|--------|------|----------|
| `/api/auth/login` | POST | ✗ | Oturum aç (rate-limit: 10 deneme/5dk) |
| `/api/auth/logout` | POST | ✓ | Oturumu kapat |
| `/api/auth/session` | GET | ✗ | Oturum durumu kontrol |
| `/api/alerts` | GET | ✓ | Alert listesi (status/priority filtreli) |
| `/api/alerts` | POST | Analyst+ | Yeni alert oluştur |
| `/api/alerts/[id]` | PATCH | Analyst+ | Alert güncelle (status, priority, atama, not) |
| `/api/live-attacks` | GET | ✓ | Simüle saldırı olayı üretir (demo) |
| `/api/metrics/live` | GET | ✓ | Dashboard metrikleri anlık görüntü |
| `/api/cves` | GET | ✗ | NIST NVD'den CVE listesi (5dk cache) |
| `/api/cybernews` | GET | ✗ | RSS haber toplayıcı (5dk cache) |
| `/api/greynoise` | GET | ✗ | GreyNoise tehdit istihbaratı (API key gerekli) |
| `/api/reports` | GET/POST/DELETE | Analyst+ | Olay raporu CRUD |
| `/api/users` | GET | ✓ | Atanabilir kullanıcı listesi |
| `/api/users` | POST | Admin | Yeni kullanıcı oluştur |

---

## 🗄️ VERİTABANI (SQLite — `data/soc.db`)

Tablolar: `users`, `sessions`, `attack_events`, `alerts`, `alert_events`, `alert_notes`, `audit_logs`, `reports`

**Demo kullanıcılar** (otomatik oluşturulur):
| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| `ghost` | `demo_pass` | Admin |
| `analyst1` | `analyst_pass` | Analyst |
| `viewer1` | `viewer_pass` | Viewer |

**Vercel'de**: SQLite yerine `soc-store-memory.ts` (RAM içi) kullanılıyor — veri oturum boyunca tutulur.

---

## 🔐 AUTH SİSTEMİ

- **Şifreleme**: scrypt + 16-byte rastgele salt → `salt:hash` formatında saklanır
- **Oturum**: 30 günlük httpOnly cookie (`soc_session`)
- **Rate limit**: IP başına 10 başarısız giriş / 5 dakika
- **RBAC**: Admin > Analyst > Viewer
- **Dosyalar**: `auth-server.ts`, `auth-client.ts`, `security.ts`, `api-auth.ts`

---

## 🧰 TEKNOLOJİ YIĞINI

```
Next.js 14.2 + TypeScript 5 + React 18
Tailwind CSS 3.4 (sadece dark mode)
SQLite (sqlite3 + sqlite paketleri)
MDX + gray-matter + shiki (blog)
xterm.js (terminal simülasyonu)
Recharts (grafikler)
cobe (3D küre)
lucide-react (ikonlar)
@anthropic-ai/sdk 0.80 (kurulu ama şu an aktif kullanılmıyor)
```

---

## 🌿 ORTAM DEĞİŞKENLERİ (`.env.local`)

```env
GREYNOISE_API_KEY=59c971f7-a585-4a34-94d1-d191070c369e   # Aktif
GROQ_API_KEY=BURAYA_YENİ_KEY_YAZ                          # ⚠️ Güncellenmeli
VERCEL_OIDC_TOKEN=...                                      # Otomatik
```

---

## 📝 BLOG İÇERİĞİ (`src/content/posts/`)

8 Türkçe MDX yazısı:
- `active-directory-saldiri-teknikleri`
- `buffer-overflow-temelleri`
- `linux-privilege-escalation`
- `merhaba-dunya`
- `reverse-shell-teknikleri`
- `sql-injection-temelleri`
- `wireshark-network-analiz`
- `xss-cross-site-scripting`

---

## 🎨 TASARIM DİLİ

- **Tema**: Tamamen siyah arka plan (`#000000`), yeşil neon vurgu (`#00ff88`), cyan (`#00d4ff`)
- **Font**: Monospace (JetBrains Mono / system-mono)
- **Efektler**: Matrix rain, neon glow, scan sweep animasyonları, kritik alert kırmızı FX
- **CSS**: `src/styles/globals.css` — custom CSS variables + Tailwind
- **Mobil**: Responsive, son commit'lerde düzeltmeler yapıldı

---

## ✅ SON YAPILAN İŞLER (Git geçmişi özeti)

```
c852e6e  fix: /home URL düzeltmesi — dashboard /home'da, / redirect veriyor
28427a3  feat: AlertManagement + CyberNews + ThreatIntel widget'ları eklendi (7 eski widget silindi)
50ed1ad  feat: AttackReportModal — Claude API kaldırıldı, statik açıklamalar
1d5a03a  feat: Claude AI saldırı analizi + eğitim setleri
acb99d5  fix: NavigationBar yanlışlıkla silinmişti, geri getirildi
4080e33  feat: navigation barları kaldırıldı, güvenlik araçları simülasyonu eklendi
cce8fff  feat: Community lab büyük yenileme — CTF, 35 araç, 12 modül
```

---

## 🚧 YAPILACAKLAR / EKSİKLER

- [ ] `SocTriageWidget` ve `CveFeedWidget`'ı DashboardLayout'a entegre et
- [ ] Claude API'yi yeniden aktif et (attakReportModal'da — şu an statik açıklamalar var)
- [ ] `GROQ_API_KEY` güncellenmeli
- [ ] Kullanıcı kayıt akışı ("KAYIT OL" butonu var ama disabled)
- [ ] Blog yazısı sayısı artırılabilir (şu an 8 yazı)
- [ ] Supabase paketi ya kullanılmalı ya kaldırılmalı

---

## 🚀 DEPLOY

```bash
git add .
git commit -m "..."
git push origin main
# Vercel otomatik deploy başlatır (~1-2 dk)
```

---

## ⚡ HIZLI BAŞLANGIÇ KOMUTU

```bash
cd "C:\Users\salim\Desktop\GİTHUB PROJE\cybersec-blog"
npm run dev
# http://localhost:3000 → /home'a yönlendirir
# Giriş: ghost / demo_pass
```
