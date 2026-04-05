import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/security'
import { dedupeStringList, getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import { mapAttackTypeToTag, priorityWeight, severityToPriority } from '@/lib/soc-attack-utils'
import type {
  AlertPriority,
  AlertStatus,
  AttackSeverity,
  SessionUser,
  UserRole,
} from '@/lib/soc-types'
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
const ATTACK_RETENTION_WINDOW = '-7 days'

const SLA_TARGET_MINUTES: Record<AlertPriority, number> = {
  P1: 15,
  P2: 60,
  P3: 240,
  P4: 720,
}

let lastRetentionSweepAt = 0

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
  createdAt: string
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

function toIsoNow() {
  return new Date().toISOString()
}

function toAgeMinutes(iso: string) {
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor((Date.now() - value) / 60000))
}

function parseTags(jsonValue: string): string[] {
  try {
    const parsed: unknown = JSON.parse(jsonValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((tag): tag is string => typeof tag === 'string')
  } catch {
    return []
  }
}

function parseStringList(jsonValue: string): string[] {
  try {
    const parsed: unknown = JSON.parse(jsonValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function toSessionUserFromRow(row: {
  id: number
  username: string
  display_name: string
  role: UserRole
}): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  }
}

function normalizeUsernameKey(username: string) {
  return username.trim().toLowerCase()
}

function toPortfolioCertificationRecord(row: {
  id: number
  user_id: number
  title: string
  issuer: string
  issue_date: string
  expiry_date: string
  credential_id: string
  verify_url: string
  status: CertificationStatus
  notes: string
  asset_path: string | null
  asset_name: string | null
  asset_mime_type: string | null
  asset_size: number | null
  sort_order: number
  created_at: string
  updated_at: string
}): PortfolioCertificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    issuer: row.issuer,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    credentialId: row.credential_id,
    verifyUrl: row.verify_url,
    status: row.status,
    notes: row.notes,
    assetPath: row.asset_path,
    assetName: row.asset_name,
    assetMimeType: row.asset_mime_type,
    assetSize: row.asset_size == null ? null : Number(row.asset_size),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toPortfolioEducationRecord(row: {
  id: number
  user_id: number
  institution: string
  program: string
  degree: string
  start_date: string
  end_date: string
  status: EducationStatus
  description: string
  sort_order: number
  created_at: string
  updated_at: string
}): PortfolioEducationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    institution: row.institution,
    program: row.program,
    degree: row.degree,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    description: row.description,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function writeAlertEvent(input: {
  alertId: number
  actorUserId: number | null
  action: string
  fromStatus?: AlertStatus | null
  toStatus?: AlertStatus | null
  fromPriority?: AlertPriority | null
  toPriority?: AlertPriority | null
  fromAssigneeUserId?: number | null
  toAssigneeUserId?: number | null
  metadata?: Record<string, unknown>
}) {
  const db = await getDb()
  await db.run(
    `
      INSERT INTO alert_events (
        alert_id, actor_user_id, action,
        from_status, to_status,
        from_priority, to_priority,
        from_assignee_user_id, to_assignee_user_id,
        metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.alertId,
    input.actorUserId,
    input.action,
    input.fromStatus ?? null,
    input.toStatus ?? null,
    input.fromPriority ?? null,
    input.toPriority ?? null,
    input.fromAssigneeUserId ?? null,
    input.toAssigneeUserId ?? null,
    JSON.stringify(input.metadata ?? {}),
    toIsoNow(),
  )
}

export async function writeAuditLog(input: {
  actorUserId: number | null
  action: string
  entityType: string
  entityId?: string | number | null
  details?: Record<string, unknown>
  metadata?: RequestMetadata
}) {
  const db = await getDb()
  await db.run(
    `
      INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id,
        details_json, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.actorUserId,
    input.action,
    input.entityType,
    input.entityId == null ? null : String(input.entityId),
    JSON.stringify(input.details ?? {}),
    input.metadata?.ipAddress ?? null,
    input.metadata?.userAgent ?? null,
    toIsoNow(),
  )
}

export async function cleanupExpiredSessions() {
  const db = await getDb()
  await db.run('DELETE FROM sessions WHERE expires_at <= ?', toIsoNow())
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  const db = await getDb()
  const usernameKey = normalizeUsernameKey(username)
  const row = await db.get<{
    id: number
    username: string
    display_name: string
    role: UserRole
    password_hash: string
    is_active: number
  }>(
    `
      SELECT id, username, display_name, role, password_hash, is_active
      FROM users
      WHERE lower(username) = ?
      LIMIT 1
    `,
    usernameKey,
  )

  if (!row || row.is_active !== 1) return null
  if (!verifyPassword(password, row.password_hash)) return null

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  }
}

async function getActiveUserById(userId: number): Promise<{
  id: number
  username: string
  display_name: string
  role: UserRole
} | null> {
  const db = await getDb()
  const row = await db.get<{
    id: number
    username: string
    display_name: string
    role: UserRole
  }>(
    `
      SELECT id, username, display_name, role
      FROM users
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `,
    userId,
  )

  return row ?? null
}

async function getActiveUserByUsername(username: string): Promise<{
  id: number
  username: string
  display_name: string
  role: UserRole
} | null> {
  const db = await getDb()
  const usernameKey = normalizeUsernameKey(username)
  const row = await db.get<{
    id: number
    username: string
    display_name: string
    role: UserRole
  }>(
    `
      SELECT id, username, display_name, role
      FROM users
      WHERE lower(username) = ? AND is_active = 1
      LIMIT 1
    `,
    usernameKey,
  )

  return row ?? null
}

async function ensurePortfolioSeedDataForUser(user: {
  id: number
  username: string
  display_name: string
}): Promise<void> {
  const db = await getDb()
  const existingProfile = await db.get<{ user_id: number }>(
    'SELECT user_id FROM user_profiles WHERE user_id = ? LIMIT 1',
    user.id,
  )
  if (existingProfile) return

  const now = toIsoNow()
  const seed = getPortfolioSeedForUser({
    username: user.username,
    displayName: user.display_name,
  })

  await db.run('BEGIN')
  try {
    await db.run(
      `
        INSERT INTO user_profiles (
          user_id, headline, bio, location, website, specialties_json, tools_json, avatar_path, avatar_name, avatar_mime_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      user.id,
      seed.profile.headline,
      seed.profile.bio,
      seed.profile.location,
      seed.profile.website,
      JSON.stringify(seed.profile.specialties),
      JSON.stringify(seed.profile.tools),
      seed.profile.avatarPath ?? null,
      seed.profile.avatarName ?? null,
      seed.profile.avatarMimeType ?? null,
      now,
      now,
    )

    for (const certification of seed.certifications) {
      await db.run(
        `
          INSERT INTO user_certifications (
            user_id, title, issuer, issue_date, expiry_date, credential_id, verify_url,
            status, notes, asset_path, asset_name, asset_mime_type, asset_size,
            sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        user.id,
        certification.title,
        certification.issuer,
        certification.issueDate,
        certification.expiryDate,
        certification.credentialId,
        certification.verifyUrl,
        certification.status,
        certification.notes,
        certification.assetPath,
        certification.assetName,
        certification.assetMimeType,
        certification.assetSize,
        certification.sortOrder,
        now,
        now,
      )
    }

    for (const education of seed.education) {
      await db.run(
        `
          INSERT INTO user_education (
            user_id, institution, program, degree, start_date, end_date, status, description, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        user.id,
        education.institution,
        education.program,
        education.degree,
        education.startDate,
        education.endDate,
        education.status,
        education.description,
        education.sortOrder,
        now,
        now,
      )
    }

    await db.run('COMMIT')
  } catch (error) {
    await db.run('ROLLBACK')
    throw error
  }
}

async function backfillPortfolioStarterDataForUser(
  user: {
    id: number
    username: string
    display_name: string
  },
  input: {
    specialties: string[]
    tools: string[]
    certifications: PortfolioCertificationRecord[]
    education: PortfolioEducationRecord[]
  },
): Promise<void> {
  if (user.username === 'ghost') return

  const db = await getDb()
  const seed = getPortfolioSeedForUser({
    username: user.username,
    displayName: user.display_name,
  })
  const now = toIsoNow()

  if (input.specialties.length === 0 || input.tools.length === 0) {
    await db.run(
      `
        UPDATE user_profiles
        SET specialties_json = ?, tools_json = ?, updated_at = ?
        WHERE user_id = ?
      `,
      JSON.stringify(input.specialties.length === 0 ? seed.profile.specialties : input.specialties),
      JSON.stringify(input.tools.length === 0 ? seed.profile.tools : input.tools),
      now,
      user.id,
    )
  }

  if (input.certifications.length === 0) {
    for (const certification of seed.certifications) {
      await db.run(
        `
          INSERT INTO user_certifications (
            user_id, title, issuer, issue_date, expiry_date, credential_id, verify_url,
            status, notes, asset_path, asset_name, asset_mime_type, asset_size,
            sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        user.id,
        certification.title,
        certification.issuer,
        certification.issueDate,
        certification.expiryDate,
        certification.credentialId,
        certification.verifyUrl,
        certification.status,
        certification.notes,
        certification.assetPath,
        certification.assetName,
        certification.assetMimeType,
        certification.assetSize,
        certification.sortOrder,
        now,
        now,
      )
    }
  }

  if (input.education.length === 0) {
    for (const education of seed.education) {
      await db.run(
        `
          INSERT INTO user_education (
            user_id, institution, program, degree, start_date, end_date, status, description, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        user.id,
        education.institution,
        education.program,
        education.degree,
        education.startDate,
        education.endDate,
        education.status,
        education.description,
        education.sortOrder,
        now,
        now,
      )
    }
  }
}

async function listPortfolioCertificationsByUserId(userId: number): Promise<PortfolioCertificationRecord[]> {
  const db = await getDb()
  const rows = await db.all<{
    id: number
    user_id: number
    title: string
    issuer: string
    issue_date: string
    expiry_date: string
    credential_id: string
    verify_url: string
    status: CertificationStatus
    notes: string
    asset_path: string | null
    asset_name: string | null
    asset_mime_type: string | null
    asset_size: number | null
    sort_order: number
    created_at: string
    updated_at: string
  }[]>(
    `
      SELECT
        id, user_id, title, issuer, issue_date, expiry_date, credential_id, verify_url,
        status, notes, asset_path, asset_name, asset_mime_type, asset_size,
        sort_order, created_at, updated_at
      FROM user_certifications
      WHERE user_id = ?
      ORDER BY sort_order ASC, id DESC
    `,
    userId,
  )

  return rows.map(toPortfolioCertificationRecord)
}

async function listPortfolioEducationByUserId(userId: number): Promise<PortfolioEducationRecord[]> {
  const db = await getDb()
  const rows = await db.all<{
    id: number
    user_id: number
    institution: string
    program: string
    degree: string
    start_date: string
    end_date: string
    status: EducationStatus
    description: string
    sort_order: number
    created_at: string
    updated_at: string
  }[]>(
    `
      SELECT
        id, user_id, institution, program, degree, start_date, end_date,
        status, description, sort_order, created_at, updated_at
      FROM user_education
      WHERE user_id = ?
      ORDER BY sort_order ASC, id DESC
    `,
    userId,
  )

  return rows.map(toPortfolioEducationRecord)
}

export async function createSession(user: SessionUser, metadata: RequestMetadata): Promise<SessionRecord> {
  await cleanupExpiredSessions()

  const db = await getDb()
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString()
  const token = randomUUID()

  await db.run(
    `
      INSERT INTO sessions (token, user_id, ip_address, user_agent, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    token,
    user.id,
    metadata.ipAddress,
    metadata.userAgent,
    createdAt,
    createdAt,
    expiresAt,
  )

  return { token, user, expiresAt }
}

export async function deleteSession(token: string) {
  const db = await getDb()
  await db.run('DELETE FROM sessions WHERE token = ?', token)
}

export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  if (!token) return null
  await cleanupExpiredSessions()

  const db = await getDb()
  const row = await db.get<{
    token: string
    expires_at: string
    id: number
    username: string
    display_name: string
    role: UserRole
  }>(
    `
      SELECT
        s.token,
        s.expires_at,
        u.id,
        u.username,
        u.display_name,
        u.role
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > ?
        AND u.is_active = 1
      LIMIT 1
    `,
    token,
    toIsoNow(),
  )

  if (!row) return null

  await db.run('UPDATE sessions SET last_seen_at = ? WHERE token = ?', toIsoNow(), token)

  return {
    token: row.token,
    expiresAt: row.expires_at,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    },
  }
}

export async function listAssignableUsers(): Promise<UserWorkload[]> {
  const db = await getDb()
  const rows = await db.all<{
    id: number
    username: string
    display_name: string
    role: UserRole
    active_workload: number
  }[]>(
    `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.role,
        COUNT(a.id) AS active_workload
      FROM users u
      LEFT JOIN alerts a
        ON a.assignee_user_id = u.id
        AND a.status != 'resolved'
      WHERE u.is_active = 1
      GROUP BY u.id
      ORDER BY
        CASE u.role
          WHEN 'admin' THEN 1
          WHEN 'analyst' THEN 2
          ELSE 3
        END,
        active_workload DESC,
        u.username ASC
    `,
  )

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    activeWorkload: Number(row.active_workload ?? 0),
  }))
}

