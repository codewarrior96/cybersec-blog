import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEY_LENGTH = 64

// R-21 hardening (Phase 1.5.4 <COMMIT_HASH_TBD>): hash storage integrity
// invariant. Every stored credential must match this exact shape — 32 hex
// chars of salt, colon, 128 hex chars of scrypt-derived hash (64 bytes,
// SCRYPT_KEY_LENGTH). Truncated or malformed storage triggers fail-loud
// at write time (hashPassword self-validates its output) and silent
// reject at read time (verifyPassword's assertion throw caught by
// try-catch → returns false, semantically equivalent to "wrong password").
//
// SENIOR ARCHITECT NOTE: the invariant is keyed off SCRYPT_KEY_LENGTH so a
// future cost-parameter change (R-07 future fix cycle) that adjusts the
// key length would surface immediately at hashPassword self-validation —
// the regex would need to update too, forcing a deliberate review rather
// than a silent drift.
//
// REJECTED ALTERNATIVE: validate by length numerics (saltHex.length === 32
// && hashHex.length === 128). Rejected because regex enforces BOTH length
// AND character class ([0-9a-f]) in one assertion. A length-only check
// would accept e.g. uppercase hex (Buffer.from accepts uppercase silently,
// but hashPassword emits lowercase), opening drift between hashPassword
// output and accepted storage formats.
const HASH_FORMAT_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/

function assertHashFormat(hash: string): void {
  if (!HASH_FORMAT_RE.test(hash)) {
    // Truncated preview in the error message — never log the full hash
    // (it's a credential derivative). First 8 chars + ellipsis is enough
    // to diagnose obvious format issues (empty, wrong length, wrong
    // charset) without leaking the credential.
    const preview = hash.length > 8 ? `${hash.slice(0, 8)}...` : hash
    throw new Error(
      `[security] hash format invariant violated: expected ${HASH_FORMAT_RE}, got "${preview}" (length=${hash.length})`,
    )
  }
}

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
  const result = `${salt.toString('hex')}:${derived.toString('hex')}`
  // R-21 write-time guard (Phase 1.5.4 <COMMIT_HASH_TBD>): self-validate
  // output before return. Tautological in steady state — randomBytes(16)
  // → 32 hex, scryptSync(...64) → 128 hex always — so this assertion
  // cannot fail unless hashPassword's own internals regress. Its job is
  // exactly that: a forward-defense tripwire that fires instantly on
  // any future change that breaks the storage contract (e.g., salt size
  // change, encoding swap, accidental version prefix). Pairs with the
  // read-time guard in verifyPassword for defense-in-depth.
  assertHashFormat(result)
  return result
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':')
  if (!saltHex || !hashHex) return false

  try {
    // R-21 read-time guard (Phase 1.5.4 <COMMIT_HASH_TBD>): reject any
    // stored hash that doesn't match the canonical
    // /^[0-9a-f]{32}:[0-9a-f]{128}$/ shape BEFORE the scrypt derive
    // step. Without this, a truncated stored hash would let
    // scryptSync derive output to the truncated expected.length, the
    // dead-code length check (two lines down) would trivially pass,
    // and timingSafeEqual would compare only the truncated bytes —
    // allowing any password whose first-N-byte scrypt output matches
    // the truncated prefix to authenticate.
    //
    // Assertion throw is caught by the surrounding try-catch and the
    // function returns false — silent reject, semantically equivalent
    // to "wrong password" from the caller POV. No new error path; no
    // signal to attackers about WHY auth failed (timing parity with
    // R-04's DUMMY_PASSWORD_HASH path also preserved — both routes
    // through this same try-block).
    assertHashFormat(storedHash)
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
