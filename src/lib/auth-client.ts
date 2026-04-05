'use client'

import { useEffect, useState } from 'react'
import type { SessionUser } from '@/lib/soc-types'

export const AUTH_CHANGED_EVENT = 'auth_changed'

export interface AuthSessionState {
  authenticated: boolean
  user: SessionUser | null
}

interface LoginResult {
  ok: boolean
  error?: string
}

const UNAUTH_STATE: AuthSessionState = {
  authenticated: false,
  user: null,
}

let authCache: AuthSessionState | null = null

function dispatchAuthChanged() {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function readAuthStatus(): boolean {
  return authCache?.authenticated ?? false
}

export async function getAuthSession(force = false): Promise<AuthSessionState> {
  if (!force && authCache) return authCache

  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      authCache = UNAUTH_STATE
      return UNAUTH_STATE
    }

    const payload = (await response.json()) as {
      authenticated?: boolean
      user?: SessionUser | null
    }

    authCache = payload.authenticated
      ? {
          authenticated: true,
          user: payload.user ?? null,
        }
      : UNAUTH_STATE
  } catch {
    authCache = UNAUTH_STATE
  }

  return authCache
}

export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: payload.error ?? 'Giris basarisiz.' }
  }

  await getAuthSession(true)
  dispatchAuthChanged()
  return { ok: true }
}

export async function registerWithPassword(input: {
  username: string
  displayName: string
  password: string
  confirmPassword: string
}): Promise<LoginResult> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: payload.error ?? 'Kayit basarisiz.' }
  }

  await getAuthSession(true)
  dispatchAuthChanged()
  return { ok: true }
}

export async function logoutAuth(): Promise<void> {
  // Optimistic UI update for instant feedback
  authCache = UNAUTH_STATE
  dispatchAuthChanged()

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // ignore network failures, state will still reset locally
  }
}

export async function clearAuthUser() {
  await logoutAuth()
}

export function useAuthStatus(initialAuth: boolean | null = null) {
  const [authStatus, setAuthStatus] = useState<boolean | null>(initialAuth)

  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      const session = await getAuthSession()
      if (!cancelled) {
        setAuthStatus(session.authenticated)
      }
    }

    sync()

    const onAuthChanged = () => {
      // Use the already-updated cache — no extra API call needed
      if (!cancelled) {
        setAuthStatus(authCache?.authenticated ?? false)
      }
    }

    const onFocus = () => {
      void sync()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    }
  }, [initialAuth])

  return authStatus
}

export function useAuthSession(initialAuth: boolean | null = null) {
  const [session, setSession] = useState<AuthSessionState | null>(() => {
    if (initialAuth === null) return null
    if (initialAuth) {
      return authCache ?? { authenticated: true, user: null }
    }
    return UNAUTH_STATE
  })

  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      const next = await getAuthSession()
      if (!cancelled) {
        setSession(next)
      }
    }

    sync()

    const onAuthChanged = () => {
      // Use the already-updated cache — no extra API call needed
      if (!cancelled && authCache !== null) {
        setSession(authCache)
      } else if (!cancelled) {
        void sync()
      }
    }

    const onFocus = () => {
      void sync()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    }
  }, [initialAuth])

  return session
}
