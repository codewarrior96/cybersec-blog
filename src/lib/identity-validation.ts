export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32
export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 120
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 256

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/

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

export function isValidDisplayName(value: string): boolean {
  return value.length >= DISPLAY_NAME_MIN_LENGTH && value.length <= DISPLAY_NAME_MAX_LENGTH
}

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
}
