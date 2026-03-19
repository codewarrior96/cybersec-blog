import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { hashPassword, verifyPassword } from '@/lib/security'
import type { AlertPriority, AlertStatus, AttackSeverity, SessionUser, UserRole } from '@/lib/soc-types'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ATTACK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const SLA_TARGET_MINUTES: Record<AlertPriority, number> = {
  P1: 15,
  P2: 60,
  P3: 240,
  P4: 720,
}

const DEMO_USERS = [
  {
    username: 'ghost',
    displayName: 'Ghost Admin',
    role: 'admin' as const,
    password: 'demo_pass',
  },
  {
    username: 'analyst1',
    displayName: 'SOC Analyst 1',
    role: 'analyst' as const,
    password: 'analyst_pass',
  },
  {
    username: 'viewer1',
    displayName: 'SOC Viewer 1',
    role: 'viewer' as const,
    password: 'viewer_pass',
  },
]

const MEMORY_SECRET = process.env.SOC_DEMO_SECRET ?? 'soc-demo-secret'

interface InternalUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface InternalAlertNote {
  id: number
  alertId: number
  authorUserId: number | null
  note: string
  createdAt: string
}

interface InternalAlert {
  id: number
  title: string
  description: string
  status: AlertStatus
  priority: AlertPriority
  sourceEventId: number | null
  sourceIp: string | null
  sourceCountry: string | null
  attackType: string | null
  assigneeUserId: number | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface InternalAttackEvent {
  id: number
  externalId: number | null
  occurredAt: string
  sourceIP: string
  sourceCountry: string
  targetPort: number
  type: string
  severity: AttackSeverity
  createdAt: string
}

interface InternalReport {
  id: number
  title: string
  content: string
  severity: string
  tags: string[]
  createdByUserId: number | null
  createdAt: string
}

interface InternalAuditLog {
  id: number
  actorUserId: number | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown>
  metadata: RequestMetadata | undefined
  createdAt: string
}

interface StoreState {
  users: InternalUser[]
  alerts: InternalAlert[]
  alertNotes: InternalAlertNote[]
  attackEvents: InternalAttackEvent[]
  reports: InternalReport[]
  auditLogs: InternalAuditLog[]
  revokedTokens: Set<string>
  counters: {
    userId: number
    alertId: number
    noteId: number
    attackId: number
    reportId: number
    auditId: number
  }
  lastRetentionSweepAt: number
}

interface SessionTokenPayload {
  uid: number
  exp: number
  nonce: string
}

const STORE_KEY = '__SOC_MEMORY_STORE__'

function toIsoNow() {
  return new Date().toISOString()
}

function toAgeMinutes(iso: string) {
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor((Date.now() - value) / 60000))
}

function priorityWeight(priority: AlertPriority): number {
  if (priority === 'P1') return 4
  if (priority === 'P2') return 3
  if (priority === 'P3') return 2
  return 1
}

function severityToPriority(severity: AttackSeverity): AlertPriority {
  if (severity === 'critical') return 'P1'
  if (severity === 'high') return 'P2'
  return 'P3'
}

function mapAttackTypeToTag(attackType: string): string {
  const value = attackType.toLowerCase()
  if (value.includes('port')) return 'scanner'
  if (value.includes('ssh')) return 'bruteforce'
  if (value.includes('sql')) return 'sqli'
  if (value.includes('rce')) return 'exploit'
  if (value.includes('ddos')) return 'botnet'
  if (value.includes('phishing')) return 'phishing'
  return 'threat'
}

function createSeededState(): StoreState {
  const now = toIsoNow()
  const users: InternalUser[] = DEMO_USERS.map((user, index) => ({
    id: index + 1,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    passwordHash: hashPassword(user.password),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))

  return {
    users,
    alerts: [],
    alertNotes: [],
    attackEvents: [],
    reports: [],
    auditLogs: [],
    revokedTokens: new Set<string>(),
    counters: {
      userId: users.length + 1,
      alertId: 1,
      noteId: 1,
      attackId: 1,
      reportId: 1,
      auditId: 1,
    },
    lastRetentionSweepAt: 0,
  }
}

function getStore(): StoreState {
  const root = globalThis as unknown as Record<string, unknown>
  const existing = root[STORE_KEY] as StoreState | undefined
  if (existing) return existing
  const created = createSeededState()
  root[STORE_KEY] = created
  return created
}

function toSessionUser(user: InternalUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }
}

