export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32
export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 120
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 256
export const EMAIL_MAX_LENGTH = 254 // RFC 5321 path-length cap

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/

// RFC 5322 lite: local@domain.tld with TLD ≥ 2 chars, no spaces, single @.
// Intentionally simple — pathological-but-valid addresses are accepted; the
// authoritative validity check is whether the verification email arrives.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isAllowedUsername(username: string): boolean {
  return USERNAME_RE.test(username)
}

export function getUsernameFormatError(): string {
  return 'Kullanici adi 3-32 karakter olmali ve sadece harf, rakam, nokta, tire veya alt cizgi icermeli.'
}

export function getDisplayNameError(): string {
  return `Gorunen ad ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} karakter arasi olmali.`
}

export function getPasswordError(): string {
  return `Sifre ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter arasi olmali.`
}

export function getEmailFormatError(): string {
  return 'Gecerli bir email adresi girin.'
}

export function isValidDisplayName(value: string): boolean {
  return value.length >= DISPLAY_NAME_MIN_LENGTH && value.length <= DISPLAY_NAME_MAX_LENGTH
}

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
}

export function isValidEmail(value: string): boolean {
  if (value.length > EMAIL_MAX_LENGTH) return false
  return EMAIL_RE.test(value)
}

export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Trim + lowercase + format-check. Returns the canonical form on success.
 * Caller can compare the returned `value` directly with stored `emailKey`
 * for uniqueness lookups.
 */
export function validateEmail(input: string): ValidateResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: getEmailFormatError() }
  }
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) {
    return { ok: false, error: getEmailFormatError() }
  }
  if (!isValidEmail(trimmed)) {
    return { ok: false, error: getEmailFormatError() }
  }
  return { ok: true, value: trimmed }
}
