# CyberSec Blog — Güncel Sınav Özeti

## Yönetici Özeti

CyberSec Blog, klasik bir içerik sitesi olmaktan çıkıp çok katmanlı bir siber güvenlik platformuna dönüşmüş full-stack bir projedir. Sistem; canlı operasyon dashboard'u, tehdit istihbaratı yüzeyleri, rapor ve CVE akışları, öğrenme/lab modülleri ve operatör portföy yönetimini tek uygulama kabuğu altında birleştirir.

Bu proje sınavda sadece “blog yaptım” diye anlatılmamalıdır. Doğru anlatım şudur:

Bu proje, siber güvenlik operasyonları ile eğitim ve kullanıcı kimliği yönetimini tek platformda bir araya getiren, modüler yapıda tasarlanmış, Next.js tabanlı bir ürün mimarisidir.

---

## 1. Projenin Amacı

Projenin temel amacı, siber güvenlik alanını sadece içerik tüketilen bir alan olarak değil; izlenen, analiz edilen, raporlanan, öğrenilen ve kişisel yetkinliklerle desteklenen bir dijital ürün olarak sunmaktır.

Bu nedenle proje dört ana hedefi aynı anda taşır:

- canlı operasyon hissi veren bir SOC benzeri dashboard sunmak
- raporlama ve tehdit istihbaratı yüzeyleri üretmek
- öğrenme, laboratuvar ve çalışma modülleri sağlamak
- kullanıcının portföy, sertifika ve eğitim geçmişini yönetebileceği bir kimlik alanı oluşturmak

---

## 2. Ürün Olarak Konumlandırma

CyberSec Blog bugün aşağıdaki ürün karakterine sahiptir:

- içerik platformu
- operasyon yüzeyi
- öğrenme ve uygulama alanı
- raporlama ve araştırma katmanı
- kullanıcı kimlik ve yetkinlik sunum alanı

Bu yönüyle proje, tek sayfalık veya sadece blog mantığında çalışan yapılardan ayrılır.

---

## 3. Ana Modüller

### Home

Home sayfası, ürünün operasyon merkezi olarak tasarlanmıştır.

Bu alanda:

- 3D Global Threat Map
- Live Telemetry Stream
- olay müdahale aksiyonları
- bölgesel focus kartları
- rapor oluşturma akışı

yer alır.

Bu modül, siber güvenlik olaylarının canlı olarak izlendiği, yorumlandığı ve aksiyona dönüştürüldüğü yüzeydir.

### Sentinel

Sentinel, tehdit istihbaratı ve raporlama katmanıdır.

Bu alanda:

- aktif raporlar
- arşiv akışı
- tarihsel saldırı veritabanı
- CVE radar
- olay okuma ve değerlendirme yüzeyleri

bulunur.

Sentinel, ürünün analitik ve güvenlik istihbaratı tarafını temsil eder.

### Community

Community, öğrenme ve çalışma alanıdır.

Bu modülde:

- öğrenme setleri
- görev temelli ilerleme yapısı
- lab benzeri içerikler
- araçlar
- CTF yüzeyleri
- terminal mantığına yakın etkileşimler

yer alır.

Bu alan, projeyi pasif bir içerik platformundan aktif bir öğrenme ekosistemine taşır.

### Portfolio

Portfolio, kullanıcının operatör kimliğini yönettiği alandır.

Bu modül içinde:

- profil bilgileri
- sertifikalar
- eğitim geçmişi
- uzmanlık görünümü
- avatar ve sunum yüzeyi

yer alır.

Bu katman, projenin kullanıcı odaklı profesyonel yüzünü oluşturur.

### Blog / İçerik Katmanı

Projede blog yapısı halen mevcuttur; ancak ürünün gittiği yön klasik blog mantığından daha profesyonel bir bilgi ve araştırma katmanına doğrudur.

Bu nedenle blog yüzeyi; gelecekte tehdit istihbaratı notları, teknik analizler, olay özetleri ve araştırma brief'leri için içerik motoru olarak konumlanmaktadır.

---

## 4. Kullanılan Güncel Teknolojiler

