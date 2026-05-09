import { getClientIp } from './client-ip'

// Pattern (c): minimal mock object — getClientIp only accesses request.headers
// and request.ip. No NextRequest import needed; cast as any satisfies TS.
function makeReq(headers: Record<string, string> = {}, ip?: string) {
  return { headers: new Headers(headers), ip } as any
}

describe('client-ip', () => {
  // ─── TRUST_PROXY_HEADERS explicit flag ───────────────────────────────────────

  describe('TRUST_PROXY_HEADERS flag', () => {
    it('T-CI01: TRUST_PROXY_HEADERS=0 — x-forwarded-for ignored, falls to unknown', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '0')
      const req = makeReq({ 'x-forwarded-for': '1.2.3.4' })
      // No request.ip set → falls through proxy block (disabled) → 'unknown'
      expect(getClientIp(req)).toBe('unknown')
    })

    it('T-CI02: TRUST_PROXY_HEADERS=1 — valid x-forwarded-for returned', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      const req = makeReq({ 'x-forwarded-for': '1.2.3.4' })
      expect(getClientIp(req)).toBe('1.2.3.4')
    })
  })

  // ─── x-forwarded-for chain and spoofing (R-01) ───────────────────────────────

  describe('x-forwarded-for chain parsing (R-01)', () => {
    it('T-CI03: chain "1.2.3.4, 5.6.7.8" returns first token', () => {
      // getClientIp splits on comma and takes index [0]. In a legitimate Vercel
      // deployment, the chain is client-IP, proxy-IP — first token is the client.
      // In a spoofing attack the attacker controls what they prepend.
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      const req = makeReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
      expect(getClientIp(req)).toBe('1.2.3.4')
    })

    it('T-CI04: attacker-set x-forwarded-for returned verbatim — rate-limit spoof gap (R-01)', () => {
      // GAP DOCUMENTATION (R-01): when trustProxy=true, getClientIp returns the
      // first token of x-forwarded-for without verifying it against an allow-listed
      // proxy chain. An attacker who sends `x-forwarded-for: 9.9.9.9` on every
      // request causes the rate-limiter to count failures against 9.9.9.9, not the
      // attacker's real IP. Rotating 9.9.9.9 per-request effectively bypasses
      // IP-based brute-force protection.
      //
      // Vercel appends the real connecting IP to the chain end — a hardened version
      // would trust ONLY the last token (or the Nth-from-last) rather than the first.
      //
      // This test asserts CURRENT behavior (verbatim return). It will fail
      // intentionally when the first-token logic is replaced with last-token or
      // allowlist-gated extraction — that failure is the R-01 regression signal.
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      const req = makeReq({ 'x-forwarded-for': '9.9.9.9' })
      expect(getClientIp(req)).toBe('9.9.9.9') // gap: R-01, should verify chain origin
    })
  })

  // ─── Header fallback chain ────────────────────────────────────────────────────

  describe('header fallback chain', () => {
    it('T-CI05: invalid x-forwarded-for falls through to x-real-ip', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      // 999.999.999.999 fails octet-range check; x-real-ip is used instead
      const req = makeReq({ 'x-forwarded-for': '999.999.999.999', 'x-real-ip': '2.2.2.2' })
      expect(getClientIp(req)).toBe('2.2.2.2')
    })

    it('T-CI06: x-forwarded-for absent; valid x-real-ip returned', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      const req = makeReq({ 'x-real-ip': '3.3.3.3' })
      expect(getClientIp(req)).toBe('3.3.3.3')
    })

    it('T-CI07: proxy headers absent, trustProxy=false — falls to request.ip', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '0')
      const req = makeReq({}, '4.4.4.4')
      expect(getClientIp(req)).toBe('4.4.4.4')
    })

    it('T-CI08: all sources absent or invalid — returns "unknown"', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '0')
      const req = makeReq({}) // no ip property
      expect(getClientIp(req)).toBe('unknown')
    })
  })

  // ─── IP validation ────────────────────────────────────────────────────────────

  describe('IP validation', () => {
    it('T-CI09: valid IPv6 address accepted', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      // isValidIp: includes ':' + /^[0-9a-fA-F:]+$/ + length <= 45
      const req = makeReq({ 'x-forwarded-for': '2001:db8::1' })
      expect(getClientIp(req)).toBe('2001:db8::1')
    })

    it('T-CI10: malformed IPv4 with octet > 255 rejected', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', '1')
      // 256 fails the `n <= 255` octet check → isValidIp returns false
      // No x-real-ip, no request.ip → falls to 'unknown'
      const req = makeReq({ 'x-forwarded-for': '256.0.0.1' })
      expect(getClientIp(req)).toBe('unknown')
    })
  })

  // ─── trustProxy() decision matrix (R-01) ─────────────────────────────────────

  describe('trustProxy decision matrix (R-01)', () => {
    it('T-CI11a: NODE_ENV=production, VERCEL unset, flag unset → trustProxy=true — gap (R-01 broader scope)', () => {
      // GAP DOCUMENTATION (R-01 — BROADER THAN AUDIT ASSUMED):
      // The audit described T-CI11 as "trustProxy false" for the non-Vercel production
      // case, implying self-hosted prod would be safe. Actual code (L24):
      //   return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
      // NODE_ENV=production ALONE triggers trustProxy=true — no VERCEL flag needed.
      //
      // Impact: every production deployment (AWS, DigitalOcean, VPS, bare-metal) that
      // sets NODE_ENV=production (the conventional standard) auto-trusts proxy headers
      // without any explicit opt-in. R-01 is not Vercel-specific; it affects every
      // production environment.
      //
      // Phase 1.5 hardening recommendation: remove NODE_ENV=production from the
      // fallback. Make trustProxy default=false; opt-in only via TRUST_PROXY_HEADERS=1
      // or VERCEL=1. Operators who run behind a trusted reverse proxy must opt in
      // explicitly. This is the "secure default" principle.
      //
      // This test asserts CURRENT behavior (trustProxy=true, spoof succeeds). It will
      // fail intentionally when the NODE_ENV branch is removed — that failure is the
      // regression signal confirming R-01 is fixed for self-hosted deployments.
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      vi.stubEnv('VERCEL', '')
      vi.stubEnv('NODE_ENV', 'production')
      const req = makeReq({ 'x-forwarded-for': '9.9.9.9' })
      expect(getClientIp(req)).toBe('9.9.9.9') // gap: R-01, trustProxy=true in all prod
    })

    it('T-CI11b: NODE_ENV=test, VERCEL unset, flag unset → trustProxy=false — safe baseline', () => {
      // Safe baseline: without production NODE_ENV or VERCEL=1, and without an
      // explicit TRUST_PROXY_HEADERS flag, trustProxy=false. Proxy headers ignored.
      // Read alongside T-CI11a: "safe in non-prod, unsafe in prod (gap)" is the
      // clearest illustration of why R-01 severity is High.
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      vi.stubEnv('VERCEL', '')
      vi.stubEnv('NODE_ENV', 'test')
      const req = makeReq({ 'x-forwarded-for': '9.9.9.9' }) // no request.ip
      expect(getClientIp(req)).toBe('unknown')
    })

    it('T-CI12: VERCEL=1, flag unset → trustProxy=true (intended Vercel behavior)', () => {
      // When VERCEL=1, trusting x-forwarded-for is intentional — Vercel's edge
      // network guarantees the header chain integrity. This is the expected path.
      // The risk (R-01) is that an attacker can still prepend their own IP to the
      // chain before Vercel appends the real one; first-token extraction returns
      // the attacker's value. This is the same gap as T-CI04, surfaced via the
      // trustProxy auto-detection path rather than the explicit flag path.
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      vi.stubEnv('VERCEL', '1')
      const req = makeReq({ 'x-forwarded-for': '1.2.3.4' })
      expect(getClientIp(req)).toBe('1.2.3.4')
    })
  })
})