function findActiveUserById(userId: number | null | undefined): InternalUser | null {
  if (!userId) return null
  const user = getStore().users.find((item) => item.id === userId && item.isActive)
  return user ?? null
}

function findActiveUserByUsername(username: string): InternalUser | null {
  const user = getStore().users.find((item) => item.username === username && item.isActive)
  return user ?? null
}

function signPayload(payloadBase64: string) {
  return createHmac('sha256', MEMORY_SECRET).update(payloadBase64).digest('base64url')
}

function encodeToken(payload: SessionTokenPayload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signPayload(payloadBase64)
  return `${payloadBase64}.${signature}`
}

function decodeToken(token: string): SessionTokenPayload | null {
  const [payloadBase64, signature] = token.split('.')
  if (!payloadBase64 || !signature) return null

  const expected = signPayload(payloadBase64)
  try {
    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== providedBuffer.length) return null
    if (!timingSafeEqual(expectedBuffer, providedBuffer)) return null
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as Partial<SessionTokenPayload>
    if (typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number' || typeof parsed.nonce !== 'string') {
      return null
    }
    return {
      uid: parsed.uid,
      exp: parsed.exp,
      nonce: parsed.nonce,
    }
  } catch {
    return null
  }
}

function sortAlertsForList(a: InternalAlert, b: InternalAlert) {
  const rank = (priority: AlertPriority) => {
    if (priority === 'P1') return 1
    if (priority === 'P2') return 2
    if (priority === 'P3') return 3
    return 4
  }
  if (rank(a.priority) !== rank(b.priority)) return rank(a.priority) - rank(b.priority)

  const aTime = new Date(a.createdAt).getTime()
  const bTime = new Date(b.createdAt).getTime()
  if (aTime !== bTime) return bTime - aTime
  return b.id - a.id
}

function sortAlertsForQueue(a: InternalAlert, b: InternalAlert) {
  const rank = (priority: AlertPriority) => {
    if (priority === 'P1') return 1
    if (priority === 'P2') return 2
    if (priority === 'P3') return 3
    return 4
  }
  if (rank(a.priority) !== rank(b.priority)) return rank(a.priority) - rank(b.priority)
  const aTime = new Date(a.createdAt).getTime()
  const bTime = new Date(b.createdAt).getTime()
  if (aTime !== bTime) return aTime - bTime
  return a.id - b.id
}

function noteCountByAlertId(alertId: number) {
  return getStore().alertNotes.filter((note) => note.alertId === alertId).length
}

function toAlertRecord(alert: InternalAlert): AlertRecord {
  const assignee = findActiveUserById(alert.assigneeUserId)
  const createdBy = findActiveUserById(alert.createdByUserId)
  return {
    id: alert.id,
    title: alert.title,
    description: alert.description,
    status: alert.status,
    priority: alert.priority,
    sourceEventId: alert.sourceEventId,
    sourceIp: alert.sourceIp,
    sourceCountry: alert.sourceCountry,
    attackType: alert.attackType,
    assignee: assignee ? toSessionUser(assignee) : null,
    createdBy: createdBy ? toSessionUser(createdBy) : null,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    resolvedAt: alert.resolvedAt,
    noteCount: noteCountByAlertId(alert.id),
    ageMinutes: toAgeMinutes(alert.createdAt),
  }
}

export interface RequestMetadata {
  ipAddress: string | null
  userAgent: string | null
}

export interface SessionRecord {
  token: string
  user: SessionUser
  expiresAt: string
}

export interface AlertRecord {
  id: number
  title: string
  description: string
  status: AlertStatus
  priority: AlertPriority
  sourceEventId: number | null
  sourceIp: string | null
  sourceCountry: string | null
  attackType: string | null
  assignee: SessionUser | null
  createdBy: SessionUser | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  noteCount: number
  ageMinutes: number
}