interface AlertJoinedRow {
  id: number
  title: string
  description: string
  status: AlertStatus
  priority: AlertPriority
  source_event_id: number | null
  source_ip: string | null
  source_country: string | null
  attack_type: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  assignee_id: number | null
  assignee_username: string | null
  assignee_display_name: string | null
  assignee_role: UserRole | null
  creator_id: number | null
  creator_username: string | null
  creator_display_name: string | null
  creator_role: UserRole | null
  note_count: number
}

function toAlertRecord(row: AlertJoinedRow): AlertRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    sourceEventId: row.source_event_id,
    sourceIp: row.source_ip,
    sourceCountry: row.source_country,
    attackType: row.attack_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    assignee:
      row.assignee_id == null || row.assignee_username == null || row.assignee_display_name == null || row.assignee_role == null
        ? null
        : {
            id: row.assignee_id,
            username: row.assignee_username,
            displayName: row.assignee_display_name,
            role: row.assignee_role,
          },
    createdBy:
      row.creator_id == null || row.creator_username == null || row.creator_display_name == null || row.creator_role == null
        ? null
        : {
            id: row.creator_id,
            username: row.creator_username,
            displayName: row.creator_display_name,
            role: row.creator_role,
          },
    noteCount: Number(row.note_count ?? 0),
    ageMinutes: toAgeMinutes(row.created_at),
  }
}

