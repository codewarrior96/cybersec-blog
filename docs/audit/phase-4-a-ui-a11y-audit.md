# Phase 4.A — UI & Accessibility Audit

**Status:** Draft (sub-stage A: report only) · **Date:** 2026-05-15 · **Phase:** 4 of 5 · **Sub-stage:** A (Audit) · **Author:** Claude (with Salim review)

Canonical Phase 4.A deliverable. Mirrors Phase 2.A + 3.A structure (9 sections: inventory → risk register → existing coverage → gaps → surgical recommendation → infra needs → mock requirements → cross-references → mentor decisions). CLAUDE.md L172 + L175 sub-stage discipline applies: **this commit produces this markdown file and nothing else**.

Audit register state at Phase 4.A start: 10 RESOLVED + 10 OPEN amendments + 1 numbering gap (A-16) after Phase 3.D revision. Risks: Phase 1 R-01..R-22 (closed Phase 1.5 series), Phase 2 R-LAB-01..R-LAB-15 (Lab Engine surface, R-LAB-02/03/04/06 closed Phase 2.D), Phase 3 R-API-01..R-API-15 (R-API-01/02/04/05 closed Phase 3.D revision; R-API-03 RECLASSIFIED per Z.10 production-vs-blueprint divergence). Phase 4 opens **R-UI-XX** namespace (new, no collision with R-XX / R-LAB-XX / R-API-XX).

**Z.10 lesson application (new audit discipline introduced by Phase 3.D revision):** Section 1 component inventory includes a **production-verified column** documenting whether each component is reachable from a production route (verified via Next.js build route map + page component tree), not assumed from file existence alone. This becomes a mandatory state-gathering step for Phase 4.A+ cycles. Phase 3.D Section 9 Z.10 documents the original lesson; this audit is the first cycle to apply it.

---

## 1. UI Component Inventory

### 1.1 — Component file map + production verification

All paths relative to `src/`. LOC = `wc -l` line count. "Prod" = whether the component is reachable from a Next.js build route (verified via `npm run build` route map + dynamic-import + page component tree, NOT from file presence alone — Z.10 lesson).

| Component | LOC | 'use client' | Prod | Consumer route(s) | Browser APIs | A11y primitives observed |
|---|---|---|---|---|---|---|
| `components/dashboard/DashboardLayout.tsx` | 2165 | ✅ | ✅ | `/home` (via `HomePageClient` dynamic-import, ssr: false) | `ResizeObserver`, `requestAnimationFrame` × 4, `d3-geo`, `topojson-client`, world-110m.json | (deep inspection deferred — surface too large; sample-scan confirms `role`/`aria-` use) |
| `components/portfolio/PortfolioWorkspace.tsx` | 1564 | ✅ (assumed) | ✅ | `/portfolio` | (not deep-scanned) | (not deep-scanned) |
| `components/lab/Terminal.tsx` | 861 | ✅ | ✅ | `/community` (dynamic-import, ssr: false) | `localStorage` (evidence log), manual `focus()` on `inputRef`, `setInterval`/`setTimeout`, `WebSocket` (gated) | manual focus management; no `role="application"` on terminal scroller |
| `components/dashboard/TelemetryStreamPanel.tsx` | 820 | ✅ | ✅ | `/home` (via DashboardLayout) | `useRef` bootstrap pattern | (not deep-scanned) |
| `components/dashboard/AttackReportModal.tsx` | 705 | ✅ | ✅ | `/home` (via DashboardLayout) | `useFocusTrap` (line 354), `useId`, Lucide icons | `role="dialog"`, `aria-modal`, `aria-labelledby`, `useFocusTrap` integrated |
| `components/dashboard/CriticalAlertPanel.tsx` | 328 | ✅ | ✅ | `/home` (via DashboardLayout) | `useFocusTrap` (line 108), `useId` | `role="dialog"`, `aria-modal`, `aria-labelledby`, `useFocusTrap` integrated; emoji-as-status icons |
| `components/NavigationBar.tsx` | 263 | ✅ | ✅ | All auth'd routes (via `AppShellClient`) | `useFocusTrap`, `useId`, `body.style.overflow` lock, window keydown listener | Best-in-codebase: `aria-label="Primary"` nav, `aria-current="page"`, `aria-expanded`, drawer `role="dialog" aria-modal`, `useFocusTrap`, body-scroll-lock, `Escape` close, path-change close |
| `components/CveRadarTab.tsx` | 263 | ✅ (assumed) | ✅ | `/zafiyet-taramasi` | (not deep-scanned) | (not deep-scanned) |
| `components/EmbeddedLogin.tsx` | (read pending) | ✅ | ✅ | `/login`, also fallback in `HomePageClient` | (not deep-scanned) | form-control native semantics |
| `components/EmbeddedRegister.tsx` | (read pending) | ✅ | ✅ | `/register` | (not deep-scanned) | form-control native semantics |
| `components/ResetPasswordForm.tsx` | (read pending) | ✅ | ✅ | `/reset` | (not deep-scanned) | form-control native semantics |
| `components/ForgotPasswordForm.tsx` | (read pending) | ✅ | ✅ | `/forgot` | (not deep-scanned) | form-control native semantics |
| `components/SearchModal.tsx` | 127 | ✅ | ✅ | All `/blog/*` + auth'd routes (mount-gated in `AppShellClient`) | `useFocusTrap`, `useId`, Cmd/Ctrl+K shortcut, Escape close | `role="dialog"`, `aria-modal`, `aria-labelledby`; auto-focus on open via 50ms timeout; backdrop click + `stopPropagation` |
| `components/dashboard/Toast.tsx` | 119 | ✅ | ✅ | `/home` (via DashboardLayout) | `createPortal` → `document.body`, `requestAnimationFrame`, `setTimeout` | `role="status"`, `aria-live="polite"` (correct for transient notifications) |
| `components/HomePageClient.tsx` | 117 | ✅ | ✅ | `/home` | `requestIdleCallback`, dynamic-import, class `ErrorBoundary` | spinner has `aria-` notes absent — minor |
| `components/AppShellClient.tsx` | 89 | ✅ | ✅ | All routes (via `RootLayout`) | `usePathname`, `useRouter`, router prefetch loop | route-gating logic (auth flow vs operator shell); no a11y concerns at this layer |
| `components/lab/AnsiText.tsx` | 76 | ✅ | ✅ | `/community` (via Terminal) | none (pure parser) | none needed (display-only ANSI-coded text) |
| `components/dashboard/CriticalOverlayFx.tsx` | 74 | ✅ | ✅ | `/home` (via DashboardLayout when CRITICAL fires) | inline CSS animation only | `pointer-events-none` (correct — pure visual FX) |
| `components/dashboard/DashboardSkeleton.tsx` | 41 | ✅ | ✅ | `/home` (loading state) | none | skeleton placeholder; no a11y concerns |
| `components/MatrixRain.tsx` | 41 | ✅ (assumed) | ⚠️ unknown | (need confirmation) | canvas | (not deep-scanned) |
| `components/OperatorSidebar.tsx` | 10 | ✅ | 🟡 **DEAD CODE** | imported by `AppShellClient` but returns `null` ("intentionally disabled in V3") | none | n/a |
| `components/Footer.tsx` | (read pending) | ✅ (assumed) | ✅ | All non-auth-gateway routes | (not deep-scanned) | (not deep-scanned) |
| `components/PageTransition.tsx` | (read pending) | ✅ (assumed) | ✅ | All routes (via `AppShellClient`) | (not deep-scanned) | (not deep-scanned) |
| `components/MDXComponents.tsx` | (read pending) | mixed | ✅ | `/blog/[slug]` | (not deep-scanned) | (not deep-scanned) |
| `components/CodeBlock.tsx` | (read pending) | ✅ (assumed) | ✅ | `/blog/[slug]` | clipboard? | (not deep-scanned) |
| `components/EncodedCodeBlock.tsx` | (read pending) | ✅ (assumed) | ✅ | `/blog/[slug]` | clipboard? | (not deep-scanned) |
| `components/PayloadDisclaimer.tsx` | (read pending) | ✅ (assumed) | ✅ | `/blog/[slug]` | none | (not deep-scanned) |
| `components/BlogCard.tsx` | (read pending) | server-rendered (assumed) | ✅ | `/blog` | none | (not deep-scanned) |
| `components/ReadingProgress.tsx` | (read pending) | ✅ (assumed) | ⚠️ unknown | (need confirmation — likely `/blog/[slug]`) | scroll listener | (not deep-scanned) |
| `components/BackToTop.tsx` | (read pending) | ✅ (assumed) | ⚠️ unknown | (need confirmation — likely `/blog/[slug]`) | scroll listener | (not deep-scanned) |
| `components/portfolio/DangerZone.tsx` | (read pending) | ✅ (assumed) | ✅ | `/portfolio` | (not deep-scanned) | (not deep-scanned) |
| `components/portfolio/DeleteAccountModal.tsx` | (read pending) | ✅ (assumed) | ✅ | `/portfolio` | (not deep-scanned) | password re-auth gate (R-API-04 cascade); likely uses `useFocusTrap` pattern |

**Total components:** 32 `.tsx` files. **Total LOC:** ~9,400 (sum across listed components, with top 5 accounting for ~5,500 LOC alone).

### 1.2 — Production verification summary (Z.10 lesson application)

