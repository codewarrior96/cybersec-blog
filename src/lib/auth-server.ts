import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getClientIp } from '@/lib/client-ip'
import { getSessionByToken } from '@/lib/soc-store-adapter'
import type { RequestMetadata, SessionRecord } from '@/lib/soc-store-adapter'

interface CookieReader {
  get(name: string): { value: string } | undefined
}

async function safelyGetSessionByToken(token: string): Promise<SessionRecord | null> {
  try {
    return await getSessionByToken(token)
  } catch (error) {
    console.error('[auth-server] Session lookup failed:', error)
    return null
  }
}

export async function getServerSessionFromCookies(cookieStore: CookieReader): Promise<SessionRecord | null> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return safelyGetSessionByToken(token)
}

export async function getServerSessionFromRequest(request: NextRequest): Promise<SessionRecord | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return safelyGetSessionByToken(token)
}

export function getRequestMetadata(request: NextRequest): RequestMetadata {
  const ip = getClientIp(request)
  return {
    ipAddress: ip === 'unknown' ? null : ip,
    userAgent: request.headers.get('user-agent'),
  }
}
