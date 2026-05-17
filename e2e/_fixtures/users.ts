/**
 * Ephemeral test user factory — Wave 4A (Phase 5.C per Z.5).
 *
 * Each call returns a unique user record. Collision-safe for parallel
 * test runs via timestamp + random suffix.
 *
 * Z.11 — `=supabase` mode assumed: production identity persists via
 * Supabase Storage JSON. Ephemeral users created during E2E runs are
 * persisted there too; no cleanup helper is required this cycle
 * (operator decision: ephemeral artifacts accepted in production
 * Storage JSON for now; cleanup task scheduled for a future
 * housekeeping cycle if pollution becomes operationally visible).
 *
 * SENIOR ARCHITECT NOTE: email domain is `e2e.siberlab.dev` —
 * subdomain reserved for test traffic. Real users never receive these
 * addresses; Resend interception (Phase 5.C Z.4) ensures no actual
 * email dispatch.
 *
 * REJECTED ALTERNATIVE: shared seed user (`e2e-test@siberlab.dev`)
 * reset between runs via API. Rejected — Z.5 ephemeral-per-run for
 * full isolation; parallel runs don't contend on shared credentials.
 */

export type EphemeralUser = {
  email: string
  password: string
  username: string
  timestamp: number
}

export function makeEphemeralUser(prefix = 'e2e'): EphemeralUser {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  // Password meets project identity-validation rules: ≥8 chars, mixed
  // case, digit, symbol. Identity-validation.ts password regex is the
  // contract that this fixture must satisfy.
  const password = process.env.TEST_USER_PASSWORD ?? `E2E-Pass-${random}!9`
  return {
    email: `${prefix}-${timestamp}-${random}@e2e.siberlab.dev`,
    password,
    // Username must satisfy USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/
    // (per src/lib/identity-validation.ts). The random suffix is
    // base36 alphanumeric — naturally compliant.
    username: `e2e_${random}`,
    timestamp,
  }
}
