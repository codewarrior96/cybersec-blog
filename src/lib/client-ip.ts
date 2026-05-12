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
  // R-01 hardening (Phase 1.5.5 <COMMIT_HASH_TBD>): explicit-opt-in only.
  // Previously this returned true when VERCEL=1 OR NODE_ENV=production —
  // an implicit auto-trust that exposed every production deployment (AWS,
  // DigitalOcean, VPS, bare-metal, self-hosted) to X-Forwarded-For
  // spoofing without operator awareness. A-03 documented the scope
  // mismatch: audit framed R-01 as "Vercel-specific," but the actual
  // gap affected all NODE_ENV=production deployments.
  //
  // Post-fix: trust is granted ONLY when TRUST_PROXY_HEADERS is
  // explicitly set to '1' or 'true'. Anything else (unset, '0', 'false',
  // garbage) → false. Fail-closed default (R-20 patterning — secure
  // default when env is unset).
  //
  // SENIOR ARCHITECT NOTE: VERCEL=1 auto-trust was a convenience for the
  // canonical deployment path but undermined the security boundary.
  // Vercel deployments now MUST set TRUST_PROXY_HEADERS=1 in
  // Production+Preview env to retain proxy-header trust. Phase 1.5.5.0
  // documented this requirement (.env.example + CLAUDE.md) BEFORE this
  // code change landed — operator confirmed the env-set in Vercel
  // before this commit was authored (Path X 3-commit deploy-safe
  // ordering, R-20 deploy-fail-risk mitigation).
  //
  // REJECTED ALTERNATIVE: keep VERCEL=1 auto-trust, remove only
  // NODE_ENV=production. Rejected because it would leave a hidden
  // trust path active on Vercel — operators reading the source could
  // not determine trust state from a single env var. Explicit-only is
  // simpler and uniformly auditable.
  //
  // RESIDUAL LIMITATION (R-01 sub-vector 2 — NOT closed by this fix):
  // Even when operator opts in via TRUST_PROXY_HEADERS=1, chain
  // extraction returns the leftmost token of x-forwarded-for. An
  // attacker who can reach the trusted proxy (e.g., the public
  // internet for Vercel's edge) can still prepend their own IP to
  // the chain. T-CI04 + T-LG11 retain gap status documenting this
  // residual limitation. Closing it requires either an
  // upstream-proxy-IP allowlist or right-token chain-depth assumption
  // — separate hardening cycle.
  const flag = process.env.TRUST_PROXY_HEADERS
  return flag === '1' || flag === 'true'
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
