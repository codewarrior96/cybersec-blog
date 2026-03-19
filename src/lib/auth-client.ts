'use client'

import { useEffect, useState } from 'react'
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_STORAGE_KEY, AUTH_USER } from '@/lib/auth-shared'

export const AUTH_CHANGED_EVENT = 'auth_changed'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!raw) return null
  return decodeURIComponent(raw.slice(prefix.length))
}

function writeAuthCookie(user: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_STORAGE_KEY}=${encodeURIComponent(user)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function readAuthStatus(): boolean {
  if (typeof window === 'undefined') return false
  const local = window.localStorage.getItem(AUTH_STORAGE_KEY)
  const cookie = readCookie(AUTH_STORAGE_KEY)
  const localAuthed = local === AUTH_USER
  const cookieAuthed = cookie === AUTH_USER

  // Keep both client stores in sync for consistent refresh behavior.
  if (localAuthed && !cookieAuthed) writeAuthCookie(AUTH_USER)
  if (!localAuthed && cookieAuthed) window.localStorage.setItem(AUTH_STORAGE_KEY, AUTH_USER)

  return localAuthed || cookieAuthed
}

export function setAuthUser(user: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_STORAGE_KEY, user)
  writeAuthCookie(user)
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function clearAuthUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  clearAuthCookie()
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function useAuthStatus(initialAuth: boolean | null = null) {
  const [authStatus, setAuthStatus] = useState<boolean | null>(initialAuth)

  useEffect(() => {
    const sync = () => setAuthStatus(readAuthStatus())
    const onAuthChanged = () => sync()

    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    document.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    }
  }, [])

  return authStatus
}