export interface AlertListResult {
  alerts: AlertRecord[]
  nextCursor: number | null
}

export interface ListAlertsFilters {
  status?: AlertStatus
  priority?: AlertPriority
  assignee?: 'me' | 'unassigned' | number
  limit?: number
  cursor?: number
  meUserId?: number
}

export interface AlertPatchInput {
  status?: AlertStatus
  priority?: AlertPriority
  assigneeId?: number | null
  note?: string
  claim?: boolean
  resolve?: boolean
}

export interface AttackEventInput {
  externalId?: number | null
  occurredAt: string
  sourceIP: string
  sourceCountry: string
  targetPort: number
  type: string
  severity: AttackSeverity
}

export interface UserWorkload {
  id: number
  username: string
  displayName: string
  role: UserRole
  activeWorkload: number
}

export interface LiveMetrics {
  generatedAt: string
  shiftSnapshot: {
    openCritical: number
    unassigned: number
    slaBreaches: number
  }
  triageBoard: {
    new: number
    inProgress: number
    blocked: number
    resolved: number
  }
  sla: {
    p1FirstResponseMinutes: number
    avgResolutionMinutes: number
    breachCount: number
  }
  assignment: UserWorkload[]
  alertQueue: AlertRecord[]
  attack: {
    topCountries: Array<{ name: string; count: number }>
    topTags: Array<{ name: string; count: number }>
    attacksPerMinute: number
    activeIps: number
    liveDensity: number
    totalLast24h: number
  }
}

export interface ReportRecord {
  id: number
  title: string
  content: string
  severity: string
  tags: string[]
  createdAt: string
}

export async function writeAuditLog(input: {
  actorUserId: number | null
  action: string
  entityType: string
  entityId?: string | number | null
  details?: Record<string, unknown>
  metadata?: RequestMetadata
}) {
  const store = getStore()
  store.auditLogs.push({
    id: store.counters.auditId++,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    details: input.details ?? {},
    metadata: input.metadata,
    createdAt: toIsoNow(),
  })
}

export async function cleanupExpiredSessions() {
  const now = Date.now()
  const store = getStore()
  for (const token of Array.from(store.revokedTokens)) {
    const parsed = decodeToken(token)
    if (!parsed || parsed.exp <= now) {
      store.revokedTokens.delete(token)
    }
  }
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  const user = findActiveUserByUsername(username)
  if (!user) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  return toSessionUser(user)
}

export async function createSession(user: SessionUser, _metadata: RequestMetadata): Promise<SessionRecord> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const token = encodeToken({
    uid: user.id,
    exp: expiresAt,
    nonce: randomBytes(12).toString('hex'),
  })

  return {
    token,
    user,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export async function deleteSession(token: string) {
  getStore().revokedTokens.add(token)
}

export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  if (!token) return null

  await cleanupExpiredSessions()
  const store = getStore()
  if (store.revokedTokens.has(token)) return null

  const parsed = decodeToken(token)
  if (!parsed) return null
  if (parsed.exp <= Date.now()) return null

  const user = findActiveUserById(parsed.uid)
  if (!user) return null

  return {
    token,
    user: toSessionUser(user),
    expiresAt: new Date(parsed.exp).toISOString(),
  }
}

export async function listAssignableUsers(): Promise<UserWorkload[]> {
  const store = getStore()
  return store.users
    .filter((user) => user.isActive)
    .map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      activeWorkload: store.alerts.filter((alert) => alert.assigneeUserId === user.id && alert.status !== 'resolved').length,
    }))
    .sort((a, b) => {
      const roleRank = (role: UserRole) => (role === 'admin' ? 1 : role === 'analyst' ? 2 : 3)
      if (roleRank(a.role) !== roleRank(b.role)) return roleRank(a.role) - roleRank(b.role)
      if (a.activeWorkload !== b.activeWorkload) return b.activeWorkload - a.activeWorkload
      return a.username.localeCompare(b.username)
    })
}

