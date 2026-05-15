# Phase 2.A — Lab Engine Audit

**Status:** Draft (sub-stage A: report only) · **Date:** 2026-05-14 · **Phase:** 2 of 5 · **Sub-stage:** A (Audit) · **Author:** Claude (with Salim review)

This document is the canonical Phase 2.A deliverable. It mirrors the `phase-1-a-final.md` structure (risk register + section-mapped DoD) and supersedes any preceding draft. R-LAB-NN risk IDs are stable; later sub-stages may reference them by number. CLAUDE.md L175 sub-stage discipline applies: **this commit produces this markdown file and nothing else**. No code, no tests, no infrastructure.

After Phase 1.5.15 A-17 closure: 8 RESOLVED + 12 OPEN amendments + 1 numbering gap (A-16). Audit register count verified via state gathering; recurring "11 OPEN" figure in three prior commit messages was an off-by-one drift.

---

## 1. Module Inventory

Lab Engine surface enumerated under `src/lib/lab/` + `src/components/lab/`. **5504 LOC** of pure TypeScript logic across 35 files. Distribution: orchestrator `engine.ts` (2556 LOC, 46%); domain content modules (manpages 699, validation/contracts 299, evidence/match 227, mutation/operations 212) account for another 26%; the remainder is small helper / type / loader modules under 100 LOC each.

| Module | LOC | Public surface (selected) | Purpose |
|---|---|---|---|
| `lab/engine.ts` | **2556** | `runCommand`, `runSingle` (file-local), `getKnownCommands`, `isValidFlag`, `syncEventIdCounter`, `RevealHooks`, `VALID_FLAGS` (re-exported view), `tokenize`/`splitPipeline`/`stripQuotes` (file-local) | Command dispatch orchestrator. Hosts the `runSingle` switch-case (~80 commands), pipeline runner, evidence-event emission, and `runRevealCheck` integration with `reveal/detector.ts`. |
| `lab/types.ts` | 165 | `FSNode`, `DirNode`, `FileNode`, `CommandContext`, `TerminalExecution`, `Challenge`, `Lesson`, `TrainingSet`, `LessonValidationCheck`, `PendingCommand` | Shared TypeScript types. No runtime logic. |
| `lab/filesystem.ts` | 80 | `ROOT`, `resolvePath`, `normalizePath` (file-local), `getNode`, `basename`, `colorEntry` | Read-only virtual filesystem (merged from `_base.json` + 6 scenario JSONs at module load). |
| `lab/content.ts` | 8 | (re-exports only) | Content barrel. |
| `lab/commands/registry.ts` | 38 | `registerCommand`, `getCommand`, `registerAll`, `listRegistryCommandNames` | Map-backed command registry (5 commands registered today: help, pwd, whoami, history, clear). |
| `lab/commands/index.ts` | 26 | (registers handlers + dev-only `verifyRegistry`) | Module-load handler registration + `if (process.env.NODE_ENV !== 'production')` dynamic-import + invoke of verifier. |
| `lab/commands/types.ts` | 34 | `CommandHandler`, `CommandResult`, `SideEffect`, `CommandCategory` | Command handler contract. |
| `lab/commands/__verify__.ts` | 71 | `verifyRegistry()` | Dev-only invariant checker — throws if registry shape drifts, runs at module-load in non-production builds. |
| `lab/commands/system/{clear,help,history,pwd,whoami}.ts` | 100 total | 5 handler implementations | Per-command handler implementations for the 5 registry-routed commands. |
| `lab/evidence/types.ts` | 57 | `EvidencePrimitive` (13-variant discriminated union), `EvidenceEvent`, `EvidenceLog` (interface) | Evidence primitive type catalog. |
| `lab/evidence/log.ts` | 70 | `RingEvidenceLog` (class), `MAX_EVIDENCE_EVENTS=200`, `serializeEvidenceLog`, `deserializeEvidenceLog`, `evidenceStorageKey` | Ring-buffer evidence log + localStorage serialization helpers. |
| `lab/evidence/match.ts` | 227 | `matchPrimitive`, `containsSubset`/`containsOrderedSubsequence` (file-local), 12 per-primitive matchers | Heart of evidence matching — 12 separate match functions feeding `matchPrimitive` switch. |
| `lab/evidence/normalize.ts` | 78 | `stripAnsi`, `normalizePath`, `normalizeCommand`, `basenameOf`, `pathMatches`, `pathArgMatches`, `normalizeArgs` | Path/arg/string normalization primitives. |
| `lab/evidence/index.ts` | 28 | barrel re-exports | Public-facing index. |
| `lab/mutation/types.ts` | 22 | `MutableFsNode`, `MutationOp` (7-variant discriminated union), `MutationResult` | Mutation operation types. |
| `lab/mutation/state.ts` | 55 | `createMutableFs`, `initMutableFs`, `resetMutableFs`, `getMutableNode`, `applyMutation` | Mutation state singleton + deep-clone helper. |
| `lab/mutation/operations.ts` | 212 | `applyOperation` (entry), 6 op handlers (touch/mkdir/rm/mv/chmod/write), `PROTECTED_PREFIXES` (file-local), `applyChmodMode` (file-local) | Filesystem mutation ops; enforces protected-prefix denial. |
| `lab/mutation/index.ts` | 8 | barrel | Public-facing index. |
| `lab/reveal/types.ts` | 8 | `RevealEvent` | Banner event type. |
| `lab/reveal/banner.ts` | 43 | `formatBanner` | ASCII neon banner renderer. |
| `lab/reveal/detector.ts` | 75 | `detectRevealEvent` | Per-challenge reveal gate logic (start-cursor + already-revealed dedup + temporal/forbidden contract eval). |
| `lab/reveal/index.ts` | 3 | barrel | Public-facing index. |
| `lab/scenarios/types.ts` | 27 | `Scenario`, `ChallengeRef`, `SerializedFSNode`, `Difficulty` | Scenario JSON shape. |
| `lab/scenarios/loader.ts` | 39 | `listScenarios`, `loadScenario` | Lazy scenario loader (per-id dynamic import). |
| `lab/scenarios/merge.ts` | 42 | `mergeScenarioWithBaseFs` | Recursive scenario-FS merge (child overrides win). |
| `lab/scenarios/index.ts` | 13 | barrel | Public-facing index. |
| `lab/validation/types.ts` | 42 | `ValidationContract`, `ValidationMode`, `ValidationResult`, `RequiresBeforeReadingClause` | Contract shape + result shape. |
| `lab/validation/contract.ts` | 90 | `validateContract`, `filterLogSince` (file-local), temporal helpers | Contract evaluator with optional start-cursor scoping. |
| `lab/validation/contracts.ts` | 299 | `challengeContracts` (6-level Record) | The 6 hardcoded CTF challenge contracts (L1-L6 expected primitives). |
| `lab/validation/adapter.ts` | 52 | `validateChallengeWithMode` | Mode dispatcher (`legacy_flag_only` / `evidence_only` / `hybrid`). |
| `lab/validation/hint.ts` | 22 | `conditionMatches`, `EvidenceCondition`, `EvidenceAwareHint` | Evidence-aware hint condition evaluator. |
| `lab/validation/humanize.ts` | 41 | `humanize` | Render a primitive as a human-readable command suggestion. |
| `lab/validation/modes.ts` | 10 | `challengeModes` | Per-level mode mapping (all `hybrid` today). |
| `lab/manpages/index.ts` | 699 | `getManPage`, `manPageCount`, `listManPages` | 50+ simulated man pages + alias map + `renderPage`. |
| `lab/__tests__/cross-context-bypass.test.ts` | 123 | (3 tests) | Existing test file — `detectRevealEvent` per-challenge start gate. |
| `lab/__tests__/ctf-regression.test.ts` | 141 | (6 tests) | Existing test file — L1-L6 canonical solution paths. |
| `components/lab/Terminal.tsx` | — | (UI consumer) | xterm.js terminal component. **NOT IN PHASE 2 SCOPE** — Phase 4 (UI). |
| `components/lab/AnsiText.tsx` | — | (UI consumer) | ANSI escape renderer. **NOT IN PHASE 2 SCOPE** — Phase 4 (UI). |

