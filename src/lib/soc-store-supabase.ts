import { randomUUID } from 'crypto'
import { isReservedUsername } from '@/lib/identity-rules'
import { hashPassword, verifyPassword } from '@/lib/security'
import { dedupeStringList, getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import {
  deleteObject,
  listObjectPaths,
  readJsonObject,
  uploadJsonObject,
} from '@/lib/supabase-app-state'
import type {
  RequestMetadata,
  SessionRecord,
  PortfolioProfilePatchInput,
  PortfolioCertificationInput,
  PortfolioEducationInput,
} from '@/lib/soc-store-memory'
import type { ReportStatus, SessionUser, UserRole } from '@/lib/soc-types'
import type {
  CertificationStatus,
  EducationStatus,
  PortfolioCertificationRecord,
  PortfolioEducationRecord,
  PortfolioProfileRecord,
} from '@/lib/portfolio-profile'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface StoredUser {
  id: number
  username: string
  usernameKey: string
  displayName: string
  role: UserRole
  passwordHash: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface StoredSession {
  token: string
  user: SessionUser
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ipAddress: string | null
  userAgent: string | null
}

interface StoredProfile {
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

interface CertificationIndexEntry {
  id: number
  userId: number
}

interface StoredReport {
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

function toIsoNow() {
  return new Date().toISOString()
}

function normalizeUsernameKey(username: string) {
  return username.trim().toLowerCase()
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function makeId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }
}

function userByUsernamePath(username: string) {
  return `state/users/by-username/${normalizeUsernameKey(username)}.json`
}

function userByIdPath(userId: number) {
  return `state/users/by-id/${userId}.json`
}

function sessionPath(token: string) {
  return `state/sessions/${sanitizeFileSegment(token)}.json`
}

function profilePath(userId: number) {
  return `state/profiles/${userId}/profile.json`
}

function avatarPrefix(userId: number) {
  return `avatars/user-${userId}`
}

function certificationPrefix(userId: number) {
  return `state/profiles/${userId}/certifications`
}

function certificationPath(userId: number, certificationId: number) {
  return `${certificationPrefix(userId)}/${certificationId}.json`
}

function certificationIndexPath(certificationId: number) {
  return `state/indexes/certifications/${certificationId}.json`
}

function educationPrefix(userId: number) {
  return `state/profiles/${userId}/education`
}

function educationPath(userId: number, educationId: number) {
  return `${educationPrefix(userId)}/${educationId}.json`
}

function reportsPrefix() {
  return 'state/reports'
}

function reportPath(reportId: number) {
  return `${reportsPrefix()}/${reportId}.json`
}

function auditLogPath(action: string) {
  return `state/audit/${Date.now()}-${randomUUID()}-${sanitizeFileSegment(action)}.json`
}

async function readUserByUsername(username: string) {
  return readJsonObject<StoredUser>(userByUsernamePath(username))
}

async function readUserById(userId: number) {
  return readJsonObject<StoredUser>(userByIdPath(userId))
}

async function writeUser(user: StoredUser) {
  await Promise.all([
    uploadJsonObject(userByIdPath(user.id), user),
    uploadJsonObject(userByUsernamePath(user.username), user),
  ])
}

export async function ensureIdentityShadowUser(input: {
  id: number
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}) {
  const user: StoredUser = {
    id: input.id,
    username: input.username,
    usernameKey: normalizeUsernameKey(input.username),
    displayName: input.displayName,
    role: input.role,
    passwordHash: input.passwordHash,
    isActive: input.isActive,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }

  await writeUser(user)

  if (user.isActive) {
    await ensureProfileSeedDataForUser(user)
  }
}

async function ensureSeedUsers() {
  return
}

async function ensureProfileSeedDataForUser(user: StoredUser): Promise<StoredProfile> {
  const existing = await readJsonObject<StoredProfile>(profilePath(user.id))
  if (existing) return existing

  const seed = getPortfolioSeedForUser({
    username: user.username,
    displayName: user.displayName,
  })
  const now = toIsoNow()
  const profile: StoredProfile = {
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

  await uploadJsonObject(profilePath(user.id), profile)

  return profile
}

async function listPortfolioCertificationsByUserId(userId: number): Promise<PortfolioCertificationRecord[]> {
  const paths = await listObjectPaths(certificationPrefix(userId))
  const rows = (
    await Promise.all(paths.filter((item) => item.endsWith('.json')).map((item) => readJsonObject<PortfolioCertificationRecord>(item)))
  ).filter((item): item is PortfolioCertificationRecord => Boolean(item))

  return rows.sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id)
}

async function listPortfolioEducationByUserId(userId: number): Promise<PortfolioEducationRecord[]> {
  const paths = await listObjectPaths(educationPrefix(userId))
  const rows = (
    await Promise.all(paths.filter((item) => item.endsWith('.json')).map((item) => readJsonObject<PortfolioEducationRecord>(item)))
  ).filter((item): item is PortfolioEducationRecord => Boolean(item))

  return rows.sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id)
}

async function getEducationRecordById(userId: number, educationId: number) {
  return readJsonObject<PortfolioEducationRecord>(educationPath(userId, educationId))
}

export async function getPortfolioAvatarForUser(userId: number): Promise<{
  assetPath: string
  assetName: string | null
  assetMimeType: string | null
} | null> {
  const profile = await readJsonObject<StoredProfile>(profilePath(userId))
  if (profile?.avatarPath) {
    return {
      assetPath: profile.avatarPath,
      assetName: profile.avatarName ?? (profile.avatarPath.split('/').at(-1) ?? null),
      assetMimeType: profile.avatarMimeType ?? null,
    }
  }

  const fallbackAssets = (await listObjectPaths(avatarPrefix(userId)))
    .filter((item) => !item.endsWith('.json'))
    .sort()
  const latestAssetPath = fallbackAssets.at(-1) ?? null
  if (!latestAssetPath) return null

  return {
    assetPath: latestAssetPath,
    assetName: latestAssetPath.split('/').at(-1) ?? null,
    assetMimeType: null,
  }
}

export async function writeAuditLog(input: {
  actorUserId: number | null
  action: string
  entityType: string
  entityId?: string | number | null
  details?: Record<string, unknown>
  metadata?: RequestMetadata
}) {
  await uploadJsonObject(auditLogPath(input.action), {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    details: input.details ?? {},
    metadata: input.metadata ?? {},
    createdAt: toIsoNow(),
  })
}

export async function cleanupExpiredSessions() {
  // Session files are cleaned lazily on read to avoid listing the whole bucket per request.
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  await ensureSeedUsers()
  const user = await readUserByUsername(username)
  if (!user || !user.isActive) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  return toSessionUser(user)
}

export async function createSession(user: SessionUser, metadata: RequestMetadata): Promise<SessionRecord> {
  await ensureSeedUsers()
  const token = randomUUID()
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString()

  const session: StoredSession = {
    token,
    user,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  }

  await uploadJsonObject(sessionPath(token), session)
  return { token, user, expiresAt }
}

export async function deleteSession(token: string) {
  await deleteObject(sessionPath(token))
}

export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  if (!token) return null
  await ensureSeedUsers()
  const session = await readJsonObject<StoredSession>(sessionPath(token))
  if (!session) return null

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteObject(sessionPath(token))
    return null
  }

  const user = await readUserById(session.user.id)
  if (!user || !user.isActive) {
    return null
  }

  return {
    token: session.token,
    user: toSessionUser(user),
    expiresAt: session.expiresAt,
  }
}