async function getAlertById(alertId: number): Promise<AlertRecord | null> {
  const db = await getDb()
  const row = await db.get<AlertJoinedRow>(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.status,
        a.priority,
        a.source_event_id,
        a.source_ip,
        a.source_country,
        a.attack_type,
        a.created_at,
        a.updated_at,
        a.resolved_at,
        assignee.id AS assignee_id,
        assignee.username AS assignee_username,
        assignee.display_name AS assignee_display_name,
        assignee.role AS assignee_role,
        creator.id AS creator_id,
        creator.username AS creator_username,
        creator.display_name AS creator_display_name,
        creator.role AS creator_role,
        (
          SELECT COUNT(*)
          FROM alert_notes notes
          WHERE notes.alert_id = a.id
        ) AS note_count
      FROM alerts a
      LEFT JOIN users assignee ON assignee.id = a.assignee_user_id
      LEFT JOIN users creator ON creator.id = a.created_by_user_id
      WHERE a.id = ?
      LIMIT 1
    `,
    alertId,
  )

  if (!row) return null

  return toAlertRecord(row)
}

export async function listAlerts(filters: ListAlertsFilters): Promise<AlertListResult> {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 12))
  const where: string[] = []
  const params: Array<string | number | null> = []

  if (filters.status) {
    where.push('a.status = ?')
    params.push(filters.status)
  }

  if (filters.priority) {
    where.push('a.priority = ?')
    params.push(filters.priority)
  }

  if (filters.assignee === 'unassigned') {
    where.push('a.assignee_user_id IS NULL')
  } else if (filters.assignee === 'me') {
    if (!filters.meUserId) {
      where.push('1 = 0')
    } else {
      where.push('a.assignee_user_id = ?')
      params.push(filters.meUserId)
    }
  } else if (typeof filters.assignee === 'number') {
    where.push('a.assignee_user_id = ?')
    params.push(filters.assignee)
  }

  if (typeof filters.cursor === 'number' && Number.isFinite(filters.cursor)) {
    where.push('a.id < ?')
    params.push(filters.cursor)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const db = await getDb()
  const [totalRow, activeRow, resolvedRow, rows] = await Promise.all([
    db.get<{ count: number }>('SELECT COUNT(*) AS count FROM alerts'),
    db.get<{ count: number }>("SELECT COUNT(*) AS count FROM alerts WHERE status != 'resolved'"),
    db.get<{ count: number }>("SELECT COUNT(*) AS count FROM alerts WHERE status = 'resolved'"),
    db.all<AlertJoinedRow[]>(
      `
        SELECT
          a.id,
          a.title,
          a.description,
          a.status,
          a.priority,
          a.source_event_id,
          a.source_ip,
          a.source_country,
          a.attack_type,
          a.created_at,
          a.updated_at,
          a.resolved_at,
          assignee.id AS assignee_id,
          assignee.username AS assignee_username,
          assignee.display_name AS assignee_display_name,
          assignee.role AS assignee_role,
          creator.id AS creator_id,
          creator.username AS creator_username,
          creator.display_name AS creator_display_name,
          creator.role AS creator_role,
          (
            SELECT COUNT(*)
            FROM alert_notes notes
            WHERE notes.alert_id = a.id
          ) AS note_count
        FROM alerts a
        LEFT JOIN users assignee ON assignee.id = a.assignee_user_id
        LEFT JOIN users creator ON creator.id = a.created_by_user_id
        ${whereSql}
        ORDER BY
          CASE a.priority
            WHEN 'P1' THEN 1
            WHEN 'P2' THEN 2
            WHEN 'P3' THEN 3
            ELSE 4
          END ASC,
          datetime(a.created_at) DESC,
          a.id DESC
        LIMIT ?
      `,
      ...params,
      limit + 1,
    ),
  ])

  const hasNext = rows.length > limit
  const sliced = hasNext ? rows.slice(0, limit) : rows
  const nextCursor = hasNext ? sliced[sliced.length - 1]?.id ?? null : null

  return {
    alerts: sliced.map(toAlertRecord),
    nextCursor,
    total: Number(totalRow?.count ?? 0),
    activeTotal: Number(activeRow?.count ?? 0),
    resolvedTotal: Number(resolvedRow?.count ?? 0),
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
  const db = await getDb()
  const now = toIsoNow()

  const result = await db.run(
    `
      INSERT INTO alerts (
        title,
        description,
        status,
        priority,
        source_event_id,
        source_ip,
        source_country,
        attack_type,
        assignee_user_id,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.title,
    input.description,
    input.status ?? 'new',
    input.priority,
    input.sourceEventId ?? null,
    input.sourceIp ?? null,
    input.sourceCountry ?? null,
    input.attackType ?? null,
    input.assigneeId ?? null,
    input.createdByUserId ?? null,
    now,
    now,
  )

  const alertId = Number(result.lastID)

  await writeAlertEvent({
    alertId,
    actorUserId: input.createdByUserId ?? null,
    action: 'created',
    toStatus: input.status ?? 'new',
    toPriority: input.priority,
    toAssigneeUserId: input.assigneeId ?? null,
  })

  if (input.note && input.note.trim().length > 0) {
    await db.run(
      `
        INSERT INTO alert_notes (alert_id, author_user_id, note, created_at)
        VALUES (?, ?, ?, ?)
      `,
      alertId,
      input.createdByUserId ?? null,
      input.note.trim(),
      now,
    )

    await writeAlertEvent({
      alertId,
      actorUserId: input.createdByUserId ?? null,
      action: 'note_added',
      metadata: { notePreview: input.note.trim().slice(0, 120) },
    })
  }

  await writeAuditLog({
    actorUserId: input.createdByUserId ?? null,
    action: 'alert.create',
    entityType: 'alert',
    entityId: alertId,
    details: {
      status: input.status ?? 'new',
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
    },
    metadata: input.metadata,
  })

  const created = await getAlertById(alertId)
  if (!created) {
    throw new Error('Alert created but not found')
  }
  return created
}

export async function patchAlert(
  alertId: number,
  patch: AlertPatchInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<AlertRecord | null> {
  const db = await getDb()
  const current = await getAlertById(alertId)
  if (!current) return null

  let nextStatus = current.status
  let nextPriority = current.priority
  let nextAssigneeId = current.assignee?.id ?? null
  let resolvedAt = current.resolvedAt

  const now = toIsoNow()

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
    resolvedAt = now
  } else if (nextStatus !== 'resolved') {
    resolvedAt = null
  }

  await db.run(
    `
      UPDATE alerts
      SET
        status = ?,
        priority = ?,
        assignee_user_id = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    nextStatus,
    nextPriority,
    nextAssigneeId,
    resolvedAt,
    now,
    alertId,
  )

  if (current.status !== nextStatus) {
    await writeAlertEvent({
      alertId,
      actorUserId: actor.id,
      action: patch.resolve ? 'resolved' : 'status_change',
      fromStatus: current.status,
      toStatus: nextStatus,
    })

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'alert.status_change',
      entityType: 'alert',
      entityId: alertId,
      details: { from: current.status, to: nextStatus },
      metadata,
    })
  }

  if (current.priority !== nextPriority) {
    await writeAlertEvent({
      alertId,
      actorUserId: actor.id,
      action: 'priority_change',
      fromPriority: current.priority,
      toPriority: nextPriority,
    })

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'alert.priority_change',
      entityType: 'alert',
      entityId: alertId,
      details: { from: current.priority, to: nextPriority },
      metadata,
    })
  }

  if ((current.assignee?.id ?? null) !== nextAssigneeId) {
    const action = patch.claim ? 'claim' : 'assign'
    await writeAlertEvent({
      alertId,
      actorUserId: actor.id,
      action,
      fromAssigneeUserId: current.assignee?.id ?? null,
      toAssigneeUserId: nextAssigneeId,
    })

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'alert.assign',
      entityType: 'alert',
      entityId: alertId,
      details: {
        fromAssigneeId: current.assignee?.id ?? null,
        toAssigneeId: nextAssigneeId,
        mode: action,
      },
      metadata,
    })
  }

  if (patch.note && patch.note.trim().length > 0) {
    const noteText = patch.note.trim()
    await db.run(
      `
        INSERT INTO alert_notes (alert_id, author_user_id, note, created_at)
        VALUES (?, ?, ?, ?)
      `,
      alertId,
      actor.id,
      noteText,
      now,
    )

    await writeAlertEvent({
      alertId,
      actorUserId: actor.id,
      action: 'note_added',
      metadata: { notePreview: noteText.slice(0, 120) },
    })

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'alert.note',
      entityType: 'alert',
      entityId: alertId,
      details: { notePreview: noteText.slice(0, 120) },
      metadata,
    })
  }

  return getAlertById(alertId)
}

export async function purgeOldAttackEvents() {
  const now = Date.now()
  if (now - lastRetentionSweepAt < 60_000) {
    return
  }

  lastRetentionSweepAt = now
  const db = await getDb()
  const cutoffIso = new Date(now - ATTACK_RETENTION_MS).toISOString()
  await db.run('DELETE FROM attack_events WHERE occurred_at < ?', cutoffIso)
}

export async function recordAttackEvent(input: AttackEventInput): Promise<void> {
  const db = await getDb()
  const now = toIsoNow()

  const eventInsert = await db.run(
    `
      INSERT INTO attack_events (
        external_id,
        occurred_at,
        source_ip,
        source_country,
        target_port,
        attack_type,
        severity,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.externalId ?? null,
    input.occurredAt,
    input.sourceIP,
    input.sourceCountry,
    input.targetPort,
    input.type,
    input.severity,
    now,
  )

  const attackEventId = Number(eventInsert.lastID)
  const priority = severityToPriority(input.severity)
  const shouldEscalate = input.severity === 'critical' || (input.severity === 'high' && Math.random() < 0.45)

  if (shouldEscalate) {
    const duplicate = await db.get<{ id: number }>(
      `
        SELECT id
        FROM alerts
        WHERE status != 'resolved'
          AND source_ip = ?
          AND attack_type = ?
          AND created_at >= datetime('now', '-20 minutes')
        ORDER BY id DESC
        LIMIT 1
      `,
      input.sourceIP,
      input.type,
    )

    if (!duplicate) {
      const title = `${input.type} from ${input.sourceCountry}`
      const description = `${input.sourceIP}:${input.targetPort} -> severity ${input.severity.toUpperCase()}`

      const autoAlert = await createAlert({
        title,
        description,
        priority,
        status: 'new',
        sourceEventId: attackEventId,
        sourceIp: input.sourceIP,
        sourceCountry: input.sourceCountry,
        attackType: input.type,
        createdByUserId: null,
        note: 'Auto-generated from live attack ingestion pipeline.',
      })

      await writeAlertEvent({
        alertId: autoAlert.id,
        actorUserId: null,
        action: 'auto_ingest',
        metadata: {
          attackEventId,
          severity: input.severity,
        },
      })
    }
  }

  await purgeOldAttackEvents()
}

export async function getLiveMetrics(): Promise<LiveMetrics> {
  await purgeOldAttackEvents()

  const db = await getDb()

  const [
    triageRows,
    assignmentRows,
    queueRows,
    countriesRows,
    tagsRows,
    attacksPerMinuteRow,
    activeIpsRow,
    total24hRow,
    p1OpenRow,
    unassignedOpenRow,
    avgResolveRow,
    p1FirstResponseRows,
    openAlertsForSla,
  ] = await Promise.all([
    db.all<{ status: AlertStatus; count: number }[]>(
      `
        SELECT status, COUNT(*) AS count
        FROM alerts
        GROUP BY status
      `,
    ),
    db.all<{
      id: number
      username: string
      display_name: string
      role: UserRole
      active_workload: number
    }[]>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.role,
          COUNT(a.id) AS active_workload
        FROM users u
        LEFT JOIN alerts a
          ON a.assignee_user_id = u.id
          AND a.status != 'resolved'
        WHERE u.is_active = 1
        GROUP BY u.id
        ORDER BY active_workload DESC, u.username ASC
      `,
    ),
    db.all<AlertJoinedRow[]>(
      `
        SELECT
          a.id,
          a.title,
          a.description,
          a.status,
          a.priority,
          a.source_event_id,
          a.source_ip,
          a.source_country,
          a.attack_type,
          a.created_at,
          a.updated_at,
          a.resolved_at,
          assignee.id AS assignee_id,
          assignee.username AS assignee_username,
          assignee.display_name AS assignee_display_name,
          assignee.role AS assignee_role,
          creator.id AS creator_id,
          creator.username AS creator_username,
          creator.display_name AS creator_display_name,
          creator.role AS creator_role,
          (
            SELECT COUNT(*)
            FROM alert_notes notes
            WHERE notes.alert_id = a.id
          ) AS note_count
        FROM alerts a
        LEFT JOIN users assignee ON assignee.id = a.assignee_user_id
        LEFT JOIN users creator ON creator.id = a.created_by_user_id
        WHERE a.status != 'resolved'
        ORDER BY
          CASE a.priority
            WHEN 'P1' THEN 1
            WHEN 'P2' THEN 2
            WHEN 'P3' THEN 3
            ELSE 4
          END ASC,
          datetime(a.created_at) ASC,
          a.id ASC
        LIMIT 8
      `,
    ),
    db.all<{ name: string; count: number }[]>(
      `
        SELECT source_country AS name, COUNT(*) AS count
        FROM attack_events
        WHERE occurred_at >= datetime('now', ?)
        GROUP BY source_country
        ORDER BY count DESC, source_country ASC
        LIMIT 5
      `,
      ATTACK_RETENTION_WINDOW,
    ),
    db.all<{ attack_type: string; count: number }[]>(
      `
        SELECT attack_type, COUNT(*) AS count
        FROM attack_events
        WHERE occurred_at >= datetime('now', ?)
        GROUP BY attack_type
        ORDER BY count DESC
        LIMIT 10
      `,
      ATTACK_RETENTION_WINDOW,
    ),
    db.get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM attack_events
        WHERE occurred_at >= datetime('now', '-1 minute')
      `,
    ),
    db.get<{ count: number }>(
      `
        SELECT COUNT(DISTINCT source_ip) AS count
        FROM attack_events
        WHERE occurred_at >= datetime('now', '-15 minutes')
      `,
    ),
    db.get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM attack_events
        WHERE occurred_at >= datetime('now', '-24 hours')
      `,
    ),
    db.get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM alerts
        WHERE status != 'resolved' AND priority = 'P1'
      `,
    ),
    db.get<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM alerts
        WHERE status != 'resolved' AND assignee_user_id IS NULL
      `,
    ),
    db.get<{ avg_minutes: number | null }>(
      `
        SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24 * 60) AS avg_minutes
        FROM alerts
        WHERE resolved_at IS NOT NULL
      `,
    ),
    db.all<{ created_at: string; first_event_at: string | null }[]>(
      `
        SELECT
          a.created_at,
          MIN(e.created_at) AS first_event_at
        FROM alerts a
        LEFT JOIN alert_events e
          ON e.alert_id = a.id
          AND e.action IN ('claim', 'assign', 'status_change', 'resolved', 'note_added', 'auto_ingest')
        WHERE a.priority = 'P1'
        GROUP BY a.id
      `,
    ),
    db.all<{ priority: AlertPriority; created_at: string }[]>(
      `
        SELECT priority, created_at
        FROM alerts
        WHERE status != 'resolved'
      `,
    ),
  ])

  const triage = {
    new: 0,
    inProgress: 0,
    blocked: 0,
    resolved: 0,
  }

  for (const row of triageRows) {
    if (row.status === 'new') triage.new = Number(row.count)
    if (row.status === 'in_progress') triage.inProgress = Number(row.count)
    if (row.status === 'blocked') triage.blocked = Number(row.count)
    if (row.status === 'resolved') triage.resolved = Number(row.count)
  }

  const assignment = assignmentRows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    activeWorkload: Number(row.active_workload ?? 0),
  }))

  const tagMap = new Map<string, number>()
  for (const row of tagsRows) {
    const tag = mapAttackTypeToTag(row.attack_type)
    tagMap.set(tag, (tagMap.get(tag) ?? 0) + Number(row.count))
  }

  const topTags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const p1FirstResponseMinutesValues = p1FirstResponseRows
    .map((row) => {
      if (!row.first_event_at) return null
      const start = new Date(row.created_at).getTime()
      const end = new Date(row.first_event_at).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
      return (end - start) / 60000
    })
    .filter((value): value is number => value != null)

  const p1FirstResponseMinutes =
    p1FirstResponseMinutesValues.length > 0
      ? p1FirstResponseMinutesValues.reduce((sum, value) => sum + value, 0) /
        p1FirstResponseMinutesValues.length
      : 0

  let breachCount = 0
  for (const row of openAlertsForSla) {
    const ageMinutes = toAgeMinutes(row.created_at)
    if (ageMinutes > SLA_TARGET_MINUTES[row.priority]) {
      breachCount += 1
    }
  }

  const attackTotal = Number(total24hRow?.count ?? 0)
  const uniqueCountries = countriesRows.length
  const topPriorityPressure = queueRows.reduce((sum, row) => sum + priorityWeight(row.priority), 0)
  const density = Math.min(
    100,
    Math.max(6, Math.round(Math.sqrt(attackTotal + 1) * 6 + uniqueCountries * 4 + topPriorityPressure * 2)),
  )

  const alertQueue: AlertRecord[] = queueRows.map(toAlertRecord)

  return {
    generatedAt: toIsoNow(),
    shiftSnapshot: {
      openCritical: Number(p1OpenRow?.count ?? 0),
      unassigned: Number(unassignedOpenRow?.count ?? 0),
      slaBreaches: breachCount,
    },
    triageBoard: triage,
    sla: {
      p1FirstResponseMinutes: Number(p1FirstResponseMinutes.toFixed(1)),
      avgResolutionMinutes: Number((avgResolveRow?.avg_minutes ?? 0).toFixed(1)),
      breachCount,
    },
    assignment,
    alertQueue,
    attack: {
      topCountries: countriesRows.map((row) => ({ name: row.name, count: Number(row.count) })),
      topTags,
      attacksPerMinute: Number(attacksPerMinuteRow?.count ?? 0),
      activeIps: Number(activeIpsRow?.count ?? 0),
      liveDensity: density,
      totalLast24h: attackTotal,
    },
  }
}

export async function listReports(
  filters: { limit?: number; cursor?: number } = {},
): Promise<{ reports: ReportRecord[]; hasNext: boolean; nextCursor: number | null }> {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
  const db = await getDb()

  const whereClauses: string[] = []
  const params: unknown[] = []

  if (filters.cursor != null) {
    whereClauses.push('id < ?')
    params.push(filters.cursor)
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const rows = await db.all<{
    id: number
    title: string
    content: string
    severity: string
    tags_json: string
    created_at: string
  }[]>(
    `
      SELECT id, title, content, severity, tags_json, created_at
      FROM reports
      ${where}
      ORDER BY id DESC
      LIMIT ?
    `,
    ...params,
    limit + 1,
  )

  const hasNext = rows.length > limit
  const page = rows.slice(0, limit).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    severity: row.severity,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
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
  const db = await getDb()
  const now = toIsoNow()
  const result = await db.run(
    `
      INSERT INTO reports (title, content, severity, tags_json, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    input.title,
    input.content,
    input.severity,
    JSON.stringify(input.tags),
    input.actor.id,
    now,
  )

  const id = Number(result.lastID)

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'report.create',
    entityType: 'report',
    entityId: id,
    details: { severity: input.severity, tagCount: input.tags.length },
    metadata: input.metadata,
  })

  return {
    id,
    title: input.title,
    content: input.content,
    severity: input.severity,
    tags: input.tags,
    createdAt: now,
  }
}