export async function listAlerts(filters: ListAlertsFilters): Promise<AlertListResult> {
  const store = getStore()
  const limit = Math.min(50, Math.max(1, filters.limit ?? 12))

  const filtered = store.alerts
    .filter((alert) => {
      if (filters.status && alert.status !== filters.status) return false
      if (filters.priority && alert.priority !== filters.priority) return false
      if (filters.assignee === 'unassigned' && alert.assigneeUserId != null) return false
      if (filters.assignee === 'me') {
        if (!filters.meUserId) return false
        if (alert.assigneeUserId !== filters.meUserId) return false
      }
      if (typeof filters.assignee === 'number' && alert.assigneeUserId !== filters.assignee) return false
      if (typeof filters.cursor === 'number' && alert.id >= filters.cursor) return false
      return true
    })
    .sort(sortAlertsForList)

  const hasNext = filtered.length > limit
  const sliced = hasNext ? filtered.slice(0, limit) : filtered
  const nextCursor = hasNext ? sliced[sliced.length - 1]?.id ?? null : null

  return {
    alerts: sliced.map(toAlertRecord),
    nextCursor,
  }
}

export async function createAlert(input: {
  title: string
  description: string
  priority: AlertPriority
  status?: AlertStatus
  assigneeId?: number | null
  sourceEventId?: number | null
  sourceIp?: string | null
  sourceCountry?: string | null
  attackType?: string | null
  createdByUserId?: number | null
  note?: string
  metadata?: RequestMetadata
}): Promise<AlertRecord> {
  const store = getStore()
  const now = toIsoNow()
  const id = store.counters.alertId++

  const alert: InternalAlert = {
    id,
    title: input.title,
    description: input.description,
    status: input.status ?? 'new',
    priority: input.priority,
    sourceEventId: input.sourceEventId ?? null,
    sourceIp: input.sourceIp ?? null,
    sourceCountry: input.sourceCountry ?? null,
    attackType: input.attackType ?? null,
    assigneeUserId: input.assigneeId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: input.status === 'resolved' ? now : null,
  }
  store.alerts.push(alert)

  if (input.note && input.note.trim()) {
    store.alertNotes.push({
      id: store.counters.noteId++,
      alertId: id,
      authorUserId: input.createdByUserId ?? null,
      note: input.note.trim(),
      createdAt: now,
    })
  }

  await writeAuditLog({
    actorUserId: input.createdByUserId ?? null,
    action: 'alert.create',
    entityType: 'alert',
    entityId: id,
    details: {
      status: alert.status,
      priority: alert.priority,
    },
    metadata: input.metadata,
  })

  return toAlertRecord(alert)
}

export async function patchAlert(
  alertId: number,
  patch: AlertPatchInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<AlertRecord | null> {
  const store = getStore()
  const alert = store.alerts.find((item) => item.id === alertId)
  if (!alert) return null

  let nextStatus = alert.status
  let nextPriority = alert.priority
  let nextAssigneeId = alert.assigneeUserId
  let resolvedAt = alert.resolvedAt

  if (patch.claim) {
    nextAssigneeId = actor.id
  }
  if (typeof patch.assigneeId !== 'undefined') {
    nextAssigneeId = patch.assigneeId
  }
  if (patch.status) {
    nextStatus = patch.status
  }
  if (patch.priority) {
    nextPriority = patch.priority
  }
  if (patch.resolve) {
    nextStatus = 'resolved'
    resolvedAt = toIsoNow()
  } else if (nextStatus !== 'resolved') {
    resolvedAt = null
  }

  alert.status = nextStatus
  alert.priority = nextPriority
  alert.assigneeUserId = nextAssigneeId ?? null
  alert.resolvedAt = resolvedAt
  alert.updatedAt = toIsoNow()

  if (patch.note && patch.note.trim()) {
    store.alertNotes.push({
      id: store.counters.noteId++,
      alertId,
      authorUserId: actor.id,
      note: patch.note.trim(),
      createdAt: toIsoNow(),
    })
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'alert.patch',
    entityType: 'alert',
    entityId: alertId,
    details: {
      status: alert.status,
      priority: alert.priority,
      assigneeId: alert.assigneeUserId,
      resolvedAt: alert.resolvedAt,
    },
    metadata,
  })

  return toAlertRecord(alert)
}

