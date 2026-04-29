## Gün 3 — Onaysız Kapsam Genişletme (Codex)

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Değişiklik:** Switch-case fallback'te 5 komut (cat, wc, grep, awk, submit) için evidence inference eklendi (~85 satır).
- **Gerekçe:** 01-recon hybrid validation 5 komuttan evidence üretimine bağımlı. Bu komutlar henüz registry'de değil; evidence olmadan contract match etmez.
- **Kullanıcı onayı süreci:** Plana yazılmadı, post-hoc onaylandı.
- **Dead code temizleme:** Gün 7 (komut migration) sırasında bu blok silinecek.
- **DURUM (2026-04-29):** ✅ DONE — Block C Stage 2 ile temizlendi. CTF-spesifik `fact_derived` çıkarımları (`passwd_line_count`) `inferSwitchEvidence`'ten kaldırıldı; karşılığı `validation/contracts.ts` içinde temel `command_executed_with_args` + `file_read` primitive'leri ile deklaratif olarak ifade ediliyor. Universal evidence (`command_executed`, `file_read via wc/grep/awk`) `emitSwitchBaseEvidence` adıyla korundu.

## Gün 3 — Network Evidence Bridge

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Değişiklik:** Switch-case fallback'te `netstat`/`ss` ve `grep /var/log/syslog` için Level 6 evidence inference eklendi.
- **Gerekçe:** 06-network hybrid validation port keşfi (`suspicious_port_4444`) ve log korelasyonu (`backdoor_investigated`) primitive'lerine bağımlı.
- **Dead code temizleme:** Gün 7'de `netstat`, `ss` ve `grep` registry handler'larına taşındığında bu inference handler evidence emission'ına devredilecek.
- **DURUM (2026-04-29):** ✅ DONE — Block C Stage 2 ile temizlendi. `suspicious_port_4444` ve `backdoor_investigated` `fact_derived` emission'ları engine'den kaldırıldı; L6 contract'ı artık `command_executed: ss/netstat` + `command_executed_with_args grep … /var/log/syslog` + `file_read /var/log/syslog via grep` ile aynı şartı deklaratif olarak ifade ediyor. `requiresBeforeReading` clause'u da `anyOf [[ssRun], [netstatRun]]` ile yeniden ifade edildi.

## Gun 3/Blok 2 — Evidence Inference Genisletme (Codex)

- **Tarih:** 2026-04-26
- **Dosya:** src/lib/lab/engine.ts
- **Degisiklik:** Switch-case fallback evidence inference; chmod, sudo ve find komutlari icin genisletildi.
- **Gerekce:** Level 2 hybrid validation chmod + bash kanitina; Level 5 hybrid validation sudo -l + sudo find -exec privesc kanitina bagimli.
- **Ek davranis:** Level 5 flag dosyasi dogrudan cat ile okunamaz; `sudo find . -exec cat flag.txt \;` simule root okuma akisini acar.
- **Dead code temizleme:** Gun 7 command registry migration sirasinda cat/wc/grep/awk/submit ile birlikte chmod/sudo/find inference bloklari da handler evidence emission'a tasinacak.
- **DURUM (2026-04-29):** ✅ DONE — Block C Stage 2 ile temizlendi. CTF-spesifik `privesc_via_sudo_find` ve `suid_discovered` (kullanılmayan) `fact_derived` emission'ları kaldırıldı. L5 contract'ı artık `command_executed_with_args sudo find -exec cat` ordered_subsequence pattern'iyle aynı koşulu yakalıyor. Universal `chmod → file_modified_perms` ve `sudo → security_tool_used` emission'ları korundu (CTF-agnostic).

## Block C Stage 3 — KNOWN_COMMANDS Auto-Generation

- **Tarih:** 2026-04-29
- **Dosya:** src/lib/lab/engine.ts, src/components/lab/Terminal.tsx, src/lib/lab/commands/{index,registry}.ts
- **Değişiklik:** Terminal.tsx'teki ~100 girişlik elle bakımlı `KNOWN_COMMANDS` listesi kaldırıldı; yerine engine'den export edilen `getKnownCommands()` fonksiyonu kullanılıyor.
- **Source of truth:** `engine.ts` içinde `SWITCH_COMMAND_TOKENS` + `DEFAULT_BRANCH_TOKENS` sabit dizileri (switch-case'in yanında, eşleşik tutulması için yorumlu) ve `commands/registry.ts:listRegistryCommandNames()`.
- **DURUM:** ✅ DONE — Block C tamamlanma yolu kapatıldı. Yeni komut eklerken Terminal.tsx'i güncellemek gerekmiyor; engine'deki tek liste yeterli.

## Block C Stage 1 — content.ts Split

- **Tarih:** 2026-04-29
- **Değişiklik:** 1752 satırlık `src/lib/lab/content.ts` 4 domain modülüne bölündü:
  - `src/content/modules/index.ts` (Learning Path)
  - `src/content/tools/index.ts` (TOOLS + TOOL_CATEGORIES)
  - `src/content/challenges/index.ts` (CTF CHALLENGES)
  - `src/content/training-sets/index.ts` (TRAINING_SETS)
- `content.ts` 8 satırlık barrel'a dönüştü; tüm consumer'lar değişiklik yapmadan çalışıyor.
- **DURUM:** ✅ DONE — production'da (commit ec21cb8).
