import { http, HttpResponse } from 'msw'

// SENIOR ARCHITECT NOTE: Phase 1.C will add override variants (network error, 401, 500,
// missing id, slow response) per audit Section 4. Phase 1.B ships only the success default
// so the setup file's beforeAll lifecycle can be smoke-tested.
// REJECTED ALTERNATIVE: Ship all variants now — Phase 1.B is infrastructure-only;
// variants are Phase 1.C scope.
export const resendHandlers = [
  http.post('https://api.resend.com/emails', () => {
    return HttpResponse.json({ data: { id: 'test-email-id-default' }, error: null })
  }),
]
