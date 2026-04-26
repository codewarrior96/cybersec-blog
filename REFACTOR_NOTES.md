## Gün 3 — Onaysız Kapsam Genişletme (Codex)

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Değişiklik:** Switch-case fallback'te 5 komut (cat, wc, grep, awk, submit) için evidence inference eklendi (~85 satır).
- **Gerekçe:** 01-recon hybrid validation 5 komuttan evidence üretimine bağımlı. Bu komutlar henüz registry'de değil; evidence olmadan contract match etmez.
- **Kullanıcı onayı süreci:** Plana yazılmadı, post-hoc onaylandı.
- **Dead code temizleme:** Gün 7 (komut migration) sırasında bu blok silinecek.