Projede kullanılan temel teknolojiler şunlardır:

- Next.js 14 App Router
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase
- SQLite
- MDX tabanlı içerik yapısı
- Vitest

Bu kombinasyonun seçilme nedeni:

- hızlı geliştirme
- güçlü tip güvenliği
- modüler front-end mimarisi
- server ve client akışlarını tek çatıda yönetebilme
- ileride ölçeklenebilir veri mimarisine geçebilme

---

## 5. Mimari Katmanlar

Proje teknik olarak birden fazla katmanın birlikte çalıştığı bir yapıya sahiptir.

### Arayüz Katmanı

- route theme yapısı
- ortak shell
- responsive dashboard tasarımı
- mobil ve masaüstü optimizasyonu

### Kimlik Doğrulama Katmanı

- login
- register
- logout
- session doğrulama
- rol tabanlı erişim mantığı

### Operasyon Katmanı

- canlı telemetry akışı
- threat map
- incident benzeri müdahale akışları
- rapor üretimi

### İstihbarat Katmanı

- Sentinel raporları
- tarihsel saldırı arşivi
- CVE radar
- tehdit odaklı bilgi yüzeyleri

### Öğrenme Katmanı

- learning sets
- lab mantığı
- araç ve CTF yüzeyleri

### Kimlik ve Profil Katmanı

- portföy profili
- sertifikalar
- eğitim kayıtları

---

## 6. Auth ve Güvenlik Yaklaşımı

Projede kimlik doğrulama akışı özel API rotaları üzerinden yönetilir.

Temel güvenlik yaklaşımı:

- parolalar `scrypt` ile hashlenir
- oturumlar `httpOnly cookie` ile yönetilir
- session kontrolü server tarafında doğrulanır
- erişim, kullanıcı rolü ve oturum bilgisi üzerinden yorumlanır

Bu yapı sayesinde kullanıcı yönetimi, istemci tarafına bırakılmadan daha güvenli bir modelde ilerler.

---

## 7. Veritabanı ve Veri Mimarisi

Bu proje açısından en önemli teknik başlıklardan biri veri katmanıdır.

### Bugünkü Gerçek Durum

Sistem şu anda hibrit bir veri yapısına sahiptir:

- Supabase Storage JSON app-state
  - users
  - sessions
  - profiles
  - certifications
  - education
  - reports

- SQLite
  - alerts
  - attack events
  - legacy operational state

- memory fallback
  - local/dev ve dayanıklılık fallback'i

- Supabase attack metrics tabloları
  - seçili canlı metrik yüzeyleri

### Neden Bu Önemli?

Bu yapı uygulamayı bugün çalıştırır; fakat profesyonel ürün seviyesinde veri güvenliği, veri tutarlılığı ve ölçeklenebilirlik için tek kaynaklı mimari gerekir.

### Hedef Mimari

Uzun vadeli ve profesyonel hedef şudur:

- Supabase Postgres = tek gerçek veri kaynağı
- Supabase Storage = sadece dosya ve binary asset alanı
- SQLite = geçiş / legacy destek

Bu hedef için migration hazırlıkları projede başlatılmıştır.

---

## 8. Şu Ana Kadar Yapılan Teknik İyileştirmeler

Proje geliştirilirken sadece yeni sayfalar eklenmemiş, aynı zamanda kalite ve profesyonellik için ciddi polish çalışmaları yapılmıştır.

Örnek olarak:

- Home dashboard operasyon akışı yeniden kurgulandı
- threat map ile telemetry senkronizasyonu geliştirildi
- müdahale aksiyonları daha gerçekçi hale getirildi
- Sentinel mobil akışı ve modal düzenleri toparlandı
- rapor arşiv akışı eklendi
- repository içinde eski ve kullanılmayan dosyalar temizlendi
- veri migration yönü belgelendi
- kullanıcı ve session verisini Postgres'e taşıyacak ilk güvenli katman hazırlandı

Bu da projenin sadece görsel değil, mimari olarak da olgunlaştığını gösterir.

---

## 9. Sınavda Anlatılması Gereken Geliştirme Sırası

