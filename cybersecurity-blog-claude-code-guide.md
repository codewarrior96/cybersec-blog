# 🛡️ Cybersecurity Blog Platform — Claude Code Prompt Rehberi

**Proje:** Kişisel Siber Güvenlik Blog & Eğitim Platformu
**Hedef:** CTF writeup'ları, güvenlik makaleleri ve teknik içerikler yayınlayabileceğin profesyonel bir platform
**Araç:** Claude Code (Terminal-based agentic coding)

---

## 📐 Mimari Karar: Tech Stack

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Framework | **Next.js 14+ (App Router)** | SSG ile hızlı, SEO-friendly, portfolyo için ideal |
| Styling | **Tailwind CSS** | Hızlı, tutarlı, dark theme kolay |
| İçerik | **MDX (Markdown + JSX)** | Kod blokları, interaktif bileşenler |
| Syntax Highlight | **Shiki** | VS Code kalitesinde kod renklendirme |
| Deployment | **Vercel** | Next.js ile native entegrasyon, ücretsiz tier |
| Versiyon Kontrol | **Git + GitHub** | Portfolyo görünürlüğü |

---

## 🔑 Claude Code Kullanım Stratejisi

### Temel Kurallar

1. **Asla tek seferde tüm projeyi isteme** — Modüler ilerle
2. **Her prompt'ta scope sınırı koy** — "Sadece X'i yap"
3. **Önceki adımı referans ver** — "Mevcut yapıyı bozmadan..."
4. **Kalite kısıtlarını her seferinde hatırlat** — responsive, accessible, secure
5. **Hata aldığında hatayı yapıştır** — Claude Code hata mesajından öğrenir

---

## 🚀 PROMPT SERİSİ (Adım Adım)

Her prompt'u sırayla Claude Code'a ver. Bir adım tamamlanıp çalıştığından emin olduktan sonra bir sonrakine geç.

---

### PROMPT 1 — Proje İskeleti (Scaffolding)

```
Cybersecurity blog platformu için Next.js 14 App Router projesi oluştur.

Tech stack:
- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS
- MDX desteği (@next/mdx veya next-mdx-remote)
- Shiki syntax highlighting

Dosya yapısı:
src/
├── app/
│   ├── layout.tsx          (root layout, dark theme default)
│   ├── page.tsx             (ana sayfa)
│   ├── blog/
│   │   ├── page.tsx         (tüm yazılar listesi)
│   │   └── [slug]/
│   │       └── page.tsx     (tekil yazı sayfası)
│   └── about/
│       └── page.tsx         (hakkımda sayfası)
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── BlogCard.tsx
│   └── MDXComponents.tsx
├── content/
│   └── posts/               (MDX dosyaları burada olacak)
├── lib/
│   └── posts.ts             (MDX dosyalarını okuma utility)
└── styles/
    └── globals.css

Sadece proje iskeleti ve dosya yapısını oluştur.
Her dosyaya minimal placeholder içerik koy.
Projenin `npm run dev` ile hatasız çalıştığını doğrula.
Henüz tasarım yapma, sadece yapı çalışsın.
```

**Bu prompt neden böyle yazıldı:**
- Dosya yapısı açıkça belirtilmiş — Claude Code tahmin etmek zorunda değil
- Scope net: "sadece iskelet, tasarım yapma"
- Başarı kriteri var: "npm run dev ile hatasız çalışsın"

---

### PROMPT 2 — İçerik Sistemi (MDX Pipeline)

```
Mevcut proje yapısını bozmadan, MDX içerik sistemini kur.

Gereksinimler:
1. content/posts/ klasöründeki .mdx dosyalarını oku
2. Her MDX dosyasının frontmatter'ı olacak:
   ---
   title: "Yazı Başlığı"
   date: "2025-03-15"
   tags: ["ctf", "web-security", "xss"]
   category: "CTF Writeup"
   excerpt: "Kısa açıklama"
   difficulty: "easy" | "medium" | "hard"
   ---
3. lib/posts.ts içinde şu fonksiyonları yaz:
   - getAllPosts() — tüm yazıları date'e göre sıralı getir
   - getPostBySlug(slug) — tekil yazı getir
   - getPostsByTag(tag) — tag'e göre filtrele
   - getPostsByCategory(category) — kategoriye göre filtrele
4. blog/page.tsx'de tüm yazıları listele
5. blog/[slug]/page.tsx'de tekil yazıyı renderla
6. Shiki ile syntax highlighting çalışsın (özellikle python, bash, javascript, sql)

Test için 2 örnek MDX dosyası oluştur:
- "XSS Nedir? Temel Cross-Site Scripting Saldırıları" (category: "Makale")
- "PicoCTF 2024 — Web Exploitation Writeup" (category: "CTF Writeup")

Her iki örnek yazıda da kod blokları olsun.
```

