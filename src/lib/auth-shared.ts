import type { UserRole } from '@/lib/soc-types'

export const SESSION_COOKIE_NAME = 'soc_session'
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const ROLE_ORDER: UserRole[] = ['viewer', 'analyst', 'admin']

export function hasRoleAtLeast(role: UserRole, required: UserRole) {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(required)
}

export function canWriteAlerts(role: UserRole) {
  return role === 'admin' || role === 'analyst'
}
