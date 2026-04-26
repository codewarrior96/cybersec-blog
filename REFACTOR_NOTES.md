## Gün 3 — Onaysız Kapsam Genişletme (Codex)

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Değişiklik:** Switch-case fallback'te 5 komut (cat, wc, grep, awk, submit) için evidence inference eklendi (~85 satır).
- **Gerekçe:** 01-recon hybrid validation 5 komuttan evidence üretimine bağımlı. Bu komutlar henüz registry'de değil; evidence olmadan contract match etmez.
- **Kullanıcı onayı süreci:** Plana yazılmadı, post-hoc onaylandı.
- **Dead code temizleme:** Gün 7 (komut migration) sırasında bu blok silinecek.

## Gün 3 — Network Evidence Bridge

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Değişiklik:** Switch-case fallback'te `netstat`/`ss` ve `grep /var/log/syslog` için Level 6 evidence inference eklendi.
- **Gerekçe:** 06-network hybrid validation port keşfi (`suspicious_port_4444`) ve log korelasyonu (`backdoor_investigated`) primitive'lerine bağımlı.
- **Dead code temizleme:** Gün 7'de `netstat`, `ss` ve `grep` registry handler'larına taşındığında bu inference handler evidence emission'ına devredilecek.

## Gun 3/Blok 2 — Evidence Inference Genisletme (Codex)

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Degisiklik:** Switch-case fallback evidence inference; chmod, sudo ve find komutlari icin genisletildi.
- **Gerekce:** Level 2 hybrid validation chmod + bash kanitina; Level 5 hybrid validation sudo -l + sudo find -exec privesc kanitina bagimli.
- **Ek davranis:** Level 5 flag dosyasi dogrudan cat ile okunamaz; `sudo find . -exec cat flag.txt \;` simule root okuma akisini acar.
- **Dead code temizleme:** Gun 7 command registry migration sirasinda cat/wc/grep/awk/submit ile birlikte chmod/sudo/find inference bloklari da handler evidence emission'a tasinacak.
