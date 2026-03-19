import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth-shared'
import { getSessionByToken } from '@/lib/soc-store'
import type { RequestMetadata, SessionRecord } from '@/lib/soc-store'

interface CookieReader {
  get(name: string): { value: string } | undefined
}

export async function getServerSessionFromCookies(cookieStore: CookieReader): Promise<SessionRecord | null> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getSessionByToken(token)
}

export async function getServerSessionFromRequest(request: NextRequest): Promise<SessionRecord | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getSessionByToken(token)
}

export function getRequestMetadata(request: NextRequest): RequestMetadata {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress =
    forwardedFor?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent'),
  }
}
