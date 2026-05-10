import type { UserRole } from './soc-types'
import { hasRoleAtLeast, canWriteAlerts } from './auth-shared'

describe('auth-shared', () => {
  // ─── Role hierarchy ──────────────────────────────────────────────────────────
  // ROLE_ORDER = ['viewer', 'analyst', 'admin'] → admin (index 2) is highest.
  // hasRoleAtLeast uses indexOf comparison; security-critical for RBAC checks
  // across every alert/report/profile/admin route.

  describe('hasRoleAtLeast (role hierarchy)', () => {
    it('T-AS01: admin satisfies hasRoleAtLeast("viewer") — top role covers lowest', () => {
      expect(hasRoleAtLeast('admin', 'viewer')).toBe(true)
    })

    it('T-AS02: admin satisfies hasRoleAtLeast("analyst") — top role covers middle', () => {
      expect(hasRoleAtLeast('admin', 'analyst')).toBe(true)
    })

    it('T-AS03: admin satisfies hasRoleAtLeast("admin") — equality boundary', () => {
      // SENIOR ARCHITECT NOTE: indexOf comparison uses `>=` not `>`, so equality
      // (admin === admin, analyst === analyst, viewer === viewer) MUST satisfy.
      // Regression guard: a future refactor that swaps `>=` for `>` would break
      // every "user X can perform action requiring role X" check.
      // REJECTED ALTERNATIVE: also assert analyst===analyst and viewer===viewer here.
      // Rejected — audit specifies one equality probe per ID; T-AS03 covers admin
      // which is the highest-impact equality (admin-only routes).
      expect(hasRoleAtLeast('admin', 'admin')).toBe(true)
    })

    it('T-AS04: analyst does NOT satisfy hasRoleAtLeast("admin") — privilege escalation blocked', () => {
      // SENIOR ARCHITECT NOTE: this is the OWASP A01 (Broken Access Control)
      // primary defense — a lower-role user must NOT pass an admin-required check.
      // Direct regression target: every analyst-vs-admin gate (user management,
      // role assignment, deletion) depends on this returning false.
      expect(hasRoleAtLeast('analyst', 'admin')).toBe(false)
    })

    it('T-AS05: viewer does NOT satisfy hasRoleAtLeast("analyst") — privilege escalation blocked', () => {
      // SENIOR ARCHITECT NOTE: viewer→analyst is the read-only-vs-write boundary.
      // A viewer passing an analyst check would allow alert creation/mutation by
      // unauthorized accounts. Direct regression target: /api/alerts POST/PATCH.
      expect(hasRoleAtLeast('viewer', 'analyst')).toBe(false)
    })
  })

  // ─── canWriteAlerts ──────────────────────────────────────────────────────────
  // Direct permission helper used by alert creation/mutation routes. Equivalent to
  // hasRoleAtLeast('analyst') but lives as a named helper for call-site clarity.

  describe('canWriteAlerts (alert write permission)', () => {
    it('T-AS06: canWriteAlerts("admin") === true', () => {
      expect(canWriteAlerts('admin')).toBe(true)
    })

    it('T-AS07: canWriteAlerts("analyst") === true', () => {
      expect(canWriteAlerts('analyst')).toBe(true)
    })

    it('T-AS08: canWriteAlerts("viewer") === false — viewer is read-only', () => {
      // SENIOR ARCHITECT NOTE: viewer must remain write-locked across ALL alert
      // mutation paths. canWriteAlerts is the gate-keeper helper; if a future
      // refactor accidentally adds 'viewer' to the allow expression, every viewer
      // account could create/edit alerts. This test is the regression tripwire.
      expect(canWriteAlerts('viewer')).toBe(false)
    })
  })

  // ─── Defensive default for unknown role ──────────────────────────────────────

  describe('hasRoleAtLeast — defensive default', () => {
    it('T-AS09: unknown role string defaults to no permission (OWASP A01 defense-in-depth)', () => {
      // SENIOR ARCHITECT NOTE: OWASP A01 (Broken Access Control) — when a role
      // string arrives from an attacker-controlled source (session tampering,
      // direct cookie edit, MITM-injected JWT claim), an UNRECOGNIZED value
      // MUST default to "no permission," never "all permissions" and never throw.
      //
      // Attack vector: attacker overwrites session role field with a string the
      // app does not recognize ('hacker', 'superuser', 'root', '__proto__', etc.).
      // Without this defense, naive comparisons (e.g. role !== 'viewer' → grant)
      // could escalate privilege. With this defense, the request is denied.
      //
      // Protection mechanism: ROLE_ORDER.indexOf(unknownRole) returns -1, and
      // -1 >= ROLE_ORDER.indexOf(validRequired) is false for any valid required
      // role (indices 0/1/2). This relies on indexOf's contract — a future
      // refactor to Map.get/Set.has/custom hierarchy comparator could silently
      // break this guard if the new lookup returns 0 or undefined for misses.
      //
      // REJECTED ALTERNATIVE: expect throw. Throwing exposes implementation
      // details via 500 error pages and enables timing/error-message enumeration.
      // Silent false is the OWASP-aligned safer default.
      //
      // Regression guard: if this test ever fails, the access-control core is
      // compromised — investigate immediately, do not patch the test.
      expect(hasRoleAtLeast('hacker' as UserRole, 'viewer')).toBe(false)
    })
  })
})