**Neden bu sırada:**
- Önce yapı (Prompt 1), sonra veri akışı (Prompt 2)
- Örnek içerik istendi — boş site ile test edemezsin

---

### PROMPT 3 — Tasarım Sistemi (Dark Terminal Aesthetic)

```
Mevcut projenin tasarımını oluştur. Tüm sayfalar için tutarlı bir dark theme uygula.

Tasarım yönü: "Terminal-Inspired Cybersecurity"
- Arka plan: koyu siyah/lacivert (#0a0a0f veya benzeri)
- Ana renk (accent): neon yeşil (#00ff88) veya cyan (#00d4ff) — birini seç
- İkincil vurgu: kırmızı (#ff4444) difficulty:hard için
- Font: JetBrains Mono (kod ve başlıklar), Inter veya genel sans-serif (body text)
- Kod blokları terminal görünümünde olsun (üstte fake title bar: ● ● ● filename.py)

Bileşen tasarımları:

1. **Header:**
   - Sol: Logo/site adı (monospace font, yanıp sönen cursor efekti: "salim@security:~$ _")
   - Sağ: Navigation (Blog, CTF Writeups, About, GitHub ikonu)
   - Sticky, blur backdrop

2. **Ana Sayfa (page.tsx):**
   - Hero section: Kısa tanıtım, typing animation efekti
   - "Son Yazılar" grid (3 kolon, responsive)
   - Kategorilere göre filtreleme butonları

3. **BlogCard bileşeni:**
   - Koyu kart, subtle border glow (hover'da accent renk)
   - Üstte kategori badge'i
   - Difficulty indicator (easy=yeşil, medium=sarı, hard=kırmızı)
   - Tag'ler alt kısımda küçük chip'ler olarak
   - Tarih gösterimi

4. **Tekil Blog Sayfası:**
   - Prose stili (tailwind typography plugin)
   - İçindekiler (Table of Contents) sidebar (desktop'ta)
   - Okuma süresi tahmini
   - Üstte breadcrumb: Blog > Kategori > Yazı Başlığı

5. **Footer:**
   - Minimal: sosyal linkler, copyright
   - "Built with Next.js • Secured with knowledge" gibi bir tagline

Responsive: mobile-first, 768px ve 1024px breakpoint'ler.
Tüm animasyonlar CSS-only olsun (JS gerekmeden).
Tailwind CSS kullan, custom CSS minimum olsun.
```

**Neden ayrı bir adım:**
- Tasarım kararları code logic'ten bağımsız verilmeli
- Çok spesifik görsel talimatlar → Claude Code'un generic çıktı üretme ihtimalini düşürür

---

### PROMPT 4 — SEO & Metadata

```
Mevcut projeye SEO ve metadata ekle. Hiçbir mevcut işlevselliği bozma.

1. Root layout'a:
   - Default metadata (site başlığı, açıklama, Open Graph)
   - Viewport ve theme-color meta tag'leri
   - Favicon desteği (public/favicon.ico placeholder)

2. Her blog yazısı için dynamic metadata:
   - generateMetadata fonksiyonu
   - Open Graph image (og:image) için basit bir template
   - Twitter card meta tag'leri
   - Canonical URL

3. sitemap.xml oluştur (app/sitemap.ts):
   - Tüm statik sayfaları listele
   - Tüm blog yazılarını dinamik olarak ekle

4. robots.txt oluştur (app/robots.ts)

5. JSON-LD structured data:
   - Ana sayfa: WebSite schema
   - Blog yazıları: BlogPosting schema (author, datePublished, headline)

Tüm URL'ler 'https://salim-security.vercel.app' base URL'ini kullansın
(deployment sonrası değiştiririz).
```

---

### PROMPT 5 — İnteraktif Özellikler

```
Projeye aşağıdaki interaktif özellikleri ekle:

1. **Arama (Search):**
   - Header'a search ikonu ekle
   - Tıklandığında modal açılsın (Command+K shortcut desteği)
   - Client-side fuzzy search (tüm yazıların title, excerpt, tags alanlarında)
   - Sonuçlar anlık filthelensin (debounce ile)

2. **Tag Sistemi:**
   - /blog sayfasında tag filtreleme
   - Tıklanan tag aktif olsun, tekrar tıklayınca kaldırılsın
   - Birden fazla tag seçilebilsin (AND logic)
   - URL query params ile senkronize olsun (?tags=xss,sqli)

3. **Reading Progress Bar:**
   - Blog yazısı sayfasında üstte ince progress bar
   - Scroll'a göre dolsun

4. **Copy Code Button:**
   - Her kod bloğunun sağ üstünde "Copy" butonu
   - Tıklayınca "Copied!" feedback'i göstersin

5. **Dark/Light Toggle:**
   - Header'da theme toggle butonu
   - Default dark, ama light mode da olsun
   - Tercih localStorage'da saklanmasın (React state yeterli)
   - Tailwind dark mode class strategy kullan

Tüm interaktif bileşenler "use client" directive ile işaretlensin.
Mevcut tasarımı ve yapıyı bozmadan ekle.
```

