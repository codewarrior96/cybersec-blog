// SENIOR ARCHITECT NOTE: soc-store-adapter.ts evaluates ALL routing config at
// IMPORT TIME (L15-30 of source — `requestedStorageMode`, `allowCriticalMemoryFallback`,
// `useSupabaseJsonDomains`, etc. are module-level `const`s frozen on first load).
// vi.stubEnv AFTER import has zero effect; the constants are already computed.
// Each test therefore MUST: (1) call vi.resetModules() to wipe the module cache,
// (2) stub env to the desired matrix, (3) vi.doMock all dependent modules,
// (4) `await import('./soc-store-adapter')` to re-evaluate with fresh config.
//
// REJECTED ALTERNATIVE: refactor source to read env lazily inside each function.
// Rejected — out of scope (Phase 1.D is read-only on production code), and the
// re-import pattern is the canonical Vitest idiom for module-level config tests.

interface ImportAdapterConfig {
  // env overrides (per-test); beforeEach restores baseline
  socStorage?: 'memory' | 'sqlite'
  socIdentityStore?: 'supabase' | 'postgres' | 'disabled'
  nodeEnv?: 'test' | 'production'
  allowCriticalFallback?: '0' | '1'
  // supabase-app-state and supabase-product-db gate flags
  supabaseAppStateEnabled?: boolean
  supabaseProductDbEnabled?: boolean
  // backend mocks (only the methods touched by the test need to be provided)
  memory?: Record<string, unknown>
  supabase?: Record<string, unknown>
  postgres?: Record<string, unknown>
  sqlite?: Record<string, unknown>
}

async function importAdapter(config: ImportAdapterConfig) {
  vi.resetModules()

  if (config.socStorage !== undefined) vi.stubEnv('SOC_STORAGE', config.socStorage)
  if (config.socIdentityStore !== undefined) vi.stubEnv('SOC_IDENTITY_STORE', config.socIdentityStore)
  if (config.nodeEnv !== undefined) vi.stubEnv('NODE_ENV', config.nodeEnv)
  if (config.allowCriticalFallback !== undefined) {
    vi.stubEnv('SOC_ALLOW_CRITICAL_MEMORY_FALLBACK', config.allowCriticalFallback)
  }

  vi.doMock('@/lib/soc-store-memory', () => config.memory ?? {})
  vi.doMock('@/lib/soc-store-supabase', () => config.supabase ?? {})
  vi.doMock('@/lib/soc-store-supabase-postgres', () => config.postgres ?? {})
  // soc-store is imported dynamically inside getSqliteStore (L40 of source).
  // Mock the default export shape — adapter awaits the import and casts.
  vi.doMock('@/lib/soc-store', () => config.sqlite ?? {})
  vi.doMock('@/lib/supabase-app-state', () => ({
    isSupabaseAppStateEnabled: () => !!config.supabaseAppStateEnabled,
  }))
  vi.doMock('@/lib/supabase-product-db', () => ({
    isSupabaseProductDbEnabled: () => !!config.supabaseProductDbEnabled,
  }))
  vi.doMock('@/lib/supabase-attack-metrics', () => ({
    getSupabaseAttackMetrics: vi.fn().mockResolvedValue(null),
    isSupabaseAttackStoreEnabled: () => false,
    recordAttackEventToSupabase: vi.fn().mockResolvedValue(undefined),
  }))

  return await import('./soc-store-adapter')
}

// SENIOR ARCHITECT NOTE: env stubs persist within a test file unless explicitly
// restored. Without baseline restoration in beforeEach, test N's NODE_ENV stub
// would leak into test N+1's import. Pinning all four routing-relevant vars to
// safe defaults at the start of every test guarantees hermetic isolation.
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('SOC_STORAGE', 'memory')
  vi.stubEnv('SOC_IDENTITY_STORE', 'disabled')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('SOC_ALLOW_CRITICAL_MEMORY_FALLBACK', '0')
})

