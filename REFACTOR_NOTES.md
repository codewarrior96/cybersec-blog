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

## Mobile UX Redesign — Floating Terminal + Curriculum Cleanup

- **Tarih:** 2026-05-01
- **Sebep:** Mobile (375 px) testte kullanıcı, terminal'i tab olarak kullanmanın bilişsel yük yarattığını raporladı: lesson okurken Terminal tab'ına geçmek bağlamı kaybettiriyor; geri dönüldüğünde mission unutulmuş oluyor. Curriculum set girişi ayrıca "OPERATION BRIEFING" + "LEARNING MODEL" kutuları ve 4 pillar tag ile şişkin — operatör asıl içerik (lesson list) için aşağı kaydırmak zorunda.
- **Çözüm:**
  1. **3-tab mobile nav.** `MOBILE_TABS` dizisinden `terminal` girişi kaldırıldı. Desktop content tab'ları zaten 3 (Curriculum / Tools / CTF Missions); desktop terminal'i sağ panelde her zaman görünür, tab'a ihtiyacı yok. Mobile artık 4→3 tab.
  2. **Floating ⌨ Terminal FAB** (`<768px` only). 56×56 px, sağ-alt köşede `position: fixed`, bottom = 86 px + safe-area-inset. Tap → arka planda backdrop fade-in (200 ms) + alttan slide-up sheet (300 ms cubic-bezier(0.22, 1, 0.36, 1), 60 vh yüksekliğinde). Sheet içinde mevcut `Terminal` componenti mount edilir ve **hiç unmount olmaz** — kullanıcı open/close yaptığında input/history/output/cwd state korunur. Dismiss: drag-handle tap, backdrop tap. `prefers-reduced-motion` saygılı (instant). FAB iki durumda gizlenir: overlay açıkken (overlap önleme) ve Tools detail görünümünde (mevcut `← Tool list` back butonuyla overlap önleme).
  3. **Curriculum set intro cleanup** (mobile only). `lab-curriculum-set-intro` className'i ile sarılan blok (OPERATION BRIEFING + LEARNING MODEL + pillars) `@media (max-width: 767px) { display: none }` ile mobile'da gizlendi. Set heading + subtitle + difficulty pills (sibling element, blok dışında) korundu — operatör girişten sonra direkt lesson list'e ulaşır.
- **Cross-panel command injection rewire:** Tools "⌨ Terminal" ve CTF "Open in Terminal" butonları mobile'da `setMobileTab('terminal')` yerine `setMobileTerminalOpen(true)` çağırıyor — komut input'a yazılır, overlay açılır, kullanıcı Enter'a basar.
- **State preservation kanıtı:** FAB → overlay → `pwd` → output görünür → drag-handle ile kapat → FAB geri gelir → tekrar tap → önceki `pwd` çıktısı hâlâ görünür. Live test PASS.
- **Trade-off:** `MobileTab` type'ı `'terminal'` variant'ını korur (back-compat ve mevcut çağrıların type-check geçmesi için), ancak mobile shell artık `mobileTab === 'terminal'` branch'ini render etmiyor. Programatik olarak set edilmesi durumunda görünür bir etkisi yok.
- **Bundle delta:** /community 69.3 → 69.5 kB (+0.2 KB — FAB markup + 6 CSS rule + state hook).
- **DURUM:** ✅ Working tree (commit pending).

## Per-Challenge Start Gate — Cross-Context Bypass Fix

- **Tarih:** 2026-04-29
- **Sebep:** CTF L1 (RECONNAISSANCE) `required: []` + sufficient'i hiç çalıştırılmadan önce reveal banner verebiliyordu. Daha kötüsü, Curriculum lesson'da veya serbest terminalde `cat /etc/passwd | wc -l` çalıştırmak CTF L1'i otomatik tamamlıyor; kart "AUTO-COMPLETED" olarak görünüp eğitim akışını geçersiz kılıyordu.
- **Kök neden (4 katman):**
  1. Tek global `RingEvidenceLog` — tüm sekmeler aynı log'u paylaşıyor.
  2. `runRevealCheck` her komut sonrası context-agnostic olarak unlocked level'ları doğruluyor.
  3. `detectRevealEvent` `ValidationResult.passed`'i değil, sadece `missing/forbidden/temporal`'ı kontrol ediyordu — `sufficient` düşse de fire ediyordu.
  4. localStorage `breach-flags` kalıcı, ne reset ne replay vardı.
- **Çözüm — Seçenek A (Per-Challenge Start Gate):**
  - `EvidenceLog.nextEventId()` helper.
  - `engine.syncEventIdCounter(floor)` — page mount'ta deserialized log'dan engine counter'ı senkronize eder; reload sonrası id collision'ını önler.
  - `validateContract(contract, log, sinceEventId?)` — opsiyonel cursor parametresi, log'u `event.id >= sinceEventId` filtresinden geçirir. `ValidationResult.sufficientMet: boolean` alanı eklendi (gerçek "user walked the path" sinyali).
  - `detectRevealEvent({ ..., startedAtEventId? })` — gate'li doğrulama + `sufficientMet=false`'ta erken return.
  - `RevealHooks.startedAt?: Record<level, eventId>` — engine.runRevealCheck per-level cursor okur.
  - `page.tsx`: `startedAt` state + `breach-started-at` localStorage anahtarı. "▶ START CHALLENGE" / "↻ REPLAY" butonları. Card 4 durum: LOCKED / NOT STARTED / IN PROGRESS / COMPLETED.
- **Migration:** Mount sırasında `submittedFlags` içinde flag'i olan ama `startedAt` kaydı bulunmayan level'lara sentinel `-1` atanır. Detector bu sentinel'i "legacy completion, do not re-fire" olarak yorumlar — mevcut kullanıcılar deploy sonrası banner spam'i ile karşılaşmaz, kart direkt COMPLETED + Replay olarak render olur.
- **Trade-off:** Gate temporal — contextual değil. Kullanıcı L1'i Start ettikten sonra Curriculum sekmesine geçip orada `cat /etc/passwd | wc -l` çalıştırırsa, o event'ler `id >= startedAt[1]` olduğu için L1 reveal'ı tetikler. Strict context isolation (per-tab evidence log) gelecek bir bloğa ertelendi.
- **Test net'i:** `src/lib/lab/__tests__/cross-context-bypass.test.ts` — 3 test (TEST-FIRST, baseline FAIL → fix sonrası PASS): pre-start bypass yok, post-start fire çalışıyor, legacy sentinel re-fire suppress ediyor.
- **DURUM:** ✅ Working tree'de + commit edildi.

## Block C Stage 1 — content.ts Split

- **Tarih:** 2026-04-29
- **Değişiklik:** 1752 satırlık `src/lib/lab/content.ts` 4 domain modülüne bölündü:
  - `src/content/modules/index.ts` (Learning Path)
  - `src/content/tools/index.ts` (TOOLS + TOOL_CATEGORIES)
  - `src/content/challenges/index.ts` (CTF CHALLENGES)
  - `src/content/training-sets/index.ts` (TRAINING_SETS)
- `content.ts` 8 satırlık barrel'a dönüştü; tüm consumer'lar değişiklik yapmadan çalışıyor.
- **DURUM:** ✅ DONE — production'da (commit ec21cb8).
