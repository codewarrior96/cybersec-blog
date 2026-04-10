import * as memoryStore from '@/lib/soc-store-memory'
import * as supabaseStore from '@/lib/soc-store-supabase'
import { isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import { getSupabaseAttackMetrics, isSupabaseAttackStoreEnabled, recordAttackEventToSupabase } from '@/lib/supabase-attack-metrics'
import type { AttackEventInput, LiveMetrics } from '@/lib/soc-store-memory'

type StoreModule = typeof import('@/lib/soc-store-memory')
type StorageMode = 'memory' | 'sqlite'
type StoreOptions = {
  allowMemoryFallback?: boolean
}

const requestedStorageMode = (process.env.SOC_STORAGE ?? 'sqlite').toLowerCase()
let activeStorageMode: StorageMode = requestedStorageMode === 'sqlite' ? 'sqlite' : 'memory'
const allowCriticalMemoryFallback =
  process.env.SOC_ALLOW_CRITICAL_MEMORY_FALLBACK === '1' ||
  process.env.NODE_ENV === 'production'
const useSupabaseIdentityStore =
  isSupabaseAppStateEnabled() &&
  (process.env.SOC_IDENTITY_STORE ?? 'supabase').toLowerCase() !== 'disabled'

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
  const forceSqlite = requestedStorageMode === 'sqlite' && !allowMemoryFallback

  if (activeStorageMode === 'memory' && !forceSqlite) {
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

    console.error(
      `[soc-store-adapter] ${operation} failed on sqlite store. Falling back to memory store.`,
      error,
    )
    activeStorageMode = 'memory'
    return runner(memoryStore)
  }
}

export async function writeAuditLog(...args: Parameters<StoreModule['writeAuditLog']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.writeAuditLog(...args)
  }
  return withStore('writeAuditLog', (store) => store.writeAuditLog(...args))
}

export async function cleanupExpiredSessions(
  ...args: Parameters<StoreModule['cleanupExpiredSessions']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.cleanupExpiredSessions(...args)
  }
  return withStore('cleanupExpiredSessions', (store) => store.cleanupExpiredSessions(...args))
}

export async function authenticateUser(
  ...args: Parameters<StoreModule['authenticateUser']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.authenticateUser(...args)
  }
  return withStore('authenticateUser', (store) => store.authenticateUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function createSession(...args: Parameters<StoreModule['createSession']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.createSession(...args)
  }
  return withStore('createSession', (store) => store.createSession(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function deleteSession(...args: Parameters<StoreModule['deleteSession']>) {
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
  return withStore('listAssignableUsers', (store) => store.listAssignableUsers(...args))
}

export async function listAlerts(...args: Parameters<StoreModule['listAlerts']>) {
  return withStore('listAlerts', (store) => store.listAlerts(...args))
}

export async function createAlert(...args: Parameters<StoreModule['createAlert']>) {
  return withStore('createAlert', (store) => store.createAlert(...args))
}

export async function patchAlert(...args: Parameters<StoreModule['patchAlert']>) {
  return withStore('patchAlert', (store) => store.patchAlert(...args))
}

export async function purgeOldAttackEvents(
  ...args: Parameters<StoreModule['purgeOldAttackEvents']>
) {
  return withStore('purgeOldAttackEvents', (store) => store.purgeOldAttackEvents(...args))
}

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  await withStore('recordAttackEvent', (store) => store.recordAttackEvent(input))

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
  if (useSupabaseIdentityStore) {
    return supabaseStore.listReports(...args)
  }
  return withStore('listReports', (store) => store.listReports(...args))
}

export async function createReport(...args: Parameters<StoreModule['createReport']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.createReport(...args)
  }
  return withStore('createReport', (store) => store.createReport(...args))
}

export async function archiveReport(...args: Parameters<StoreModule['archiveReport']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.archiveReport(...args)
  }
  return withStore('archiveReport', (store) => store.archiveReport(...args))
}


export async function createUser(...args: Parameters<StoreModule['createUser']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.createUser(...args)
  }
  return withStore('createUser', (store) => store.createUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function registerUser(...args: Parameters<StoreModule['registerUser']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.registerUser(...args)
  }
  return withStore('registerUser', (store) => store.registerUser(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function getPortfolioProfile(...args: Parameters<StoreModule['getPortfolioProfile']>) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.getPortfolioProfile(...args)
  }
  return withStore('getPortfolioProfile', (store) => store.getPortfolioProfile(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function getPortfolioCertificationById(
  ...args: Parameters<StoreModule['getPortfolioCertificationById']>
) {
  if (useSupabaseIdentityStore) {
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
  if (useSupabaseIdentityStore) {
    return supabaseStore.updatePortfolioProfile(...args)
  }
  return withStore('updatePortfolioProfile', (store) => store.updatePortfolioProfile(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function updatePortfolioAvatar(
  ...args: Parameters<StoreModule['updatePortfolioAvatar']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.updatePortfolioAvatar(...args)
  }
  return withStore('updatePortfolioAvatar', (store) => store.updatePortfolioAvatar(...args), {
    allowMemoryFallback: allowCriticalMemoryFallback,
  })
}

export async function createPortfolioCertification(
  ...args: Parameters<StoreModule['createPortfolioCertification']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.createPortfolioCertification(...args)
  }
  return withStore(
    'createPortfolioCertification',
    (store) => store.createPortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function updatePortfolioCertification(
  ...args: Parameters<StoreModule['updatePortfolioCertification']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.updatePortfolioCertification(...args)
  }
  return withStore(
    'updatePortfolioCertification',
    (store) => store.updatePortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function deletePortfolioCertification(
  ...args: Parameters<StoreModule['deletePortfolioCertification']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.deletePortfolioCertification(...args)
  }
  return withStore(
    'deletePortfolioCertification',
    (store) => store.deletePortfolioCertification(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function createPortfolioEducation(
  ...args: Parameters<StoreModule['createPortfolioEducation']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.createPortfolioEducation(...args)
  }
  return withStore(
    'createPortfolioEducation',
    (store) => store.createPortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function updatePortfolioEducation(
  ...args: Parameters<StoreModule['updatePortfolioEducation']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.updatePortfolioEducation(...args)
  }
  return withStore(
    'updatePortfolioEducation',
    (store) => store.updatePortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
  )
}

export async function deletePortfolioEducation(
  ...args: Parameters<StoreModule['deletePortfolioEducation']>
) {
  if (useSupabaseIdentityStore) {
    return supabaseStore.deletePortfolioEducation(...args)
  }
  return withStore(
    'deletePortfolioEducation',
    (store) => store.deletePortfolioEducation(...args),
    { allowMemoryFallback: allowCriticalMemoryFallback },
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