**Consumers:** only `src/app/community/page.tsx` + `src/components/lab/Terminal.tsx` import from `@/lib/lab/*`. Single user-facing route consumer (`/community` per CLAUDE.md routing table) — narrows blast radius if a Lab Engine change regresses.

---

## 2. Risk Register (R-LAB-01..R-LAB-15)

Phase 2 adopts a new `R-LAB-XX` namespace to avoid collision with Phase 1's R-01..R-22. Severity scheme matches Phase 1 (Critical / High / Medium / Low / Informational). Phase 1's empty-area Lab Engine references during Phase 1.D-1.5 cycles were intentional (`auth-client.ts is Phase 4 territory` style) — Phase 1 audit has zero Lab Engine R-XX entries.

| ID | Severity | OWASP / Category | File(s) | Risk | Exploit / failure scenario |
|---|---|---|---|---|---|
| R-LAB-01 | Medium | A04 Insecure Design | `validation/contracts.ts`, `engine.ts` | **CTF flag exposure in client bundle**: `VALID_FLAGS` (engine.ts L50-57) is a module-load `Set<string>` enumerating all 6 challenge flag strings as literals. The 6 challenge contracts in `contracts.ts` also embed flag strings as `expectedFlag` and inside `flag_submitted` primitives. All literals are bundled into the client JS chunk served by `/community`. Inspect-element / View-source / `grep` of the deployed JS reveals every flag. | Demo-context risk: any visitor with browser DevTools can extract flags without solving challenges. **Severity adjusted High → Medium in Phase 2.D (mentor Z.1 decision):** portfolio-demo context downgrades the educational-integrity threat. The deployment is a personal portfolio, not a graded competition; flag-viewable status is acceptable. Mitigations preserved: (a) `hybrid` mode still requires evidence beyond the flag string; (b) panel-driven submission (validateChallengeWithMode) goes through the contract evaluator. **Hardening proposal** (NOT Phase 2.D scope; future architectural cycle if context shifts): move flag validation server-side via API route, store flags hashed (SHA-256) in client bundle, validate via constant-time compare on server. |
| R-LAB-02 | **High** | A04 Insecure Design | `reveal/detector.ts`, `engine.ts:runRevealCheck` | **Reveal-detector start-cursor logic is multi-state-complex**: detector branches on `alreadyRevealed` (Set), `startedAtEventId` (number / undefined / -1 sentinel / +Infinity sentinel), `sufficientMet` (boolean), `blockingMissing` (filtered list excluding `flag_submitted`), plus contract `forbidden` and `temporalFailures`. Five-axis branch matrix. Existing test covers happy-path + 2 negative cases (before-start + legacy sentinel), but doesn't exhaustively cross-product the axes. | A logic regression in this surface causes one of: (a) early reveal — banner fires before the user actually solves (educational integrity loss), (b) silent no-reveal — banner suppressed despite solution (UX breakage, hard to debug), (c) cross-context bleed — Curriculum lesson events satisfying a CTF level's contract from the prior session. The `startedAtEventId: number === undefined ? +Infinity : entry` branch in `engine.ts:runRevealCheck` L467-471 is particularly subtle (treating "level not started" as `+Infinity` cursor means no event id can clear the gate — correct intent, fragile code). |
| R-LAB-03 | **High** | A04 Insecure Design | `validation/contract.ts`, `validation/contracts.ts` | **Validation contract evaluator + temporal clauses are correctness-critical**: `validateContract` (contract.ts) filters log by `sinceEventId`, then checks `required` (all present), `forbidden` (none present), `sufficient` (≥1 group satisfied), `requiresBeforeReading` (temporal ordering before flag submit). 6 contracts × 4 clause types × event-id ordering = combinatorial surface. | A regression in temporal ordering (e.g., a refactor that breaks `latestFlagSubmitEventId`'s `Number.POSITIVE_INFINITY` default when no submit exists) silently passes contracts. False-positive reveals = R-LAB-02 outcome. Existing CTF regression test exercises happy paths only; **negative temporal scenarios are untested** (e.g., flag submitted before required `file_read` is recorded → must fail; never tested). |
| R-LAB-04 | Medium | A04 Insecure Design | `mutation/operations.ts` | **Protected-prefix enforcement** (`PROTECTED_PREFIXES = ['/etc', '/usr', '/var', '/proc', '/sys', '/root', '/boot']`) gates 6 mutation ops (touch/mkdir/rm/mv/chmod/write). `isProtected(path)` uses `path === prefix \|\| path.startsWith(prefix+'/')`. Path normalization is the caller's responsibility — `engine.ts` resolves via `resolvePath` first, but if a future caller invokes `applyMutation` with a non-normalized path (e.g., `/etc/../tmp/x` raw), `startsWith('/etc/')` returns true and denies legitimate `/tmp/x` work, or worse — `'/etc'.startsWith('/etc')` is true but `'/etcd'.startsWith('/etc/')` is false (correct), yet `'/etca'.startsWith('/etc')` is true (incorrect — non-existent edge case but illustrates pattern brittleness). | Realistic: educational user attempts `chmod +x /etc/passwd` → permission denied (correct). Edge: user constructs path with `~`/`..` segments that bypass intent. Severity Medium because mutation only affects in-memory mutable FS clone (no actual host damage), but a bypass would corrupt the educational experience (showing root-owned files writable to operator user). |
| R-LAB-05 ✅ RESOLVED (Wave 3 gap-locked) | Medium | A04 Insecure Design | `mutation/state.ts` | **Mutation state singleton** (`let currentMutableFs: MutableFsNode \| null = null` at module scope) — single-process-global. `initMutableFs()` returns the same instance to every caller until `resetMutableFs()` is invoked. In a multi-tab browser session, both tabs share this singleton (same JS module instance per origin). In production Vercel runtime, server-side rendering paths share the same module instance across concurrent SSR requests if the singleton ever escapes the client boundary. | Educational issue: state from one tab visible in another (could be intended for some scenarios, surprising for others). Per-test isolation issue: vitest tests that touch mutation state must explicitly `resetMutableFs()` before each test or risk cross-test bleed; existing tests use `createMutableFs(ROOT)` per-test which is correct, but a future test that calls `initMutableFs()` directly would inherit. Severity Medium because Lab Engine is client-side and Next.js dynamic-import boundary mostly prevents SSR coupling, but the pattern is fragile. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-MS01-04 gap-tests (`src/lib/lab/mutation/__tests__/state.test.ts`). Current singleton behavior locked: T-MS01-GAP asserts `initMutableFs()` reference-equality across calls (singleton confirmed); T-MS02 verifies `resetMutableFs()` drops + rebuilds; T-MS03 documents cross-caller leak (multi-tab risk); T-MS04 verifies `createMutableFs(ROOT)` isolation helper for test contexts. Future per-session refactor flips T-MS01-GAP assertion. |
| R-LAB-06 ✅ FIXED (Wave 2B) | Medium | A04 Insecure Design | `mutation/operations.ts:applyChmodMode` | **chmod mode parser** supports numeric (`755`, `0755`, `644`) and symbolic (`+x`, `u+x`, `g-w`, `a=r`, `+rx`) modes. Multiple branches: numeric three-digit interpretation, leading-zero stripping, symbolic regex `/^([ugoa]*)([+\-=])([rwx]+)$/`. Mode `=r` (set scope to r only, drop w+x) is implemented via `op === '+' \|\| op === '='` branch — `=` shares the "+" code path but should additionally clear unmentioned bits. Surface: untested today. | A user types `chmod 077 file` (numeric, valid) — parser sets owner=---, group=rwx, other=rwx. Correct. A user types `chmod g=r file` (symbolic, `=` op) — parser adds `r` to group bits via `+`-style codepath but does NOT clear group `w`+`x`. The expected POSIX semantics is "set group to r only (clear w+x)". This is a soft semantic-correctness bug; impact is educational fidelity (user observes deviation from real shell behavior). Severity Medium because mutation operations are foundational to L2 (perms) challenge. **Phase 2.D ships T-MO-CHMOD-EQ-GAP gap-test** (R-21 Phase 1 lineage pattern) locking current deviant behavior as regression guard. Future R-LAB-06 closure cycle: implement POSIX `=` semantics in `applyChmodMode`, replace gap-test with T-MO-CHMOD-EQ01 asserting POSIX behavior, flip R-LAB-06 row to ✅ FIXED. **STATUS (Wave 2B commit `775525c`):** FIXED — `applyChmodMode` symbolic-mode branch now clears ALL bits in target triplets when `op === '='` BEFORE applying named bits (POSIX-correct clear-then-set ordering). Example: `g=r` on `-rwxrwxrwx` → `-rwxr--rwx` (group cleared to `r--`). Test transition: T-MO-CHMOD-EQ-GAP RENAMED to T-MO-CHMOD-EQ01 + assertion flipped from deviant `-rwxrwx---` to POSIX-correct `-rwxr-----`. T-MO-CHMOD-EQ02 (u=rw) + T-MO-CHMOD-EQ03 (a=r) added as companion regression guards (distinct scope/bits). **First gap-test → regression guard lifecycle transition** in the project's pattern catalog. |
| R-LAB-07 ✅ RESOLVED (Wave 3 regression-locked) | Medium | A04 Insecure Design | `evidence/log.ts` | **Ring buffer silent truncation**: `RingEvidenceLog` enforces `MAX_EVIDENCE_EVENTS = 200` via `slice(-MAX)`. When a user accumulates >200 events (long Curriculum session before opening CTF), earlier events fall off. The detector's `startedAtEventId` cursor can outlive its event: if `startedAtEventId = 50` was captured, then events 0-150 were emitted and the ring trimmed to events 51-150, the cursor is still 50 but no event with id 50 exists in the log. `filterLogSince(log, 50)` returns events with `id >= 50` — all of 51-150 are visible (correct behavior since they're all after the start gate). But contracts that require evidence from BEFORE the cursor (none today, but `hasBefore` semantic exists) would fail unexpectedly. | Current contracts don't exploit this, but the latent risk is real. Severity Medium because it's a correctness invariant that depends on contract authors avoiding cursor-relative pre-event references. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-RB01-05 regression tests (`src/lib/lab/evidence/__tests__/log.test.ts`). Current ring-buffer + cursor invariants locked: T-RB01 buffer wraps at MAX (200) discipline; T-RB02 `nextEventId()` returns lastId+1; T-RB03 append is immutable (defensive); T-RB04 documents cursor-orphan scenario (cursor predating window → `hasBefore` returns false); T-RB05 serialize/deserialize round-trip + malformed JSON defense. |
| R-LAB-08 | Medium | A04 Insecure Design | `engine.ts:tokenize`, `splitPipeline`, `stripQuotes` | **Shell-like parser correctness**: `tokenize` uses regex `/(?:[^\s"']+\|"[^"]*"\|'[^']*')+/g` — handles double-quote + single-quote string literals + bare tokens. Does NOT handle escape sequences (`\"`, `\'`, `\\`), backtick-substitution, `$()` substitution, glob `*`/`?`/`[]`, or `>` redirects (echo handler has its own ad-hoc redirect parsing). `splitPipeline` walks chars looking for `|` outside quotes — also no escape handling. Quote-state tracker uses single `quote` variable. | A user types `echo "hello | world"` → `tokenize` returns 1 token (correct because the `|` is inside `"`). A user types `echo 'hello \' world'` → tokenize regex `'[^']*'` matches `'hello \'` (terminator is the first single quote inside, not the escaped one). Result: token boundaries surprise the user. Severity Medium because educational fidelity. Real shells handle this; the simulator doesn't claim to be a real shell but the gap is undocumented. |
| R-LAB-09 ✅ RESOLVED (Wave 3 gap-locked) | Low | A04 Insecure Design | `commands/index.ts:registerAll` (module-load side effect) | **Module-load side effect**: `commands/index.ts` at module load (a) calls `registerAll([...5 handlers])` and (b) in non-production environments, dynamically imports `__verify__.ts` and invokes `verifyRegistry()` whose throws are caught by `.catch(err => { console.error(...); throw err })` — the `throw err` inside a `.catch` is **fire-and-forget** because it rejects the promise but isn't awaited at module scope. Net effect: verifier failures are visible only via `console.error`, not via test-runner failure. | Educational risk: a dev breaks the registry shape (e.g., changes `clear` sentinel `__CLEAR__` → `__CLR__`), `verifyRegistry` throws, the throw lands in unhandled rejection. Tests pass because the rejection is async + unawaited. Compounding: `commands/registry.ts:registerCommand` throws synchronously on duplicate registration — that surfaces correctly. The async verifier is the weak link. Severity Low because verifier is dev-only and only checks shape invariants. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-RV01-02 gap-tests (`src/lib/lab/__tests__/verifier-async.test.ts`). T-RV01-GAP locks duplicate-registration sync-throw chokepoint (does surface); T-RV02-GAP indirect coverage of the 5 expected handlers presence at module load (verifier-detected invariant proxy). Future await + propagate refactor would flip these to direct verifier-result assertions. |
| R-LAB-10 ✅ RESOLVED (Wave 3 gap-locked) | Low | A04 Insecure Design | `engine.ts:nextEvidenceEventId`, `syncEventIdCounter` | **Module-load counter state**: `nextEvidenceEventId` (engine.ts L28) starts at 0 per module load. `syncEventIdCounter(floor)` advances or resets-to-0 (test-only branch). Multiple test files importing engine.ts share this counter across tests unless each test calls `syncEventIdCounter(0)`. Existing `cross-context-bypass.test.ts` does this correctly per-test; future tests may forget. | Symptom: a test asserts event ids `[0, 1, 2]` in some scenario but sees `[7, 8, 9]` because a prior test left the counter at 7. Surfaces as fragile snapshot diffs or "id mismatch" assertion failures. Severity Low because deterministic isolation is achievable; just needs documentation + per-test reset. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-EV01-03 gap-tests (`src/lib/lab/__tests__/evidence-counter.test.ts`). T-EV01-GAP locks reset-hook contract; T-EV02-GAP locks cross-call persistence (the foot-gun); T-EV03 ratchet-monotonic regression guard. Future per-test-counter-instance refactor (dependency injection) flips these. Test-discipline doc: `beforeEach(() => syncEventIdCounter(0))` for any engine-touching test. |
| R-LAB-11 ✅ RESOLVED (Wave 2B) | Low | A04 Insecure Design | `engine.ts:cmdSubmit` | **`submit` command bypasses contract**: `cmdSubmit` (L1830-1842) checks `VALID_FLAGS.has(flag)` — if flag string matches, returns "FLAG ACCEPTED" banner. Does NOT emit a `flag_submitted` evidence primitive (this is what the panel-side `validateChallengeWithMode` adapter does separately for panel-driven submission). Branch: a user can type `submit FLAG{r3con_master_l1nux}` in the terminal directly (no panel) and see the success banner without ANY contract evidence. | The "ACCEPTED" banner here is purely visual feedback; the contract-driven reveal banner is separate (controlled by `runRevealCheck` → `detectRevealEvent`). But the inconsistency confuses educational intent: terminal-submit gives a green banner without solving, panel-submit (via adapter) requires evidence. Severity Low because (a) the visual is feedback only, no "level unlocked" state mutation, (b) it shares the same root cause as R-LAB-01 (flags in client bundle). **STATUS (Wave 2B commit `775525c`):** RESOLVED — terminal `submit` command no longer issues a green "FLAG ACCEPTED" banner regardless of flag validity. Returns an informational redirect (`[i] Bayrak gönderme paneli üzerinden değerlendirilir.`) routing users to the panel — the canonical evaluation path (`validateChallengeWithMode` emits `flag_submitted` evidence + drives reveal). The deceptive success path is closed. Surgical-scope rationale: `cmdSubmit` has no engine-state access (pure function); adding state-aware guards would require signature refactor at the call site. The simpler closure (remove deceptive banner) matches the audit's Severity Low rationale ("visual feedback only, no state mutation"). T-MO-SUBMIT01-03 (3 tests in `src/lib/lab/__tests__/engine-submit.test.ts`) verify: no "FLAG ACCEPTED" / "✓" in output (T-MO-SUBMIT01), message mentions panel (T-MO-SUBMIT02), no-args still shows usage hint (T-MO-SUBMIT03). R-LAB-01 root cause (flag strings in client bundle) remains accepted-by-policy per Phase 2.D Z.1 portfolio-demo context — this closure addresses the SECONDARY symptom only. |
| R-LAB-12 ✅ RESOLVED (Wave 3 gap-locked) | Low | A04 Insecure Design | `engine.ts` (L1100-1101, L1151) | **Non-determinism via `Date.now()`** at module load: `SESSION_SEED = Date.now() & 0xffff` and `SESSION_BOOT = Date.now()`. Used by some simulated commands (e.g., uptime/who) to fabricate plausible time-based output. Also `Date.now()` is called inline in event-emission paths (L168, L230, L413, L493) for `timestamp` field. | Test impact: tests that inspect command output for time-derived substrings need `vi.useFakeTimers()` for determinism. Event timestamps are technically non-deterministic across runs (won't affect equality checks on id/command/args but affects timestamp-comparison tests). Severity Low because no contract evaluates `timestamp`. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-ND01-02 gap-tests (`src/lib/lab/__tests__/non-determinism.test.ts`). T-ND01-GAP locks output-structure-deterministic-given-counter-reset contract; T-ND02-GAP locks that non-time-aware commands (pwd/ls/cd) do NOT echo raw Date.now() values (limits determinism blast radius). Test-discipline guidance: `vi.useFakeTimers()` for time-aware command surface tests. |
| R-LAB-13 ✅ RESOLVED (Wave 3 gap-locked) | Low | A04 Insecure Design | `scenarios/merge.ts:mergeScenarioWithBaseFs` | **Merge semantics**: recursive merge where scenario child overrides base child (or base if no override). `if (baseFs.type === 'file' \|\| scenarioFs.type === 'file') return cloneNode(scenarioFs)` — type-conflict resolution rule: any non-dir on either side, scenario wins as-is. The cloned scenarioFs may be a file that "shadows" a directory tree in base. | Educational risk: a scenario author defines `/usr/local/bin` as a file (typo); merge replaces base's `/usr/local/bin` directory tree with the file. Silent. No validation catches this. The merged ROOT is computed at module load (filesystem.ts L29-32); a bad scenario JSON corrupts ROOT for ALL scenarios. Severity Low because scenarios are hardcoded JSON (authors control), but the lack of validation is a latent footgun. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-SM-MERGE01-03 gap-tests (`src/lib/lab/scenarios/__tests__/merge.test.ts`). T-SM-MERGE01-GAP locks silent shadow behavior (scenario file replaces base dir tree); T-SM-MERGE02 locks happy-path merge of non-conflicting additions; T-SM-MERGE03 locks scenario-file-over-base-file precedence. Future validation refactor (throw on type conflict) flips T-SM-MERGE01-GAP. |
| R-LAB-14 ✅ RESOLVED (Wave 3 regression-locked) | Low | A04 Insecure Design | `evidence/normalize.ts:normalizeArgs` | **Short-flag expansion**: `if (/^-[a-zA-Z]{2,}$/.test(arg) && !arg.startsWith('--'))` expands `-la` → `['-l', '-a']`. Heuristic: anything matching `-AAA` where each char is alphabetic. Edge: `-rf` (rm recursive force) expands to `['-r', '-f']`. But `-9` (kill signal style) doesn't match the regex (digit), so it stays as `-9`. Subtle: `-Pn` (nmap-style) expands to `['-P', '-n']` which is semantically wrong for nmap (where `-Pn` is one flag meaning "no ping"). | Evidence matchers comparing args with `subset_unordered` mode will count `-P` and `-n` separately — a contract requiring `-Pn` literal would never match. Today's contracts.ts doesn't depend on this, but it's a foot-gun for future contract authors. Severity Low. **STATUS (Wave 3 commit `<COMMIT_HASH_TBD>`):** RESOLVED via T-NA01-04 regression tests (`src/lib/lab/evidence/__tests__/normalize.test.ts`). Heuristic intentional + locked: T-NA01 cluster expansion `-la`; T-NA02 long-flag `--long-flag` preserved; T-NA03 single-letter `-l` preserved (regex requires {2,}); T-NA04 digit-containing `-9` preserved (regex requires letters). Future contract-author guidance: -Pn-style flags require explicit subset-ordered mode or pre-expansion in contract definition. |
| R-LAB-15 ✅ DOC-ONLY closure (Wave 1) | Informational | A04 Insecure Design | `validation/contract.ts:filterLogSince`, `evidence/log.ts:RingEvidenceLog` | **Sentinel cursor semantics**: `sinceEventId === -1` (legacy migration completion sentinel) and `sinceEventId === +Infinity` (level-not-started sentinel) are both handled, but their domain is "magic numbers". Documentation lives in comments; no type-level enforcement. A type alias `type EventCursor = number \| 'legacy-completed' \| 'not-started'` would surface the magic-number trap to readers. | Pure refactor-readiness concern. No exploit. Informational severity. **STATUS (Wave 1 housekeeping commit `7032a17`):** DOC-ONLY closure — type alias proposal noted for future Lab Engine refactor cycle. No source-code change this cycle (Wave 1 audit-doc-only scope). Future closure: introduce `EventCursor` type alias in `validation/types.ts` + flip filterLogSince signature to accept `EventCursor`; replace magic-number literals at call sites with sentinel-named constants. |

**Summary by severity (Phase 2.D + Wave 1 + Wave 2B + Wave 3 updates marked):** High = 2 (R-LAB-02 ✅ CLOSED Phase 2.D, R-LAB-03 ✅ CLOSED Phase 2.D); Medium = 6 (R-LAB-01 *adjusted* accepted-by-policy, R-LAB-04 ✅ CLOSED Phase 2.D, **R-LAB-05 ✅ RESOLVED Wave 3** via T-MS gap-tests, **R-LAB-06 ✅ FIXED Wave 2B** via POSIX `=` + T-MO-CHMOD-EQ01/02/03, **R-LAB-07 ✅ RESOLVED Wave 3** via T-RB regression, R-LAB-08 untouched); Low = 6 (**R-LAB-09 ✅ RESOLVED Wave 3** via T-RV gap, **R-LAB-10 ✅ RESOLVED Wave 3** via T-EV gap, **R-LAB-11 ✅ RESOLVED Wave 2B** via cmdSubmit redirect + T-MO-SUBMIT, **R-LAB-12 ✅ RESOLVED Wave 3** via T-ND gap, **R-LAB-13 ✅ RESOLVED Wave 3** via T-SM-MERGE gap, **R-LAB-14 ✅ RESOLVED Wave 3** via T-NA regression); Informational = 1 (**R-LAB-15 ✅ DOC-ONLY closure Wave 1**). Total = 15. **R-LAB-RESOLVED count: 13 of 15 (87%); only R-LAB-01 accepted-by-policy + R-LAB-08 shell parser pending (Wave 5).**

**No Critical entries.** Lab Engine is a pure-logic client-side educational simulation; the threat model is correctness + integrity of the educational experience, not classic auth/data-confidentiality risk. Phase 1's Critical R-03 + R-20 had no analog in this surface.

---

## 3. Existing Test Coverage

Two test files in `src/lib/lab/__tests__/`. Test counts inside each file:

| File | Tests | Coverage |
|---|---|---|
| `cross-context-bypass.test.ts` | 3 | **T-CCB01** (no-fire before startedAt), **T-CCB02** (fire after startedAt), **T-CCB03** (legacy `-1` sentinel suppresses re-fire). Targets `detectRevealEvent` (`reveal/detector.ts`) + `runCommand` (`engine.ts`) end-to-end for Level 1's contract. |
| `ctf-regression.test.ts` | 6 | **T-CTFR01..T-CTFR06** — happy-path solutions for L1-L6. Asserts `validateContract` returns no blocking missing/forbidden/temporal-failures (ignoring `flag_submitted` which the reveal-banner substitutes for) AND `__reveal__` event was emitted. End-to-end through `runCommand` + `validateContract` + `runRevealCheck`. |

**Test ID renaming convention (Phase 2 lineage):** existing tests have no T-XX labels in source — only describe-block titles. Phase 2.D should formalize T-CCB01..T-CCB03 + T-CTFR01..T-CTFR06 in `it()` titles for traceability with this audit (Phase 1 lineage pattern from R-21 T-S09/T-S13).

**Total Lab Engine test count pre-Phase-2.D:** 9.

**Risk coverage observation (pre-Phase-2.D):** existing tests cover R-LAB-02 partial (happy-path detector + 2 negative branches; full 5-axis matrix not exercised) and R-LAB-03 happy-path (6 levels × 1 canonical solution each; no negative temporal-clause cases). All other R-LAB-XX risks have **zero direct coverage**.

### Phase 2.D test expansion (this audit's surgical recommendation, IMPLEMENTED)

Phase 2.D commit `cf89d96` ships 3 new test files implementing the Top-3 surgical scope from Section 5:

| File | Test count | Coverage target | Maps to |
|---|---|---|---|
| `validation-contract.test.ts` | 25 | `validateContract` 4-clause matrix + 6-contract shape + sinceEventId scoping (incl. -1 / +Infinity / undefined / 0 / N) | T-VC01..T-VC25 → R-LAB-03 (High) |
| `reveal-detector.test.ts` | 20 | `detectRevealEvent` 5-axis branch matrix (alreadyRevealed × startedAtEventId variants × forbidden × temporal × blockingMissing) + happy-path RevealEvent shape | T-RD01..T-RD20 → R-LAB-02 (High) |
| `mutation-operations.test.ts` | 31 | 6 ops × happy-path × protected-prefix denial × chmod parser (numeric + symbolic) + `=` operator gap-test | T-MO01..T-MO30 + T-MO-CHMOD-EQ-GAP → R-LAB-04 + R-LAB-06 (Medium) |

**Total Lab Engine test count post-Phase-2.D:** 9 (existing) + 76 (new) = **85**.

R-LAB risk coverage state post-Phase-2.D:
- R-LAB-02 (High): test-coverage gap CLOSED via T-RD01..T-RD20 (20 tests across 5-axis matrix)
- R-LAB-03 (High): test-coverage gap CLOSED via T-VC01..T-VC25 (negative temporal cases + scoping cursor + shape verification)
- R-LAB-04 (Medium): test-coverage gap CLOSED via T-MO01-30 protected-prefix denial × 6 ops
- R-LAB-06 (Medium): gap-test (T-MO-CHMOD-EQ-GAP) ships; underlying POSIX deviation NOT fixed (regression guard locks current behavior; future closure cycle implements POSIX `=`)
- R-LAB-01, R-LAB-05, R-LAB-07..R-LAB-15: untouched (intentional surgical scope — Phase 2.D does NOT chase all 15 risks; only Top-3 high-leverage modules per Section 5 ranking)

---

## 4. Test Gaps + Priority Ranking

Ranking criteria (per mega-prompt SECTION 1):
1. Risk severity (R-LAB-XX rating)
2. User-facing impact (touched by command line OR by panel)
3. Test ROI (surface size, invariant density, scaffolding complexity)

Candidate modules sorted by overall priority:

| Rank | Module | LOC | Test ROI | Highest R-LAB | Notes |
|---|---|---|---|---|---|
| **1** | `validation/contract.ts` + `validation/contracts.ts` | 90 + 299 | **HIGH** | R-LAB-03 (High) | Pure functions, no I/O, no DOM. `validateContract` has 4 clause types × 6 contracts = test combinatorial sweet spot. Existing CTF regression uses these but only happy-path. Negative temporal scenarios + forbidden-primitive scenarios + scoping-cursor edge cases are all dense in invariants. **Low scaffolding cost**. |
| **2** | `reveal/detector.ts` + `engine.ts:runRevealCheck` | 75 + ~70 (in engine) | **HIGH** | R-LAB-02 (High) | 5-axis branch matrix (alreadyRevealed × startedAtEventId variants × sufficientMet × forbidden × temporalFailures). Existing test covers 3 of these crossings. Negative-permutation tests would harden L2 closure significantly. `runRevealCheck` itself is harder (file-local in engine.ts) — Phase 2.D could test it through `runCommand` end-to-end like ctf-regression does. **Medium scaffolding cost** (some harness reuse from existing tests). |
| **3** | `mutation/operations.ts` | 212 | **HIGH** | R-LAB-04 (Medium) | Pure functions, deterministic. 6 op handlers × protected-prefix paths × happy-path + each error mode = 30+ test cases yields ~95% line coverage. `applyChmodMode` numeric+symbolic parser is its own sub-surface (~15-20 test cases). **Low scaffolding cost** (no engine wiring needed — `applyMutation(state, op)` is the public entry). |
| 4 | `evidence/match.ts` | 227 | **HIGH** | R-LAB-08 (Medium) implicit | `matchPrimitive` switch + 12 per-primitive matchers + `argsMatchWithPathArgs` 3-mode dispatch. Lots of invariants. **Low scaffolding cost** but **wide surface** — could swallow 60+ tests for full coverage. Surgical risk. |
| 5 | `engine.ts:tokenize/splitPipeline` | ~40 (in engine) | **MEDIUM** | R-LAB-08 (Medium) | File-local helpers; would need to export-for-test or test via `runCommand`. Pipeline semantics + quote edge cases. |
| 6 | `evidence/normalize.ts` | 78 | **MEDIUM** | R-LAB-14 (Low) | `normalizePath`, `pathMatches`, `pathArgMatches`, `normalizeArgs` — all pure. Short-flag expansion edge cases dense. |
| 7 | `validation/adapter.ts:validateChallengeWithMode` | 52 | **MEDIUM** | R-LAB-03 (High) indirect | 3-mode dispatcher. Small surface, narrow tests possible. |
| 8 | `mutation/state.ts` | 55 | **MEDIUM** | R-LAB-05 (Medium) | Singleton lifecycle. `createMutableFs` / `initMutableFs` / `resetMutableFs` semantics. Deep-clone invariants. |
| 9 | `scenarios/merge.ts` | 42 | **MEDIUM** | R-LAB-13 (Low) | Small surface, recursive merge. Type-conflict resolution edge cases. |
| 10 | `evidence/log.ts:RingEvidenceLog` | 70 | **LOW** | R-LAB-07 (Medium) | Ring buffer semantics + serialize/deserialize. Smallish but ring-truncation edge cases matter for R-LAB-07. |
| 11 | `validation/humanize.ts` | 41 | **LOW** | none | 13 cases × 1 assertion each. Trivial but low-impact. |
| 12 | `validation/hint.ts` | 22 | **LOW** | none | `conditionMatches` — 3 logical operators. Smallest meaningful test surface. |
| 13 | `reveal/banner.ts` | 43 | **LOW** | none | ASCII rendering. Snapshot-test territory. Aesthetic. |
| 14 | `scenarios/loader.ts` | 39 | **LOW** | none | Dynamic-import dispatcher. Would need `vi.mock('@/content/scenarios/*.json')`. Higher scaffolding cost. |
| 15 | `manpages/index.ts` | 699 | **LOW** | none | 50+ pages, mostly content. Test boilerplate-heavy with low invariant density. |

---

## 5. Phase 2.D Scope Recommendation — Top 2-3 Surgical Targets

Per operator constraint (surgical, no full sweep), recommendation locks the top three from Section 4 by combining R-LAB severity, ROI, and low scaffolding cost:

### Recommended Phase 2.D scope: **3 modules, ~50-65 new tests, +50-65 to baseline 239 → ~290-305**

#### Target #1 — `validation/contract.ts` + `validation/contracts.ts` (R-LAB-03 High)

**Why first:** highest-severity logic gap, pure functions, no scaffolding. Negative temporal-clause and forbidden-primitive cases close the gap between happy-path CTF regression and full contract correctness.

**Test invariants to lock (illustrative — Phase 2.D refines):**
- `validateContract` returns `passed: true` when all clauses pass (already partial via T-CTFR01..T-CTFR06)
- `validateContract` flags `missing` correctly when one required primitive absent
- `validateContract` flags `forbidden` correctly when forbidden primitive present
- `requiresBeforeReading` temporal clause: flag submitted before required `file_read` → reported in `temporalFailures` (no current test)
- `sinceEventId` cursor scopes the log correctly (filterLogSince invariants)
- `sinceEventId === -1` sentinel returns empty-log behavior
- `sinceEventId === +Infinity` returns empty-log behavior
- `sufficient` group OR-of-AND semantics (≥1 group passes → sufficientMet)
- Empty contract (no required, no sufficient, no forbidden) → passes trivially
- All 6 challenge contracts (L1-L6) parse + have non-empty `expectedFlag` + `levelTitle`

**Expected test count:** 15-25.

#### Target #2 — `reveal/detector.ts` (R-LAB-02 High)

**Why second:** five-axis branch matrix; existing test covers 3 crossings of ~24 possible. Filling the matrix locks reveal-banner correctness against the most user-visible failure modes (early reveal / silent no-reveal / cross-context bleed).

**Test invariants to lock:**
- `alreadyRevealed.has(level)` → return null (dedup)
- `startedAtEventId === -1` → return null (legacy sentinel)
- `startedAtEventId === undefined` → no scoping (legacy callers)
- `startedAtEventId === +Infinity` → no event satisfies → contract fails
- Contract `forbidden` non-empty → return null
- Contract `temporalFailures` non-empty → return null
- `blockingMissing` (non-`flag_submitted` missing) non-empty → return null
- `sufficientMet === false` → return null (no canonical path walked)
- Happy: all passes → return `RevealEvent` with correct `level`, `flag`, `levelTitle`, `nextLevelTitle`

**Expected test count:** 15-20.

#### Target #3 — `mutation/operations.ts` (R-LAB-04 Medium + R-LAB-06 Medium)

**Why third:** highest LOC × ROI in the mutation surface. `applyChmodMode` parser is independently complex. Locks L2 (perms) challenge mechanic against future refactor.

**Test invariants to lock:**
- 6 ops × happy path: touch creates file, mkdir creates dir, rm removes file, rm -r removes dir, mv relocates, chmod modifies perms, write replaces content, write append concatenates
- Each op × protected-prefix denial (`/etc`, `/usr`, `/var`, `/proc`, `/sys`, `/root`, `/boot` × each op = denial)
- `applyChmodMode` numeric: `755`, `0755`, `644` (each maps correctly to triplet)
- `applyChmodMode` symbolic: `+x`, `u+x`, `g-w`, `a=r`, `o+rx` (each maps correctly)
- `applyChmodMode` `=` operator semantic note (R-LAB-06): currently behaves as `+` for the named bits, may surface as documented gap-test (rather than fix) — agent flags for mentor decision
- Type-conflict denial: mkdir on existing file → fail; rm on non-empty dir without `-r` → fail
- `splitParent` edge cases: root path, single-segment, empty

**Expected test count:** 25-30.

### Why not Target #4 (`evidence/match.ts`)?

R-LAB-08 surface is broad (227 LOC, 12 matchers, 3-mode dispatcher). Full coverage = 60+ tests, blowing the surgical budget. **Recommendation:** defer to a later Phase 2 cycle if time permits; OR test selected matchers indirectly through Target #1's contract evaluator (`validateContract` calls `log.has(primitive)` which calls `matchPrimitive`, so contract tests exercise matchers transitively).

### Why not target the orchestrator (`engine.ts`)?

Engine is 2556 LOC of which ~80% is per-command implementations (cmdLs, cmdGrep, cmdNmap...) — testing each is high boilerplate, low invariant density per test (each command has ~3-5 testable behaviors). The 20% of engine that IS high-leverage (runRevealCheck, pipeline runner, tokenize/splitPipeline) is reachable via Target #2 (through runCommand end-to-end). **Phase 2.D explicitly does NOT target per-command engine.ts coverage** — that's a multi-phase-D effort if ever undertaken.

### Phase 2.D commit cross-reference

**Phase 2.D commit `cf89d96` implements this surgical scope.** Three new test files landed:
- `src/lib/lab/__tests__/validation-contract.test.ts` — T-VC01..T-VC25 (25 tests)
- `src/lib/lab/__tests__/reveal-detector.test.ts` — T-RD01..T-RD20 (20 tests)
- `src/lib/lab/__tests__/mutation-operations.test.ts` — T-MO01..T-MO30 + T-MO-CHMOD-EQ-GAP (31 tests)

Test ID prefixes per Z.5 lock: T-VC / T-RD / T-MO. Each `it(...)` title begins with the T-XX ID for audit traceability. Total baseline shift: 239 → 315 (+76 net).

Phase 2.B + 2.C explicitly SKIPPED per Section 6 + 7 assessment (skip rationale documented in Phase 2.D commit message).

---

## 6. Phase 2.B Infrastructure Needs

**Assessment: minimal-to-none.**

The Lab Engine is pure TypeScript logic with zero browser APIs, zero network calls, zero filesystem touches (the "filesystem" is an in-memory tree), and zero external services. The existing vitest config (`environment: 'node'`, `include: ['src/**/*.test.ts']`) is sufficient.

**What Phase 2.B MIGHT need:**

| Possible | Required for surgical Phase 2.D? |
|---|---|
| New `__tests__/` subdirectory under each module (e.g., `validation/__tests__/`) | No — colocated `*.test.ts` under each module dir is fine (Phase 1 convention). Or co-locate as `lab/__tests__/<module>.test.ts` continuing existing pattern. |
| Shared test harness for mutation-state setup | Optional — `createMutableFs(ROOT)` is already a one-liner per test |
| Shared test harness for evidence-log setup | Optional — `new RingEvidenceLog()` is already a one-liner |
| Fixture JSONs (scenario test scaffolds) | No — existing scenario JSONs `_base` + `01..06` are sufficient |
| MSW handlers | No — Lab Engine makes no HTTP calls |

**Recommendation:** **skip Phase 2.B entirely.** Phase 2.D can write tests directly. If a test-time helper emerges as duplicated, extract it then.

**Mentor decision needed:** confirm skip, OR ship a minimal Phase 2.B with shared test-harness helpers (e.g., `createTestHarness(level)` mirroring the existing `cross-context-bypass.test.ts` createHarness)?

---

## 7. Phase 2.C Mock/Handler Requirements

**Assessment: minimal-to-none.**

Lab Engine internal dependency graph (engine.ts imports):
- `./filesystem` (pure) — no mock needed
- `./commands` (registry + handlers, all pure) — no mock needed
- `./evidence` (pure types + matchers + RingEvidenceLog class) — no mock needed
- `./mutation` (pure operations + state singleton) — no mock needed; tests use `createMutableFs` directly
- `./manpages` (static content) — no mock needed
- `./reveal` (pure detector + banner) — no mock needed
- `./validation/contracts` (static challenge contracts) — no mock needed
- `./types` (TypeScript types) — no mock needed
- `@/content/scenarios/*.json` (static JSON) — no mock needed unless Phase 2.D targets `scenarios/loader.ts` (deferred per Section 4 rank #14)

**Recommendation:** **skip Phase 2.C entirely.** Lab Engine is fully self-contained pure logic with no external dependencies that warrant mocking.

**Mentor decision needed:** confirm skip, OR pre-write `vi.mock('@/lib/lab/<module>')` boilerplates in Phase 2.C for Phase 2.D consumption (would mirror Phase 1.C MSW prep pattern, but lower value here since Lab Engine has no module boundary that needs cross-cutting mock)?

---

## 8. Cross-References

### A-13 explicit re-mapping (state-gathering decision)

A-13 (`docs/audit/phase-1-a-pending-amendments.md` L92-95) — "R-05 TOCTOU lacks direct concurrent-execution test" — has Action text: *"Add explicit concurrent-execution test to soc-store-adapter.test.ts (Phase 1.D.9 already complete) or create dedicated race-condition test in **Phase 2 storage suite**. Test would use Promise.all on two register calls with same email."*

**Phase 2.A re-map:** the phrase "Phase 2 storage suite" is a Phase 1.D author's framing that conflates Phase 2 (Lab Engine per CLAUDE.md) with a hypothetical "storage suite" (not in CLAUDE.md phase map). Storage adapter (`soc-store-adapter.ts`) is structurally **Phase 3** territory (API & Contracts → CRUD routes → adapter routing). Lab Engine surface does NOT include `soc-store-adapter.ts`.

**Resolution:** A-13 does **not** close during Phase 2. It maps to Phase 3 cycle (when API & Contracts test surface is built out). Phase 2.D scope (Section 5 above) explicitly excludes any storage-adapter touch.

### Phase 1 audit doc references to Lab Engine

`grep "lab\|Lab Engine" docs/audit/phase-1-a-final.md docs/audit/phase-1-a-pending-amendments.md` returns zero direct Lab Engine references. Phase 1 audit had explicit scoping notes (e.g., `phase-1-a-final.md:13` — *"`auth-client.ts` is Phase 4 territory"*) — Lab Engine was simply out-of-scope without explicit deferral. Phase 2.A is the first formal Lab Engine audit treatment.

### OPEN amendments touching Lab Engine

`grep "lab\|Lab Engine" docs/audit/phase-1-a-pending-amendments.md` matches only narrative text (`siberlab` brand, lowercase "lab" in non-Lab-Engine contexts). Zero OPEN amendments directly touch Lab Engine surface.

### Risk register namespace

Phase 1 risks: R-01 through R-22 + Critical R-03/R-20.
Phase 2 risks: R-LAB-01 through R-LAB-15 (this audit).
**No collision.** Future Phase 3/4/5 should adopt their own namespaces (R-API-XX, R-UI-XX, R-E2E-XX) for the same hygiene.

### Test ID namespace

Existing tests: 3 cross-context-bypass + 6 ctf-regression = 9 (untitled in source; this audit assigns T-CCB01..T-CCB03 + T-CTFR01..T-CTFR06 for traceability).
Phase 2.D additions per Section 5: ~50-65 (T-VC01..T-VC25 for `validateContract`, T-RD01..T-RD20 for reveal-detector, T-MO01..T-MO30 for mutation/operations — Phase 2.D refines).

### Coverage threshold (`phase-1-a-final.md:58`)

Phase 1 audit set the graduated coverage threshold:
- Phase 1 end → 50%
- Phase 3 end → 70%
- Phase 5 end → 80%

Phase 2 end is **not in the threshold ladder** — Phase 1 author treated Phase 2 as Lab Engine surface that doesn't move the headline coverage number significantly. Phase 2.A confirms: at ~5500 Lab Engine LOC out of total `src/` LOC (~50k+ estimated), surgical Phase 2.D (50-65 tests, ~3 modules) will not significantly shift the overall coverage gauge but WILL close concrete R-LAB-XX risks.

---

## 9. Mentor Decision Points

### Z.1 — R-LAB-01 severity confirmation

CTF flag exposure (Section 2) is rated **High** based on the educational-integrity threat model. Mentor may downgrade to **Medium** or **Informational** if the operator's framing is "the lab is a portfolio demo, not a graded competition; flags being viewable is acceptable". Decision affects whether a future hardening cycle (server-side flag validation) is justified.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — R-LAB-01 downgraded from High to Medium. Portfolio-demo context downgrades the educational-integrity threat; flag-viewable status is acceptable for a personal portfolio. Section 2 row updated to reflect new severity + Phase 2.D adjustment note. Future hardening cycle (server-side validation) NOT triggered.

### Z.2 — Phase 2.B + Phase 2.C skip confirmation

Sections 6 + 7 recommend skipping infra + mocks. CLAUDE.md L175 says *"Each phase is split into sub-stages: A (audit) → B (infrastructure) → C (mocks/handlers) → D (test cases)"* — strict sequential interpretation would still run B + C as audit deliverables (e.g., "Phase 2.B confirmed minimal"). Loose interpretation: skip directly from 2.A to 2.D since 2.B + 2.C have no deliverable.

**Agent recommendation:** loose — go 2.A → 2.D, skipping 2.B + 2.C. Adds one cycle-skip note in the Phase 2.D mega-prompt as documentation.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — Phase 2.B + 2.C SKIPPED. Lab Engine has zero external dependencies warranting infra/mock cycles (per Sections 6 + 7 assessment). Phase 2.D mega-prompt documented the skip explicitly. Phase 2 effective cycle chain: A (audit) → D (tests). Phase 2 CLOSED after this commit + cleanup.

### Z.3 — Phase 2.D scope (Section 5 ranking)

Section 5 recommends 3 targets: validation/contract + validation/contracts (Target #1), reveal/detector (Target #2), mutation/operations (Target #3). Estimated 50-65 tests. Mentor may:
- (a) Accept all three.
- (b) Tighten to top 2 (Target #1 + Target #2 — closes R-LAB-02 + R-LAB-03 High; defers R-LAB-04..06 mutation).
- (c) Loosen to top 4 (add evidence/match → R-LAB-08 closure).
- (d) Reorder or substitute.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — option (a) accepted. All three targets shipped. Actual test counts: T-VC = 25, T-RD = 20, T-MO = 30 + T-MO-CHMOD-EQ-GAP = 1 gap-test → total 76 new tests (slightly above the 50-65 estimate, within tolerance). Baseline 239 → 315.

### Z.4 — `applyChmodMode` `=` operator behavior (R-LAB-06)

The current implementation of `applyChmodMode` treats `=` operator like `+` for the named bits — does NOT clear unmentioned bits. POSIX semantics is "set scope to exactly these bits, clear others". Phase 2.D could:
- (a) **Document the deviation** with a gap-test (Phase 1 R-21 pattern — test asserts current behavior + comment explains future hardening path).
- (b) **Flag for a fix cycle** (separate from Phase 2.D, R-LAB-06 closure cycle).
- (c) **Treat as not-a-bug** (educational sim doesn't claim POSIX fidelity).

Mentor decision required.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — option (a) selected. T-MO-CHMOD-EQ-GAP ships as regression guard locking current deviant behavior (R-21 Phase 1 lineage). R-LAB-06 stays OPEN in audit register with documented future-closure path. No fix to `applyChmodMode` in this cycle. Section 2 R-LAB-06 row updated with gap-test reference.

### Z.5 — Test ID naming convention

Existing tests are untitled in source. Phase 2.D should assign:
- T-CCB01..T-CCB03 (existing cross-context-bypass)
- T-CTFR01..T-CTFR06 (existing ctf-regression)
- T-VC01..T-VCNN (new validation/contract tests)
- T-RD01..T-RDNN (new reveal/detector tests)
- T-MO01..T-MONN (new mutation/operations tests)

Or alternative consistent scheme. Mentor lock the prefix style before Phase 2.D writes assertions.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — proposed prefixes (T-CCB / T-CTFR / T-VC / T-RD / T-MO) accepted and applied. Each new test's `it(...)` title begins with `T-XX —` prefix (em-dash separator). Existing test files NOT renamed this cycle (mentor decision: pure-cosmetic rename inflates diff; deferred to a future housekeeping cycle). Phase 2.A audit doc cross-references existing tests by their assigned T-CCB / T-CTFR IDs already.

### Z.6 — Lab Engine "no new product" constraint mapping

Phase 2.D writes NEW test files but touches NO product code in `src/lib/lab/*.ts`. Mapping to operator constraint:
- Test file creation under `src/lib/lab/__tests__/` or `src/lib/lab/<module>/__tests__/` = NOT new product surface (testing existing surface).
- No new modules, no new commands, no new contracts, no new scenarios — all confirmed.

Agent reads constraint as satisfied. Mentor confirms.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — constraint satisfied. Phase 2.D verification step `git diff src/lib/lab/ -- ':!src/lib/lab/__tests__/'` returns empty diff (zero changes to product code). New test files added under existing `src/lib/lab/__tests__/` (flat structure preserved). No new src/lib/lab/ modules, no new commands, no new contracts, no new scenarios.

### Z.7 — Off-by-one count drift in prior commit messages

Phase 1.5.12 + Phase 1.5.15 commit messages stated "11 OPEN amendments". Actual is **12 OPEN** (A-01, A-05, A-06, A-07, A-08, A-09, A-11, A-12, A-13, A-14, A-15, A-18). Phase 2.A surfaces but does NOT correct (per mega-prompt SECTION 1). Mentor decides whether a paired Phase 2.A.1 housekeeping commit corrects the drift in the audit doc + a future commit message.

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — absorbed into Phase 2.D commit message. Phase 2.A doc Section 0 already states the corrected 12-OPEN count. No separate housekeeping commit. Future commit messages reference 12 OPEN.

### Z.8 — R-LAB-11 `submit` cmd visual-bypass severity

`cmdSubmit` validates flag string against `VALID_FLAGS` (R-LAB-01 surface) and returns a "FLAG ACCEPTED" banner without emitting `flag_submitted` evidence (the panel-side path emits this separately). Severity Low because (a) no state mutation, (b) doesn't fire the contract-driven reveal banner, (c) shares root cause with R-LAB-01 (flags client-side). Mentor may upgrade if the visual confirmation is considered misleading enough; or downgrade if it's a feature (user knows they "got" the right flag string).

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — Low confirmed. No severity change. R-LAB-11 stays in audit register at current Low rating.

### Z.9 — Where this audit doc commit fits in Phase 2 commit chain

Phase 2.A produces this audit doc. Subsequent cycles (per CLAUDE.md sub-stage discipline):
- Phase 2.B — likely skipped per Z.2
- Phase 2.C — likely skipped per Z.2
- Phase 2.D — writes ~50-65 tests across 3 target modules per Section 5

Mentor confirms Phase 2 cadence: do 2.A.1 housekeeping (Z.7) first, or proceed direct to Phase 2.D after this audit lands?

**Resolution (Phase 2.D commit `cf89d96`):** RESOLVED — proceed direct to Phase 2.D. No intermediate housekeeping cycle. A-07, A-09, A-18 amendment housekeeping deferred to a later cycle. Phase 2 cycle chain after this commit pair (2.D fix + 2.D.1 cleanup): Phase 2 CLOSED. Next: Phase 3.A audit (API & Contracts) per mentor direction.

---

**End of Phase 2.A audit. All Z.1-Z.9 RESOLVED in Phase 2.D commit `cf89d96`.**
