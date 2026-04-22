# CyberSec Blog - Tek Sayfa Sinav Ozeti

## Proje Tanimi
CyberSec Blog, Next.js tabanli full-stack bir siber guvenlik platformudur. Sistem; canli operasyon dashboard'u, tehdit istihbarati ve raporlama yuzeyleri, ogrenme/lab modulleri ve kullanici portfoy yonetimini tek uygulama kabugu altinda birlestirir.

## Ana Moduller
- Home: 3D Global Threat Map, Live Telemetry Stream, olay aksiyonlari, focus kartlari
- Sentinel: aktif raporlar, tarihsel saldiri veritabani, CVE radar, rapor okuma/arsiv akisi
- Community: ogrenme setleri, lab mantigi, araclar, CTF ve terminal benzeri calisma yuzeyi
- Portfolio: profil, sertifikalar, egitim gecmisi, avatar ve operator kimligi
- Blog/Icerik: klasik blogtan daha profesyonel bir istihbarat/arastirma katmanina evrilen icerik motoru

## Teknoloji Yigini
- Next.js 14 App Router
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase
- SQLite
- Vitest

## Auth ve Guvenlik
- login, register, logout ve session akisi API rotalariyla yonetilir
- parolalar `scrypt` ile hashlenir
- oturumlar `httpOnly cookie` ile saklanir
- rol ve session bilgisi server tarafinda dogrulanir

## Veri Mimarisi
Bugun proje hibrit veri yapisiyla calisir:
- Supabase Storage JSON: users, sessions, profiles, certifications, education, reports
- SQLite: alerts, attack events, legacy operational state
- memory fallback: local/dev dayaniklilik katmani

Profesyonel hedef:
- Supabase Postgres = tek gercek veri kaynagi
- Supabase Storage = sadece dosya ve asset depolama

## Gelistirme Sirasi
1. Next.js uygulama kabugu ve ortak shell yapisi kuruldu.
2. Auth ve session sistemi gelistirildi.
3. Home operasyon ekrani kuruldu.
4. Sentinel rapor ve istihbarat alani gelistirildi.
5. Community ogrenme/lab modulleri eklendi.
6. Portfolio kimlik ve belge yonetimi eklendi.
7. Veri katmani profesyonel seviyeye tasinmak uzere Postgres migration yonu hazirlandi.

## Sinavda Kullanilabilecek Guclu Kisa Cevap
Bu proje, siber guvenlik operasyonlari, tehdit istihbarati, ogrenme yuzeyleri ve kullanici portfoy yonetimini bir araya getiren moduler bir full-stack platformdur. Next.js, TypeScript ve Tailwind ile gelistirdim; auth, session, dashboard, raporlama, community ve profile modullerini ayni urunde birlestirdim. Veri katmani bugun hibrit calissa da, projeyi daha profesyonel hale getirmek icin Supabase Postgres tabanli tek source of truth mimarisine gecis hazirligini da tamamladim.

## Ezber Formulu
Kurulum - Auth - Shell - Home - Sentinel - Community - Portfolio - Migration