export async function deleteReport(id: number, actor: SessionUser, metadata: RequestMetadata): Promise<boolean> {
  const db = await getDb()
  const result = await db.run('DELETE FROM reports WHERE id = ?', id)
  const deleted = Number(result.changes ?? 0) > 0
  if (!deleted) return false

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'report.delete',
    entityType: 'report',
    entityId: id,
    metadata,
  })

  return true
}

export async function registerUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  metadata: RequestMetadata
}): Promise<SessionUser> {
  const db = await getDb()
  const existing = await getActiveUserByUsername(input.username)
  if (existing) {
    throw new Error('User already exists')
  }

  const now = toIsoNow()
  const result = await db.run(
    `
      INSERT INTO users (username, display_name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `,
    input.username,
    input.displayName,
    input.passwordHash,
    input.role,
    now,
    now,
  )

  const user = {
    id: Number(result.lastID),
    username: input.username,
    display_name: input.displayName,
    role: input.role,
  }

  await ensurePortfolioSeedDataForUser(user)

  await writeAuditLog({
    actorUserId: user.id,
    action: 'user.register',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role },
    metadata: input.metadata,
  })

  return toSessionUserFromRow(user)
}

export async function getPortfolioProfile(userId: number): Promise<PortfolioProfileRecord | null> {
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()

  let [profileRow, certifications, education] = await Promise.all([
    db.get<{
      headline: string
      bio: string
      location: string
      website: string
      specialties_json: string
      tools_json: string
      avatar_path: string | null
      avatar_name: string | null
      avatar_mime_type: string | null
      updated_at: string
    }>(
      `
        SELECT headline, bio, location, website, specialties_json, tools_json, avatar_path, avatar_name, avatar_mime_type, updated_at
        FROM user_profiles
        WHERE user_id = ?
        LIMIT 1
      `,
      userId,
    ),
    listPortfolioCertificationsByUserId(userId),
    listPortfolioEducationByUserId(userId),
  ])

  if (!profileRow) return null

  return {
    user: toSessionUserFromRow(user),
    profile: {
      headline: profileRow.headline,
      bio: profileRow.bio,
      location: profileRow.location,
      website: profileRow.website,
      specialties: parseStringList(profileRow.specialties_json),
      tools: parseStringList(profileRow.tools_json),
      avatarPath: profileRow.avatar_path,
      avatarName: profileRow.avatar_name,
      avatarMimeType: profileRow.avatar_mime_type,
      updatedAt: profileRow.updated_at,
    },
    certifications,
    education,
  }
}

