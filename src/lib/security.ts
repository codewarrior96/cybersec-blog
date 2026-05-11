import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEY_LENGTH = 64

// R-04 hardening (Phase 1.5.3): precomputed dummy hash for authentication
// timing equalization. authenticateUser implementations call
// verifyPassword(input, DUMMY_PASSWORD_HASH) when the username lookup
// misses, forcing the unknown-user branch to consume the same ~50ms
// scrypt CPU cost as the matched-user branch. Without this, response
// time differential (~50ms vs ~1ms) leaks account existence — A07
// username enumeration. Industry standard (Django auth, Rails
// has_secure_password) — always-runs scrypt makes both paths take
// the same amount of CPU work, robust to deployment environment
// variance.
//
// SENIOR ARCHITECT NOTE: computed once at module load via scryptSync
// against a fixed zero-byte salt + fixed sentinel password. One-time
// ~50ms cost at first import amortizes to zero across the process
// lifetime. The format ${saltHex}:${hashHex} matches the contract
// verifyPassword expects (split-on-colon, both halves non-empty hex),
// so the parse-step short-circuit in verifyPassword is never hit and
// the scrypt invocation IS reached on every dummy-verify call.
//
// REJECTED ALTERNATIVE: hardcode the hash as a string literal. Rejected
// because computing at load couples the dummy hash parameters
// (SCRYPT_KEY_LENGTH) to the hashPassword/verifyPassword primitives —
// a future SCRYPT_KEY_LENGTH change updates the dummy hash too, no
// drift. Also forbidden per Phase 1.5.3 brief Section 9 ("hardcoded
// literal yok").
const DUMMY_SALT = Buffer.alloc(16, 0)
const DUMMY_DERIVED = scryptSync(
  'siberlab-r04-dummy-password',
  DUMMY_SALT,
  SCRYPT_KEY_LENGTH,
)
export const DUMMY_PASSWORD_HASH = `${DUMMY_SALT.toString(
  'hex',
)}:${DUMMY_DERIVED.toString('hex')}`

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':')
  if (!saltHex || !hashHex) return false

  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
