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

    it('T-AD07: production + sqlite outage → memory fallback silent (full R-03 reproduction)', async () => {
      // SENIOR ARCHITECT NOTE: R-03 (Critical, A05) — full integration probe.
      // This is the production attack surface: NODE_ENV=production auto-enables
      // allowCriticalMemoryFallback (no operator opt-in), and any failure of
      // the primary store (sqlite call rejects) silently routes to the memory
      // store. The caller receives a successful result — there is no thrown
      // error, no thrown exception, no signal except a single console.error log.
      //
      // AUDIT-PROSE DRIFT (documented as A-10): audit T-AD07 says "Supabase
      // outage". The actual source path has NO supabase→memory fallback —
      // when useSupabaseIdentityStore=true, the call is `return supabaseStore.X(...)`
      // with no try/catch. Supabase failures propagate to the caller. The
      // real R-03 vector is non-supabase identity store mode + sqlite outage
      // under production env. Test interprets audit prose accordingly.
      //
      // ASSERTIONS (per Phase 1.D.9 prompt requirement):
      //  (1) await does NOT throw — direct await, no try/catch — proves silence
      //  (2) memory mock's return value reaches caller — proves fallback worked
      //  (3) console.error was called — proves the only operational signal exists
      //  (4) the error log content is the only forensic trace
      //
      // PHASE 1.5 HARDENING PROPOSAL: replace the silent console.error fallback
      // with a thrown error in production mode. When that hardening lands,
      // assertion (1) flips: `await expect(adapter.authenticateUser(...)).rejects.toThrow()`,
      // and assertions (2)/(3) become regression-guards on the previous behavior.
      // The test then documents both the pre- and post-fix contracts.
      //
      // REJECTED ALTERNATIVE: wrap the call in try/catch — rejected, that
      // would mask a bug where the function unexpectedly throws. The test
      // explicitly asserts NO throw via direct await; if the implementation
      // ever throws (intentionally or not), the test fails loudly.
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
})