export async function repairPortfolioStarterData(
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioProfileRecord | null> {
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()
  const [profileRow, certifications, education] = await Promise.all([
    db.get<{
      specialties_json: string
      tools_json: string
    }>(
      `
        SELECT specialties_json, tools_json
        FROM user_profiles
        WHERE user_id = ?
        LIMIT 1
      `,
      userId,
    ),
    listPortfolioCertificationsByUserId(userId),
    listPortfolioEducationByUserId(userId),
  ])

  if (!profileRow) return null

  await backfillPortfolioStarterDataForUser(user, {
    specialties: parseStringList(profileRow.specialties_json),
    tools: parseStringList(profileRow.tools_json),
    certifications,
    education,
  })

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.repair.starter',
    entityType: 'profile',
    entityId: userId,
    details: {
      certificationCountBefore: certifications.length,
      educationCountBefore: education.length,
    },
    metadata,
  })

  return getPortfolioProfile(userId)
}

export async function getPortfolioCertificationById(
  certificationId: number,
): Promise<PortfolioCertificationRecord | null> {
  const db = await getDb()
  const row = await db.get<{
    id: number
    user_id: number
    title: string
    issuer: string
    issue_date: string
    expiry_date: string
    credential_id: string
    verify_url: string
    status: CertificationStatus
    notes: string
    asset_path: string | null
    asset_name: string | null
    asset_mime_type: string | null
    asset_size: number | null
    sort_order: number
    created_at: string
    updated_at: string
  }>(
    `
      SELECT
        id, user_id, title, issuer, issue_date, expiry_date, credential_id, verify_url,
        status, notes, asset_path, asset_name, asset_mime_type, asset_size,
        sort_order, created_at, updated_at
      FROM user_certifications
      WHERE id = ?
      LIMIT 1
    `,
    certificationId,
  )

  return row ? toPortfolioCertificationRecord(row) : null
}

