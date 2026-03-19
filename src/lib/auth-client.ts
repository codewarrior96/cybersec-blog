'use client'

import { useEffect, useState } from 'react'

export const AUTH_STORAGE_KEY = 'auth_user'
export const AUTH_USER = 'ghost'
export const AUTH_CHANGED_EVENT = 'auth_changed'

export function readAuthStatus(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === AUTH_USER
}

export function setAuthUser(user: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_STORAGE_KEY, user)
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function clearAuthUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function useAuthStatus() {
  const [authStatus, setAuthStatus] = useState<boolean | null>(null)

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
