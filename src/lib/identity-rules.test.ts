import { isReservedUsername } from './identity-rules'

// Reserved list at time of audit: ['ghost', 'analyst1', 'viewer1']
// Matching: case-insensitive + whitespace-trimmed via normalizeIdentityUsername.

describe('identity-rules', () => {
  describe('isReservedUsername', () => {
    it('T-IR01: ghost is reserved', () => {
      expect(isReservedUsername('ghost')).toBe(true)
    })

    it('T-IR02: GHOST (uppercase) is reserved — case-insensitive matching works', () => {
      // normalizeIdentityUsername applies .toLowerCase() before Set lookup.
      // This is correct behavior; test guards against regression to case-sensitive matching.
      expect(isReservedUsername('GHOST')).toBe(true)
    })

    it('T-IR03: " ghost " (whitespace) is reserved — trimming works', () => {
      // normalizeIdentityUsername applies .trim() before Set lookup.
      // This is correct behavior; test guards against regression where untrimmed
      // input bypasses the reserved check.
      expect(isReservedUsername(' ghost ')).toBe(true)
    })

    it('T-IR04: admin is NOT reserved — gap (R-09)', () => {
      // GAP DOCUMENTATION: the reserved username list contains only 3 demo-account
      // names (ghost, analyst1, viewer1). The identifier `admin` is not reserved,
      // allowing any user to register it.
      //
      // R-09 risk: a user who registers `admin` appears as `admin` in audit logs,
      // report attribution, and any UI that displays the username. This enables
      // impersonation of a privileged authority role without elevated permissions —
      // a social-engineering vector (e.g. "admin says your account is suspended,
      // click here to verify"). Combined with the homoglyph gap (R-10), the attack
      // surface widens further.
      //
      // Suggested additions to RESERVED_USERNAMES for Phase 1.5 hardening:
      // admin, administrator, root, system, support, api, null, undefined,
      // webmaster, postmaster, security, abuse, noreply, no-reply, help.
      //
      // This test asserts CURRENT behavior (not reserved). It will fail
      // intentionally when the list is expanded — that failure is the expected
      // regression signal for Phase 1.5 hardening.
      expect(isReservedUsername('admin')).toBe(false) // gap: R-09
    })

    it('T-IR05: root is NOT reserved — gap (R-09)', () => {
      // GAP DOCUMENTATION: same root cause as T-IR04. `root` is the canonical
      // superuser identity on Unix systems. A user who registers `root` can
      // mislead technically-literate targets into believing they have system-level
      // authority ("root says the server is compromised").
      //
      // R-09: distinct threat surface from `admin` — targets sysadmin/DevOps
      // audience rather than general users. Separate test gives Phase 1.5
      // hardening a separate regression signal for this specific sentinel.
      expect(isReservedUsername('root')).toBe(false) // gap: R-09
    })

    it('T-IR06: support is NOT reserved — gap (R-09)', () => {
      // GAP DOCUMENTATION: same root cause as T-IR04. `support` is the canonical
      // customer-service identity. A user who registers `support` can send messages
      // or file reports that appear to originate from the platform's support team —
      // the primary social-engineering vector for phishing and account-reset fraud.
      //
      // R-09: distinct threat surface from `admin` and `root` — targets non-technical
      // end users who trust "support" as an authoritative source. Separate test gives
      // Phase 1.5 hardening a separate regression signal for this specific sentinel.
      expect(isReservedUsername('support')).toBe(false) // gap: R-09
    })

    it('T-IR07: regularuser is not reserved', () => {
      expect(isReservedUsername('regularuser')).toBe(false)
    })
  })
})