export async function registerUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  metadata: RequestMetadata
}): Promise<SessionUser> {
  await ensureSeedUsers()
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }
  const existing = await readUserByUsername(input.username)
  if (existing?.isActive) {
    throw new Error('User already exists')
  }

  const now = toIsoNow()
  const user: StoredUser = {
    id: makeId(),
    username: input.username,
    usernameKey: normalizeUsernameKey(input.username),
    displayName: input.displayName,
    role: input.role,
    passwordHash: input.passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  await writeUser(user)
  await ensureProfileSeedDataForUser(user)

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

export async function createUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  actor: SessionUser
  metadata: RequestMetadata
}) {
  await ensureSeedUsers()
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }
  const existing = await readUserByUsername(input.username)
  if (existing?.isActive) {
    throw new Error('User already exists')
  }

  const now = toIsoNow()
  const user: StoredUser = {
    id: makeId(),
    username: input.username,
    usernameKey: normalizeUsernameKey(input.username),
    displayName: input.displayName,
    role: input.role,
    passwordHash: input.passwordHash,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  await writeUser(user)
  await ensureProfileSeedDataForUser(user)

  await writeAuditLog({
    actorUserId: input.actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role },
    metadata: input.metadata,
  })
}

export async function getPortfolioProfile(userId: number): Promise<PortfolioProfileRecord | null> {
  await ensureSeedUsers()
  const user = await readUserById(userId)
  if (!user || !user.isActive) return null

  const profile = await ensureProfileSeedDataForUser(user)
  const [certifications, education, avatarAsset] = await Promise.all([
    listPortfolioCertificationsByUserId(user.id),
    listPortfolioEducationByUserId(user.id),
    getPortfolioAvatarForUser(user.id),
  ])
  const avatarPath = avatarAsset?.assetPath ?? null
  const avatarName = avatarAsset?.assetName ?? null
  const avatarMimeType = avatarAsset?.assetMimeType ?? null

  return {
    user: toSessionUser(user),
    profile: {
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      specialties: [...profile.specialties],
      tools: [...profile.tools],
      avatarPath,
      avatarName,
      avatarMimeType,
      updatedAt: profile.updatedAt,
    },
    certifications,
    education,
  }
}

