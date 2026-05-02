import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { isReservedUsername } from '@/lib/identity-rules'
import { hashPassword, verifyPassword } from '@/lib/security'
import { dedupeStringList, getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import type { AlertPriority, AlertStatus, AttackSeverity, ReportStatus, SessionUser, UserRole } from '@/lib/soc-types'
import { mapAttackTypeToTag, priorityWeight, severityToPriority } from '@/lib/soc-attack-utils'
import type {
  CertificationStatus,
  EducationStatus,
  PortfolioCertificationRecord,
  PortfolioEducationRecord,
  PortfolioProfileFields,
  PortfolioProfileRecord,
} from '@/lib/portfolio-profile'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ATTACK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const SLA_TARGET_MINUTES: Record<AlertPriority, number> = {
  P1: 15,
  P2: 60,
  P3: 240,
  P4: 720,
}

const DEMO_USERS: Array<{
  username: string
  displayName: string
  role: UserRole
  password: string
}> = []

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

interface InternalProfile {
  userId: number
  headline: string
  bio: string
  location: string
  website: string
  specialties: string[]
  tools: string[]
  avatarPath: string | null
  avatarName: string | null
  avatarMimeType: string | null
  createdAt: string
  updatedAt: string
}

interface InternalCertification {
  id: number
  userId: number
  title: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialId: string
  verifyUrl: string
  status: CertificationStatus
  notes: string
  assetPath: string | null
  assetName: string | null
  assetMimeType: string | null
  assetSize: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface InternalEducation {
  id: number
  userId: number
  institution: string
  program: string
  degree: string
  startDate: string
  endDate: string
  status: EducationStatus
  description: string
  sortOrder: number
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
  firstResponseAt: string | null
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
  status: ReportStatus
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
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
  profiles: InternalProfile[]
  certifications: InternalCertification[]
  education: InternalEducation[]
  alerts: InternalAlert[]
  alertNotes: InternalAlertNote[]
  attackEvents: InternalAttackEvent[]
  reports: InternalReport[]
  auditLogs: InternalAuditLog[]
  revokedTokens: Set<string>
  counters: {
    userId: number
    certificationId: number
    educationId: number
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

  const profiles: InternalProfile[] = []
  const certifications: InternalCertification[] = []
  const education: InternalEducation[] = []
  let certificationIdCounter = 1
  let educationIdCounter = 1

  users.forEach((user) => {
    const seed = getPortfolioSeedForUser({
      username: user.username,
      displayName: user.displayName,
    })

    profiles.push({
      userId: user.id,
      headline: seed.profile.headline,
      bio: seed.profile.bio,
      location: seed.profile.location,
      website: seed.profile.website,
      specialties: [...seed.profile.specialties],
      tools: [...seed.profile.tools],
      avatarPath: seed.profile.avatarPath ?? null,
      avatarName: seed.profile.avatarName ?? null,
      avatarMimeType: seed.profile.avatarMimeType ?? null,
      createdAt: now,
      updatedAt: now,
    })

    seed.certifications.forEach((item, index) => {
      certifications.push({
        id: certificationIdCounter++,
        userId: user.id,
        title: item.title,
        issuer: item.issuer,
        issueDate: item.issueDate,
        expiryDate: item.expiryDate,
        credentialId: item.credentialId,
        verifyUrl: item.verifyUrl,
        status: item.status,
        notes: item.notes,
        assetPath: item.assetPath,
        assetName: item.assetName,
        assetMimeType: item.assetMimeType,
        assetSize: item.assetSize,
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
    })

    seed.education.forEach((item, index) => {
      education.push({
        id: educationIdCounter++,
        userId: user.id,
        institution: item.institution,
        program: item.program,
        degree: item.degree,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        description: item.description,
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
    })
  })

  return {
    users,
    profiles,
    certifications,
    education,
    alerts: [],
    alertNotes: [],
    attackEvents: [],
    reports: [],
    auditLogs: [],
    revokedTokens: new Set<string>(),
    counters: {
      userId: users.length + 1,
      certificationId: certifications.length + 1,
      educationId: education.length + 1,
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
    // Memory store doesn't persist email; stays unverified for fallback
    // sessions. Production uses supabase store which surfaces real value.
    emailVerified: false,
  }
}

function findProfileByUserId(userId: number): InternalProfile | null {
  return getStore().profiles.find((item) => item.userId === userId) ?? null
}

function findCertificationById(id: number): InternalCertification | null {
  return getStore().certifications.find((item) => item.id === id) ?? null
}

function toCertificationRecord(item: InternalCertification): PortfolioCertificationRecord {
  return {
    id: item.id,
    userId: item.userId,
    title: item.title,
    issuer: item.issuer,
    issueDate: item.issueDate,
    expiryDate: item.expiryDate,
    credentialId: item.credentialId,
    verifyUrl: item.verifyUrl,
    status: item.status,
    notes: item.notes,
    assetPath: item.assetPath,
    assetName: item.assetName,
    assetMimeType: item.assetMimeType,
    assetSize: item.assetSize,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toEducationRecord(item: InternalEducation): PortfolioEducationRecord {
  return {
    id: item.id,
    userId: item.userId,
    institution: item.institution,
    program: item.program,
    degree: item.degree,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    description: item.description,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function ensureProfileForUser(user: InternalUser): InternalProfile {
  const store = getStore()
  const existing = store.profiles.find((item) => item.userId === user.id)
  if (existing) return existing

  const now = toIsoNow()
  const seed = getPortfolioSeedForUser({
    username: user.username,
    displayName: user.displayName,
  })

  const created: InternalProfile = {
    userId: user.id,
    headline: seed.profile.headline,
    bio: seed.profile.bio,
    location: seed.profile.location,
    website: seed.profile.website,
    specialties: [...seed.profile.specialties],
    tools: [...seed.profile.tools],
    avatarPath: seed.profile.avatarPath ?? null,
    avatarName: seed.profile.avatarName ?? null,
    avatarMimeType: seed.profile.avatarMimeType ?? null,
    createdAt: now,
    updatedAt: now,
  }
  store.profiles.push(created)
  return created
}

function findActiveUserById(userId: number | null | undefined): InternalUser | null {
  if (!userId) return null
  const user = getStore().users.find((item) => item.id === userId && item.isActive)
  return user ?? null
}

function normalizeUsernameKey(username: string) {
  return username.trim().toLowerCase()
}

function findActiveUserByUsername(username: string): InternalUser | null {
  const usernameKey = normalizeUsernameKey(username)
  const user = getStore().users.find(
    (item) => normalizeUsernameKey(item.username) === usernameKey && item.isActive,
  )
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
    firstResponseAt: alert.firstResponseAt,
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
  firstResponseAt: string | null
  noteCount: number
  ageMinutes: number
}

export interface AlertListResult {
  alerts: AlertRecord[]
  nextCursor: number | null
  total: number
  activeTotal: number
  resolvedTotal: number
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
  status: ReportStatus
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface PortfolioProfilePatchInput extends PortfolioProfileFields {}

export interface PortfolioCertificationInput {
  title: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialId: string
  verifyUrl: string
  status: CertificationStatus
  notes: string
  assetPath?: string | null
  assetName?: string | null
  assetMimeType?: string | null
  assetSize?: number | null
  sortOrder?: number
}

export interface PortfolioEducationInput {
  institution: string
  program: string
  degree: string
  startDate: string
  endDate: string
  status: EducationStatus
  description: string
  sortOrder?: number
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
  const total = store.alerts.length
  const activeTotal = store.alerts.filter((alert) => alert.status !== 'resolved').length
  const resolvedTotal = total - activeTotal

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
    total,
    activeTotal,
    resolvedTotal,
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

  const initialStatus = input.status ?? 'new'
  const initialAssignee = input.assigneeId ?? null
  const hasInitialResponse = initialStatus !== 'new' || initialAssignee != null
  const alert: InternalAlert = {
    id,
    title: input.title,
    description: input.description,
    status: initialStatus,
    priority: input.priority,
    sourceEventId: input.sourceEventId ?? null,
    sourceIp: input.sourceIp ?? null,
    sourceCountry: input.sourceCountry ?? null,
    attackType: input.attackType ?? null,
    assigneeUserId: initialAssignee,
    createdByUserId: input.createdByUserId ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: initialStatus === 'resolved' ? now : null,
    firstResponseAt: hasInitialResponse ? now : null,
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

  const statusChanged = nextStatus !== alert.status
  const assigneeChanged = (nextAssigneeId ?? null) !== alert.assigneeUserId
  const now = toIsoNow()

  alert.status = nextStatus
  alert.priority = nextPriority
  alert.assigneeUserId = nextAssigneeId ?? null
  alert.resolvedAt = resolvedAt
  alert.updatedAt = now
  if (!alert.firstResponseAt && (statusChanged || assigneeChanged)) {
    alert.firstResponseAt = now
  }

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

const VALID_ATTACK_SEVERITIES: ReadonlySet<AttackSeverity> = new Set<AttackSeverity>([
  'critical',
  'high',
  'low',
])

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  if (!VALID_ATTACK_SEVERITIES.has(input.severity)) {
    throw new Error(`Invalid attack severity: ${String(input.severity)}`)
  }

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

  const shouldEscalate = input.severity === 'critical' || (input.severity === 'high' && Math.random() < 0.08)
  if (shouldEscalate) {
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000
    const duplicate = store.alerts.find((alert) => {
      if (alert.status === 'resolved') return false
      if (alert.sourceCountry !== input.sourceCountry) return false
      if (alert.attackType !== input.type) return false
      return new Date(alert.createdAt).getTime() >= fifteenMinutesAgo
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

  const p1FirstResponseDurations = store.alerts
    .filter((alert) => alert.priority === 'P1' && alert.firstResponseAt)
    .map((alert) => {
      const start = new Date(alert.createdAt).getTime()
      const end = new Date(alert.firstResponseAt as string).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
      return (end - start) / 60000
    })
    .filter((value): value is number => value != null)

  const p1FirstResponseMinutes =
    p1FirstResponseDurations.length === 0
      ? 0
      : p1FirstResponseDurations.reduce((sum, item) => sum + item, 0) / p1FirstResponseDurations.length

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
      p1FirstResponseMinutes: Number(p1FirstResponseMinutes.toFixed(1)),
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

export async function listReports(
  filters: { limit?: number; cursor?: number; status?: ReportStatus | 'all' } = {},
): Promise<{ reports: ReportRecord[]; hasNext: boolean; nextCursor: number | null }> {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
  const store = getStore()
  const statusFilter = filters.status ?? 'active'
  const sorted = [...store.reports]
    .filter((report) => statusFilter === 'all' || report.status === statusFilter)
    .sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    if (aTime !== bTime) return bTime - aTime
    return b.id - a.id
    })

  // Cursor: id of the last item from the previous page â€” skip until past it
  let startIndex = 0
  if (filters.cursor != null) {
    const cursorPos = sorted.findIndex((r) => r.id === filters.cursor)
    startIndex = cursorPos === -1 ? sorted.length : cursorPos + 1
  }

  const slice = sorted.slice(startIndex, startIndex + limit + 1)
  const hasNext = slice.length > limit
  const page = slice.slice(0, limit).map((report) => ({
    id: report.id,
    title: report.title,
    content: report.content,
    severity: report.severity,
    tags: report.tags,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    archivedAt: report.archivedAt,
  }))

  return {
    reports: page,
    hasNext,
    nextCursor: hasNext ? page[page.length - 1].id : null,
  }
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
    status: 'active',
    createdByUserId: input.actor.id,
    createdAt: toIsoNow(),
    updatedAt: toIsoNow(),
    archivedAt: null,
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
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    archivedAt: report.archivedAt,
  }
}

export async function archiveReport(id: number, actor: SessionUser, metadata: RequestMetadata): Promise<ReportRecord | null> {
  const store = getStore()
  const report = store.reports.find((item) => item.id === id)
  if (!report) return null

  if (actor.role === 'viewer' && report.createdByUserId !== actor.id) {
    throw new Error('FORBIDDEN')
  }

  if (report.status !== 'archived') {
    report.status = 'archived'
    report.archivedAt = toIsoNow()
    report.updatedAt = report.archivedAt

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'report.archive',
      entityType: 'report',
      entityId: id,
      metadata,
    })
  }

  return {
    id: report.id,
    title: report.title,
    content: report.content,
    severity: report.severity,
    tags: report.tags,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    archivedAt: report.archivedAt,
  }
}


/**
 * Phase 3 stub: memory store doesn't persist emails; email-key lookups
 * always return null. Production runs supabase JSON store, so this
 * branch is dormant in the live identity flow. Kept to satisfy the
 * adapter contract.
 */
export async function readUserByEmailKey(_emailKey: string): Promise<null> {
  return null
}

/**
 * Phase 4.5 stub: looks up a full user record by username. Memory store
 * doesn't carry email columns on InternalUser, so we cannot return a
 * StoredUser-shaped record; null is the contract-safe answer. Production
 * identity flow runs supabase JSON store and uses the real lookup; this
 * stub exists only so the adapter contract type-checks.
 */
export async function readUserByUsername(_username: string): Promise<null> {
  return null
}

// Phase 4 stubs — memory store does not persist email-verification
// tokens; these are no-ops returning null so the adapter contract
// stays consistent. Production identity flow runs supabase store.
export async function findUserByVerifyToken(_token: string): Promise<null> {
  return null
}

export async function setEmailVerified(_userId: number): Promise<null> {
  return null
}

export async function setEmailVerifyToken(
  _userId: number,
  _token: string,
  _expiresAt: string,
): Promise<null> {
  return null
}

export async function registerUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  metadata: RequestMetadata
  // Phase 3 mirror: optional email-verification fields. Memory store is
  // a fallback for local dev / Vercel cold-start — accept-and-ignore so
  // the adapter contract stays consistent. Email persistence in memory
  // mode is not required for current behavior; if needed in the future,
  // add fields to InternalUser and persist here.
  email?: string
  emailVerifyToken?: string | null
  emailVerifyTokenExpiresAt?: string | null
}): Promise<SessionUser> {
  const store = getStore()
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }
  const usernameKey = normalizeUsernameKey(input.username)
  const exists = store.users.some((user) => normalizeUsernameKey(user.username) === usernameKey)
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
  ensureProfileForUser(user)

  await writeAuditLog({
    actorUserId: user.id,
    action: 'user.register',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role },
    metadata: input.metadata,
  })

  return toSessionUser(user)
}

export async function getPortfolioProfile(userId: number): Promise<PortfolioProfileRecord | null> {
  const user = findActiveUserById(userId)
  if (!user) return null
  const profile = ensureProfileForUser(user)
  const store = getStore()

  return {
    user: toSessionUser(user),
    profile: {
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      specialties: [...profile.specialties],
      tools: [...profile.tools],
      avatarPath: profile.avatarPath,
      avatarName: profile.avatarName,
      avatarMimeType: profile.avatarMimeType,
      updatedAt: profile.updatedAt,
    },
    certifications: store.certifications
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id)
      .map(toCertificationRecord),
    education: store.education
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id)
      .map(toEducationRecord),
  }
}

export async function getPortfolioCertificationById(
  certificationId: number,
): Promise<PortfolioCertificationRecord | null> {
  const item = findCertificationById(certificationId)
  return item ? toCertificationRecord(item) : null
}

export async function updatePortfolioProfile(
  userId: number,
  patch: PortfolioProfilePatchInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioProfileRecord | null> {
  const user = findActiveUserById(userId)
  if (!user) return null
  const profile = ensureProfileForUser(user)
  const now = toIsoNow()

  profile.headline = patch.headline.trim()
  profile.bio = patch.bio.trim()
  profile.location = patch.location.trim()
  profile.website = patch.website.trim()
  profile.specialties = dedupeStringList(patch.specialties)
  profile.tools = dedupeStringList(patch.tools)
  profile.updatedAt = now

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.update',
    entityType: 'profile',
    entityId: userId,
    details: { headline: profile.headline, specialtyCount: profile.specialties.length, toolCount: profile.tools.length },
    metadata,
  })

  return getPortfolioProfile(userId)
}

export async function updatePortfolioAvatar(
  userId: number,
  input: {
    avatarPath: string | null
    avatarName: string | null
    avatarMimeType: string | null
  },
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioProfileRecord | null> {
  const user = findActiveUserById(userId)
  if (!user) return null
  const profile = ensureProfileForUser(user)

  profile.avatarPath = input.avatarPath
  profile.avatarName = input.avatarName
  profile.avatarMimeType = input.avatarMimeType
  profile.updatedAt = toIsoNow()

  await writeAuditLog({
    actorUserId: actor.id,
    action: input.avatarPath ? 'profile.avatar.update' : 'profile.avatar.clear',
    entityType: 'profile',
    entityId: userId,
    details: { hasAvatar: Boolean(input.avatarPath) },
    metadata,
  })

  return getPortfolioProfile(userId)
}

export async function createPortfolioCertification(
  userId: number,
  input: PortfolioCertificationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioCertificationRecord | null> {
  const user = findActiveUserById(userId)
  if (!user) return null

  const store = getStore()
  const now = toIsoNow()
  const item: InternalCertification = {
    id: store.counters.certificationId++,
    userId,
    title: input.title.trim(),
    issuer: input.issuer.trim(),
    issueDate: input.issueDate.trim(),
    expiryDate: input.expiryDate.trim(),
    credentialId: input.credentialId.trim(),
    verifyUrl: input.verifyUrl.trim(),
    status: input.status,
    notes: input.notes.trim(),
    assetPath: input.assetPath ?? null,
    assetName: input.assetName ?? null,
    assetMimeType: input.assetMimeType ?? null,
    assetSize: input.assetSize ?? null,
    sortOrder: input.sortOrder ?? store.certifications.filter((cert) => cert.userId === userId).length,
    createdAt: now,
    updatedAt: now,
  }
  store.certifications.push(item)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.create',
    entityType: 'profile_certification',
    entityId: item.id,
    details: { userId, title: item.title, hasAsset: Boolean(item.assetPath) },
    metadata,
  })

  return toCertificationRecord(item)
}

export async function updatePortfolioCertification(
  certificationId: number,
  userId: number,
  input: PortfolioCertificationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioCertificationRecord | null> {
  const item = findCertificationById(certificationId)
  if (!item || item.userId !== userId) return null

  item.title = input.title.trim()
  item.issuer = input.issuer.trim()
  item.issueDate = input.issueDate.trim()
  item.expiryDate = input.expiryDate.trim()
  item.credentialId = input.credentialId.trim()
  item.verifyUrl = input.verifyUrl.trim()
  item.status = input.status
  item.notes = input.notes.trim()
  item.assetPath = input.assetPath !== undefined ? input.assetPath : item.assetPath ?? null
  item.assetName = input.assetName !== undefined ? input.assetName : item.assetName ?? null
  item.assetMimeType = input.assetMimeType !== undefined ? input.assetMimeType : item.assetMimeType ?? null
  item.assetSize = input.assetSize !== undefined ? input.assetSize : item.assetSize ?? null
  item.sortOrder = input.sortOrder ?? item.sortOrder
  item.updatedAt = toIsoNow()

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.update',
    entityType: 'profile_certification',
    entityId: item.id,
    details: { userId, title: item.title, hasAsset: Boolean(item.assetPath) },
    metadata,
  })

  return toCertificationRecord(item)
}

export async function deletePortfolioCertification(
  certificationId: number,
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioCertificationRecord | null> {
  const store = getStore()
  const index = store.certifications.findIndex((item) => item.id === certificationId && item.userId === userId)
  if (index < 0) return null

  const [removed] = store.certifications.splice(index, 1)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.delete',
    entityType: 'profile_certification',
    entityId: certificationId,
    details: { userId, title: removed.title, assetPath: removed.assetPath },
    metadata,
  })

  return toCertificationRecord(removed)
}

export async function createPortfolioEducation(
  userId: number,
  input: PortfolioEducationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const user = findActiveUserById(userId)
  if (!user) return null

  const store = getStore()
  const now = toIsoNow()
  const item: InternalEducation = {
    id: store.counters.educationId++,
    userId,
    institution: input.institution.trim(),
    program: input.program.trim(),
    degree: input.degree.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    status: input.status,
    description: input.description.trim(),
    sortOrder: input.sortOrder ?? store.education.filter((entry) => entry.userId === userId).length,
    createdAt: now,
    updatedAt: now,
  }
  store.education.push(item)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.create',
    entityType: 'profile_education',
    entityId: item.id,
    details: { userId, institution: item.institution, program: item.program },
    metadata,
  })

  return toEducationRecord(item)
}

export async function updatePortfolioEducation(
  educationId: number,
  userId: number,
  input: PortfolioEducationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const item = getStore().education.find((entry) => entry.id === educationId && entry.userId === userId)
  if (!item) return null

  item.institution = input.institution.trim()
  item.program = input.program.trim()
  item.degree = input.degree.trim()
  item.startDate = input.startDate.trim()
  item.endDate = input.endDate.trim()
  item.status = input.status
  item.description = input.description.trim()
  item.sortOrder = input.sortOrder ?? item.sortOrder
  item.updatedAt = toIsoNow()

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.update',
    entityType: 'profile_education',
    entityId: item.id,
    details: { userId, institution: item.institution, program: item.program },
    metadata,
  })

  return toEducationRecord(item)
}

export async function deletePortfolioEducation(
  educationId: number,
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const store = getStore()
  const index = store.education.findIndex((entry) => entry.id === educationId && entry.userId === userId)
  if (index < 0) return null

  const [removed] = store.education.splice(index, 1)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.delete',
    entityType: 'profile_education',
    entityId: removed.id,
    details: { userId, institution: removed.institution, program: removed.program },
    metadata,
  })

  return toEducationRecord(removed)
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
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }
  const usernameKey = normalizeUsernameKey(input.username)
  const exists = store.users.some((user) => normalizeUsernameKey(user.username) === usernameKey)
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
  ensureProfileForUser(user)

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    details: { username: input.username, role: input.role },
    metadata: input.metadata,
  })
}

