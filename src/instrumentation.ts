// Phase 1.5.15 — A-17 closure: Next.js boot validator (Layer 1 of two-layer
// defense-in-depth for SOC_DEMO_SECRET).
//
// SENIOR ARCHITECT NOTE: `register()` is Next.js 14.x's officially-supported
// hook for server-startup-time validation. It runs once per server process,
// after the JS bundle is loaded but before request handling begins. Throwing
// here causes Vercel/Node to fail-loud at boot with the error visible in
// startup logs — exactly the operator-visible signal R-20 hardening was
// designed for, just at boot instead of at first-import.
//
// Layer 2 (final defense) lives in src/lib/soc-store-memory.ts:getMemorySecret
// — first session-token operation throws if this validator was somehow
// bypassed (e.g., unusual runtime, test harness, future Next.js change).
//
// REJECTED ALTERNATIVE: validate inside individual route handlers (e.g.,
// middleware.ts or a per-route check). Rejected — register() runs once at
// boot, route checks run per-request (CPU waste + late failure mode).
//
// REJECTED ALTERNATIVE: validate at /api/auth/login route specifically (the
// first auth path that needs the secret). Rejected — same per-request waste,
// AND doesn't fail loud at boot, AND doesn't centralize the env contract.
//
// SCOPE — Phase 1.5.15 cycle validates only SOC_DEMO_SECRET. Future
// security-critical env additions (TRUST_PROXY_HEADERS validation in
// production, SUPABASE_SERVICE_ROLE_KEY presence check, etc.) are NOT in
// this cycle. This file is the canonical centralization point; extensions
// land in future dedicated cycles.

export async function register(): Promise<void> {
  // SENIOR ARCHITECT NOTE: NEXT_RUNTIME gate.
  // Next.js sets process.env.NEXT_RUNTIME to 'nodejs' or 'edge' depending on
  // the runtime context. Edge runtime has different env semantics (limited
  // process.env access). This validator targets the Node.js server runtime
  // — the path that actually executes session token sign/verify.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // SENIOR ARCHITECT NOTE: NEXT_PHASE gate.
  // `next build` invokes register() during static-export simulation phase
  // to validate that the bundle initializes cleanly. We don't want the
  // validator to throw during build (that's the entire A-17 fragility we're
  // closing). NEXT_PHASE='phase-production-build' is the canonical Next.js
  // build-phase marker (constant: PHASE_PRODUCTION_BUILD in
  // next/dist/shared/lib/constants).
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  // SOC_DEMO_SECRET — R-20 HMAC session-token signing key (security-critical).
  // Missing → server cannot sign session tokens → fail loud at boot rather
  // than silently fall back (R-20 was originally about removing the
  // public-knowable 'soc-demo-secret' hardcoded fallback).
  if (!process.env.SOC_DEMO_SECRET) {
    throw new Error(
      '[boot-validator] SOC_DEMO_SECRET environment variable must be set ' +
      'before server startup. R-20 hardening + A-17 closure (Phase 1.5.15). ' +
      'Set in .env.local for local dev, or Vercel dashboard for production/preview.'
    )
  }
}
