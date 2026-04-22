import type { NextRequest } from 'next/server'

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV6_RE = /^[0-9a-fA-F:]+$/

function isValidIp(value: string): boolean {
  if (!value) return false
  if (IPV4_RE.test(value)) {
    return value.split('.').every((octet) => {
      const n = Number(octet)
      return Number.isInteger(n) && n >= 0 && n <= 255
    })
  }
  if (value.includes(':') && IPV6_RE.test(value)) {
    return value.length <= 45
  }
  return false
}

function trustProxy(): boolean {
  const flag = process.env.TRUST_PROXY_HEADERS
  if (flag === '0' || flag === 'false') return false
  if (flag === '1' || flag === 'true') return true
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
}

export function getClientIp(request: NextRequest): string {
  if (trustProxy()) {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      const first = forwardedFor.split(',')[0]?.trim()
      if (first && isValidIp(first)) return first
    }
    const realIp = request.headers.get('x-real-ip')?.trim()
    if (realIp && isValidIp(realIp)) return realIp
  }

  const remote = (request as NextRequest & { ip?: string }).ip
  if (typeof remote === 'string' && isValidIp(remote)) return remote

  return 'unknown'
}
