import { http, HttpResponse, delay } from 'msw'

const RESEND_URL = 'https://api.resend.com/emails'

// SENIOR ARCHITECT NOTE: Phase 1.C will add override variants (network error, 401, 500,
// missing id, slow response) per audit Section 4. Phase 1.B ships only the success default
// so the setup file's beforeAll lifecycle can be smoke-tested.
// REJECTED ALTERNATIVE: Ship all variants now — Phase 1.B is infrastructure-only;
// variants are Phase 1.C scope.
export const resendHandlers = [
  http.post(RESEND_URL, () => {
    return HttpResponse.json({ data: { id: 'test-email-id-default' }, error: null })
  }),
]

// SENIOR ARCHITECT NOTE: variants are factory functions (not pre-instantiated handlers)
// because MSW handlers are stateful — they track call counts and once-vs-many semantics.
// A factory ensures each test gets a fresh handler instance.
// REJECTED ALTERNATIVE: pre-instantiated handler constants — rejected because reuse across
// tests can cause subtle state leaks even with resetHandlers.
//
// SENIOR ARCHITECT NOTE: `apiError` returns HTTP 200 with `error` field set because that
// is Resend's actual error pattern — they distinguish HTTP-level failures (4xx/5xx) from
// API-level validation failures (200 + error body). Both must be mocked separately to
// exercise email.ts's full failure surface.
// REJECTED ALTERNATIVE: use 422 for validation errors — rejected because Resend's actual
// API returns 200 with an error payload for these cases.
export const resendOverrides = {
  networkError: () =>
    http.post(RESEND_URL, () => {
      return HttpResponse.error()
    }),

  unauthorized: () =>
    http.post(RESEND_URL, () => {
      return HttpResponse.json(
        { name: 'unauthorized', message: 'Invalid API key', statusCode: 401 },
        { status: 401 },
      )
    }),

  serverError: () =>
    http.post(RESEND_URL, () => {
      return HttpResponse.json(
        { name: 'internal_server_error', message: 'Server error', statusCode: 500 },
        { status: 500 },
      )
    }),

  apiError: () =>
    http.post(RESEND_URL, () => {
      return HttpResponse.json({
        data: null,
        error: { name: 'validation_error', message: 'Invalid recipient' },
      })
    }),

  missingId: () =>
    http.post(RESEND_URL, () => {
      return HttpResponse.json({ data: {}, error: null })
    }),

  slow: () =>
    http.post(RESEND_URL, async () => {
      await delay(3000)
      return HttpResponse.json({ data: { id: 'test-email-id-slow' }, error: null })
    }),
}