export async function getPortfolioCertificationById(
  certificationId: number,
): Promise<PortfolioCertificationRecord | null> {
  const indexEntry = await readJsonObject<CertificationIndexEntry>(certificationIndexPath(certificationId))
  if (!indexEntry) return null
  return readJsonObject<PortfolioCertificationRecord>(certificationPath(indexEntry.userId, certificationId))
}

export async function updatePortfolioProfile(
  userId: number,
  patch: PortfolioProfilePatchInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioProfileRecord | null> {
  await ensureSeedUsers()
  const user = await readUserById(userId)
  if (!user || !user.isActive) return null

  const current = await ensureProfileSeedDataForUser(user)
  const fallbackAvatar =
    current.avatarPath || current.avatarName || current.avatarMimeType
      ? null
      : await getPortfolioAvatarForUser(userId)
  const updated: StoredProfile = {
    ...current,
    headline: patch.headline.trim(),
    bio: patch.bio.trim(),
    location: patch.location.trim(),
    website: patch.website.trim(),
    specialties: dedupeStringList(patch.specialties),
    tools: dedupeStringList(patch.tools),
    avatarPath: current.avatarPath ?? fallbackAvatar?.assetPath ?? null,
    avatarName: current.avatarName ?? fallbackAvatar?.assetName ?? null,
    avatarMimeType: current.avatarMimeType ?? fallbackAvatar?.assetMimeType ?? null,
    updatedAt: toIsoNow(),
  }

  await uploadJsonObject(profilePath(userId), updated)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.update',
    entityType: 'profile',
    entityId: userId,
    details: {
      headline: updated.headline,
      specialtyCount: updated.specialties.length,
      toolCount: updated.tools.length,
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
  await ensureSeedUsers()
  const user = await readUserById(userId)
  if (!user || !user.isActive) return null

  const current = await ensureProfileSeedDataForUser(user)
  const updated: StoredProfile = {
    ...current,
    avatarPath: input.avatarPath,
    avatarName: input.avatarName,
    avatarMimeType: input.avatarMimeType,
    updatedAt: toIsoNow(),
  }

  await uploadJsonObject(profilePath(userId), updated)

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
  const user = await readUserById(userId)
  if (!user || !user.isActive) return null
  await ensureProfileSeedDataForUser(user)

  const current = await listPortfolioCertificationsByUserId(userId)
  const now = toIsoNow()
  const certification: PortfolioCertificationRecord = {
    id: makeId(),
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
    sortOrder: input.sortOrder ?? current.length,
    createdAt: now,
    updatedAt: now,
  }

  await uploadJsonObject(certificationPath(userId, certification.id), certification)
  await uploadJsonObject(certificationIndexPath(certification.id), {
    id: certification.id,
    userId,
  } satisfies CertificationIndexEntry)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.certification.create',
    entityType: 'profile_certification',
    entityId: certification.id,
    details: { userId, title: certification.title, hasAsset: Boolean(certification.assetPath) },
    metadata,
  })

  return certification
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

  const updated: PortfolioCertificationRecord = {
    ...existing,
    title: input.title.trim(),
    issuer: input.issuer.trim(),
    issueDate: input.issueDate.trim(),
    expiryDate: input.expiryDate.trim(),
    credentialId: input.credentialId.trim(),
    verifyUrl: input.verifyUrl.trim(),
    status: input.status,
    notes: input.notes.trim(),
    assetPath: input.assetPath !== undefined ? input.assetPath : existing.assetPath ?? null,
    assetName: input.assetName !== undefined ? input.assetName : existing.assetName ?? null,
    assetMimeType:
      input.assetMimeType !== undefined ? input.assetMimeType : existing.assetMimeType ?? null,
    assetSize: input.assetSize !== undefined ? input.assetSize : existing.assetSize ?? null,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: toIsoNow(),
  }

  await uploadJsonObject(certificationPath(userId, certificationId), updated)

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

  await Promise.all([
    deleteObject(certificationPath(userId, certificationId)),
    deleteObject(certificationIndexPath(certificationId)),
  ])

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
  const user = await readUserById(userId)
  if (!user || !user.isActive) return null
  await ensureProfileSeedDataForUser(user)

  const current = await listPortfolioEducationByUserId(userId)
  const now = toIsoNow()
  const education: PortfolioEducationRecord = {
    id: makeId(),
    userId,
    institution: input.institution.trim(),
    program: input.program.trim(),
    degree: input.degree.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    status: input.status,
    description: input.description.trim(),
    sortOrder: input.sortOrder ?? current.length,
    createdAt: now,
    updatedAt: now,
  }

  await uploadJsonObject(educationPath(userId, education.id), education)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.create',
    entityType: 'profile_education',
    entityId: education.id,
    details: { userId, institution: education.institution, program: education.program },
    metadata,
  })

  return education
}