Sınavda projeyi şu sırayla anlatmak en güçlü etkiyi verir:

1. Projenin amacı belirlendi ve siber güvenlik odaklı modüler ürün yapısı kurgulandı.
2. Next.js, TypeScript ve Tailwind ile temel uygulama kabuğu kuruldu.
3. Login, register, logout ve session mantığı geliştirildi.
4. Ortak shell, route theme ve navigasyon altyapısı oluşturuldu.
5. Home tarafında canlı telemetry ve 3D threat map ile operasyon merkezi kuruldu.
6. Sentinel tarafında raporlar, tarihsel saldırılar ve CVE akışı geliştirildi.
7. Community tarafında öğrenme ve lab modülleri eklendi.
8. Portfolio tarafında kullanıcı profili, sertifika ve eğitim yönetimi geliştirildi.
9. Son aşamada veri mimarisi profesyonel seviyeye taşınmak üzere Supabase Postgres migration planı hazırlandı.

Bu sıralama projeyi hem teknik hem ürün gözüyle anlatmana yardımcı olur.

---

## 10. Sınavda Kullanılabilecek Güçlü Teknik Cevap

Bu projede önce Next.js App Router, TypeScript ve Tailwind kullanarak temel uygulama mimarisini kurdum. Ardından kullanıcı kimlik doğrulama sistemini geliştirip login, register, logout ve session akışlarını API rotaları üzerinden yönettim. Güvenlik için parola hashleme ve httpOnly cookie yaklaşımını kullandım. Daha sonra ürünü modüllere ayırdım: Home tarafında canlı telemetry ve global threat map ile operasyon ekranı kurdum; Sentinel tarafında raporlama, tarihsel saldırı arşivi ve CVE radar geliştirdim; Community alanında öğrenme ve lab mantığını ekledim; Portfolio tarafında ise profil, sertifika ve eğitim yönetimi oluşturdum. Veri katmanında proje şu an hibrit çalışıyor, ancak daha profesyonel ve güvenli bir yapı için Supabase Postgres tabanlı tek source of truth mimarisine geçiş hazırlığını da projeye dahil ettim.

---

## 11. Neden Bu Proje Güçlü Görünür?

Bu projeyi güçlü gösteren şey sadece ekran sayısı değildir.

Asıl güçlü yönleri şunlardır:

- modüler ürün mimarisi
- teknik doğrulama ve API tabanlı auth akışı
- operasyon, istihbarat, öğrenme ve profil yüzeylerinin tek üründe birleşmesi
- responsive ve premium arayüz yaklaşımı
- veri katmanının profesyonel seviyeye taşınması için önceden planlanmış migration yönü

Bu nedenle proje, sıradan bir içerik sitesi yerine gelişen bir platform olarak anlatılmalıdır.

---

## 12. Kısa Ezber Formülü

Kurulum — Auth — Shell — Home — Sentinel — Community — Portfolio — Data Migration

Bu akış sınav anında proje mantığını kaybetmeden anlatmanı sağlar.

---

## 13. Bir Dakikalık Kısa Sunum Metni

CyberSec Blog, siber güvenlik odaklı full-stack bir platformdur. Projede kullanıcı giriş sistemi, canlı operasyon dashboard'u, tehdit istihbaratı ve raporlama alanı, öğrenme/lab modülleri ve portföy yönetimi bulunur. Teknik tarafta Next.js, TypeScript, Tailwind ve Supabase kullanılmıştır. Bugün proje çalışan hibrit bir veri mimarisine sahip olsa da hedef, tüm çekirdek veriyi Supabase Postgres üzerinde tek source of truth mantığında toplamaktır.

---

## 14. Sonuç

CyberSec Blog bugün:

- çalışan
- modüler
- profesyonel hissi olan
- büyümeye hazır
- veri omurgası daha da güçlendirilmeye açık

bir siber güvenlik platformudur.

Sınavda bu projeyi anlatırken en doğru yaklaşım; onu sadece “blog”, sadece “dashboard” veya sadece “öğrenci projesi” gibi sunmak değil, çok katmanlı bir ürün mimarisi olarak konumlandırmaktır.
