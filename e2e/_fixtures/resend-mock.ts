/**
 * Resend API interception fixture — Wave 4A (Phase 5.C per Z.4).
 *
 * Installs `page.route()` handler that intercepts ALL Resend API calls
 * and stores payloads for later assertion. Real emails are never sent
 * during E2E runs — critical for production-baseline tests against
 * siberlab.dev (Z.10) where uncontrolled email dispatch would spam
 * the verified noreply@siberlab.dev domain.
 *
 * Pattern: page.route() runs CLIENT-SIDE in the browser context. The
 * server (Vercel-deployed siberlab.dev) attempts the real Resend POST
 * but the browser intercepts the request before it leaves the page.
 *
 * IMPORTANT LIMITATION: this approach only works for browser-initiated
 * Resend calls. Server-side fetch from Next.js route handlers
 * (src/lib/email.ts) bypasses page.route() — those calls happen on
 * Vercel's server, not in the browser. For E2E tests that need to
 * intercept SERVER-SIDE Resend calls, two options exist:
 *   (1) Run Playwright against `npm run dev` (local) with a server-
 *       side env override that swaps Resend client for a test sink
 *   (2) Use a test-mode env var (e.g., RESEND_API_KEY=test) that
 *       configures Resend SDK to a sandbox/replay mode
 * For Wave 4A scope: we ship the interception helper. Wave 4B test
 * design will decide whether to (a) test verify flow against the
 * test-mode env override, (b) skip verify and test direct API path,
 * or (c) something else.
 *
 * SENIOR ARCHITECT NOTE: the typed-extension pattern (`PageWithIntercepts`)
 * attaches state to the Page instance for retrieval. Playwright's
 * test fixture system has its own state-passing pattern (fixture
 * functions), but page-level attachment keeps the helper simple and
 * compatible with raw `test()` blocks that don't use fixtures.
 *
 * REJECTED ALTERNATIVE: maildev/MailHog local SMTP catcher. Rejected
 * per Z.4 — adds external service dependency, increases CI complexity.
 * REJECTED ALTERNATIVE: test-only env var swap. Deferred to Wave 4B
 * (decision: hybrid? or interception-only?).
 */
import type { Page } from '@playwright/test'

export type InterceptedResendEmail = {
  to: string | string[]
  subject?: string
  html?: string
  text?: string
  timestamp: number
}

type PageWithIntercepts = Page & {
  _resendIntercepts?: InterceptedResendEmail[]
}

export async function mockResend(page: Page): Promise<void> {
  const typedPage = page as PageWithIntercepts
  typedPage._resendIntercepts = []
  // Match Resend API endpoints: /emails, /domains, /api-keys. The
  // glob captures the production base + any path under it.
  await page.route('**/api.resend.com/**', async (route) => {
    const request = route.request()
    try {
      const body = request.postDataJSON()
      typedPage._resendIntercepts?.push({
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        timestamp: Date.now(),
      })
    } catch {
      // Body parse failed (non-JSON or empty); intercept without payload
    }
    // Respond as Resend would — synthetic id matches real shape
    // (resend returns { id: 'uuid' } on success).
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: `mocked-email-${Date.now()}` }),
    })
  })
}

export async function getInterceptedEmails(page: Page): Promise<InterceptedResendEmail[]> {
  return (page as PageWithIntercepts)._resendIntercepts ?? []
}

export async function clearInterceptedEmails(page: Page): Promise<void> {
  const typedPage = page as PageWithIntercepts
  if (typedPage._resendIntercepts) {
    typedPage._resendIntercepts.length = 0
  }
}
