import * as memoryStore from '@/lib/soc-store-memory'
import * as supabasePostgresStore from '@/lib/soc-store-supabase-postgres'
import * as supabaseStore from '@/lib/soc-store-supabase'
import { isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import { getSupabaseAttackMetrics, isSupabaseAttackStoreEnabled, recordAttackEventToSupabase } from '@/lib/supabase-attack-metrics'
import { isSupabaseProductDbEnabled } from '@/lib/supabase-product-db'
import type { AttackEventInput, LiveMetrics } from '@/lib/soc-store-memory'

type StoreModule = typeof import('@/lib/soc-store-memory')
type StorageMode = 'memory' | 'sqlite'
type StoreOptions = {
  allowMemoryFallback?: boolean
  // R-03 hardening (Phase 1.5.7 9e16fbe): Path γ — when isWrite=true
  // AND the call has reached the memory-fallback path (sqlite failure under
  // production env), throw MemoryFallbackBlockedError instead of silently
  // routing the write to in-memory state (which would lose data on instance
  // recycle). Reads remain permissive during fallback (degraded-availability
  // mode preserved — login/list operations continue to function against
  // memory-seeded state). See A-21 amendment for Class 1/2/3 routing analysis.
  isWrite?: boolean
}

// R-03 Path γ — typed error thrown by withStore when an isWrite=true call
// would otherwise silently fall back to memory. Caller (route handler)
// catches and returns 503. Distinguishes "primary store unavailable, write
// blocked" from generic exceptions so observability + retry policy can be
// differentiated.
export class MemoryFallbackBlockedError extends Error {
  constructor(operation: string) {
    super(
      `[soc-store-adapter] ${operation}: write blocked — primary store ` +
        `unavailable and memory fallback restricted to read operations ` +
        `(R-03 Path γ, audit Section 2).`,
    )
    this.name = 'MemoryFallbackBlockedError'
  }
}

const requestedStorageMode = (process.env.SOC_STORAGE ?? 'sqlite').toLowerCase()
let activeStorageMode: StorageMode = requestedStorageMode === 'sqlite' ? 'sqlite' : 'memory'
const allowCriticalMemoryFallback =
  process.env.SOC_ALLOW_CRITICAL_MEMORY_FALLBACK === '1' ||
  process.env.NODE_ENV === 'production'
const supabaseAppStateEnabled = isSupabaseAppStateEnabled()
const identityStoreMode = (process.env.SOC_IDENTITY_STORE ?? 'supabase').toLowerCase()
const useSupabaseJsonDomains =
  supabaseAppStateEnabled &&
  identityStoreMode !== 'disabled'
const useSupabaseIdentityStore =
  identityStoreMode === 'supabase' &&
  useSupabaseJsonDomains
const useSupabasePostgresIdentityStore =
  identityStoreMode === 'postgres' &&
  isSupabaseProductDbEnabled()

let sqliteStorePromise: Promise<StoreModule> | null = null

if (requestedStorageMode !== 'memory' && requestedStorageMode !== 'sqlite') {
  console.warn(`[soc-store-adapter] Unsupported SOC_STORAGE="${requestedStorageMode}". Falling back to memory.`)
}

async function getSqliteStore(): Promise<StoreModule> {
  if (!sqliteStorePromise) {
    sqliteStorePromise = import('@/lib/soc-store').then((mod) => mod as unknown as StoreModule)
  }
  return sqliteStorePromise
}

async function withStore<T>(
  operation: string,
  runner: (store: StoreModule) => Promise<T>,
  options: StoreOptions = {},
): Promise<T> {
  const allowMemoryFallback = options.allowMemoryFallback ?? true
  const isWrite = options.isWrite ?? false
  const forceSqlite = requestedStorageMode === 'sqlite' && !allowMemoryFallback
  // R-03 Path γ — "in fallback" means we configured sqlite as primary but
  // ended up in memory mode (either because a prior call switched us, or
  // because we're about to). When requestedStorageMode === 'memory' (test
  // fixtures, local dev), activeStorageMode === 'memory' is by design and
  // NOT fallback — writes remain permissive.
  const inFallbackMode = requestedStorageMode === 'sqlite' && activeStorageMode === 'memory'

  if (activeStorageMode === 'memory' && !forceSqlite) {
    // R-03 Path γ — second-and-later call after fallback already triggered.
    // Block writes; allow reads (degraded availability).
    if (isWrite && inFallbackMode) {
      throw new MemoryFallbackBlockedError(operation)
    }
    return runner(memoryStore)
  }

  try {
    const sqliteStore = await getSqliteStore()
    const result = await runner(sqliteStore)
    activeStorageMode = 'sqlite'
    return result
  } catch (error) {
    if (!allowMemoryFallback) {
      throw error
    }

    // R-03 Path γ — first sqlite failure on a write. Surface fail-loud as
    // MemoryFallbackBlockedError instead of silently routing to memory.
    // activeStorageMode intentionally NOT switched to 'memory' here — next
    // write retries sqlite (allowing recovery) rather than locking the
    // process into degraded write-blocked state forever.
    if (isWrite) {
      console.error(
        `[soc-store-adapter] ${operation} failed on sqlite store. Write blocked — memory fallback restricted to reads (R-03 Path γ).`,
        error,
      )
      throw new MemoryFallbackBlockedError(operation)
    }

    console.error(
      `[soc-store-adapter] ${operation} failed on sqlite store. Falling back to memory store for read (R-03 Path γ permits read fallback).`,
      error,
    )
    activeStorageMode = 'memory'
    return runner(memoryStore)
  }
}

export async function writeAuditLog(...args: Parameters<StoreModule['writeAuditLog']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.writeAuditLog(...args)
  }
  return withStore('writeAuditLog', (store) => store.writeAuditLog(...args), { isWrite: true })
}