export async function updatePortfolioProfile(
  userId: number,
  patch: PortfolioProfilePatchInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioProfileRecord | null> {
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()
  const now = toIsoNow()

  await db.run(
    `
      UPDATE user_profiles
      SET headline = ?, bio = ?, location = ?, website = ?, specialties_json = ?, tools_json = ?, updated_at = ?
      WHERE user_id = ?
    `,
    patch.headline.trim(),
    patch.bio.trim(),
    patch.location.trim(),
    patch.website.trim(),
    JSON.stringify(dedupeStringList(patch.specialties)),
    JSON.stringify(dedupeStringList(patch.tools)),
    now,
    userId,
  )

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.update',
    entityType: 'profile',
    entityId: userId,
    details: {
      headline: patch.headline.trim(),
      specialtyCount: patch.specialties.length,
      toolCount: patch.tools.length,
    },
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
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()

  await db.run(
    `
      UPDATE user_profiles
      SET avatar_path = ?, avatar_name = ?, avatar_mime_type = ?, updated_at = ?
      WHERE user_id = ?
    `,
    input.avatarPath,
    input.avatarName,
    input.avatarMimeType,
    toIsoNow(),
    userId,
  )

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
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()
  const now = toIsoNow()
  const existingCount = await db.get<{ count: number }>(
    'SELECT COUNT(*) AS count FROM user_certifications WHERE user_id = ?',
    userId,
  )

  const result = await db.run(
    `
      INSERT INTO user_certifications (
        user_id, title, issuer, issue_date, expiry_date, credential_id, verify_url,
        status, notes, asset_path, asset_name, asset_mime_type, asset_size, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    userId,
    input.title.trim(),
    input.issuer.trim(),
    input.issueDate.trim(),
    input.expiryDate.trim(),
    input.credentialId.trim(),
    input.verifyUrl.trim(),
    input.status,
    input.notes.trim(),
    input.assetPath ?? null,
    input.assetName ?? null,
    input.assetMimeType ?? null,
    input.assetSize ?? null,
    input.sortOrder ?? Number(existingCount?.count ?? 0),
    now,
    now,
  )

  const created = await getPortfolioCertificationById(Number(result.lastID))
  if (!created) return null

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.create',
    entityType: 'profile_certification',
    entityId: created.id,
    details: { userId, title: created.title, hasAsset: Boolean(created.assetPath) },
    metadata,
  })

  return created
}

export async function updatePortfolioCertification(
  certificationId: number,
  userId: number,
  input: PortfolioCertificationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioCertificationRecord | null> {
  const existing = await getPortfolioCertificationById(certificationId)
  if (!existing || existing.userId !== userId) return null

  const db = await getDb()
  await db.run(
    `
      UPDATE user_certifications
      SET
        title = ?,
        issuer = ?,
        issue_date = ?,
        expiry_date = ?,
        credential_id = ?,
        verify_url = ?,
        status = ?,
        notes = ?,
        asset_path = ?,
        asset_name = ?,
        asset_mime_type = ?,
        asset_size = ?,
        sort_order = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
    input.title.trim(),
    input.issuer.trim(),
    input.issueDate.trim(),
    input.expiryDate.trim(),
    input.credentialId.trim(),
    input.verifyUrl.trim(),
    input.status,
    input.notes.trim(),
    input.assetPath !== undefined ? input.assetPath : existing.assetPath ?? null,
    input.assetName !== undefined ? input.assetName : existing.assetName ?? null,
    input.assetMimeType !== undefined ? input.assetMimeType : existing.assetMimeType ?? null,
    input.assetSize !== undefined ? input.assetSize : existing.assetSize ?? null,
    input.sortOrder ?? existing.sortOrder,
    toIsoNow(),
    certificationId,
    userId,
  )

  const updated = await getPortfolioCertificationById(certificationId)
  if (!updated) return null

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.update',
    entityType: 'profile_certification',
    entityId: certificationId,
    details: { userId, title: updated.title, hasAsset: Boolean(updated.assetPath) },
    metadata,
  })

  return updated
}