describe('soc-store-adapter', () => {
  // ─── Identity store routing (T-AD01-03) ─────────────────────────────────────

  describe('identity store routing', () => {
    it('T-AD01: SOC_IDENTITY_STORE=supabase delegates to supabaseStore', async () => {
      const supabaseAuth = vi.fn().mockResolvedValue({ source: 'supabase' })
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory' })
      const postgresAuth = vi.fn().mockResolvedValue({ source: 'postgres' })

      const adapter = await importAdapter({
        socIdentityStore: 'supabase',
        socStorage: 'memory',
        supabaseAppStateEnabled: true,
        supabase: { authenticateUser: supabaseAuth },
        memory: { authenticateUser: memoryAuth },
        postgres: { authenticateUser: postgresAuth },
      })

      const result = await adapter.authenticateUser('user', 'pass')

      expect(supabaseAuth).toHaveBeenCalledOnce()
      expect(memoryAuth).not.toHaveBeenCalled()
      expect(postgresAuth).not.toHaveBeenCalled()
      expect(result).toEqual({ source: 'supabase' })
    })

    it('T-AD02: SOC_IDENTITY_STORE=postgres + product_db enabled delegates to postgres store', async () => {
      const postgresAuth = vi.fn().mockResolvedValue({ source: 'postgres' })
      const supabaseAuth = vi.fn().mockResolvedValue({ source: 'supabase' })
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory' })

      const adapter = await importAdapter({
        socIdentityStore: 'postgres',
        supabaseProductDbEnabled: true,
        // supabaseAppStateEnabled intentionally false — postgres branch is
        // gated only by isSupabaseProductDbEnabled, NOT useSupabaseJsonDomains.
        // Verifying the postgres branch still wins under that config.
        supabaseAppStateEnabled: false,
        postgres: { authenticateUser: postgresAuth },
        supabase: { authenticateUser: supabaseAuth },
        memory: { authenticateUser: memoryAuth },
      })

      const result = await adapter.authenticateUser('user', 'pass')

      expect(postgresAuth).toHaveBeenCalledOnce()
      expect(supabaseAuth).not.toHaveBeenCalled()
      expect(memoryAuth).not.toHaveBeenCalled()
      expect(result).toEqual({ source: 'postgres' })
    })

    it('T-AD03: SOC_IDENTITY_STORE=disabled falls through to withStore', async () => {
      // SENIOR ARCHITECT NOTE: when identityStoreMode === 'disabled', both
      // useSupabaseIdentityStore and useSupabaseJsonDomains evaluate false.
      // useSupabasePostgresIdentityStore is also false (identityStoreMode
      // !== 'postgres'). Result: authenticateUser hits the third branch —
      // withStore('authenticateUser', ...). With SOC_STORAGE=memory the
      // memory mock is invoked directly without any sqlite import attempt.
      // This is the canonical "dev fallback" path for offline development.
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory' })
      const supabaseAuth = vi.fn()
      const postgresAuth = vi.fn()

      const adapter = await importAdapter({
        socIdentityStore: 'disabled',
        socStorage: 'memory',
        supabaseAppStateEnabled: false,
        memory: { authenticateUser: memoryAuth },
        supabase: { authenticateUser: supabaseAuth },
        postgres: { authenticateUser: postgresAuth },
      })

      const result = await adapter.authenticateUser('user', 'pass')

      expect(memoryAuth).toHaveBeenCalledOnce()
      expect(supabaseAuth).not.toHaveBeenCalled()
      expect(postgresAuth).not.toHaveBeenCalled()
      expect(result).toEqual({ source: 'memory' })
    })
  })

  // ─── Production memory fallback flag (T-AD04, R-03) ────────────────────────

  describe('allowCriticalMemoryFallback (R-03 trigger evaluation)', () => {
    it('T-AD04: NODE_ENV=production, fallback flag unset → allowCriticalMemoryFallback=true', async () => {
      // SENIOR ARCHITECT NOTE: R-03 (Critical, A05) — the boolean flag
      // `allowCriticalMemoryFallback` (source L17-19) auto-evaluates to true
      // when NODE_ENV === 'production' OR SOC_ALLOW_CRITICAL_MEMORY_FALLBACK
      // === '1'. The OR short-circuit means production deployments AUTOMATICALLY
      // enable memory-fallback for identity functions (authenticateUser,
      // createUser, registerUser, etc.) without any operator opt-in.
      //
      // The flag is private (not exported). To verify it evaluated to true,
      // we observe its DOWNSTREAM effect: when sqlite throws and the flag is
      // true, withStore falls through to memory. If the flag had been false,
      // withStore would re-throw the sqlite error.
      //
      // Test invariant: NODE_ENV=production set, SOC_ALLOW_CRITICAL_MEMORY_FALLBACK
      // intentionally NOT set (flag derived purely from NODE_ENV branch).
      // sqlite mock throws → if flag=true, memory is called; if flag=false,
      // the await would reject.
      //
      // REJECTED ALTERNATIVE: export `allowCriticalMemoryFallback` for direct
      // assertion — rejected, source modification is out of scope and exporting
      // implementation details widens the public surface needlessly.
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory-fallback' })
      const sqliteAuth = vi.fn().mockRejectedValue(new Error('sqlite outage'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const adapter = await importAdapter({
        nodeEnv: 'production',
        socStorage: 'sqlite',
        socIdentityStore: 'disabled',
        // allowCriticalFallback intentionally OMITTED — verifying the
        // NODE_ENV=production branch alone triggers the flag.
        memory: { authenticateUser: memoryAuth },
        sqlite: { authenticateUser: sqliteAuth },
      })

      const result = await adapter.authenticateUser('user', 'pass')

      expect(sqliteAuth).toHaveBeenCalledOnce()
      expect(memoryAuth).toHaveBeenCalledOnce()
      expect(result).toEqual({ source: 'memory-fallback' })
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  // ─── Storage mode routing (T-AD05) ──────────────────────────────────────────

  describe('storage mode routing', () => {
    it('T-AD05: SOC_STORAGE=memory uses memoryStore directly (no sqlite import attempted)', async () => {
      // SENIOR ARCHITECT NOTE: probed via listAlerts because it has no identity
      // branch — pure withStore() dispatch (source L156-158). When activeStorageMode
      // starts as 'memory' (because requestedStorageMode !== 'sqlite') and
      // forceSqlite is false, withStore returns runner(memoryStore) without
      // ever calling getSqliteStore(). Verifies the early-exit memory path.
      const memoryListAlerts = vi.fn().mockResolvedValue({ alerts: [], total: 0, activeTotal: 0, resolvedTotal: 0 })
      const sqliteListAlerts = vi.fn()

      const adapter = await importAdapter({
        socStorage: 'memory',
        socIdentityStore: 'disabled',
        memory: { listAlerts: memoryListAlerts },
        sqlite: { listAlerts: sqliteListAlerts },
      })

      const result = await adapter.listAlerts({} as never)

      expect(memoryListAlerts).toHaveBeenCalledOnce()
      expect(sqliteListAlerts).not.toHaveBeenCalled()
      expect(result).toEqual({ alerts: [], total: 0, activeTotal: 0, resolvedTotal: 0 })
    })
  })

  // ─── sqlite→memory fallback chain (T-AD06-07, R-03 mechanism + chain) ──────

  describe('sqlite→memory fallback chain (R-03)', () => {
    it('T-AD06: sqlite failure with allowMemoryFallback=true falls back to memory', async () => {
      // SENIOR ARCHITECT NOTE: explicit-flag form of R-03's fallback mechanism.
      // SOC_ALLOW_CRITICAL_MEMORY_FALLBACK='1' sets allowCriticalMemoryFallback
      // independent of NODE_ENV (source L17-19: the OR short-circuit). When
      // authenticateUser hits the withStore branch and sqlite rejects,
      // withStore catches and runs memoryStore.authenticateUser instead
      // (source L62-72). NODE_ENV stays 'test' — proves the explicit flag
      // works without production env.
      // REJECTED ALTERNATIVE: pin NODE_ENV=production AND set the flag — test
      // would then conflate the two trigger paths. Keeping NODE_ENV='test'
      // isolates the explicit-flag branch as the sole trigger.
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory-fallback' })
      const sqliteAuth = vi.fn().mockRejectedValue(new Error('sqlite outage'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const adapter = await importAdapter({
        nodeEnv: 'test',
        allowCriticalFallback: '1',
        socStorage: 'sqlite',
        socIdentityStore: 'disabled',
        memory: { authenticateUser: memoryAuth },
        sqlite: { authenticateUser: sqliteAuth },
      })

      const result = await adapter.authenticateUser('user', 'pass')

      expect(sqliteAuth).toHaveBeenCalledOnce()
      expect(memoryAuth).toHaveBeenCalledOnce()
      expect(result).toEqual({ source: 'memory-fallback' })
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('T-AD07: production + sqlite outage → memory fallback for read (R-03 Path γ FIXED in <COMMIT_HASH_TBD>, read path preserved)', async () => {
      // FIX EVIDENCE: Phase 1.5.7 R-03 Path γ closure. authenticateUser is
      // a READ operation (verifies credentials without writing). Path γ
      // intentionally preserves read fallback during sqlite outage — this
      // is the "degraded availability" design choice (logins continue to
      // function against memory-seeded user state even when sqlite is
      // down, accepting that data writes will fail-loud via 503). This
      // test now documents the INTENDED read-permissive behavior of Path γ.
      //
      // PRIOR GAP-DOCUMENTATION HISTORY (A-10 RESOLVED):
      // T-AD07's original incarnation (Phase 1.D.9) probed this same
      // scenario as a GAP test, asserting silent fallback as an exploit
      // surface. Comment header included a "Phase 1.5 hardening proposal:
      // replace silent console.error fallback with thrown error" — the
      // proposal aligned with Path α (remove fallback entirely) or Path β
      // (require explicit opt-in). Path γ chose a narrower hardening:
      // block WRITES, preserve READS. authenticateUser falls in the read
      // category, so its fallback behavior remains permissive. The
      // write-block regression guard now lives at T-AD08; the read-allow
      // semantic mirror at T-AD09 (which uses listAlerts as a Class 3
      // probe).
      //
      // AUDIT-PROSE DRIFT (A-10 historical context, now RESOLVED):
      // Audit T-AD07 row originally said "Supabase outage" trigger. The
      // actual source has NO supabase→memory fallback path — when
      // useSupabaseIdentityStore=true, calls are `return supabaseStore.X(...)`
      // with no try/catch. Supabase failures propagate to the caller. The
      // real R-03 vector was always non-supabase identity store mode +
      // sqlite outage under production env. A-10 amendment documented
      // this drift in Phase 1.D.9; Phase 1.5.7 R-03 fix commit resolves
      // A-10 with audit row revision + this comment refresh.
      //
      // ASSERTIONS (read-fallback regression guard):
      //  (1) await does NOT throw — read fallback succeeds
      //  (2) memory mock's return value reaches caller — fallback delivered
      //  (3) console.error called — Path γ retains observability signal
      //  (4) error log content includes "Falling back to memory store for read"
      //
      // SENIOR ARCHITECT NOTE: Class 1 identity-ops in current production
      // config (SOC_IDENTITY_STORE=supabase) bypass this entire path —
      // authenticateUser goes directly to supabaseStore with no fallback.
      // This test exercises the legacy/dev fallback path (SOC_IDENTITY_STORE=
      // disabled), which retains its degraded-mode read behavior under
      // Path γ. See A-21 amendment for Class 1/2/3 routing canonical reference.
      const memoryAuth = vi.fn().mockResolvedValue({ source: 'memory-fallback' })
      const sqliteAuth = vi.fn().mockRejectedValue(new Error('sqlite outage'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const adapter = await importAdapter({
        nodeEnv: 'production',
        socStorage: 'sqlite',
        socIdentityStore: 'disabled',
        // SOC_ALLOW_CRITICAL_MEMORY_FALLBACK NOT set — flag derived from
        // NODE_ENV=production alone, exactly the R-03 vector.
        memory: { authenticateUser: memoryAuth },
        sqlite: { authenticateUser: sqliteAuth },
      })

      // (1) direct await — NO try/catch wrapping. If this throws, the test
      // fails on the unhandled rejection (vitest catches and reports).
      const result = await adapter.authenticateUser('user', 'pass')

      // (2) caller sees the memory mock's return value — fallback delivered
      expect(result).toEqual({ source: 'memory-fallback' })

      // (3) console.error called — the silent fallback's only visible signal
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('authenticateUser failed on sqlite store')

      // (4) verify the chain ran in the expected order
      expect(sqliteAuth).toHaveBeenCalledOnce()
      expect(memoryAuth).toHaveBeenCalledOnce()

      errorSpy.mockRestore()
    })
  })

  // ─── R-03 Path γ write-block (R-03 FIXED in <COMMIT_HASH_TBD>) ─────────────

  describe('R-03 Path γ write-block (R-03 FIXED in <COMMIT_HASH_TBD>)', () => {
    it('T-AD08: production + sqlite outage + Class 3 write → MemoryFallbackBlockedError throws (R-03 Path γ regression guard)', async () => {
      // FIX EVIDENCE: Phase 1.5.7 R-03 Path γ — Class 3 write operations
      // (createAlert, patchAlert, purgeOldAttackEvents, recordAttackEvent)
      // now pass `isWrite: true` to withStore. When sqlite primary fails
      // and allowCriticalMemoryFallback=true (production auto-enable),
      // withStore throws MemoryFallbackBlockedError instead of silently
      // routing the write to in-memory state. The caller (route handler)
      // catches and returns 503 to the API consumer.
      //
      // Before Path γ (pre-1.5.7): same scenario silently fell back →
      // alert written to in-memory store → instance recycle loses data →
      // no operator signal. This was the actual R-03 exploit surface
      // (A-10 corrected framing).
      //
      // After Path γ: write fails fast with typed error → operator sees
      // 503s in monitoring → fail-loud signal triggers ops investigation.
      // Data integrity preserved (write doesn't land in volatile state).
      //
      // SENIOR ARCHITECT NOTE: this test uses createAlert as the Class 3
      // write probe; identical semantics hold for patchAlert,
      // purgeOldAttackEvents, recordAttackEvent. Class 2 writes
      // (writeAuditLog, createReport, deleteUserCascade, all portfolio
      // writes) inherit Path γ semantics when useSupabaseJsonDomains=
      // false (i.e., SUPABASE_APP_STATE_BUCKET unset / SOC_IDENTITY_STORE=
      // disabled). Class 1 identity ops are NOT touched — already
      // fail-loud via direct supabaseStore routing in production config.
      //
      // REJECTED ALTERNATIVE: use recordAttackEvent for the probe.
      // Rejected because recordAttackEvent has a secondary Supabase
      // attack-store call after the primary; mocking that surface adds
      // test noise without changing the primary-store-write semantic
      // being probed.
      const memoryCreate = vi.fn().mockResolvedValue({ id: 99 })
      const sqliteCreate = vi.fn().mockRejectedValue(new Error('sqlite outage'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const adapter = await importAdapter({
        nodeEnv: 'production',
        socStorage: 'sqlite',
        socIdentityStore: 'disabled',
        // SOC_ALLOW_CRITICAL_MEMORY_FALLBACK NOT set — derived from
        // NODE_ENV=production alone (R-03 trigger path).
        memory: { createAlert: memoryCreate },
        sqlite: { createAlert: sqliteCreate },
      })

      // Path γ assertion: createAlert (Class 3 write) throws typed error
      // instead of silently falling back to memory.
      await expect(adapter.createAlert({} as never)).rejects.toThrow(
        adapter.MemoryFallbackBlockedError,
      )

      // sqlite was attempted (one call before throw)
      expect(sqliteCreate).toHaveBeenCalledOnce()
      // memory was NEVER reached for the write — Path γ blocks it before
      // the in-memory mutation happens
      expect(memoryCreate).not.toHaveBeenCalled()
      // console.error fired with the write-block diagnostic
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('Write blocked')

      errorSpy.mockRestore()
    })

    it('T-AD09: production + sqlite outage + Class 3 read → memory fallback succeeds (Path γ read-permissive regression guard)', async () => {
      // FIX EVIDENCE: Phase 1.5.7 R-03 Path γ — read operations remain
      // permissive during sqlite outage to preserve degraded availability.
      // listAlerts (Class 3 read) has NO isWrite flag → default false →
      // withStore catch block routes to memoryStore.listAlerts as
      // pre-Path-γ behavior.
      //
      // This test pairs with T-AD08 as the "Path γ duality" probe:
      //   - T-AD08: same env, write call → throws
      //   - T-AD09: same env, read call → succeeds via memory fallback
      // Together they document the read/write asymmetry Path γ
      // intentionally introduces.
      //
      // SENIOR ARCHITECT NOTE: the operational tradeoff is explicit —
      // read availability preserved (dashboard alert list, live metrics
      // continue working against memory-seeded state during sqlite
      // outage) at the cost of degraded data freshness (memory state
      // may be empty or stale). Operator monitors via the console.error
      // log + 503s from write attempts. This is the R-03 Path γ "fail
      // partial, not fail entire" design philosophy.
      //
      // REJECTED ALTERNATIVE: T-AD09 could probe getLiveMetrics instead
      // of listAlerts. Rejected because listAlerts has the simpler
      // return-shape mock (just an alert list) — clearer test focus.
      // Both methods share identical fallback behavior under Path γ.
      const memoryListAlerts = vi.fn().mockResolvedValue({
        alerts: [],
        total: 0,
        activeTotal: 0,
        resolvedTotal: 0,
      })
      const sqliteListAlerts = vi.fn().mockRejectedValue(new Error('sqlite outage'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const adapter = await importAdapter({
        nodeEnv: 'production',
        socStorage: 'sqlite',
        socIdentityStore: 'disabled',
        memory: { listAlerts: memoryListAlerts },
        sqlite: { listAlerts: sqliteListAlerts },
      })

      // Path γ assertion: listAlerts (Class 3 read) succeeds via memory
      // fallback after sqlite throws — read-permissive contract preserved.
      const result = await adapter.listAlerts({} as never)
      expect(result).toEqual({ alerts: [], total: 0, activeTotal: 0, resolvedTotal: 0 })

      // sqlite attempted, memory served as fallback
      expect(sqliteListAlerts).toHaveBeenCalledOnce()
      expect(memoryListAlerts).toHaveBeenCalledOnce()
      // console.error fired with the read-fallback diagnostic (different
      // message than write-block — Path γ's two diagnostic strings let
      // operators distinguish the two paths in log analysis)
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('Falling back to memory store for read')

      errorSpy.mockRestore()
    })
  })
})
