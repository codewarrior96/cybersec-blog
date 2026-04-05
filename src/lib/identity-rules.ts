const RESERVED_USERNAMES = new Set(['ghost', 'analyst1', 'viewer1'])

export function normalizeIdentityUsername(username: string) {
  return username.trim().toLowerCase()
}

export function isReservedUsername(username: string) {
  return RESERVED_USERNAMES.has(normalizeIdentityUsername(username))
}

export function getReservedUsernameError() {
  return 'Bu kullanici adi kullanima kapali.'
}