export async function updatePortfolioEducation(
  educationId: number,
  userId: number,
  input: PortfolioEducationInput,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const existing = await getEducationRecordById(userId, educationId)
  if (!existing) return null

  const updated: PortfolioEducationRecord = {
    ...existing,
    institution: input.institution.trim(),
    program: input.program.trim(),
    degree: input.degree.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    status: input.status,
    description: input.description.trim(),
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: toIsoNow(),
  }

  await uploadJsonObject(educationPath(userId, educationId), updated)

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.update',
    entityType: 'profile_education',
    entityId: educationId,
    details: { userId, institution: updated.institution, program: updated.program },
    metadata,
  })

  return updated
}

export async function deletePortfolioEducation(
  educationId: number,
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<PortfolioEducationRecord | null> {
  const existing = await getEducationRecordById(userId, educationId)
  if (!existing) return null

  await deleteObject(educationPath(userId, educationId))

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'profile.education.delete',
    entityType: 'profile_education',
    entityId: educationId,
    details: { userId, institution: existing.institution, program: existing.program },
    metadata,
  })

  return existing
}

export async function listReports(
  filters: { limit?: number; cursor?: number; status?: ReportStatus | 'all' } = {},
): Promise<{ reports: import('@/lib/soc-store-memory').ReportRecord[]; hasNext: boolean; nextCursor: number | null }> {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
  const statusFilter = filters.status ?? 'active'
  const paths = await listObjectPaths(reportsPrefix())
  const reports = (
    await Promise.all(
      paths
        .filter((item) => item.endsWith('.json'))
        .map((item) => readJsonObject<StoredReport>(item)),
    )
  )
    .filter((item): item is StoredReport => Boolean(item))
    .filter((item) => statusFilter === 'all' || item.status === statusFilter || (!item.status && statusFilter === 'active'))
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      if (aTime !== bTime) return bTime - aTime
      return b.id - a.id
    })

  let startIndex = 0
  if (filters.cursor != null) {
    const cursorPos = reports.findIndex((report) => report.id === filters.cursor)
    startIndex = cursorPos === -1 ? reports.length : cursorPos + 1
  }

  const slice = reports.slice(startIndex, startIndex + limit + 1)
  const hasNext = slice.length > limit
  const page = slice.slice(0, limit).map((report) => ({
    id: report.id,
    title: report.title,
    content: report.content,
    severity: report.severity,
    tags: report.tags,
    status: report.status ?? 'active',
    createdAt: report.createdAt,
    updatedAt: report.updatedAt ?? report.createdAt,
    archivedAt: report.archivedAt ?? null,
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
}): Promise<import('@/lib/soc-store-memory').ReportRecord> {
  const report: StoredReport = {
    id: makeId(),
    title: input.title,
    content: input.content,
    severity: input.severity,
    tags: [...input.tags],
    status: 'active',
    createdByUserId: input.actor.id,
    createdAt: toIsoNow(),
    updatedAt: toIsoNow(),
    archivedAt: null,
  }

  await uploadJsonObject(reportPath(report.id), report)

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

export async function archiveReport(
  id: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<import('@/lib/soc-store-memory').ReportRecord | null> {
  const existing = await readJsonObject<StoredReport>(reportPath(id))
  if (!existing) return null

  if (actor.role === 'viewer' && existing.createdByUserId !== actor.id) {
    throw new Error('FORBIDDEN')
  }

  if (existing.status !== 'archived') {
    existing.status = 'archived'
    existing.archivedAt = toIsoNow()
    existing.updatedAt = existing.archivedAt
    await uploadJsonObject(reportPath(id), existing)

    await writeAuditLog({
      actorUserId: actor.id,
      action: 'report.archive',
      entityType: 'report',
      entityId: id,
      metadata,
    })
  }

  return {
    id: existing.id,
    title: existing.title,
    content: existing.content,
    severity: existing.severity,
    tags: existing.tags,
    status: existing.status,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
    archivedAt: existing.archivedAt,
  }
}