export async function deletePortfolioCertification(
  certificationId: number,
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioCertificationRecord | null> {
  const existing = await getPortfolioCertificationById(certificationId)
  if (!existing || existing.userId !== userId) return null

  const db = await getDb()
  await db.run('DELETE FROM user_certifications WHERE id = ? AND user_id = ?', certificationId, userId)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.delete',
    entityType: 'profile_certification',
    entityId: certificationId,
    details: { userId, title: existing.title, assetPath: existing.assetPath },
    metadata,
  })

  return existing
}

export async function createPortfolioEducation(
  userId: number,
  input: PortfolioEducationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const user = await getActiveUserById(userId)
  if (!user) return null

  await ensurePortfolioSeedDataForUser(user)
  const db = await getDb()
  const now = toIsoNow()
  const existingCount = await db.get<{ count: number }>(
    'SELECT COUNT(*) AS count FROM user_education WHERE user_id = ?',
    userId,
  )

  const result = await db.run(
    `
      INSERT INTO user_education (
        user_id, institution, program, degree, start_date, end_date, status, description, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    userId,
    input.institution.trim(),
    input.program.trim(),
    input.degree.trim(),
    input.startDate.trim(),
    input.endDate.trim(),
    input.status,
    input.description.trim(),
    input.sortOrder ?? Number(existingCount?.count ?? 0),
    now,
    now,
  )

  const dbRow = await db.get<{
    id: number
    user_id: number
    institution: string
    program: string
    degree: string
    start_date: string
    end_date: string
    status: EducationStatus
    description: string
    sort_order: number
    created_at: string
    updated_at: string
  }>(
    `
      SELECT
        id, user_id, institution, program, degree, start_date, end_date,
        status, description, sort_order, created_at, updated_at
      FROM user_education
      WHERE id = ?
      LIMIT 1
    `,
    Number(result.lastID),
  )
  if (!dbRow) return null

  const created = toPortfolioEducationRecord(dbRow)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.create',
    entityType: 'profile_education',
    entityId: created.id,
    details: { userId, institution: created.institution, program: created.program },
    metadata,
  })

  return created
}

export async function updatePortfolioEducation(
  educationId: number,
  userId: number,
  input: PortfolioEducationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const db = await getDb()
  const existing = await db.get<{
    id: number
    user_id: number
    institution: string
    program: string
    degree: string
    start_date: string
    end_date: string
    status: EducationStatus
    description: string
    sort_order: number
    created_at: string
    updated_at: string
  }>(
    `
      SELECT
        id, user_id, institution, program, degree, start_date, end_date,
        status, description, sort_order, created_at, updated_at
      FROM user_education
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    educationId,
    userId,
  )
  if (!existing) return null

  await db.run(
    `
      UPDATE user_education
      SET institution = ?, program = ?, degree = ?, start_date = ?, end_date = ?, status = ?, description = ?, sort_order = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
    input.institution.trim(),
    input.program.trim(),
    input.degree.trim(),
    input.startDate.trim(),
    input.endDate.trim(),
    input.status,
    input.description.trim(),
    input.sortOrder ?? existing.sort_order,
    toIsoNow(),
    educationId,
    userId,
  )

  const updated = await db.get<{
    id: number
    user_id: number
    institution: string
    program: string
    degree: string
    start_date: string
    end_date: string
    status: EducationStatus
    description: string
    sort_order: number
    created_at: string
    updated_at: string
  }>(
    `
      SELECT
        id, user_id, institution, program, degree, start_date, end_date,
        status, description, sort_order, created_at, updated_at
      FROM user_education
      WHERE id = ?
      LIMIT 1
    `,
    educationId,
  )
  if (!updated) return null

  const record = toPortfolioEducationRecord(updated)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.update',
    entityType: 'profile_education',
    entityId: educationId,
    details: { userId, institution: record.institution, program: record.program },
    metadata,
  })

  return record
}

export async function deletePortfolioEducation(
  educationId: number,
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const db = await getDb()
  const existing = await db.get<{
    id: number
    user_id: number
    institution: string
    program: string
    degree: string
    start_date: string
    end_date: string
    status: EducationStatus
    description: string
    sort_order: number
    created_at: string
    updated_at: string
  }>(
    `
      SELECT
        id, user_id, institution, program, degree, start_date, end_date,
        status, description, sort_order, created_at, updated_at
      FROM user_education
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    educationId,
    userId,
  )
  if (!existing) return null

  await db.run('DELETE FROM user_education WHERE id = ? AND user_id = ?', educationId, userId)

  const removed = toPortfolioEducationRecord(existing)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.delete',
    entityType: 'profile_education',
    entityId: educationId,
    details: { userId, institution: removed.institution, program: removed.program },
    metadata,
  })

  return removed
}

export async function createUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  actor: SessionUser
  metadata: RequestMetadata
}) {
  const db = await getDb()
  const now = toIsoNow()

  const result = await db.run(
    `
      INSERT INTO users (username, display_name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `,
    input.username,
    input.displayName,
    input.passwordHash,
    input.role,
    now,
    now,
  )

  await ensurePortfolioSeedDataForUser({
    id: Number(result.lastID),
    username: input.username,
    display_name: input.displayName,
  })

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: Number(result.lastID),
    details: { username: input.username, role: input.role },
    metadata: input.metadata,
  })
}