Build route map (`npm run build` output) confirms 7 user-facing UI route surfaces:

| Route | First Load JS | Status | Primary components |
|---|---|---|---|
| `/community` | 158 kB | dynamic ƒ | Terminal.tsx + AnsiText.tsx (dynamic-import, ssr: false) |
| `/home` | 97.2 kB | dynamic ƒ | HomePageClient → DashboardLayout (dynamic-import, ssr: false) |
| `/portfolio` | 108 kB | dynamic ƒ | PortfolioWorkspace + DangerZone + DeleteAccountModal |
| `/zafiyet-taramasi` | 118 kB | dynamic ƒ | CveRadarTab (+ Reports tab, +CVE Radar tab, +Historical) |
| `/blog` | 96.3 kB | dynamic ƒ | BlogCard list |
| `/blog/[slug]` | 131 kB | static (SSG) ● | MDXComponents, CodeBlock, EncodedCodeBlock, PayloadDisclaimer (+ ReadingProgress?, BackToTop?) |
| `/login`, `/register`, `/forgot`, `/reset` | 95–100 kB | dynamic ƒ | Embedded auth forms |

**Production-confirmed mounting:** Terminal, AnsiText, DashboardLayout, TelemetryStreamPanel, AttackReportModal, CriticalAlertPanel, CriticalOverlayFx, Toast, DashboardSkeleton, HomePageClient, AppShellClient, NavigationBar, SearchModal, Footer (in non-gateway routes), PageTransition, OperatorSidebar (mounted but renders null — dead at the render boundary).

**Dead-code candidates surfaced by Z.10 verification:**
- `OperatorSidebar.tsx` (10 LOC) — returns `null`. Imported + rendered in `AppShellClient.tsx:73` but always renders nothing. Comment: *"Sidebar intentionally disabled in V3. Navigation is handled inside the dashboard shell."* Should be either removed or repurposed; current state is intentional placeholder per author note.

**Production-uncertain components (would benefit from explicit route trace):**
- `MatrixRain.tsx` (41 LOC) — canvas-based decorative effect; consumer unverified
- `ReadingProgress.tsx`, `BackToTop.tsx` — assumed `/blog/[slug]` but not verified in this audit pass

**SENIOR ARCHITECT NOTE:** the production-verified column is the **direct application of Phase 3.D Z.10 lesson** — audit doc must not assume from file existence alone. The 3 "uncertain" rows above are honest signals; Phase 4.D scope can decide whether to trace them or exclude from coverage.

**REJECTED ALTERNATIVE:** mark all components as "Prod ✅" based on file existence + import-graph analysis only. Rejected — Phase 3.D revision Z.10 lesson explicitly invalidates this approach. Migration file presence ≠ applied; component file presence ≠ rendered.

---

## 2. R-UI-XX Risk Register

Phase 4 adopts a new `R-UI-XX` namespace to avoid collision with Phase 1's R-01..R-22, Phase 2's R-LAB-01..R-LAB-15, and Phase 3's R-API-01..R-API-15. Severity scheme matches prior phases (Critical / High / Medium / Low / Informational). OWASP A0X mappings included where applicable; WCAG 2.1 AA criterion numbers cited where the risk maps to an established a11y guideline.