export async function cleanupExpiredSessions(
  ...args: Parameters<StoreModule['cleanupExpiredSessions']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.cleanupExpiredSessions(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.cleanupExpiredSessions(...args)
  }
  return withStore('cleanupExpiredSessions', (store) => store.cleanupExpiredSessions(...args))
}

export async function authenticateUser(
  ...args: Parameters<StoreModule['authenticateUser']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.authenticateUser(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.authenticateUser(...args)
  }
  return withStore('authenticateUser', (store) => store.authenticateUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function createSession(...args: Parameters<StoreModule['createSession']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.createSession(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.createSession(...args)
  }
  return withStore('createSession', (store) => store.createSession(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function deleteSession(...args: Parameters<StoreModule['deleteSession']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.deleteSession(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.deleteSession(...args)
  }
  return withStore('deleteSession', (store) => store.deleteSession(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function getSessionByToken(
  ...args: Parameters<StoreModule['getSessionByToken']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.getSessionByToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.getSessionByToken(...args)
  }
  return withStore('getSessionByToken', (store) => store.getSessionByToken(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function listAssignableUsers(
  ...args: Parameters<StoreModule['listAssignableUsers']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.listAssignableUsers(...args)
  }
  return withStore('listAssignableUsers', (store) => store.listAssignableUsers(...args))
}

export async function listAlerts(...args: Parameters<StoreModule['listAlerts']>) {
  return withStore('listAlerts', (store) => store.listAlerts(...args))
}

export async function createAlert(...args: Parameters<StoreModule['createAlert']>) {
  return withStore('createAlert', (store) => store.createAlert(...args), { isWrite: true })
}

export async function patchAlert(...args: Parameters<StoreModule['patchAlert']>) {
  return withStore('patchAlert', (store) => store.patchAlert(...args), { isWrite: true })
}

export async function purgeOldAttackEvents(
  ...args: Parameters<StoreModule['purgeOldAttackEvents']>
) {
  return withStore('purgeOldAttackEvents', (store) => store.purgeOldAttackEvents(...args), { isWrite: true })
}

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  await withStore('recordAttackEvent', (store) => store.recordAttackEvent(input), { isWrite: true })

  if (!isSupabaseAttackStoreEnabled()) {
    return
  }

  try {
    await recordAttackEventToSupabase(input)
  } catch (error) {
    console.warn('[soc-store-adapter] Supabase attack insert failed:', error)
  }
}

export async function getLiveMetrics(): Promise<LiveMetrics> {
  const baseMetrics = await withStore('getLiveMetrics', (store) => store.getLiveMetrics())

  if (!isSupabaseAttackStoreEnabled()) {
    return baseMetrics
  }

  try {
    const supabaseAttackMetrics = await getSupabaseAttackMetrics()
    if (!supabaseAttackMetrics) {
      return baseMetrics
    }
    return {
      ...baseMetrics,
      attack: supabaseAttackMetrics,
    }
  } catch (error) {
    console.warn('[soc-store-adapter] Supabase attack metrics read failed:', error)
    return baseMetrics
  }
}

export async function listReports(...args: Parameters<StoreModule['listReports']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.listReports(...args)
  }
  return withStore('listReports', (store) => store.listReports(...args))
}

export async function createReport(...args: Parameters<StoreModule['createReport']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.createReport(...args)
  }
  return withStore('createReport', (store) => store.createReport(...args), { isWrite: true })
}

export async function archiveReport(...args: Parameters<StoreModule['archiveReport']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.archiveReport(...args)
  }
  return withStore('archiveReport', (store) => store.archiveReport(...args), { isWrite: true })
}

export async function deleteReport(...args: Parameters<StoreModule['deleteReport']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.deleteReport(...args)
  }
  return withStore('deleteReport', (store) => store.deleteReport(...args), { isWrite: true })
}


export async function createUser(...args: Parameters<StoreModule['createUser']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.createUser(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.createUser(...args)
  }
  return withStore('createUser', (store) => store.createUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function registerUser(...args: Parameters<StoreModule['registerUser']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.registerUser(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.registerUser(...args)
  }
  return withStore('registerUser', (store) => store.registerUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function readUserByEmailKey(...args: Parameters<StoreModule['readUserByEmailKey']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.readUserByEmailKey(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.readUserByEmailKey(...args)
  }
  return withStore('readUserByEmailKey', (store) => store.readUserByEmailKey(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function readUserByUsername(...args: Parameters<StoreModule['readUserByUsername']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.readUserByUsername(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.readUserByUsername(...args)
  }
  return withStore('readUserByUsername', (store) => store.readUserByUsername(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function findUserByVerifyToken(...args: Parameters<StoreModule['findUserByVerifyToken']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.findUserByVerifyToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.findUserByVerifyToken(...args)
  }
  return withStore('findUserByVerifyToken', (store) => store.findUserByVerifyToken(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function setEmailVerified(...args: Parameters<StoreModule['setEmailVerified']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.setEmailVerified(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.setEmailVerified(...args)
  }
  return withStore('setEmailVerified', (store) => store.setEmailVerified(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function setEmailVerifyToken(...args: Parameters<StoreModule['setEmailVerifyToken']>) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.setEmailVerifyToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.setEmailVerifyToken(...args)
  }
  return withStore('setEmailVerifyToken', (store) => store.setEmailVerifyToken(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

// ─── Phase 5 password-reset contract ─────────────────────────────────────────
// Same routing pattern as the email-verification helpers above. Postgres
// branch returns null (dormant pending SQL migration); supabase branch is
// the production path; memory branch is dev fallback.

export async function findUserByPasswordResetToken(
  ...args: Parameters<StoreModule['findUserByPasswordResetToken']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.findUserByPasswordResetToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.findUserByPasswordResetToken(...args)
  }
  return withStore(
    'findUserByPasswordResetToken',
    (store) => store.findUserByPasswordResetToken(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function setPasswordResetToken(
  ...args: Parameters<StoreModule['setPasswordResetToken']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.setPasswordResetToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.setPasswordResetToken(...args)
  }
  return withStore('setPasswordResetToken', (store) => store.setPasswordResetToken(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function consumePasswordResetToken(
  ...args: Parameters<StoreModule['consumePasswordResetToken']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.consumePasswordResetToken(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.consumePasswordResetToken(...args)
  }
  return withStore(
    'consumePasswordResetToken',
    (store) => store.consumePasswordResetToken(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function deleteAllSessionsForUser(
  ...args: Parameters<StoreModule['deleteAllSessionsForUser']>
) {
  if (useSupabasePostgresIdentityStore) {
    return supabasePostgresStore.deleteAllSessionsForUser(...args)
  }
  if (useSupabaseIdentityStore) {
    return supabaseStore.deleteAllSessionsForUser(...args)
  }
  return withStore(
    'deleteAllSessionsForUser',
    (store) => store.deleteAllSessionsForUser(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

// F-002: account permanent delete with GDPR cascade. Identity store
// is supabase in production; postgres branch is dormant (Phase 2
// migration pending) and falls through to the JSON store which is
// where user records live anyway. Memory branch is dev fallback.
export async function deleteUserCascade(
  ...args: Parameters<StoreModule['deleteUserCascade']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.deleteUserCascade(...args)
  }
  return withStore('deleteUserCascade', (store) => store.deleteUserCascade(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
    isWrite: true,
  })
}

export async function getPortfolioProfile(...args: Parameters<StoreModule['getPortfolioProfile']>) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.getPortfolioProfile(...args)
  }
  return withStore('getPortfolioProfile', (store) => store.getPortfolioProfile(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function getPortfolioCertificationById(
  ...args: Parameters<StoreModule['getPortfolioCertificationById']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.getPortfolioCertificationById(...args)
  }
  return withStore(
    'getPortfolioCertificationById',
    (store) => store.getPortfolioCertificationById(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function updatePortfolioProfile(
  ...args: Parameters<StoreModule['updatePortfolioProfile']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.updatePortfolioProfile(...args)
  }
  return withStore('updatePortfolioProfile', (store) => store.updatePortfolioProfile(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
    isWrite: true,
  })
}

export async function updatePortfolioAvatar(
  ...args: Parameters<StoreModule['updatePortfolioAvatar']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.updatePortfolioAvatar(...args)
  }
  return withStore('updatePortfolioAvatar', (store) => store.updatePortfolioAvatar(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
    isWrite: true,
  })
}

export async function createPortfolioCertification(
  ...args: Parameters<StoreModule['createPortfolioCertification']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.createPortfolioCertification(...args)
  }
  return withStore(
    'createPortfolioCertification',
    (store) => store.createPortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export async function updatePortfolioCertification(
  ...args: Parameters<StoreModule['updatePortfolioCertification']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.updatePortfolioCertification(...args)
  }
  return withStore(
    'updatePortfolioCertification',
    (store) => store.updatePortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export async function deletePortfolioCertification(
  ...args: Parameters<StoreModule['deletePortfolioCertification']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.deletePortfolioCertification(...args)
  }
  return withStore(
    'deletePortfolioCertification',
    (store) => store.deletePortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export async function createPortfolioEducation(
  ...args: Parameters<StoreModule['createPortfolioEducation']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.createPortfolioEducation(...args)
  }
  return withStore(
    'createPortfolioEducation',
    (store) => store.createPortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export async function updatePortfolioEducation(
  ...args: Parameters<StoreModule['updatePortfolioEducation']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.updatePortfolioEducation(...args)
  }
  return withStore(
    'updatePortfolioEducation',
    (store) => store.updatePortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export async function deletePortfolioEducation(
  ...args: Parameters<StoreModule['deletePortfolioEducation']>
) {
  if (useSupabaseJsonDomains) {
    return supabaseStore.deletePortfolioEducation(...args)
  }
  return withStore(
    'deletePortfolioEducation',
    (store) => store.deletePortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback, isWrite: true },
  )
}

export type {
  RequestMetadata,
  SessionRecord,
  AlertRecord,
  AlertListResult,
  ListAlertsFilters,
  AlertPatchInput,
  AttackEventInput,
  UserWorkload,
  LiveMetrics,
  ReportRecord,
  PortfolioProfilePatchInput,
  PortfolioCertificationInput,
  PortfolioEducationInput,
} from '@/lib/soc-store-memory'

