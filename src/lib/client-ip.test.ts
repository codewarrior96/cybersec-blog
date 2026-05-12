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
    it('T-CI11a: NODE_ENV=production, VERCEL unset, flag unset → trustProxy=false (R-01 FIXED in <COMMIT_HASH_TBD>)', () => {
      // FIX EVIDENCE: Phase 1.5.5 R-01 trust-gating sub-vector closure.
      // trustProxy() now returns true ONLY when TRUST_PROXY_HEADERS is
      // explicitly set to '1' or 'true' (client-ip.ts post-fix). The
      // prior implicit fallback (`VERCEL === '1' || NODE_ENV ===
      // 'production'`) has been removed. NODE_ENV=production alone no
      // longer auto-trusts proxy headers — every deployment must opt
      // in via TRUST_PROXY_HEADERS=1.
      //
      // HISTORICAL CONTEXT (A-03 RESOLVED): the original audit framed
      // R-01 as "Vercel-specific multi-instance dispatch." Phase 1.D.5
      // analysis of client-ip.ts (then-current) discovered the
      // NODE_ENV=production implicit-trust branch — broadening R-01's
      // scope to every production deployment (AWS, DigitalOcean, VPS,
      // bare-metal, self-hosted). A-03 documented the scope correction;
      // Phase 1.5.5 R-01 fix closes both the original (Vercel) and
      // broadened (all-production) scope by making trust strictly
      // explicit-opt-in.
      //
      // SENIOR ARCHITECT NOTE: x-forwarded-for header is still present
      // in the request, but trustProxy()=false routes getClientIp
      // through the request.ip / 'unknown' fallback path, ignoring the
      // header entirely. The spoof attempt (`9.9.9.9` in
      // x-forwarded-for) is invisible to downstream consumers
      // (rate-limiter, audit log, abuse attribution).
      //
      // REJECTED ALTERNATIVE: keep NODE_ENV=production auto-trust but
      // gate by a list of trusted reverse-proxy IPs. Rejected — adds
      // significant config complexity (operator must enumerate proxy
      // IPs), and the same outcome is achievable with a single
      // explicit env flag that is auditable from a glance.
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      vi.stubEnv('VERCEL', '')
      vi.stubEnv('NODE_ENV', 'production')
      const req = makeReq({ 'x-forwarded-for': '9.9.9.9' })
      expect(getClientIp(req)).toBe('unknown')
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

    it('T-CI12: VERCEL=1, flag unset → trustProxy=false (R-01 FIXED in <COMMIT_HASH_TBD>; Vercel deploy now requires explicit TRUST_PROXY_HEADERS=1)', () => {
      // FIX EVIDENCE: Phase 1.5.5 R-01 — the VERCEL=1 implicit-trust
      // fallback was removed from trustProxy() alongside the
      // NODE_ENV=production fallback (T-CI11a above). Vercel
      // deployments now MUST set TRUST_PROXY_HEADERS=1 explicitly in
      // Production+Preview env to retain proxy-header trust.
      //
      // DEPLOYMENT ORDERING (Path X 3-commit deploy-safe pattern):
      // Phase 1.5.5.0 (commit 3630057) documented TRUST_PROXY_HEADERS
      // in .env.example + CLAUDE.md as a Vercel-required env. Operator
      // set TRUST_PROXY_HEADERS=1 in Vercel Production + Preview env
      // BEFORE this fix's deploy. Without the env-set, getClientIp
      // would fall through to request.ip — on Vercel this surfaces
      // the edge node's IP rather than the actual client IP, and
      // per-IP rate-limit buckets would collapse to a single shared
      // bucket (effectively disabling brute-force protection at the
      // IP layer). R-20 deploy-fail-risk pattern mitigation.
      //
      // SENIOR ARCHITECT NOTE: the previous "VERCEL=1 → trustProxy
      // true" auto-detection was a convenience but undermined the
      // security boundary by allowing two distinct trust paths
      // (explicit flag OR auto-detect). Explicit-only is uniformly
      // auditable from a single env variable.
      //
      // REJECTED ALTERNATIVE: retain VERCEL=1 auto-trust as a Vercel-
      // platform-specific convenience. Rejected because it leaves a
      // hidden trust path active — operators reading the source
      // couldn't determine trust state from TRUST_PROXY_HEADERS alone.
      // The cost of "set one extra env var on Vercel" is trivially
      // less than the benefit of single-source-of-truth auditing.
      vi.stubEnv('TRUST_PROXY_HEADERS', '')
      vi.stubEnv('VERCEL', '1')
      const req = makeReq({ 'x-forwarded-for': '1.2.3.4' })
      expect(getClientIp(req)).toBe('unknown')
    })
  })
})
