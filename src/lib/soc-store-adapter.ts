import * as sqliteStore from '@/lib/soc-store'
import * as memoryStore from '@/lib/soc-store-memory'

const USE_MEMORY_STORE = process.env.SOC_STORAGE === 'memory' || process.env.VERCEL === '1'

const activeStore = USE_MEMORY_STORE ? memoryStore : sqliteStore

export const writeAuditLog = activeStore.writeAuditLog
export const cleanupExpiredSessions = activeStore.cleanupExpiredSessions
export const authenticateUser = activeStore.authenticateUser
export const createSession = activeStore.createSession
export const deleteSession = activeStore.deleteSession
export const getSessionByToken = activeStore.getSessionByToken
export const listAssignableUsers = activeStore.listAssignableUsers
export const listAlerts = activeStore.listAlerts
export const createAlert = activeStore.createAlert
export const patchAlert = activeStore.patchAlert
export const purgeOldAttackEvents = activeStore.purgeOldAttackEvents
export const recordAttackEvent = activeStore.recordAttackEvent
export const getLiveMetrics = activeStore.getLiveMetrics
export const listReports = activeStore.listReports
export const createReport = activeStore.createReport
export const deleteReport = activeStore.deleteReport
export const createUser = activeStore.createUser

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