export async function purgeOldAttackEvents() {
  const store = getStore()
  const now = Date.now()
  if (now - store.lastRetentionSweepAt < 60_000) {
    return
  }

  store.lastRetentionSweepAt = now
  const cutoff = now - ATTACK_RETENTION_MS
  store.attackEvents = store.attackEvents.filter((event) => new Date(event.occurredAt).getTime() >= cutoff)
}

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  const store = getStore()
  const now = toIsoNow()
  const attackId = store.counters.attackId++

  store.attackEvents.push({
    id: attackId,
    externalId: input.externalId ?? null,
    occurredAt: input.occurredAt,
    sourceIP: input.sourceIP,
    sourceCountry: input.sourceCountry,
    targetPort: input.targetPort,
    type: input.type,
    severity: input.severity,
    createdAt: now,
  })

  const shouldEscalate = input.severity === 'critical' || (input.severity === 'high' && Math.random() < 0.45)
  if (shouldEscalate) {
    const twentyMinutesAgo = Date.now() - 20 * 60 * 1000
    const duplicate = store.alerts.find((alert) => {
      if (alert.status === 'resolved') return false
      if (alert.sourceIp !== input.sourceIP) return false
      if (alert.attackType !== input.type) return false
      return new Date(alert.createdAt).getTime() >= twentyMinutesAgo
    })

    if (!duplicate) {
      await createAlert({
        title: `${input.type} from ${input.sourceCountry}`,
        description: `${input.sourceIP}:${input.targetPort} -> severity ${input.severity.toUpperCase()}`,
        priority: severityToPriority(input.severity),
        status: 'new',
        sourceEventId: attackId,
        sourceIp: input.sourceIP,
        sourceCountry: input.sourceCountry,
        attackType: input.type,
        createdByUserId: null,
        note: 'Auto-generated from live attack ingestion pipeline.',
      })
    }
  }

  await purgeOldAttackEvents()
}

