// Wave 4B Phase 5.D — J-3 Portfolio cert CRUD (R-E2E-03 PARTIAL closure)
//
// /portfolio is server-side gated via `redirect('/login')` in
// `src/app/portfolio/page.tsx` (BUG-006 closure family — same pattern
// as /academy layout, formerly /community per A-26 Wave 12 rename).
// Anonymous users cannot reach the workspace.
//
// Yol A constraint (Phase 5.A Z.12): ephemeral user cannot verify
// email → cannot log in → cannot reach /portfolio. R-E2E-03 PARTIAL
// CLOSURE: anon-redirect contract tested; certification CRUD round-
// trip (which would exercise Z.11 Supabase Storage JSON persistence
// path end-to-end) skipped pending Phase 6 operational decision.
//
// SENIOR ARCHITECT NOTE: Phase 3.D shipped T-PC01-20 (20 tests) for
// the /api/profile/certifications route handlers — IDOR closure +
// adapter contracts covered at unit level. The Phase 5.D layer we're
// skipping is the BROWSER-DRIVEN round-trip (form fill → submit →
// reload → persistence verified). That's the Z.11 Supabase Storage
// JSON contract verification — preserved as future-cycle work.

import { test, expect } from '@playwright/test'

test.describe('J-3 Portfolio cert CRUD — R-E2E-03 PARTIAL closure', () => {
  test('T-E3-01 — anonymous /portfolio redirects to /login (BUG-006 server-side gate)', async ({ page }) => {
    await page.goto('/portfolio')
    expect(page.url()).toContain('/login')
    await expect(page.getByPlaceholder('Kullanıcı adınızı giriniz')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('T-E3-02 — anonymous /portfolio?tab=certifications also redirects (tab param preserved on retry but gate fires first)', async ({ page }) => {
    // The tab=certifications query parameter is read inside the
    // server component AFTER the session gate. Anonymous users hit
    // the redirect regardless of tab. This locks the contract that
    // the gate runs BEFORE param-driven branching.
    await page.goto('/portfolio?tab=certifications')
    expect(page.url()).toContain('/login')
  })

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('T-E3-03 — portfolio workspace renders certifications tab (SKIPPED: Yol A — auth-gated)', async () => {
    // BLOCKED: same dependency as J-2. Pre-verified user setup
    // pending Phase 6. Phase 3.D T-PC01-20 covers the API contract
    // at unit level — the E2E layer this skip leaves uncovered is
    // the browser-rendered form integration.
  })

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('T-E3-04 — add certification → Supabase Storage JSON persistence verified on reload (SKIPPED: Yol A)', async () => {
    // Z.11 critical verification: cross-session persistence via
    // Storage JSON path is the production-realistic contract. Deferred
    // to verified-user setup.
  })

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('T-E3-05 — edit certification persists across reload (SKIPPED: Yol A)', async () => {
    // CRUD update path — same dependency.
  })

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('T-E3-06 — delete certification confirmation modal + cascade (SKIPPED: Yol A)', async () => {
    // Delete + DeleteAccountModal pattern (Phase 4.A R-UI-02 modal
    // surface uses useFocusTrap). Modal a11y is unit-tested via
    // T-FT01-13 (Phase 4.D). E2E layer deferred.
  })
})
