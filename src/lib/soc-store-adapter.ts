import * as memoryStore from '@/lib/soc-store-memory'
import { getSupabaseAttackMetrics, isSupabaseAttackStoreEnabled, recordAttackEventToSupabase } from '@/lib/supabase-attack-metrics'
import type { AttackEventInput, LiveMetrics } from '@/lib/soc-store-memory'

const STORAGE_MODE = (process.env.SOC_STORAGE ?? 'sqlite').toLowerCase()
const USE_MEMORY_STORE = STORAGE_MODE === 'memory'
type StoreModule = typeof import('@/lib/soc-store-memory')

let sqliteStorePromise: Promise<StoreModule> | null = null

if (STORAGE_MODE !== 'memory' && STORAGE_MODE !== 'sqlite') {
  console.warn(`[soc-store-adapter] Unsupported SOC_STORAGE="${STORAGE_MODE}". Falling back to sqlite.`)
}

async function getActiveStore(): Promise<StoreModule> {
  if (USE_MEMORY_STORE) return memoryStore
  if (!sqliteStorePromise) {
    sqliteStorePromise = import('@/lib/soc-store').then((mod) => mod as unknown as StoreModule)
  }
  return sqliteStorePromise
}

export async function writeAuditLog(...args: Parameters<StoreModule['writeAuditLog']>) {
  const store = await getActiveStore()
  return store.writeAuditLog(...args)
}

export async function cleanupExpiredSessions(
  ...args: Parameters<StoreModule['cleanupExpiredSessions']>
) {
  const store = await getActiveStore()
  return store.cleanupExpiredSessions(...args)
}

export async function authenticateUser(
  ...args: Parameters<StoreModule['authenticateUser']>
) {
  const store = await getActiveStore()
  return store.authenticateUser(...args)
}

export async function createSession(...args: Parameters<StoreModule['createSession']>) {
  const store = await getActiveStore()
  return store.createSession(...args)
}

export async function deleteSession(...args: Parameters<StoreModule['deleteSession']>) {
  const store = await getActiveStore()
  return store.deleteSession(...args)
}

export async function getSessionByToken(
  ...args: Parameters<StoreModule['getSessionByToken']>
) {
  const store = await getActiveStore()
  return store.getSessionByToken(...args)
}

export async function listAssignableUsers(
  ...args: Parameters<StoreModule['listAssignableUsers']>
) {
  const store = await getActiveStore()
  return store.listAssignableUsers(...args)
}

export async function listAlerts(...args: Parameters<StoreModule['listAlerts']>) {
  const store = await getActiveStore()
  return store.listAlerts(...args)
}

export async function createAlert(...args: Parameters<StoreModule['createAlert']>) {
  const store = await getActiveStore()
  return store.createAlert(...args)
}

export async function patchAlert(...args: Parameters<StoreModule['patchAlert']>) {
  const store = await getActiveStore()
  return store.patchAlert(...args)
}

export async function purgeOldAttackEvents(
  ...args: Parameters<StoreModule['purgeOldAttackEvents']>
) {
  const store = await getActiveStore()
  return store.purgeOldAttackEvents(...args)
}

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  const store = await getActiveStore()
  await store.recordAttackEvent(input)

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
  const store = await getActiveStore()
  const baseMetrics = await store.getLiveMetrics()

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
  const store = await getActiveStore()
  return store.listReports(...args)
}

export async function createReport(...args: Parameters<StoreModule['createReport']>) {
  const store = await getActiveStore()
  return store.createReport(...args)
}

export async function deleteReport(...args: Parameters<StoreModule['deleteReport']>) {
  const store = await getActiveStore()
  return store.deleteReport(...args)
}

export async function createUser(...args: Parameters<StoreModule['createUser']>) {
  const store = await getActiveStore()
  return store.createUser(...args)
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
} from '@/lib/soc-store-memory'