export async function getLiveMetrics(): Promise<LiveMetrics> {
  await purgeOldAttackEvents()
  const store = getStore()

  const triage = {
    new: store.alerts.filter((alert) => alert.status === 'new').length,
    inProgress: store.alerts.filter((alert) => alert.status === 'in_progress').length,
    blocked: store.alerts.filter((alert) => alert.status === 'blocked').length,
    resolved: store.alerts.filter((alert) => alert.status === 'resolved').length,
  }

  const assignment = await listAssignableUsers()
  const queue = store.alerts
    .filter((alert) => alert.status !== 'resolved')
    .sort(sortAlertsForQueue)
    .slice(0, 8)
    .map(toAlertRecord)

  const sevenDaysAgo = Date.now() - ATTACK_RETENTION_MS
  const recentAttacks = store.attackEvents.filter((event) => new Date(event.occurredAt).getTime() >= sevenDaysAgo)

  const countryMap = new Map<string, number>()
  const tagMap = new Map<string, number>()
  for (const attack of recentAttacks) {
    countryMap.set(attack.sourceCountry, (countryMap.get(attack.sourceCountry) ?? 0) + 1)
    const tag = mapAttackTypeToTag(attack.type)
    tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
  }

  const topCountries = Array.from(countryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)

  const topTags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const oneMinuteAgo = Date.now() - 60 * 1000
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000

  const attacksPerMinute = store.attackEvents.filter((event) => new Date(event.occurredAt).getTime() >= oneMinuteAgo).length
  const activeIps = new Set(
    store.attackEvents
      .filter((event) => new Date(event.occurredAt).getTime() >= fifteenMinutesAgo)
      .map((event) => event.sourceIP),
  ).size
  const totalLast24h = store.attackEvents.filter((event) => new Date(event.occurredAt).getTime() >= dayAgo).length

  const openAlerts = store.alerts.filter((alert) => alert.status !== 'resolved')
  const p1Open = openAlerts.filter((alert) => alert.priority === 'P1').length
  const unassignedOpen = openAlerts.filter((alert) => alert.assigneeUserId == null).length

  const resolvedDurations = store.alerts
    .filter((alert) => alert.resolvedAt)
    .map((alert) => {
      const start = new Date(alert.createdAt).getTime()
      const end = new Date(alert.resolvedAt as string).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
      return (end - start) / 60000
    })
    .filter((value): value is number => value != null)

  const avgResolutionMinutes =
    resolvedDurations.length === 0
      ? 0
      : resolvedDurations.reduce((sum, item) => sum + item, 0) / resolvedDurations.length

  let breachCount = 0
  for (const alert of openAlerts) {
    const ageMinutes = toAgeMinutes(alert.createdAt)
    if (ageMinutes > SLA_TARGET_MINUTES[alert.priority]) {
      breachCount += 1
    }
  }

  const uniqueCountries = topCountries.length
  const topPriorityPressure = queue.reduce((sum, alert) => sum + priorityWeight(alert.priority), 0)
  const liveDensity = Math.min(
    100,
    Math.max(6, Math.round(Math.sqrt(totalLast24h + 1) * 6 + uniqueCountries * 4 + topPriorityPressure * 2)),
  )

  return {
    generatedAt: toIsoNow(),
    shiftSnapshot: {
      openCritical: p1Open,
      unassigned: unassignedOpen,
      slaBreaches: breachCount,
    },
    triageBoard: triage,
    sla: {
      p1FirstResponseMinutes: 0,
      avgResolutionMinutes: Number(avgResolutionMinutes.toFixed(1)),
      breachCount,
    },
    assignment,
    alertQueue: queue,
    attack: {
      topCountries,
      topTags,
      attacksPerMinute,
      activeIps,
      liveDensity,
      totalLast24h,
    },
  }
}

export async function listReports(): Promise<ReportRecord[]> {
  const store = getStore()
  return [...store.reports]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      if (aTime !== bTime) return bTime - aTime
      return b.id - a.id
    })
    .map((report) => ({
      id: report.id,
      title: report.title,
      content: report.content,
      severity: report.severity,
      tags: report.tags,
      createdAt: report.createdAt,
    }))
}

export async function createReport(input: {
  title: string
  content: string
  severity: string
  tags: string[]
  actor: SessionUser
  metadata: RequestMetadata
}): Promise<ReportRecord> {
  const store = getStore()
  const report: InternalReport = {
    id: store.counters.reportId++,
    title: input.title,
    content: input.content,
    severity: input.severity,
    tags: input.tags,
    createdByUserId: input.actor.id,
    createdAt: toIsoNow(),
  }
  store.reports.push(report)

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'report.create',
    entityType: 'report',
    entityId: report.id,
    details: { severity: input.severity, tagCount: input.tags.length },
    metadata: input.metadata,
  })

  return {
    id: report.id,
    title: report.title,
    content: report.content,
    severity: report.severity,
    tags: report.tags,
    createdAt: report.createdAt,
  }
}

export async function deleteReport(id: number, actor: SessionUser, metadata: RequestMetadata): Promise<boolean> {
  const store = getStore()
  const index = store.reports.findIndex((report) => report.id === id)
  if (index < 0) return false
  store.reports.splice(index, 1)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'report.delete',
    entityType: 'report',
    entityId: id,
    metadata,
  })

  return true
}

export async function createUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  actor: SessionUser
  metadata: RequestMetadata
}) {
  const store = getStore()
  const exists = store.users.some((user) => user.username === input.username)
  if (exists) {
    throw new Error('User already exists')
  }

  const now = toIsoNow()
  const user: InternalUser = {
    id: store.counters.userId++,
    username: input.username,
    displayName: input.displayName,
    role: input.role,
    passwordHash: input.passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  store.users.push(user)

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    details: { username: input.username, role: input.role },
    metadata: input.metadata,
  })
}