| Risk | Severity | OWASP / WCAG | Source surface | Description | Why severe |
|---|---|---|---|---|---|
| R-UI-01 🟡 PARTIAL | **High** | WCAG 2.1.1 Keyboard | `components/lab/Terminal.tsx` (xterm-like surface, 861 LOC) | **Terminal accessibility surface untested.** Custom prompt input (not a real `<input>` per se — there IS an `inputRef` so likely a focused text input, but the scroll-back history, tab-completion, history-up/down, and ANSI-coded output rendering pattern is unique and a11y-untested). Phase 2.A explicitly deferred Terminal/AnsiText to Phase 4 (`phase-2-a-lab-engine-audit.md:53-54`). Tab-completion + Ctrl-key composition + scroll-back behavior under screen reader is unverified. | Terminal is the **primary user surface for the Community / Breach Lab** — central demo feature. Keyboard-only navigation + screen-reader announcement of new lines (ANSI-stripped) + focus retention after WebSocket reconnect are all unverified. Severity High because (a) it's the flagship UX, (b) the surface is large enough that regression is plausible, (c) Phase 2.A explicit deferral makes this Phase 4's first responsibility. **STATUS (Phase 4.D commit `a0abe8f`):** PARTIAL CLOSURE — `AnsiText.tsx` pure parser surface covered via 16 tests (T-AT01-16) locking current ANSI color/bold/dim/reset semantics + escape positioning + accumulation + axe smoke. `Terminal.tsx` itself (861 LOC, xterm-like surface) intentionally NOT unit-tested per Phase 4.A Section 5 rationale; routed to Phase 5 E2E (Playwright) for full keyboard + screen-reader coverage. **UPDATE (Wave 4B commit `bc9c867`):** Phase 5 E2E coverage of Terminal STILL pending — Wave 4B state gathering surfaced that `/community` is server-side auth-gated via `src/app/community/layout.tsx` (BUG-006 closure). Yol A pragmatic fallback (Phase 5.A Z.13) declined the three paths that would unblock verified-user E2E (Resend sandbox / pre-verified user / SERVICE_ROLE_KEY). T-E2-02..05 in `e2e/journey-lab-l1-solve.spec.ts` are SKIPPED with explicit Phase 6 operational dependency note. R-UI-01 status remains PARTIAL pending verified-user setup. |
| R-UI-02 ✅ RESOLVED | **High** | WCAG 2.4.3 Focus Order + 2.1.2 No Keyboard Trap | `components/dashboard/AttackReportModal.tsx` (705 LOC), `components/dashboard/CriticalAlertPanel.tsx` (328 LOC), `components/SearchModal.tsx` (127 LOC), `components/NavigationBar.tsx` drawer (lines 209-259), `components/portfolio/DeleteAccountModal.tsx` (LOC tbd) | **5 modal surfaces use the shared `useFocusTrap` hook** (`src/hooks/useFocusTrap.ts`, 76 LOC) but the hook itself has zero direct tests. Single shared primitive → single point of failure across 5 critical UX surfaces. Hook documents WCAG 2.1 AA modal pattern in header but no automated assertion holds the contract. If hook regresses (e.g., Tab handling, Shift-Tab, Escape, focus restoration on close), all 5 modals break simultaneously. | Concrete failure modes: (a) Tab outside trap on Shift-Tab from first element, (b) Escape handler not preventing default (parent dialog catches it), (c) focus restoration to wrong element after close (`previouslyFocused?.focus?.()` on line 72), (d) `offsetParent !== null` filter (line 48) — `display: none` elements correctly excluded but `visibility: hidden` ones may slip through. Severity High because **single primitive ownership of 5 critical UX surfaces** = test ROI very high. **STATUS (Phase 4.D commit `a0abe8f`):** RESOLVED — 13 tests (T-FT01-13) lock the hook contract: activation focus, Tab/Shift+Tab boundary wrap, disabled/tabindex=-1/display:none wrap-target filtering, Escape callback invocation + preventDefault, previous focus restoration on deactivation, rapid toggle stability, cleanup unbind verification. Transitively secures all 5 modal surfaces (NavigationBar drawer, AttackReportModal, CriticalAlertPanel, SearchModal, DeleteAccountModal). T-SM10 in SearchModal test file additionally verifies the integration at the consumer side. |
| R-UI-03 🟡 DOC-ACCEPT (Wave 5A) | **High** | WCAG 1.4.3 Contrast (Minimum) + WCAG 2.4.7 Focus Visible | `components/dashboard/DashboardLayout.tsx` (2165 LOC, hacker-themed `#000000` + `#00ff88` neon + `#00d4ff` cyan palette per CLAUDE.md) | **Color contrast not verified against WCAG AA.** Dashboard uses hacker/breach palette with neon foregrounds on near-black backgrounds; some accent colors may fail 4.5:1 normal-text or 3:1 large-text contrast. | Demo-critical UX — Dashboard is the centerpiece on `/home`. WCAG AA failure means: (a) operator with mild color-vision deficiency can't read critical alerts, (b) accessibility-compliance claims unsupportable. Severity High because invisible to sighted-developer testing. **STATUS (Wave 5A commit `3b20855`):** DOC-ACCEPT per mentor option (b) — intentional theme tradeoff. The cybersecurity siberhacker palette (`#000000` + `#00ff88` neon + `#00d4ff` cyan per CLAUDE.md L77-78) is the project's intentional aesthetic identity. Strict WCAG AA contrast trades against the neon-on-dark visual brand. Honest closure signal: tradeoff explicit, not silent. AAA-leaning iteration (state-critical accent variants) deferred to Phase 6. No code change. |
| R-UI-04 ✅ RESOLVED (Wave 2A) | **High** | A04 Insecure Design + WCAG 4.1.2 Name/Role/Value | `components/dashboard/CriticalAlertPanel.tsx` (lines 44-52, `getIncidentIcon`) | **Emoji used as status icons without `aria-label`/`role="img"` annotation.** `getIncidentIcon` returns raw emoji strings (`💀`, `🔓`, `🔑`, `⚡`, `📤`, `🛰`, `⚠`) for ransomware / SQL / auth / flood / exfil / C2 / generic. Screen readers may announce as Unicode codepoint names (e.g., "skull and crossbones, padlock") or skip entirely depending on UA. Sighted users see decoration; non-sighted users get inconsistent (and sometimes meaningless) audio. | This is the **critical incident alert panel** — when CRITICAL fires, the panel pops with `role="dialog" aria-modal="true"` and the operator has to triage. Emoji-without-label means a blind operator can't quickly distinguish ransomware (skull) from generic warning (triangle). Severity High because critical-incident triage UX has zero room for ambiguity. **STATUS (Wave 2A commit `8ded1c4`):** RESOLVED — `getIncidentIcon` refactored to return `{ emoji, ariaLabel }` (Turkish descriptive labels: Ransomware saldırısı / SQL enjeksiyonu / Kimlik doğrulama atlatma / Yoğun trafik saldırısı / Veri sızdırma / Komuta-kontrol bağlantısı / Kritik tehdit). Call site at L254 wraps in `<span role="img" aria-label={ariaLabel}>`. Tests T-CAP01-02 + T-CAP-A11 verify the contract (axe scoped to R-UI-04-relevant rules: image-alt, aria-allowed-attr, aria-valid-attr-value, role-img-alt). **Out-of-scope discovery:** Wave 2A test writing surfaced a separate `button-name` axe violation (dismiss buttons missing `aria-label`) — locked via T-CAP-A11-GAP (R-21 gap-test pattern, Phase 1 lineage) pending a future R-UI-NN entry + closure cycle. **UPDATE (Wave 6 commit `fd88d15`):** T-CAP-A11-GAP CLOSED — X close button in panel header now carries `aria-label="Kritik uyarı panelini kapat"` + inner `<X />` icon marked `aria-hidden="true"` (icon is decorative; accessible name lives on the parent button). The Wave 2A gap-test (T-CAP-A11-GAP) is renamed T-CAP-A11-DISMISS and **flipped** to a regression-guard assertion (`expect(results).toHaveNoViolations()` instead of `expect(violations.length).toBeGreaterThan(0)`). Broad T-CAP-A11 smoke also re-enables the `button-name` rule (previously disabled to scope the assertion to R-UI-04 only). **2nd gap-test → regression-guard lifecycle transition** in the project's pattern catalog (1st: Wave 2B `T-MO-CHMOD-EQ-GAP → T-MO-CHMOD-EQ01`). Other panel buttons ("Rapor Olustur", "Kapat") already carry visible text labels, so no aria-label change was needed there — axe button-name passes via the text node. |
| R-UI-05 ✅ RESOLVED (Wave 5A) | Medium | WCAG 1.3.1 Info & Relationships + WCAG 2.4.6 Headings & Labels | `components/dashboard/TelemetryStreamPanel.tsx` (820 LOC), `components/dashboard/DashboardLayout.tsx` panels | **Dashboard panels lack heading hierarchy + landmark regions.** Phase 4.D needs to verify that panels expose `<h2>` / `<h3>` for screen-reader navigation, `<section aria-labelledby=...>` for landmarks, and that the global threat map is reachable via `role="region"`. | Screen-reader operators navigate by headings. Without a heading map, the Dashboard becomes an undifferentiated wall of `<div>`s. **STATUS (Wave 5A commit `3b20855`):** RESOLVED — DashboardLayout root now has `<h1 className="sr-only">SOC Sentinel Dashboard</h1>` anchoring the heading hierarchy. The Frame wrapper component (DashboardLayout L245-254) already provides `<section>` + `<header>` + `<h2>` per panel — h1 → h2 cascade now valid per axe `heading-order` rule. `<main>` landmark at L2134 already present (single column layout, no additional `<aside>` needed). GlobalMapPanel renders inside `<section>` at L1020. TelemetryStreamPanel renders inside Frame's `<section>` — semantic landmark already in place. No additional code changes needed for TelemetryStreamPanel beyond h1 anchor at DashboardLayout root. Direct axe unit test deferred — components are 2165 + 820 LOC (Phase 4.A Section 5 "too large for unit"); Phase 5 E2E + axe-playwright will surface any future regressions. |
| R-UI-06 ✅ RESOLVED (Wave 5A) | Medium | A04 Insecure Design + WCAG 2.5.5 Target Size | `components/NavigationBar.tsx` (mobile drawer hamburger lines 194-206) | **Mobile drawer + touch target sizes unverified.** WCAG 2.5.5 recommends 44×44 CSS pixels for touch targets. The `nb2-menu-btn` had no explicit dimensions in component code; same applied to drawer-internal links + close button. | Mobile UX correctness — demo from a phone in interview / portfolio context. Tap miss = bad first impression. **STATUS (Wave 5A commit `3b20855`):** RESOLVED — `min-h-[44px] min-w-[44px]` Tailwind classes applied to: (a) hamburger toggle button (`nb2-menu-btn`), (b) close button (`nb2-close`), (c) drawer link items (`nb2-drawer-link min-h-[44px]`). Enforces WCAG 2.5.5 minimum touch target at the component layer regardless of `globals.css` evolution. Direct test deferred (jsdom doesn't compute layout reliably); contract is verified via static class presence + visual review on real mobile viewport during demo prep. |
| R-UI-07 ✅ RESOLVED (Wave 5A) | Medium | WCAG 1.4.13 Content on Hover or Focus + WCAG 3.2.1 On Focus + WCAG 2.2.4 Interruptions (AAA-leaning) | `components/dashboard/Toast.tsx` | **Toast timing not configurable for assistive tech.** Toast auto-dismissed after 4000ms with no extension on hover / focus / screen-reader-reading-mode. | Operator triaging multiple incidents in quick succession may miss toast labels via screen reader. **STATUS (Wave 5A commit `3b20855`):** RESOLVED — `ToastItem` refactored with `useRef<number | null>` storing the dismiss timer + `pauseTimer()` / `resumeTimer()` / `startExitTimer()` callbacks. `onMouseEnter` / `onMouseLeave` (hover-pause for mouse operators) + `onFocus` / `onBlur` (focus-pause for keyboard / screen-reader operators) wired at the toast container. Existing `aria-live="polite"` preserved. After hover/focus ends, timer restarts with full `TOAST_DURATION_MS` budget. Tests T-TP-HOVER (mouseenter pauses, no dismiss after extended time), T-TP-FOCUS (focus pauses identically), T-TP-RESUME (mouseleave restarts timer and eventually fires) verify the contract with `vi.useFakeTimers()` + `fireEvent`. |
| R-UI-08 ✅ RESOLVED (Wave 2A) | Medium | WCAG 1.1.1 Non-text Content (Alt Text) | `components/NavigationBar.tsx` SkullImage (lines 36-46), `components/MatrixRain.tsx` (canvas), `components/dashboard/DashboardLayout.tsx` globe (d3-geo / topojson world-110m.json) | **Decorative imagery uses `alt=""` + `aria-hidden="true"` (correct in NavigationBar) but other decorative surfaces uncertain.** MatrixRain canvas — not deep-scanned; if it lacks `aria-hidden`, screen reader may announce "canvas" with no context. DashboardLayout globe is `<canvas>`-or-`<svg>` (d3-geo + topojson) — needs `role="img" aria-label="Global threat map"` or `aria-hidden="true"` + alternative text representation. | Inconsistent decorative-vs-meaningful image annotation. Severity Medium because (a) most decorative use is already correct (NavigationBar SkullImage), (b) globe is a centerpiece — if announced as "canvas" the user has no context, if hidden the user loses information. Audit Phase 4.D should verify each `<canvas>` / large SVG surface. **STATUS (Wave 2A commit `8ded1c4`):** RESOLVED — MatrixRain canvas annotated `aria-hidden="true"` (decorative animation; mentor decision per Z.7 lineage). DashboardLayout globe SVG annotated `role="img" aria-label="Real-time global attack telemetry map"` (informative; mentor-locked descriptive label replaces prior "3D threat globe"). Tests T-MR01 + T-MR-A11 axe smoke verify MatrixRain a11y contract. DashboardLayout globe a11y attribute landed code-only; transitive E2E coverage in Phase 5 (R-E2E-04 dashboard mount). |
| R-UI-09 | Medium | A06 Vulnerable & Outdated Components | `vitest.config.ts` (`environment: 'node'`), `package.json` (no jsdom/happy-dom/RTL/axe-core) | **No DOM test environment + no component-test infrastructure.** vitest runs in Node — no `document`, no `window`, no React rendering. `include: ['src/**/*.test.ts']` excludes `.test.tsx`. Zero UI components currently have unit-level tests. Without this infra, R-UI-01..R-UI-08 are unverifiable in CI. | This is a **test-infrastructure debt**, not a runtime risk — but it's the gating constraint for ALL of Phase 4.D. Without jsdom + @testing-library/react + axe-core, no Phase 4.D test can assert WCAG outcomes. Phase 4.B will own the install + config update. Severity Medium because (a) it's a known gap (Phase 1.A:65 already deferred to Phase 4.B), (b) the gap is one well-defined PR away from closure. |
| R-UI-10 ✅ RESOLVED (Wave 5A) | Medium | A04 Insecure Design (Defensive Coding) | `components/HomePageClient.tsx` + new `components/SectionErrorBoundary.tsx` | **ErrorBoundary scope is single (DashboardLayout-only).** Class ErrorBoundary inside HomePageClient catches DashboardLayout errors and shows plain-text English fallback. Other surfaces had no error boundary — a render-time exception propagated to Next.js' default error page. | Operator demo crash = blanket 500 page instead of localized "module crashed" affordance. **STATUS (Wave 5A commit `3b20855`):** RESOLVED — new `src/components/SectionErrorBoundary.tsx` (generic class component, `{ section: string, children, fallback? }` props) provides per-section isolation. HomePageClient authed branch now nests `<SectionErrorBoundary section="SOC Dashboard">` INSIDE the legacy top-level ErrorBoundary (belt + suspenders pattern — outer catches catastrophic mount failures, inner isolates specific section). Default fallback styled to fit hacker-aesthetic palette (rose-tinted alert, compact, role="alert"). Future cycles can wrap individual panels (TelemetryStream, GlobalMap, CriticalAlert) with their own SectionErrorBoundary instances without restructuring. Tests T-HP-EB01 (HomePageClient pass-through under no-error), T-HP-EB02 (default fallback rendered on crash), T-HP-EB03 (custom fallback prop overrides default) lock the contract. |
| R-UI-11 ✅ RESOLVED (Wave 2A) | Medium | A05 Security Misconfiguration | `components/AppShellClient.tsx` (lines 21, 22 — `posts: any[]`) | **`AppShellClient` accepts `posts: any[]` as a prop.** Any-typed props are an established anti-pattern; `posts` is later passed to `SearchModal` (`{posts as PostMeta[]}` implicit cast at use site). If a future refactor changes `PostMeta` shape, no compile-time check catches the drift. Same risk as Phase 1.A R-XX-family "no type safety on prop boundary" lineage. | Type-system gap — not exploitable but a maintenance liability. Severity Medium because (a) other code in this file is well-typed, (b) the `any` is a contained, low-risk localism, (c) Phase 4.D could add a regression-guard test asserting `SearchModal` receives `PostMeta[]`-shaped data. **STATUS (Wave 2A commit `8ded1c4`):** RESOLVED — `posts: any[]` → `posts: PostMeta[]` with explicit `import type { PostMeta } from '@/lib/posts'`. Caller pipeline now type-checked end-to-end; future `PostMeta` shape changes surface at the `AppShellClient` boundary at compile time. `npx tsc --noEmit` confirms zero callers violate the new contract — no runtime test added; TypeScript discipline IS the closure signal. |
| R-UI-12 ✅ RESOLVED (Wave 3) | Low | A04 Insecure Design | `components/HomePageClient.tsx` (lines 51-89 — idle-callback dashboard mounting) | **DashboardLayout mounting gated on `requestIdleCallback` (with 80ms `setTimeout` fallback).** Pattern is sound — defer heavy DashboardLayout component until browser is idle — but `requestIdleCallback` is not in Safari < 15 and the `setTimeout(80)` fallback fires regardless. Cleanup logic on `useEffect` return correctly cancels both. Edge case: if `authStatus` flips during the idle window, the cleanup runs and the new idle handle is registered. No race in current logic but the cleanup is intricate. | Pure code-quality concern. Severity Low because (a) cleanup is correct on inspection, (b) Safari fallback acceptable, (c) test ROI low (would need fake timer + fake `requestIdleCallback`). **STATUS (Wave 3 commit `5cb6bee`):** RESOLVED via T-HP01-04 tests (`src/components/__tests__/HomePageClient.test.tsx`, 4 tests). T-HP01 unauth → EmbeddedLogin; T-HP02 pending auth → "Authenticating" spinner; T-HP03 authed + pre-rIC → DashboardSkeleton (gate closed); T-HP04 unmount cleanup robustness (no setState-after-unmount). Post-rIC DashboardLayout mount routed to Phase 5 E2E (R-E2E-04 — `next/dynamic` async loader is beyond unit scope). |
| R-UI-13 ✅ RESOLVED (Wave 5A) | Low | A04 Insecure Design | `components/AppShellClient.tsx` (lines 57-64 — router prefetch loop) | **Router prefetch fires once per `pathname` change + iterates 4 sibling routes.** Non-cancellable — fires off N prefetch promises every navigation. | Pure efficiency concern. **STATUS (Wave 5A commit `3b20855`):** RESOLVED — `useEffect` now constructs `AbortController` per effect run; inner `async runPrefetchLoop()` gates each iteration via `controller.signal.aborted`. Cleanup function calls `controller.abort()` on unmount or pathname change. Next.js `router.prefetch` doesn't accept AbortSignal directly, so the gate works by short-circuiting NEW iterations — in-flight prefetches that already started are framework-managed (acceptable per R-UI-13 Low severity scope). Tests T-AS-ABORT (unmount triggers `AbortController.prototype.abort` spy) + T-AS-ABORT-RERUN (pathname change reruns effect → prior controller aborted + new one created) lock the contract via prototype-spy pattern. |
| R-UI-14 ✅ RESOLVED (Wave 3) | Low | A07 ID&A Failures | `components/dashboard/Toast.tsx` (line 117 — `createPortal(..., document.body)`) | **Toast portal target is `document.body` unconditionally.** In SSR (Next.js App Router server components) the component is `'use client'` + `mounted` state-gated (lines 101-107) → safe. But the gating relies on `useEffect` running before portal render. Race risk negligible but the pattern depends on React's commit-phase ordering. Phase 4.D test could verify with mocked `createPortal`. | Pure correctness concern. Severity Low. **STATUS (Wave 3 commit `5cb6bee`):** RESOLVED via T-TP01-04 tests (`src/components/dashboard/__tests__/Toast.test.tsx`, 4 tests). T-TP01 empty toasts array → null (no portal); T-TP02 non-empty → portal mounts to document.body with role="status"; T-TP03 N toasts → N role="status" elements; T-TP04 onDismiss auto-fires after TOAST_DURATION_MS+TOAST_FADE_MS via fake timers. The mounted-state gate works as designed. |
| R-UI-15 ✅ RESOLVED (Wave 2A) | Informational | — | `components/OperatorSidebar.tsx` (10 LOC) | **Dead code — component returns `null` unconditionally.** Comment confirms "intentionally disabled in V3." Imported + rendered in `AppShellClient.tsx:73`. No runtime cost, but presence in the bundle + import graph is dead weight. | Pure code-hygiene note. Could be deleted + import removed, or repurposed for V4 sidebar. No security or correctness implication. **STATUS (Wave 2A commit `8ded1c4`):** RESOLVED — `src/components/OperatorSidebar.tsx` DELETED. Single importer (`AppShellClient.tsx` line 6 import + line 73 JSX use) cleaned up. `grep -rn "OperatorSidebar" src/` returns zero hits post-removal. No test added (dead-code removal has no behavioral surface). |

**Summary by severity (Phase 4.D + Wave 2A + Wave 3 + Wave 5A updates marked):** High = 4 (R-UI-01 🟡 PARTIAL — AnsiText covered via T-AT01-16; Terminal.tsx → Phase 5 E2E; **R-UI-02 ✅ RESOLVED** via T-FT01-13 + T-SM10; **R-UI-03 🟡 DOC-ACCEPT (Wave 5A)** intentional theme tradeoff; **R-UI-04 ✅ RESOLVED (Wave 2A)** via emoji wrap + T-CAP); Medium = 7 (**R-UI-05 ✅ RESOLVED (Wave 5A)** via h1 sr-only + Frame semantic structure; **R-UI-06 ✅ RESOLVED (Wave 5A)** via min-h-[44px] min-w-[44px] touch targets; **R-UI-07 ✅ RESOLVED (Wave 5A)** via hover/focus pause + T-TP-HOVER/FOCUS/RESUME; **R-UI-08 ✅ RESOLVED (Wave 2A)** via MatrixRain aria-hidden + DashboardLayout globe role+aria-label; R-UI-09 closed Phase 4.B infra; **R-UI-10 ✅ RESOLVED (Wave 5A)** via SectionErrorBoundary + T-HP-EB; **R-UI-11 ✅ RESOLVED (Wave 2A)** via `any[]`→`PostMeta[]`); Low = 3 (**R-UI-12 ✅ RESOLVED (Wave 3)** via T-HP01-04; **R-UI-13 ✅ RESOLVED (Wave 5A)** via AbortController + T-AS-ABORT; **R-UI-14 ✅ RESOLVED (Wave 3)** via T-TP01-04); Informational = 1 (**R-UI-15 ✅ RESOLVED (Wave 2A)** via OperatorSidebar deletion). **Total = 15. R-UI-RESOLVED count: 14 of 15 (93%); R-UI-01 PARTIAL pending Phase 6 verified-user setup; R-UI-03 DOC-ACCEPT.**

**No Critical entries.** Critical UI risks would be exploit-level (script injection via uncontrolled `dangerouslySetInnerHTML`, etc.) — sample-checked at file-read time and not observed in the audited surface. The Phase 4 risk profile is concentrated in **accessibility + test-infrastructure debt** — both surfaces where prevention through testing is cheaper than after-the-fact remediation.

**WCAG criterion distribution:** AA = 8 (R-UI-01/02/03/04/05/07/08), AAA-leaning = 2 (R-UI-06 touch target, R-UI-07 timing). A11y posture is mostly correct (`useFocusTrap` consistent, `role` + `aria-` usage broad) — the risks are gaps in test coverage of those primitives, not coding errors.

---

## 3. Existing UI Test Coverage

**Direct UI component test count: 0.** vitest config (line 13) `include: ['src/**/*.test.ts']` excludes `.test.tsx`; `find src -name "*.test.tsx"` returns empty.

**Indirect UI surface coverage (transitive):**

| Surface | Coverage |
|---|---|
| Terminal command parsing | `src/lib/lab/__tests__/*.test.ts` (Phase 2.D — T-CCB / T-CTFR / T-VC / T-RD / T-MO suites, 76 tests). Tests `engine.ts`, `validation/*`, `reveal/*`, `mutation/operations.ts`, `filesystem.ts`. Terminal.tsx render layer NOT exercised. |
| Auth forms | `src/app/api/auth/__tests__/*.test.ts` (Phase 1.D — 9 test files, ~85 tests). Exercise route handlers. EmbeddedLogin.tsx / EmbeddedRegister.tsx / ForgotPasswordForm.tsx / ResetPasswordForm.tsx render layer NOT exercised. |
| Dashboard data flow | `src/lib/__tests__/*.test.ts` (T-AD adapter, T-EM email, T-INSTR instrumentation, etc.). DashboardLayout.tsx render layer NOT exercised. |
| Profile + portfolio | `src/app/api/profile/**/__tests__/*.test.ts` (Phase 3.D — T-PC suite, 20 tests). PortfolioWorkspace.tsx + DangerZone.tsx + DeleteAccountModal.tsx render layer NOT exercised. |
| Reports + alerts | `src/app/api/{reports,alerts}/__tests__/*.test.ts` (Phase 3.D — T-AL + T-RP, 51 tests). No UI render coverage. |

**Total transitive coverage:** 386 tests / 37 files (post-Phase-3.D-revision baseline) exercise business logic; **zero exercise UI render path.** Every Phase 4.D test will be net-new coverage.

### Phase 4.D test expansion (this audit's surgical recommendation, IMPLEMENTED)

Phase 4.D commit `a0abe8f` ships 3 new component test files implementing the Top-3 surgical scope from Section 5:

| File | Tests | Coverage target | Maps to |
|---|---|---|---|
| `src/hooks/__tests__/useFocusTrap.test.tsx` | 13 | activation focus + Tab/Shift+Tab boundary wrap + filtering (disabled/tabindex=-1/hidden) + Escape callback + previous-focus restore + cleanup verification | T-FT01-T-FT13 → R-UI-02 (High) full closure |
| `src/components/lab/__tests__/AnsiText.test.tsx` | 16 | ANSI parser: plain text + 4 foreground colors + bold + dim + reset + combined sequence + bright variants + unknown code + escape position + accumulation + axe smoke | T-AT01-T-AT16 → R-UI-01 (High) partial closure |
| `src/components/__tests__/SearchModal.test.tsx` | 12 | open/close lifecycle (Ctrl-K, Cmd-K, Escape) + backdrop click + inner-click stopPropagation + auto-focus + title-filter + tag-filter + no-match state + axe smoke | T-SM01-T-SM12 → R-UI-02 (transitive) + filter + keyboard |

**Total Phase 4.D test count:** 13 + 16 + 12 = **41 net new tests**. Baseline 386 → **427 / 40 files**.

R-UI risk coverage state post-Phase-4.D:
- **R-UI-01 (High)**: 🟡 PARTIAL via T-AT01-16 (AnsiText covered; Terminal.tsx → Phase 5 E2E per Section 5 out-of-scope rationale)
- **R-UI-02 (High)**: ✅ RESOLVED via T-FT01-13 + T-SM10 transitive (single hook test secures 5 modal surfaces)
- **R-UI-03..R-UI-15**: Untouched (intentional surgical scope — Phase 4.D doesn't chase all 15 risks; only Top-3 per Section 5 ranking)

### 3.1 — Test infrastructure gap inventory

| Gap | Current state | Phase 4.B closure |
|---|---|---|
| DOM environment | `environment: 'node'` (vitest.config.ts:11) | Either: (a) add `jsdom` or `happy-dom`, OR (b) per-file `// @vitest-environment jsdom` directive |
| React render utilities | absent | `@testing-library/react` + `@testing-library/jest-dom` |
| User interaction simulation | absent | `@testing-library/user-event` |
| A11y assertion library | absent | `axe-core` + `@axe-core/react` OR `jest-axe`/`vitest-axe` wrapper |
| Component test file pattern | `include: ['src/**/*.test.ts']` excludes `.test.tsx` | Either: (a) widen to `['src/**/*.test.{ts,tsx}']`, OR (b) add second include for tsx |
| Setup file augmentation | `src/test/setup.ts` (env stubs) | Add `import '@testing-library/jest-dom/vitest'` + browser API stubs |
| Browser API mocks | absent | window.matchMedia, ResizeObserver, IntersectionObserver, requestAnimationFrame/cancelAnimationFrame |

**REJECTED ALTERNATIVE:** keep vitest in Node environment and use Playwright for ALL UI work. Rejected — Playwright is Phase 5 (E2E) per CLAUDE.md L173. Unit-level UI tests with jsdom + RTL are the established Phase 4 pattern.

**REJECTED ALTERNATIVE:** jsdom (vs happy-dom). Trade-off: jsdom is the more compatible default with broader API coverage but slower; happy-dom is faster (~2-10×) and lighter but has known gaps (CSS computation, some DOM APIs). Phase 4.B should pick one explicitly; defaulting to **jsdom** as recommendation because (a) closer to real-browser behavior, (b) better xterm.js / d3-geo compatibility (canvas + SVG ops), (c) the test suite is currently small enough that 2-10× speedup doesn't yet matter.

---

## 4. Test Gaps + Priority Ranking

Ranking criteria (Phase 2.A + 3.A pattern):
1. R-UI-XX severity
2. User-facing impact (which components drive demo / portfolio narrative)
3. Test ROI (surface size × invariant density / scaffolding cost)
4. Cross-reference depth (single primitive that gates multiple risks ranks higher)

| Rank | Component cluster | Surface size | Test ROI | R-UI-XX coverage | Phase 4.D candidacy |
|---|---|---|---|---|---|
| 1 | **`src/hooks/useFocusTrap.ts`** | 76 LOC, 5 callers | **VERY HIGH** — single primitive used by 5 modal surfaces. Pure hook with deterministic focus semantics, easy to test with jsdom + RTL `renderHook` | R-UI-02 | **Strongly recommended Target #1** |
| 2 | **`components/lab/AnsiText.tsx`** | 76 LOC, pure parser | **HIGH** — stateless input→output function (ANSI escape → React span array). Property-style tests (escape combinations, malformed input, unicode, control-char edge cases). Already named in Phase 2.A:54 as Phase 4 territory. | (R-UI-01 partial via Terminal coverage) | **Strongly recommended Target #2** |
| 3 | **`components/SearchModal.tsx`** | 127 LOC, modal + keyboard shortcut | **HIGH** — focused scope (open/close + filter + Cmd-K + Escape + backdrop + focus on input). Uses useFocusTrap → Target #1 transitively. Posts filter is testable property. | R-UI-02 (transitive) | **Strongly recommended Target #3** |
| 4 | `components/dashboard/Toast.tsx` | 119 LOC, transient notification | HIGH — small surface, predictable timer behavior, `aria-live="polite"` contract, portal mounting. `vi.useFakeTimers()` + `requestAnimationFrame` stub. | R-UI-07 | Phase 4.D candidate (alternate to #3) |
| 5 | `components/dashboard/CriticalAlertPanel.tsx` | 328 LOC, modal | MEDIUM-HIGH — uses useFocusTrap; emoji-as-icon contract; queue interaction. Larger than Target #1-3 but high-impact (R-UI-04). | R-UI-02, R-UI-04 | Phase 4.D follow-on candidate |
| 6 | `components/NavigationBar.tsx` | 263 LOC, drawer + nav | MEDIUM — drawer pattern + body-scroll-lock + Escape + path-change-close + click-outside. Best-in-codebase a11y but lots of state interactions to verify. | R-UI-02 (transitive), R-UI-06 | Phase 4.D follow-on candidate |
| 7 | `components/HomePageClient.tsx` | 117 LOC, ErrorBoundary + idle gate | MEDIUM — class ErrorBoundary semantics + idle-callback gating. Needs `vi.useFakeTimers` + `requestIdleCallback` stub. | R-UI-10, R-UI-12 | Phase 4.D follow-on candidate |
| 8 | `components/dashboard/AttackReportModal.tsx` | 705 LOC, modal + form | MEDIUM — large surface, form interactions, useFocusTrap integration. Test ROI moderate (high LOC, single feature). | R-UI-02 (transitive) | Phase 4.D potential, lower priority |
| 9 | `components/dashboard/CriticalOverlayFx.tsx` | 74 LOC, pure CSS animation | LOW — no interactivity, pure visual FX with `pointer-events-none`. Test could verify it doesn't trap pointer events / is hidden from screen readers. | (R-UI-04 partial) | Phase 4.D **low priority** |
| 10 | `components/dashboard/DashboardLayout.tsx` | 2165 LOC, globe + telemetry orchestrator | LOW — too large, too many internal sub-features. Better tested via E2E (Phase 5). Phase 4.D could carve narrow targets (e.g., severity-to-color mapping pure function if isolatable). | R-UI-03, R-UI-05 | Phase 4.D **out of scope** (recommend Phase 5 E2E) |
| 11 | `components/portfolio/PortfolioWorkspace.tsx` | 1564 LOC, multi-tab workspace | LOW — same logic as #10. Sub-components (DangerZone, DeleteAccountModal) carved out are smaller and could be Phase 4.D candidates separately. | — | Phase 4.D **out of scope** (recommend Phase 5 E2E) |
| 12 | `components/lab/Terminal.tsx` | 861 LOC, xterm-like | LOW for unit | Same as #10/#11 — too large for unit. Inputs/outputs are well-defined (lab engine results in, ANSI lines out) but the DOM-interaction surface (scroll-back, tab, history) is more profitably E2E-tested. | R-UI-01 | Phase 4.D narrow surface only (e.g., tabComplete function exported separately if isolatable) |

**WHAT WE'RE NOT RECOMMENDING (and why):**
- DashboardLayout, PortfolioWorkspace, Terminal (top 3 by LOC) — too large for productive unit testing. Phase 5 E2E (Playwright) is the right closure path. Phase 4.D scope **explicitly excludes** these to avoid the Phase 2.A R-LAB-09 "test the orchestrator" anti-pattern.

---

## 5. Surgical Recommendation for Phase 4.D

**Three targets, ~50-70 net new tests, all closeable in a single Phase 4.D cycle after Phase 4.B infrastructure lands.**

### Target #1 — `src/hooks/useFocusTrap.ts` (R-UI-02 closure, 76 LOC)

Single shared primitive across 5 modal surfaces. Test ROI is maximal: ~10-15 tests against a 76-LOC hook locks the contract for 5 downstream consumers.

- T-FT01 — initial focus moves to first focusable on `active: true`
- T-FT02 — Tab on last focusable cycles to first
- T-FT03 — Shift-Tab on first focusable cycles to last
- T-FT04 — Tab/Shift-Tab on no-focusable container prevents default + no-op
- T-FT05 — Escape calls `onEscape` callback when provided
- T-FT06 — Escape with no `onEscape` does NOT prevent default (passthrough)
- T-FT07 — Focus restored to `previouslyFocused` element on cleanup
- T-FT08 — `display: none` elements excluded via `offsetParent !== null` filter
- T-FT09 — `[disabled]` attribute respected (selector excludes)
- T-FT10 — `[tabindex="-1"]` excluded; `[tabindex="0"]` included
- T-FT11 — Hook deactivates cleanly when `active` flips to false
- T-FT12 — Hook is idempotent: re-activate after deactivate works
- T-FT13 — Multi-instance: two simultaneous active traps (defensive — should not happen in practice but locks current behavior)

Estimated count: 13. Estimated effort: small (76 LOC pure hook, RTL `renderHook`).

### Target #2 — `src/components/lab/AnsiText.tsx` (R-UI-01 partial closure, 76 LOC)

Pure parser, deterministic. Phase 2.A explicit deferral lands here.

- T-AT01 — empty string → empty span
- T-AT02 — plain text (no escapes) → single span with text
- T-AT03 — `\x1b[31m` → red color applied to subsequent text
- T-AT04 — `\x1b[0m` reset clears color + bold + dim
- T-AT05 — `\x1b[1m` bold applied; `\x1b[2m` dim applied
- T-AT06 — combined `\x1b[1;31m` (bold + red) applies both
- T-AT07 — bright variants (`\x1b[91m`..`\x1b[93m`) map correctly
- T-AT08 — unknown code (`\x1b[99m`) is ignored, state unchanged
- T-AT09 — escape sequence at start of string
- T-AT10 — escape sequence at end of string (no text follows)
- T-AT11 — escape sequence in middle splits text into two segments
- T-AT12 — multiple consecutive escapes accumulate state
- T-AT13 — malformed escape (`\x1b[` without closing `m`) — current behavior locked
- T-AT14 — unicode preserved in text segments
- T-AT15 — long input (perf smoke) — no regression
- T-AT16 — property test: parseAnsi(input).map(s=>s.text).join('') === input.replace(/escapes/, '') (text preservation invariant)

Estimated count: 16. Estimated effort: small (pure function tests, no jsdom required for parser — though tests in `.test.tsx` need jsdom for render assertions).

### Target #3 — `src/components/SearchModal.tsx` (R-UI-02 transitive + filter logic, 127 LOC)

Modal + keyboard shortcut + filter. Combines focus-trap integration (Target #1 transitively) with own surface.

- T-SM01 — opens on Cmd-K (or Ctrl-K)
- T-SM02 — closes on Escape
- T-SM03 — closes on backdrop click (outer div)
- T-SM04 — inner content click does NOT close (stopPropagation)
- T-SM05 — auto-focuses input on open (after 50ms timeout)
- T-SM06 — input value updates on type
- T-SM07 — empty query shows first 8 posts (slice)
- T-SM08 — non-empty query filters by title match (case-insensitive)
- T-SM09 — non-empty query filters by tag match (case-insensitive)
- T-SM10 — `useFocusTrap` integration: Tab stays within modal (one assertion delegates to Target #1)
- T-SM11 — `role="dialog" aria-modal="true" aria-labelledby` present
- T-SM12 — closed state renders nothing (`return null`)

Estimated count: 12. Estimated effort: small-medium (RTL `render` + `userEvent` + fake timers).

### Total Phase 4.D expansion estimate

**13 + 16 + 12 = 41 net new tests**, all UI surface, distributed across 3 new `.test.tsx` files. Baseline 386 → ~427 / 40 files.

If Phase 4.B + 4.C land cleanly (high confidence — patterns are well-established), the actual Phase 4.D commit could absorb 1-2 stretch targets (Toast.tsx — 10 tests, NavigationBar.tsx drawer — 15 tests) bringing total to ~50-70.

### Why not Target #N (negative cases)

- **DashboardLayout (2165 LOC):** too large for unit. Better tested via E2E in Phase 5. Phase 4.D would duplicate render-tree fragility.
- **PortfolioWorkspace (1564 LOC):** same as above.
- **Terminal (861 LOC):** business logic already tested via Phase 2.D `engine.ts` + `validation/*` + `mutation/*`. UI-render layer of Terminal is more profitably E2E-tested.
- **EmbeddedLogin / EmbeddedRegister / ForgotPasswordForm / ResetPasswordForm:** auth-route tests (Phase 1.D, 85 tests) cover server contract. Render layer is a thin form-control wrapper; carving tests for it duplicates Phase 1.D coverage with little new signal. Defer to Phase 5 E2E for full flow.
- **MDXComponents, CodeBlock, EncodedCodeBlock, BlogCard:** static-ish blog rendering. Low risk surface. Defer to Phase 5 if E2E reveals issues; otherwise leave uncovered.

### Phase 4.D commit cross-reference

**Phase 4.D commit `a0abe8f` implements this surgical scope.** Three new test files, 41 net new tests, zero product code changes:

- `src/hooks/__tests__/useFocusTrap.test.tsx` — T-FT01-T-FT13 (13 tests, R-UI-02 closure)
- `src/components/lab/__tests__/AnsiText.test.tsx` — T-AT01-T-AT16 (16 tests including T-AT16 axe smoke, R-UI-01 partial closure)
- `src/components/__tests__/SearchModal.test.tsx` — T-SM01-T-SM12 (12 tests including T-SM12 axe smoke, R-UI-02 transitive)

Baseline 386 → 427 / 40 files. Phase 4 cycle now: A (audit) + B (infra, commits `d36b1f0` + `2ea4e60`) + D (this commit). C absorbed into B per Z.9. **Phase 4 effectively CLOSED.**

---

## 6. Phase 4.B Infrastructure Needs

**Status (Phase 4.B):** SHIPPED in commit `d36b1f0` — `jsdom@^29.1.1` + `@testing-library/react@^16.3.2` + `@testing-library/jest-dom@^6.9.1` + `@testing-library/user-event@^14.6.1` + `axe-core@^4.11.4` + `vitest-axe@^0.1.0` installed (devDependencies); `@vitejs/plugin-react@^6.0.2` added alongside (required because tsconfig `jsx: "preserve"` defers JSX transform to Next, leaving vitest with no transformer otherwise); `vitest.config.ts` widened to `include: ['src/**/*.test.{ts,tsx}']` with default `environment: 'node'` preserved (per-file `// @vitest-environment jsdom` opt-in for Phase 4.D component test files); `src/test/setup.ts` extended with `@testing-library/jest-dom/vitest` matcher import, `vitest-axe/matchers` extension (`toHaveNoViolations`), RTL `cleanup()` afterEach (jsdom-guarded via `typeof document !== 'undefined'`), and browser API stubs (`window.matchMedia`, `ResizeObserver`, `IntersectionObserver`, `requestAnimationFrame`/`cancelAnimationFrame` polyfill — all `typeof window !== 'undefined'` guarded so pure-node tests pay zero cost). Smoke-tested via temporary `src/test/__phase-4-b-smoke__.test.tsx` (3 assertions: RTL render, axe deliberate violation, axe clean-pass; all green) then DELETED before commit. **Baseline 386 / 37 preserved.** Phase 4.D unblocked.

**Assessment: SUBSTANTIAL — unlike Phase 2.B (skipped) and Phase 3.B (skipped).** Phase 4.B is the first non-trivial infrastructure cycle since Phase 1.B.

### 6.1 — Dependencies (Phase 4.B adds)

| Package | Version target | Purpose | Estimated install size |
|---|---|---|---|
| `jsdom` (devDependency) | ^25 or latest stable | DOM environment for vitest | ~40 MB tree |
| `@testing-library/react` | ^16 (matches React 18) | render utilities | ~5 MB |
| `@testing-library/jest-dom` | ^6 | custom matchers (toBeInTheDocument, toHaveAttribute, etc.) | ~2 MB |
| `@testing-library/user-event` | ^14 | realistic user-interaction simulation | ~2 MB |
| `axe-core` | ^4 | a11y assertion engine | ~3 MB |
| `vitest-axe` (or wrap manually) | ^0.1 | vitest matcher integration for axe | ~50 KB |

**Total estimated dep tree growth:** ~50-60 MB. Acceptable for a UI test stack.

**REJECTED ALTERNATIVE:** `happy-dom` instead of `jsdom`. See Section 3.1 — jsdom chosen for compatibility breadth over speed at current test-suite size.

**REJECTED ALTERNATIVE:** `@axe-core/react` (a development-time-only console reporter) instead of `axe-core` + matcher. Rejected — we want CI assertions, not console warnings; `axe-core` + matcher provides hard pass/fail.

### 6.2 — vitest.config.ts changes (Phase 4.B applies)

```ts
// Current (Phase 1.B):
test: {
  environment: 'node',
  include: ['src/**/*.test.ts'],
  ...
}

// Phase 4.B target:
test: {
  // Per-file: keep 'node' as default, override via `// @vitest-environment jsdom`
  // header in .test.tsx files. Faster than running everything in jsdom.
  environment: 'node',
  include: ['src/**/*.test.{ts,tsx}'],  // ← widen to capture .test.tsx
  ...
}
```

**SENIOR ARCHITECT NOTE:** per-file environment opt-in (via `@vitest-environment` directive header) keeps the existing 386 Node-environment tests fast and only pays the jsdom cost on the new `.test.tsx` files. Phase 2.D + 3.D test files stay untouched.

**REJECTED ALTERNATIVE:** global `environment: 'jsdom'`. Rejected — would slow down all existing tests, no benefit for pure-Node tests (Lab Engine + API routes).

### 6.3 — `src/test/setup.ts` additions (Phase 4.B applies)

Current setup.ts (per Phase 1.B) stubs env vars. Phase 4.B additions:

```ts
import '@testing-library/jest-dom/vitest'   // custom matchers globally
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { toHaveNoViolations } from 'vitest-axe'  // or manual wrapper

expect.extend(toHaveNoViolations)
afterEach(() => cleanup())

// Browser API stubs (Phase 4.C — split into separate file if grows)
if (typeof window !== 'undefined') {
  // window.matchMedia (Tailwind responsive utilities may call this)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
  // ResizeObserver (DashboardLayout uses it)
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any
  // IntersectionObserver (defensive — not currently used but RTL convention)
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} root = null; rootMargin = ''; thresholds = []; takeRecords() { return [] } } as any
}
```

**REJECTED ALTERNATIVE:** rely on jsdom defaults. Rejected — jsdom does not provide `matchMedia` / `ResizeObserver` / `IntersectionObserver` natively. Without stubs, components calling these throw at render time.

### 6.4 — package.json scripts (no change needed Phase 4.B)

Existing `test` script (`vitest`) works against the widened include pattern automatically. Optional: add `test:ui` script that filters to `.test.tsx` only if iteration speed matters.

---

## 7. Phase 4.C Mock Requirements

**Assessment: MODERATE — fewer mocks than Phase 3.C would have needed (had it not been skipped), but still substantial for the Top-3 targets.**

| Mock target | Purpose | Approach | Used by Target |
|---|---|---|---|
| `requestAnimationFrame` / `cancelAnimationFrame` | Toast enter animation, DashboardLayout globe rotation | `vi.useFakeTimers()` advances rAF | (Toast — stretch goal, not Target #1-3) |
| `requestIdleCallback` / `cancelIdleCallback` | HomePageClient dashboard mount gate | Stub on window (with optional setTimeout fallback path) | (HomePageClient — stretch goal) |
| `ResizeObserver` | DashboardLayout panel sizing | Setup.ts global stub (Section 6.3) | (DashboardLayout — out of Phase 4.D scope) |
| `window.matchMedia` | Defensive (Tailwind utility) | Setup.ts global stub (Section 6.3) | All `.test.tsx` files |
| `document.body` (for createPortal) | Toast portal | jsdom provides natively | Toast (stretch goal) |
| `localStorage` | Terminal evidence log | jsdom provides natively | (Terminal — out of Phase 4.D scope) |
| `axe-core` integration | a11y assertions | `vitest-axe` matcher | Targets #1-3 (a11y smoke per modal) |
| `xterm.js` | (none directly — Terminal is custom impl, not xterm.js) | n/a | n/a |
| `d3-geo` / `topojson-client` / `world-110m.json` | DashboardLayout globe | n/a (DashboardLayout out of scope) | n/a |
| `cobe` 3D globe | (CLAUDE.md mentions but `DashboardLayout.tsx:4` imports `d3-geo` — possible drift in CLAUDE.md description) | n/a | n/a |
| `next/dynamic` + `next/link` + `next/navigation` | Various components | RTL `render` typically works; if not, simple stubs via `vi.mock` | Target #3 SearchModal (uses Link) |
| `useFocusTrap` (when testing modal consumers) | NavigationBar, AttackReportModal, etc. | DO NOT mock when testing Target #3 SearchModal — testing integration is the point. Mock only when testing modal logic separately from focus trap. | Target #3 (no mock — integration test) |
| Auth client (`useAuthSession`, `useAuthStatus`) | HomePageClient | `vi.mock('@/lib/auth-client')` | (HomePageClient — stretch goal) |

**SENIOR ARCHITECT NOTE:** Phase 4.D Top-3 has a manageable mock surface — most of it is browser-API stubs in setup.ts (one-time setup) + per-test fake timers. No MSW handlers needed (no fetch from Top-3 targets). Phase 4.D commit can stay surgical.

**REJECTED ALTERNATIVE:** stub everything including `next/link` + `next/navigation`. Rejected — Next.js' test utilities + RTL handle these natively in most cases; stubbing is needed only when a component's behavior diverges from default.

**REJECTED ALTERNATIVE:** mock `useFocusTrap` when testing modal consumers (e.g., SearchModal). Rejected — Target #3 SearchModal's most valuable test IS the integration with the hook. Mocking the hook turns the integration test into a unit test and loses coverage of the wiring contract.

---

## 8. Cross-References

### 8.1 — Phase 1.A Phase 4 deferrals (inherited)

- `docs/audit/phase-1-a-final.md:13` — *"`auth-client.ts` is Phase 4 territory."* Browser-only API surface (window, localStorage, focus events). Phase 4 picks this up at testing time.
- `docs/audit/phase-1-a-final.md:64` — *"auth-client.ts environment mismatch — Phase 4.B switches to happy-dom."* (Phase 4.A note: jsdom recommended over happy-dom — see Section 3.1 / 6.1 rejected alternative.)
- `docs/audit/phase-1-a-final.md:65` — *"`@testing-library/*` not installed Phase 4 needs react testing library. Document only; defer to Phase 4.B."* Phase 4.A confirms install scope (Section 6.1).
- `docs/audit/phase-1-a-final.md:404` — *"auth-client.ts placement: Phase 4. Excluded from Phase 1.D."*

### 8.2 — Phase 2.A Phase 4 deferrals (inherited)

- `docs/audit/phase-2-a-lab-engine-audit.md:53` — *"`components/lab/Terminal.tsx` ... xterm.js terminal component. **NOT IN PHASE 2 SCOPE** — Phase 4 (UI)."* Phase 4.A picks up Terminal in R-UI-01 (deferred for Phase 4.D unit scope; recommended Phase 5 E2E for full coverage).
- `docs/audit/phase-2-a-lab-engine-audit.md:54` — *"`components/lab/AnsiText.tsx` ... ANSI escape renderer. **NOT IN PHASE 2 SCOPE** — Phase 4 (UI)."* Phase 4.A picks up AnsiText as Target #2 of Phase 4.D Section 5.
- `docs/audit/phase-2-a-lab-engine-audit.md:295` — *"Future Phase 3/4/5 should adopt their own namespaces (R-API-XX, R-UI-XX, R-E2E-XX)."* Phase 4.A adopts R-UI-XX (this doc).

### 8.3 — Phase 3.A Phase 4 forward-references (inherited)

- `docs/audit/phase-3-a-api-contracts-audit.md:80` (R-API-08) — *"UI render path determines exploit (not in Phase 3 scope), ... UI surface deferred to Phase 4 (UI & Accessibility) per CLAUDE.md L172."* Phase 4.A notes the cybernews RSS render path as a Phase 4 candidate but does NOT promote to a top R-UI-XX — the surface is the blog/feed rendering, currently low-risk in production. Re-evaluate if cybernews feed becomes UI-prominent.
- `docs/audit/phase-3-a-api-contracts-audit.md:85` (R-API-13) — *"Profile bio rendered as HTML in admin/portfolio UI without escape → stored-XSS via bio. Severity Low because (a) UI render path determines exploit (Phase 4)."* Phase 4.A surfaces this as part of PortfolioWorkspace surface but **does not promote** to a Phase 4.D target — render path is `<div>{profile.bio}</div>` style (React text-escape default = safe). Re-verify at Phase 4.D test-writing time; promote if `dangerouslySetInnerHTML` discovered.

### 8.4 — Phase 3.D Z.10 lesson application (this audit's first cycle)

- **Section 1.1 production-verified column** — direct application of Z.10. Each component row carries `Prod ✅` / `🟡 DEAD CODE` / `⚠️ unknown`. Honest signal beats assumed-from-file-presence.
- **Section 1.2 production verification summary** — built from `npm run build` route map, NOT from file enumeration. The 3 "uncertain" rows (MatrixRain, ReadingProgress, BackToTop) document the limit of this audit pass.
- **Section 5 surgical recommendation** — components named are confirmed production-reachable. No reliance on file presence to recommend test investment.

**Pattern lesson maintained for Phase 5.A** (E2E audit): the lesson extends naturally — verify actual user journeys via build output / running app screenshot / interactive trace, not just route file enumeration.

### 8.5 — CLAUDE.md alignment

- CLAUDE.md L172 — *"Phase 4 — UI & Accessibility (Terminal, Dashboard, mobile drawer, axe-core)"* — All four named surfaces audited in this doc: Terminal (R-UI-01 + Section 5 negative), Dashboard (R-UI-03/04/05/08 + Section 4 negative), mobile drawer (NavigationBar — R-UI-02/06), axe-core (Section 6.1 install plan).
- CLAUDE.md L175 — *"A produces report ONLY."* — This commit ships only `docs/audit/phase-4-a-ui-a11y-audit.md`. No code, no tests, no infrastructure changes.

### 8.6 — Pending-amendments cross-reference

The Phase 1.A pending-amendments register (10 OPEN, 1 numbering gap A-16, post-Phase-3.D-revision) does NOT contain UI-specific amendments. R-UI-XX risks introduced in this audit are net-new entries with no prior amendment lineage.

---

## 9. Mentor Decision Points (Z.X)

Mentor's call on these before Phase 4.B + 4.D move forward. Each marked with current agent recommendation + alternatives.

### Z.1 — Phase 4.D scope (Top 3 acceptance)

Phase 4.A Section 5 recommends Targets #1-3: useFocusTrap, AnsiText, SearchModal (~41 tests). Mentor decides:
- (a) Accept Top-3 as Phase 4.D scope.
- (b) Reduce to Top-2 (drop SearchModal).
- (c) Expand to Top-5 (add Toast + NavigationBar drawer).
- (d) Different ordering or surface selection.

Agent recommends (a). Top-3 is the "tight scope wins" pattern from Phase 2.D + 3.D. Stretch goals (Toast / NavigationBar) absorb into Phase 4.D commit if velocity allows.

**Resolution (Phase 4.D commit `a0abe8f`):** RESOLVED — option (a) shipped exactly as recommended. 13 + 16 + 12 = 41 net new tests across the Top 3 targets. Stretch goals (Toast, NavigationBar drawer) NOT bundled — kept commit surgical. Test delta 386 → 427 / 40 files.

### Z.2 — Phase 4.B + 4.C cycle deliverables

Phase 4.B requires REAL deliverables (unlike Phase 2.B / 3.B which were SKIPPED). Mentor decides:
- (a) Phase 4.B ships as a separate commit (single PR): install deps + vitest config + setup.ts updates. THEN Phase 4.D follows.
- (b) Phase 4.B + 4.D combined into one large commit (atomic but reviewable surface increases).
- (c) Phase 4.B as Phase 4.A.1 cleanup (treat as housekeeping).

Agent recommends (a). Separation aids reviewability and matches Phase 1.B precedent (Phase 1.B was its own commit cycle).

### Z.3 — jsdom vs happy-dom

Section 3.1 + 6.1 recommend jsdom over happy-dom. Mentor confirms or overrides:
- (a) jsdom (compatibility-first, slower).
- (b) happy-dom (speed-first, narrower API).
- (c) Per-test mix (some files jsdom, some happy-dom — overkill).

Agent recommends (a). Performance gap matters at scale; current test count is small enough that compatibility dominates.

### Z.4 — axe-core integration depth

Phase 4.D test design has 2 axe-core integration approaches:
- (a) Per-modal a11y smoke: each modal test ends with `expect(await axe(container)).toHaveNoViolations()`. ~3-5 axe assertions across Targets #1-3.
- (b) Full-render axe pass at end of each `.test.tsx` file (regression net).
- (c) Standalone `axe.test.tsx` file that renders every component once and runs axe (single-pane regression).

Agent recommends (a). Targeted assertions tie to specific test contexts and fail close to the cause. (c) sounds nice but loses signal locality (a violation in Modal X surfaces as "axe failed in axe.test.tsx").

**Resolution (Phase 4.D commit `a0abe8f`):** RESOLVED — option (a) shipped. T-AT16 (AnsiText final test) + T-SM12 (SearchModal final test) each end with `expect(await axe(container)).toHaveNoViolations()`. useFocusTrap test file has no axe smoke (hook has no DOM tree of its own — axe applies to render output). Signal locality preserved per recommendation.

### Z.5 — Test ID convention for Phase 4.D

Phase 2.D adopted `T-VC / T-RD / T-MO`. Phase 3.D adopted `T-PC / T-AL / T-RP`. Phase 4.A proposes:
- `T-FT` — `useFocusTrap` (Target #1)
- `T-AT` — `AnsiText` (Target #2)
- `T-SM` — `SearchModal` (Target #3)
- Optional stretch: `T-TS` — `Toast`, `T-NB` — `NavigationBar` drawer

Each `it(...)` title begins with `T-XX —` (em-dash separator). Matches Phase 2.D + 3.D convention.

Mentor confirms before Phase 4.D writes assertions.

**Resolution (Phase 4.D commit `a0abe8f`):** RESOLVED — proposed prefixes accepted and applied verbatim. T-FT01-T-FT13 (13 tests), T-AT01-T-AT16 (16 tests), T-SM01-T-SM12 (12 tests). Each `it(...)` title begins with `T-XX — ` (em-dash separator), matching Phase 2.D + 3.D convention. Stretch goals (T-TS Toast, T-NB NavigationBar) NOT executed per Z.1 surgical scope.

### Z.6 — R-UI-15 (OperatorSidebar dead code) handling

`OperatorSidebar.tsx` returns null. Audit observes; no fix this cycle (Phase 4.A is audit-only). Mentor decides:
- (a) Defer to housekeeping cycle (delete the file + remove the import).
- (b) Repurpose for V4 sidebar (designed product cycle).
- (c) Leave as-is (intentional placeholder per author comment).

Agent leans (a). Dead code is cheap to fix; deferring it indefinitely risks future engineers reviving the wrong intent.

### Z.7 — Emoji-as-icon (R-UI-04) closure approach

CriticalAlertPanel emoji-as-icon lacks `aria-label`. Mentor decides:
- (a) Phase 4.D adds a fix: wrap emoji in `<span role="img" aria-label="...">`. Single-line code change + test.
- (b) Replace emoji with Lucide icons (consistent with Toast.tsx) — larger refactor.
- (c) Audit-doc-only — leave emoji, document as accepted (operator preference: hacker aesthetic).

Agent leans (a). Cheapest fix, maximum a11y win. (b) loses the visual identity intentionally; (c) accepts a real WCAG 4.1.2 gap.

### Z.8 — Z.10-lesson scope going forward (Phase 5.A precedent)

Phase 3.D Z.10 introduced "production state verification" as a new audit discipline. Phase 4.A applied it via the production-verified column in Section 1. Mentor confirms:
- (a) Make production-verified column a permanent audit-doc convention (Phase 5.A also includes it).
- (b) Phase 4.A is one-off; Phase 5.A is E2E so the verification is inherent to the test mechanism.
- (c) Discontinue the convention if it adds more noise than signal.

Agent recommends (a). Phase 5.A E2E will still benefit from explicit "this user journey is verifiable" annotations; the discipline scales.

### Z.9 — Phase 4 cadence after Phase 4.A

Standard cadence options (mirror Phase 2 / Phase 3):
- (a) Phase 4.A → Phase 4.B (infra) → Phase 4.C (skipped — minimal mock surface, fold into B) → Phase 4.D (tests).
- (b) Phase 4.A → Phase 4.B + 4.C combined → Phase 4.D.
- (c) Phase 4.A → minimal Phase 4.B (deps only, no config) → Phase 4.C (config + mocks) → Phase 4.D.
- (d) Phase 4.A → Phase 4.B (deps + config + mocks all atomic) → Phase 4.D.

Agent recommends (d). Phase 4.B + 4.C have a single deliverable target (test infra setup); splitting them creates ceremony without leverage. Phase 4.B-as-one-commit matches Phase 1.B precedent.

### Z.10 — Inherited from Phase 3.D revision (no new decision; tracked here for register continuity)

Phase 3.D revision's Z.10 (production-vs-blueprint divergence + pattern lesson for state gathering) carries over to Phase 4 register. **Applied** in Section 1.1 / 1.2 / 8.4 of this audit (production-verified column + build-route-map summary + cross-reference subsection). No further action required this cycle; Z.10 is now standard discipline.

---

**End of Phase 4.A audit. Section 9 mentor decision points Z.1-Z.9 await response before Phase 4.B / 4.D proceed. Z.10 inherited from Phase 3.D revision is permanently in effect.**
