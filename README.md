# CyberSec Blog — SOC Dashboard & Siber Güvenlik Blogu

Türkçe içerikli bir siber güvenlik blogu ve tam işlevsel bir **Güvenlik Operasyon Merkezi (SOC) dashboard**'unu birleştiren, eğitim/demo odaklı bir full-stack web uygulaması.

---

## Özellikler

### Genel Erişim (Giriş Gerektirmez)
- Siber güvenlik konularında MDX tabanlı teknik blog yazıları (Türkçe)
- CVE Radar — NIST NVD API üzerinden güncel zafiyet listesi
- Breach Timeline — 2003–2024 arası ~40 büyük siber saldırı olayı
- Portfolio, Roadmap ve Community sayfaları
- Tam metin blog arama

### SOC Dashboard (Giriş Gerektirir)
- **Canlı saldırı akışı** — Server-Sent Events (SSE) ile 30 saniyede bir gerçek zamanlı simüle saldırı verisi
- **Alert yönetimi** — Oluşturma, önceliklendirme (P1–P4), atama, durum takibi, kapatma
- **3D Tehdit Globu** — Saldırı kaynaklarını dünya haritasında görselleştirme
- **Metrik paneli** — SLA takibi, analist iş yükü dağılımı, shift snapshot
- **Audit trail** — Her alert değişikliği tam geçmişiyle kayıt altında
- **Raporlama** — Olay/tehdit raporu oluşturma, listeleme, silme
- **Kullanıcı yönetimi** (Admin) — Yeni kullanıcı ekleme, rol atama

### Rol Tabanlı Erişim Kontrolü
| Rol | Yetkiler |
|-----|----------|
| **Admin** | Tam erişim + kullanıcı yönetimi |
| **Analyst** | Alert oluşturma/güncelleme, rapor yazma |
| **Viewer** | Yalnızca okuma |

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript 5 |
| UI | React 18 + Tailwind CSS 3 |
| Veritabanı | SQLite 3 (dosya tabanlı) |
| Blog İçeriği | MDX + gray-matter + next-mdx-remote |
| Kimlik Doğrulama | Session tabanlı (httpOnly cookie) |
| Parola Güvenliği | scrypt + rastgele salt |
| Gerçek Zamanlı | Server-Sent Events (SSE) |
| Dış API'lar | NVD/NIST CVE API, GreyNoise |
| Deployment | Vercel |

---

## Veri Tabanı Şeması

```
users           — Kullanıcı hesapları ve rolleri
sessions        — Oturum token'ları (30 gün TTL)
attack_events   — Simüle saldırı olayları (7 gün saklama)
alerts          — SOC alert kayıtları
alert_events    — Alert değişiklik geçmişi (event sourcing)
alert_notes     — Alert yorumları
audit_logs      — Sistem geneli denetim kaydı
reports         — Olay/tehdit raporları
```

---

## Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn

### Adımlar

```bash
# 1. Repoyu klonla
git clone https://github.com/kullanici-adi/cybersec-blog.git
cd cybersec-blog

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla
cp .env.local.example .env.local
# .env.local dosyasını düzenle (aşağıya bakın)

# 4. Geliştirme sunucusunu başlat
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır. İlk çalıştırmada SQLite veritabanı (`data/soc.db`) ve demo kullanıcılar otomatik oluşturulur.

---

## Ortam Değişkenleri

`.env.local` dosyasına aşağıdaki değişkenleri ekleyin:

```env
# GreyNoise tehdit istihbarat API anahtarı (isteğe bağlı)
GREYNOISE_API_KEY=your_greynoise_api_key_here

