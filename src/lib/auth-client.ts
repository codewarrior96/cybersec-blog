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
  /**
   * Phase 4.5: structured error code for the unverified-email path. Lets
   * the login form distinguish "wrong credentials" (no code, generic
   * error) from "right credentials, unverified email" (code set), so it
   * can surface the resend-verification affordance.
   */
  code?: 'EMAIL_NOT_VERIFIED'
  /** Email associated with the account, when the server can supply it. */
  email?: string
}

const UNAUTH_STATE: AuthSessionState = {
  authenticated: false,
  user: null,
}

const AUTH_CACHE_TTL_MS = 60_000

let authCache: AuthSessionState | null = null
let authCacheAt = 0

function isCacheFresh(): boolean {
  return authCache !== null && Date.now() - authCacheAt < AUTH_CACHE_TTL_MS
}

function dispatchAuthChanged() {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export function readAuthStatus(): boolean {
  return authCache?.authenticated ?? false
}

export async function getAuthSession(force = false): Promise<AuthSessionState> {
  if (!force && isCacheFresh() && authCache) return authCache

  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    if (!response.ok) {
      authCache = UNAUTH_STATE
      authCacheAt = Date.now()
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
    authCacheAt = Date.now()
  } catch {
    authCache = UNAUTH_STATE
    authCacheAt = Date.now()
  }

  return authCache
}

export async function loginWithPassword(
  username: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember: options.remember !== false }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      message?: string
      email?: string
    }

    // Phase 4.5: surface the EMAIL_NOT_VERIFIED 403 as a structured
    // result so the form can render the resend-verification UI without
    // string-matching the human-readable message.
    if (response.status === 403 && payload.error === 'EMAIL_NOT_VERIFIED') {
      return {
        ok: false,
        code: 'EMAIL_NOT_VERIFIED',
        error: payload.message ?? 'Email henüz doğrulanmamış.',
        email: payload.email ?? '',
      }
    }

    return { ok: false, error: payload.error ?? 'Giris basarisiz.' }
  }

  await getAuthSession(true)
  dispatchAuthChanged()
  return { ok: true }
}

export async function registerWithPassword(input: {
  username: string
  displayName: string
  email: string
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

  // Phase 4.5: register no longer mints a session — the user must verify
  // their email and then log in to authenticate. We deliberately skip
  // getAuthSession(true) and dispatchAuthChanged() here because there is
  // no session to fetch and no auth state to broadcast; firing them would
  // just incur a wasted /api/auth/session round-trip.
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
  } catch (error) {
    // BUG-003.5: surface fetch failures so the focus-refetch revert
    // pattern (Salim's BUG-003 symptom) is diagnosable from the
    // console next time. Optimistic local cache flip already happened
    // above; this catch intentionally does not re-throw or alter
    // state — the server-side desync is what we want to detect, not
    // prevent the local flip.
    console.warn('[auth-client.logoutAuth] fetch failed:', error)
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
