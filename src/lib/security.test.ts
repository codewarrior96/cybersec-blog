import { hashPassword, verifyPassword } from './security'

describe('security', () => {
  describe('hashPassword', () => {
    it('T-S01: hashPassword returns salt:hash with 32-char salt hex', () => {
      const result = hashPassword('somepassword')
      const [saltHex, hashHex] = result.split(':')
      expect(saltHex).toHaveLength(32)
      expect(hashHex).toHaveLength(128)
      expect(result).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    })

    it('T-S08: two hashes of same password produce different salts', () => {
      const hash1 = hashPassword('samepassword')
      const hash2 = hashPassword('samepassword')
      const salt1 = hash1.split(':')[0]
      const salt2 = hash2.split(':')[0]
      expect(salt1).not.toBe(salt2)
    })
  })

  describe('verifyPassword', () => {
    it('T-S02: verifyPassword returns true for correct password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('correctpassword', hash)).toBe(true)
    })

    it('T-S03: verifyPassword returns false for wrong password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('wrongpassword', hash)).toBe(false)
    })

    it('T-S04: verifyPassword returns false for empty stored hash', () => {
      expect(verifyPassword('anypassword', '')).toBe(false)
    })

    it('T-S05: verifyPassword returns false for hash without colon separator', () => {
      expect(verifyPassword('anypassword', 'noseparatorhere')).toBe(false)
    })

    it('T-S06: verifyPassword returns false for non-hex salt', () => {
      // Non-hex salt causes Buffer.from to produce unexpected bytes or throw;
      // the catch block returns false either way.
      expect(verifyPassword('anypassword', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:abcd')).toBe(false)
    })

    it('T-S07: verifyPassword returns false for empty password', () => {
      const hash = hashPassword('correctpassword')
      expect(verifyPassword('', hash)).toBe(false)
    })

    it('T-S09: truncated hashHex passes verification — L19 length guard is dead code (gap, R-07)', () => {
      // GAP DOCUMENTATION: audit assumed verifyPassword returns false for a truncated
      // stored hash. Actual behavior: scryptSync(password, salt, expected.length) always
      // produces exactly expected.length bytes, so actual.length === expected.length always.
      // L19 (`if (actual.length !== expected.length) return false`) is therefore unreachable
      // dead code in this implementation.
      //
      // Consequence: a truncated hash is accepted as valid — the first N bytes of the scrypt
      // output match the first N bytes stored. This is a real gap: an attacker who can write
      // a shortened hash to storage can authenticate with any password whose first-N-byte
      // scrypt output matches. Requires prior storage write access (not a remote vector), but
      // is worth tracking for the hardening backlog.
      //
      // This test asserts the CURRENT behavior (true) as a regression guard. If a future
      // refactor switches to scryptSync(password, salt, SCRYPT_KEY_LENGTH) and then
      // compares against the stored hash, a length mismatch would correctly return false —
      // and this test would catch the regression in either direction.
      const hash = hashPassword('somepassword')
      const [saltHex, hashHex] = hash.split(':')
      const truncated = `${saltHex}:${hashHex.slice(0, -8)}`
      expect(verifyPassword('somepassword', truncated)).toBe(true) // gap: should be false
    })
  })
})