# Vercel deployment (yalnızca production için)
VERCEL_OIDC_TOKEN=your_vercel_oidc_token
```

> NVD CVE API'si anahtar gerektirmez; ücretsiz kullanılabilir.

---

## Demo Kullanıcılar

Uygulama ilk çalıştığında aşağıdaki demo hesaplar otomatik oluşturulur:

| Kullanıcı Adı | Şifre | Rol |
|--------------|-------|-----|
| `ghost` | `demo_pass` | Admin |
| `analyst1` | `analyst_pass` | Analyst |
| `viewer1` | `viewer_pass` | Viewer |

> **Uyarı:** Production ortamında bu şifreleri mutlaka değiştirin.

---

## Proje Yapısı

```
cybersec-blog/
├── src/
│   ├── app/
│   │   ├── api/               # Backend API rotaları
│   │   │   ├── auth/          # Giriş/çıkış/oturum
│   │   │   ├── alerts/        # Alert CRUD
│   │   │   ├── live-attacks/  # SSE saldırı akışı
│   │   │   ├── metrics/live/  # SOC metrikleri
│   │   │   ├── cves/          # CVE verileri
│   │   │   ├── reports/       # Raporlama
│   │   │   └── users/         # Kullanıcı yönetimi
│   │   ├── blog/              # Blog sayfaları
│   │   ├── cve-radar/         # CVE listesi
│   │   ├── breach-timeline/   # Tarihsel olaylar
│   │   ├── portfolio/
│   │   ├── roadmap/
│   │   └── community/
│   ├── components/
│   │   ├── SOCDashboard.tsx   # Ana dashboard bileşeni
│   │   ├── ThreatGlobe.tsx    # 3D saldırı haritası
│   │   ├── ThreatFeed.tsx     # Tehdit akışı
│   │   ├── OperatorSidebar.tsx
│   │   ├── MatrixRain.tsx     # Matrix animasyonu
│   │   └── InteractiveTerminal.tsx
│   ├── content/
│   │   └── posts/             # MDX blog yazıları
│   └── lib/
│       ├── db.ts              # SQLite başlatma ve şema
│       ├── soc-store-adapter.ts  # Veri erişim katmanı
│       ├── auth-server.ts     # Sunucu tarafı auth
│       ├── security.ts        # Parola hash fonksiyonları
│       ├── breachData.ts      # Tarihsel breach verileri
│       └── soc-types.ts       # TypeScript tip tanımları
├── public/
├── middleware.ts
├── next.config.mjs
└── tailwind.config.ts
```

---

## Blog Yazısı Ekleme

`src/content/posts/` dizinine `.mdx` uzantılı dosya oluşturun:

```mdx
---
title: "Yazı Başlığı"
date: "2025-01-15"
excerpt: "Kısa açıklama"
tags: ["web", "güvenlik"]
---

# İçerik buraya gelir

MDX destekli tam içerik...
```

---

## API Rotaları

| Rota | Method | Auth | Açıklama |
|------|--------|------|----------|
| `/api/auth/login` | POST | Hayır | Oturum açma |
| `/api/auth/logout` | POST | Evet | Oturum kapatma |
| `/api/auth/session` | GET | Hayır | Oturum kontrolü |
| `/api/alerts` | GET/POST | Evet | Alert listele/oluştur |
| `/api/alerts/[id]` | PATCH | Analyst+ | Alert güncelle |
| `/api/live-attacks` | GET (SSE) | Evet | Canlı saldırı akışı |
| `/api/metrics/live` | GET | Evet | SOC metrikleri |
| `/api/cves` | GET | Hayır | CVE listesi (NVD) |
| `/api/reports` | GET/POST/DELETE | Evet | Rapor yönetimi |
| `/api/users` | GET/POST | Admin | Kullanıcı yönetimi |

---

## Güvenlik

- **Oturum yönetimi**: httpOnly cookie, 30 gün TTL, otomatik temizleme
- **Parola**: scrypt algoritması + rastgele salt + timing-safe karşılaştırma
- **Denetim kaydı**: Tüm kritik aksiyonlar IP ve user-agent ile loglanır
- **RBAC**: Her API rotasında rol kontrolü yapılır
- **Alert geçmişi**: Her durum değişikliği event sourcing ile saklanır

---

## Production'a Geçiş Notları

Bu proje demo/eğitim amaçlıdır. Production ortamı için önerilen adımlar:

- [ ] SQLite → PostgreSQL geçişi (Drizzle ORM veya Prisma ile migration yönetimi)
- [ ] Demo şifrelerin değiştirilmesi
- [ ] API rotalarına rate limiting eklenmesi (örn. Upstash Redis)
- [ ] Sık sorgulanan sütunlara DB index eklenmesi
- [ ] Supabase paketinin kaldırılması (kullanılmıyor)
- [ ] HTTPS ve HSTS zorunlu hale getirilmesi
- [ ] Otomatik DB yedekleme stratejisi belirlenmesi

---

## Lisans

Bu proje eğitim ve kişisel portfolyo amaçlıdır.