---

### PROMPT 6 — Performans & Güvenlik (Production Hardening)

```
Projeyi production-ready hale getir:

1. **Güvenlik Headers (next.config.js):**
   - Content-Security-Policy
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy

2. **Performans:**
   - Tüm görseller next/image ile optimize edilsin
   - Font optimizasyonu (next/font ile JetBrains Mono yükle)
   - Static generation (generateStaticParams) blog yazıları için

3. **Erişilebilirlik (a11y):**
   - Semantic HTML (nav, main, article, aside, footer)
   - Skip to content link
   - ARIA labels navigation için
   - Keyboard navigation desteği (search modal ESC ile kapansın)
   - Color contrast WCAG AA uyumlu olsun

4. **Error Handling:**
   - app/not-found.tsx (custom 404 sayfası, cybersecurity temalı)
   - app/error.tsx (error boundary)

Mevcut tüm işlevselliği koru. Sadece iyileştirme yap.
```

---

### PROMPT 7 — Deployment Hazırlığı

```
Projeyi Vercel deployment için hazırla:

1. .gitignore dosyasını kontrol et (node_modules, .next, .env.local)
2. README.md oluştur:
   - Proje açıklaması
   - Tech stack listesi
   - Local development talimatları
   - Yeni blog yazısı ekleme talimatları
   - Deployment talimatları
3. package.json'daki scripts'i kontrol et (build, start, lint)
4. `npm run build` komutunun hatasız çalıştığını doğrula
5. Eğer hata varsa düzelt

README.md İngilizce olsun (GitHub portfolyo için).
```

---

## 📋 Ekstra Prompt'lar (İhtiyaca Göre)

### Yeni Blog Yazısı Ekleme
```
content/posts/ klasörüne yeni bir MDX blog yazısı oluştur:

Konu: [KONU]
Kategori: [CTF Writeup / Makale / Tutorial / Tool Review]
Difficulty: [easy / medium / hard]
Tags: [tag1, tag2, tag3]

İçerik detaylı olsun, kod örnekleri içersin.
Frontmatter formatını mevcut yazılarla tutarlı tut.
```

### Yeni Bileşen Ekleme
```
Yeni bir [BİLEŞEN ADI] bileşeni oluştur.

İşlevi: [açıklama]
Nereye eklenecek: [hangi sayfa/layout]
Tasarım: mevcut dark terminal temasıyla uyumlu olsun
Props: [varsa listele]

Mevcut yapıyı ve tasarımı bozmadan ekle.
```

### Hata Düzeltme
```
Şu hatayı alıyorum:

[HATA MESAJINI BURAYA YAPIŞTIR]

Bu hata [hangi sayfada/durumda] oluşuyor.
Beklenen davranış: [ne olmalıydı]
Gerçekleşen: [ne oldu]

Hatayı düzelt, mevcut işlevselliği bozma.
```

---

## ⚙️ Claude Code Kurulum Notları

Claude Code terminal tabanlı bir araç. Kurulum ve kullanım için güncel dokümantasyon:
- **Resmi döküman:** https://docs.claude.com/en/docs/claude-code/overview
- **npm paketi:** https://www.npmjs.com/package/@anthropic-ai/claude-code

Kurulum için **Node.js gerekli**. Terminalde `npm install -g @anthropic-ai/claude-code` ile kurulur.
Detaylı ve güncel bilgi için yukarıdaki linkleri kontrol et.

---

## 🧭 Geliştirme Sırası (Roadmap)

```
Hafta 1: Prompt 1-2 (İskelet + İçerik Sistemi)
Hafta 2: Prompt 3 (Tasarım)
Hafta 3: Prompt 4-5 (SEO + İnteraktif Özellikler)
Hafta 4: Prompt 6-7 (Production + Deployment)
Hafta 5+: İçerik üretimi ve yeni özellikler
```

---

## 💡 Portfolyo İpuçları

Bu projeyi GitHub'da paylaşırken:
- **README.md kaliteli olsun** — recruiters buna bakar
- **Commit mesajları anlamlı olsun** — "feat: add MDX pipeline", "fix: search modal a11y"
- **En az 10 gerçek blog yazısı** yaz — boş site kötü görünür
- **Live demo linki** her zaman README'de olsun
- **Yazılarını LinkedIn'de paylaş** — görünürlük kazanırsın
