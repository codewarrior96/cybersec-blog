/**
 * Auth flow helper for E2E tests — Wave 4A (Phase 5.C per Z.6).
 *
 * Hybrid storageState pattern (Z.6):
 *   - Happy-path tests (J-2 Lab solve, J-3 portfolio CRUD) reuse a
 *     pre-computed storageState file (`e2e/_storage/operator.json`)
 *     produced by a shared setup test or the first run of
 *     `registerAndLogin`.
 *   - Negative-path tests (J-1 auth bootstrap itself, wrong-credentials)
 *     fresh-login with `registerAndLogin()` per test.
 *
 * SELECTOR PLACEHOLDER WARNING: this helper uses placeholder selectors
 * (label patterns + role patterns) that MAY or MAY NOT match the
 * actual `src/app/login/page.tsx` and `src/app/register/page.tsx` form
 * shapes. Wave 4B (Phase 5.D) test cases will perform state gathering
 * against the actual EmbeddedLogin / EmbeddedRegister components and
 * update the selectors accordingly. This file is INFRASTRUCTURE
 * scaffolding — its callers' tests don't exist yet.
 *
 * SENIOR ARCHITECT NOTE: the registerAndLogin flow has an inherent
 * Resend-server-side-dispatch dependency (see resend-mock.ts header
 * limitation). For Wave 4B, mentor will decide whether to (a) test
 * the verify flow with a test-mode env override on the server, OR (b)
 * skip verify and test only register + login (assuming Supabase auto-
 * verify in test mode).
 *
 * REJECTED ALTERNATIVE: programmatic auth via direct cookie-set
 * (bypassing UI). Rejected — defeats the integration purpose of E2E;
 * we want to test the actual login form's wiring.
 */
import type { Page } from '@playwright/test'
import { makeEphemeralUser, type EphemeralUser } from './users'
import { mockResend, getInterceptedEmails } from './resend-mock'

export type LoggedInContext = {
  user: EphemeralUser
  /**
   * Verification link extracted from the intercepted Resend payload,
   * if the registration flow produced one. May be null in test-mode
   * deployments that auto-verify or that bypass Resend entirely.
   */
  verificationLink: string | null
}

/**
 * Full register → verify → login flow against the current baseURL.
 *
 * Used by Wave 4B test cases. The selectors below are PLACEHOLDERS
 * pending Wave 4B state gathering against actual EmbeddedLogin /
 * EmbeddedRegister components.
 */
export async function registerAndLogin(
  page: Page,
  user?: EphemeralUser,
): Promise<LoggedInContext> {
  const ephemeralUser = user ?? makeEphemeralUser()
  await mockResend(page)

  // 1) Register
  // Selectors are placeholder — Wave 4B confirms against actual form.
  await page.goto('/register')
  await page.getByLabel(/e-?mail|e-?posta/i).fill(ephemeralUser.email)
  await page.getByLabel(/username|kullanıcı adı/i).fill(ephemeralUser.username)
  await page.getByLabel(/password|parola|şifre/i).first().fill(ephemeralUser.password)
  await page.getByRole('button', { name: /kayıt|register|sign up/i }).click()

  // 2) Wait briefly for async dispatch to Resend (client-side intercept
  // captures the payload). Real wait time depends on Vercel cold-start;
  // 1000ms is a conservative ceiling for warm responses.
  await page.waitForTimeout(1_000)

  // 3) Extract verification link from intercepted Resend payload
  // (works only if server-side Resend POST goes through page.route,
  // which it doesn't — see resend-mock.ts header limitation. This
  // path is the FUTURE-READY shape for when a test-mode override is
  // wired. Until then, verificationLink will be null in real runs.)
  const emails = await getInterceptedEmails(page)
  const verifyEmail = emails.find((e) => /verify|doğrula/i.test(e.subject ?? ''))
  const linkMatch = verifyEmail?.html?.match(
    /https?:\/\/[^\s"<]+\/verify[^\s"<]*/,
  )
  const verificationLink = linkMatch?.[0] ?? null

  // 4) Visit verify link (if captured)
  if (verificationLink) {
    await page.goto(verificationLink)
    // Verify page auto-redirects to /login after 3s via meta refresh
    await page.waitForURL('**/login', { timeout: 10_000 }).catch(() => {
      // If meta refresh is suppressed in headless mode, navigate manually
    })
  }

  // 5) Login
  await page.goto('/login')
  await page.getByLabel(/username|kullanıcı adı/i).fill(ephemeralUser.username)
  await page.getByLabel(/password|parola|şifre/i).fill(ephemeralUser.password)
  await page.getByRole('button', { name: /giriş|login|sign in/i }).click()

  return { user: ephemeralUser, verificationLink }
}
