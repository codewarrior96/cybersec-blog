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
import { deleteStoredAsset } from '@/lib/portfolio-assets'
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
  // ─── Email + recovery (Phase 2 of email foundation) ────────────────────
  // Schema-only addition; Phase 3+ will populate these during register and
  // verify/reset flows. Until Phase 3 ships, callers create users with
  // empty defaults — TS strict satisfied without runtime change.
  email: string
  emailKey: string
  emailVerified: boolean
  emailVerifyToken: string | null
  emailVerifyTokenExpiresAt: string | null
  passwordResetToken: string | null
  passwordResetTokenExpiresAt: string | null
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

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase()
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
    emailVerified: user.emailVerified,
  }
}

function userByEmailKeyPath(emailKey: string) {
  return `state/users/by-email/${emailKey}.json`
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

// F-002: exported so DELETE /api/users/me can re-fetch the full
// StoredUser record (including passwordHash) for password verification.
// SessionUser intentionally omits the hash; this is the controlled
// path to access it.
export async function readUserById(userId: number) {
  return readJsonObject<StoredUser>(userByIdPath(userId))
}

async function readUserByEmailKeyInternal(emailKey: string) {
  return readJsonObject<StoredUser>(userByEmailKeyPath(emailKey))
}

export async function readUserByEmailKey(emailKey: string) {
  if (!emailKey) return null
  return readUserByEmailKeyInternal(emailKey)
}

/**
 * Phase 4.5: public username-keyed lookup. Used by the login route
 * after a successful credential check to fetch the email address for
 * the EMAIL_NOT_VERIFIED 403 response (so the frontend can pre-fill
 * the resend-verification flow). The internal helper is already used
 * across this module; this export just exposes it through the adapter
 * contract.
 */
export async function readUserByUsername(username: string) {
  if (!username) return null
  return readJsonObject<StoredUser>(userByUsernamePath(username))
}

/**
 * Phase 4: lookup user by current emailVerifyToken. Used by /api/auth/verify
 * to consume a verification link. Token is opaque 32-byte hex; we don't
 * keep a token-to-userid index file since tokens are short-lived and
 * rotate, so this is O(n) over indexed users. For early-stage scale (0
 * users today, growing to thousands) this is acceptable. Switch to a
 * dedicated token index file when signup volume warrants it.
 */
export async function findUserByVerifyToken(token: string): Promise<StoredUser | null> {
  if (!token) return null
  try {
    const paths = await listObjectPaths('state/users/by-id/')
    for (const path of paths) {
      const user = await readJsonObject<StoredUser>(path)
      if (user?.emailVerifyToken === token) return user
    }
    return null
  } catch (err) {
    console.error('[soc-store-supabase.findUserByVerifyToken] failed:', err)
    return null
  }
}

export async function setEmailVerified(userId: number): Promise<StoredUser | null> {
  const user = await readUserById(userId)
  if (!user) return null
  const updated: StoredUser = {
    ...user,
    emailVerified: true,
    emailVerifyToken: null,
    emailVerifyTokenExpiresAt: null,
    updatedAt: toIsoNow(),
  }
  await writeUser(updated)
  return updated
}

export async function setEmailVerifyToken(
  userId: number,
  token: string,
  expiresAt: string,
): Promise<StoredUser | null> {
  const user = await readUserById(userId)
  if (!user) return null
  const updated: StoredUser = {
    ...user,
    emailVerifyToken: token,
    emailVerifyTokenExpiresAt: expiresAt,
    updatedAt: toIsoNow(),
  }
  await writeUser(updated)
  return updated
}

/**
 * Phase 5: lookup user by current passwordResetToken. Mirrors the
 * findUserByVerifyToken pattern — opaque 32-byte hex token, no
 * dedicated token-to-userid index file (O(n) over indexed users; fine
 * at current scale, switch to an index when signup volume warrants).
 */
export async function findUserByPasswordResetToken(token: string): Promise<StoredUser | null> {
  if (!token) return null
  try {
    const paths = await listObjectPaths('state/users/by-id/')
    for (const path of paths) {
      const user = await readJsonObject<StoredUser>(path)
      if (user?.passwordResetToken === token) return user
    }
    return null
  } catch (err) {
    console.error('[soc-store-supabase.findUserByPasswordResetToken] failed:', err)
    return null
  }
}

/**
 * Phase 5: stash a fresh password-reset token + expiry on the user
 * record. Caller (POST /api/auth/forgot) generates the token via
 * randomBytes(32).toString('hex') and a 1-hour TTL — shorter than the
 * verify token's 24h since reset is more sensitive (assumes the
 * "forgot" signal may indicate compromise).
 */
export async function setPasswordResetToken(
  userId: number,
  token: string,
  expiresAt: string,
): Promise<StoredUser | null> {
  const user = await readUserById(userId)
  if (!user) return null
  const updated: StoredUser = {
    ...user,
    passwordResetToken: token,
    passwordResetTokenExpiresAt: expiresAt,
    updatedAt: toIsoNow(),
  }
  await writeUser(updated)
  return updated
}

/**
 * Phase 5: atomic consume of a password-reset token. Writes the new
 * passwordHash, clears the reset token + expiry, and bumps updatedAt
 * in one writeUser pass. Caller validates token freshness BEFORE
 * calling this; we don't double-check here since the token may already
 * have been cleared by a concurrent reset (both writes idempotent).
 */
export async function consumePasswordResetToken(
  userId: number,
  newPasswordHash: string,
): Promise<StoredUser | null> {
  const user = await readUserById(userId)
  if (!user) return null
  const updated: StoredUser = {
    ...user,
    passwordHash: newPasswordHash,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    updatedAt: toIsoNow(),
  }
  await writeUser(updated)
  return updated
}

/**
 * Phase 5: invalidate every active session for a user. Used after a
 * successful password reset to force fresh login on every device —
 * standard GitHub/banking pattern. Iterates `state/sessions/*.json`,
 * reads each, and deletes those whose embedded `user.id` matches.
 *
 * O(N) over total active sessions (not just this user's). Acceptable
 * at current scale; if session volume grows, swap for a per-user
 * index file (`state/sessions/by-user/{id}/{token}`).
 *
 * Best-effort: we tolerate individual deletion failures (logged) and
 * report `deletedCount` = the number actually removed. Caller can
 * decide whether to surface a warning if deletedCount < expected.
 */
export async function deleteAllSessionsForUser(userId: number): Promise<{ deletedCount: number }> {
  let deletedCount = 0
  try {
    const paths = await listObjectPaths('state/sessions/')
    for (const path of paths) {
      try {
        const session = await readJsonObject<StoredSession>(path)
        if (!session) continue
        if (session.user?.id !== userId) continue
        await deleteObject(path)
        deletedCount += 1
      } catch (err) {
        console.warn('[soc-store-supabase.deleteAllSessionsForUser] per-session delete failed:', path, err)
      }
    }
  } catch (err) {
    console.error('[soc-store-supabase.deleteAllSessionsForUser] list failed:', err)
  }
  return { deletedCount }
}

/**
 * F-002: account permanent delete with GDPR cascade.
 *
 * Cascade order (sacred — do not reorder):
 *   1. Audit snapshot BEFORE any deletion. AUDIT_LOG_FAILED throws to
 *      abort the whole cascade — user remains intact. Cannot delete
 *      without forensic record.
 *   2. Sessions (delegates to deleteAllSessionsForUser)
 *   3. Reports (own only — createdByUserId === userId)
 *   4. Certifications: binary asset + index entry + record
 *   5. Educations
 *   6. Avatar binaries (avatars/user-{id}/* prefix)
 *   7. Profile record
 *   8. User indexes — by-email, by-username, by-id LAST. Failure here
 *      throws (cannot leave half-deleted user record).
 *
 * Per-step error handling: best-effort with console.warn for orphans
 * on resource steps; final user-record deletion is fatal-on-failure.
 *
 * Returns null when the user doesn't exist; throws AUDIT_LOG_FAILED
 * if step 1 fails. Caller maps these to 404 / 500 respectively.
 */
export async function deleteUserCascade(
  userId: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<{
  deleted: true
  counts: {
    sessions: number
    reports: number
    certifications: number
    educations: number
  }
} | null> {
  const user = await readUserById(userId)
  if (!user) return null

  // Pre-count cascade resources for the audit snapshot. Done BEFORE
  // any delete so the count reflects what's about to be removed,
  // even if resource deletion later fails partially.
  const allReportPaths = await listObjectPaths(reportsPrefix())
  const userReportPaths: string[] = []
  for (const path of allReportPaths) {
    if (!path.endsWith('.json')) continue
    const report = await readJsonObject<StoredReport>(path)
    if (report && report.createdByUserId === userId) {
      userReportPaths.push(path)
    }
  }

  const certPaths = (await listObjectPaths(certificationPrefix(userId))).filter((p) => p.endsWith('.json'))
  const certs: PortfolioCertificationRecord[] = []
  for (const path of certPaths) {
    const cert = await readJsonObject<PortfolioCertificationRecord>(path)
    if (cert) certs.push(cert)
  }

  const eduPaths = (await listObjectPaths(educationPrefix(userId))).filter((p) => p.endsWith('.json'))

  const counts = {
    sessions: 0, // populated by deleteAllSessionsForUser below
    reports: userReportPaths.length,
    certifications: certs.length,
    educations: eduPaths.length,
  }

  // Step 1 — audit FIRST (sacred invariant)
  try {
    await writeAuditLog({
      actorUserId: actor.id,
      action: 'user.delete',
      entityType: 'user',
      entityId: userId,
      details: {
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        counts,
      },
      metadata,
    })
  } catch (err) {
    console.error('[soc-store-supabase.deleteUserCascade] audit write failed, aborting:', err)
    throw new Error('AUDIT_LOG_FAILED')
  }

  // Step 2 — sessions
  const { deletedCount: sessionsDeleted } = await deleteAllSessionsForUser(userId)
  counts.sessions = sessionsDeleted

  // Step 3 — reports
  for (const path of userReportPaths) {
    try {
      await deleteObject(path)
    } catch (err) {
      console.warn('[soc-store-supabase.deleteUserCascade] report delete failed:', path, err)
    }
  }

  // Step 4 — certifications (asset + index + record)
  for (const cert of certs) {
    try {
      if (cert.assetPath) {
        await deleteStoredAsset(cert.assetPath)
      }
      await deleteObject(certificationIndexPath(cert.id))
      await deleteObject(certificationPath(userId, cert.id))
    } catch (err) {
      console.warn('[soc-store-supabase.deleteUserCascade] cert delete failed:', cert.id, err)
    }
  }

  // Step 5 — educations
  for (const path of eduPaths) {
    try {
      await deleteObject(path)
    } catch (err) {
      console.warn('[soc-store-supabase.deleteUserCascade] education delete failed:', path, err)
    }
  }

  // Step 6 — avatar binaries
  try {
    const avatarPaths = await listObjectPaths(avatarPrefix(userId))
    for (const path of avatarPaths) {
      try {
        await deleteStoredAsset(path)
      } catch (err) {
        console.warn('[soc-store-supabase.deleteUserCascade] avatar binary delete failed:', path, err)
      }
    }
  } catch (err) {
    console.warn('[soc-store-supabase.deleteUserCascade] avatar list failed:', err)
  }

  // Step 7 — profile
  try {
    await deleteObject(profilePath(userId))
  } catch (err) {
    console.warn('[soc-store-supabase.deleteUserCascade] profile delete failed:', err)
  }

  // Step 8 — user indexes (LAST, in this order; fatal-on-failure)
  try {
    if (user.emailKey) {
      await deleteObject(userByEmailKeyPath(user.emailKey))
    }
    await deleteObject(userByUsernamePath(user.username))
    await deleteObject(userByIdPath(userId))
  } catch (err) {
    console.error('[soc-store-supabase.deleteUserCascade] user index delete failed:', err)
    throw err
  }

  return { deleted: true, counts }
}

async function writeUser(user: StoredUser) {
  const writes: Promise<unknown>[] = [
    uploadJsonObject(userByIdPath(user.id), user),
    uploadJsonObject(userByUsernamePath(user.username), user),
  ]
  if (user.emailKey) {
    writes.push(uploadJsonObject(userByEmailKeyPath(user.emailKey), user))
  }
  await Promise.all(writes)
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
  // Email-related fields are optional inputs so the postgres adapter
  // (which doesn't yet read them from its rows) can call this without
  // forcing a schema-coupled refactor in Phase 2. Phase 3+ will pass
  // them through.
  email?: string
  emailVerified?: boolean
  emailVerifyToken?: string | null
  emailVerifyTokenExpiresAt?: string | null
  passwordResetToken?: string | null
  passwordResetTokenExpiresAt?: string | null
}) {
  const email = input.email ?? ''
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
    email,
    emailKey: normalizeEmailKey(email),
    emailVerified: input.emailVerified ?? false,
    emailVerifyToken: input.emailVerifyToken ?? null,
    emailVerifyTokenExpiresAt: input.emailVerifyTokenExpiresAt ?? null,
    passwordResetToken: input.passwordResetToken ?? null,
    passwordResetTokenExpiresAt: input.passwordResetTokenExpiresAt ?? null,
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
  // Phase 3: optional email-verification bundle. When provided, the new
  // user is persisted with emailVerified=false + the verification token
  // set on the same write that creates the record (atomic with the
  // identity-by-id and -by-username index files).
  email?: string
  emailVerifyToken?: string | null
  emailVerifyTokenExpiresAt?: string | null
}): Promise<SessionUser> {
  await ensureSeedUsers()
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }
  const existing = await readUserByUsername(input.username)
  if (existing?.isActive) {
    throw new Error('User already exists')
  }

  const email = input.email ?? ''
  const emailKey = email ? normalizeEmailKey(email) : ''

  // Email-uniqueness guard. Routes already validate format and pre-check
  // uniqueness, but we re-check at the storage boundary so concurrent
  // registrations can't slip past a race in route-level validation.
  if (emailKey) {
    const emailTaken = await readUserByEmailKeyInternal(emailKey)
    if (emailTaken?.isActive) {
      throw new Error('Email already exists')
    }
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
    email,
    emailKey,
    emailVerified: false,
    emailVerifyToken: input.emailVerifyToken ?? null,
    emailVerifyTokenExpiresAt: input.emailVerifyTokenExpiresAt ?? null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
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
    // Phase 2 schema-only defaults; admin-created users currently lack
    // email association — future admin UI will collect this.
    email: '',
    emailKey: '',
    emailVerified: false,
    emailVerifyToken: null,
    emailVerifyTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
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
  filters: {
    limit?: number
    cursor?: number
    status?: ReportStatus | 'all'
    // BUG-002: per-user listing. Mirrors memory store. Viewers see
    // only their own reports; admin/analyst see all. Drives the
    // per-row isOwner flag in the response.
    actor?: SessionUser
  } = {},
): Promise<{ reports: import('@/lib/soc-store-memory').ReportRecord[]; hasNext: boolean; nextCursor: number | null }> {
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20))
  const statusFilter = filters.status ?? 'active'
  const actor = filters.actor
  const isViewer = actor?.role === 'viewer'
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
    .filter((item) => !isViewer || item.createdByUserId === actor?.id)
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
    // Default false when no actor was passed — backward-compat for
    // callers without session context. The route handler always
    // passes actor.
    isOwner: actor ? report.createdByUserId === actor.id : false,
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
    // BUG-002: actor is the creator by definition here.
    isOwner: true,
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
    // BUG-002: archiveReport is reachable by either an owner viewer or
    // any higher role. Compute the flag honestly so the response
    // reflects the actor's relationship to the record.
    isOwner: existing.createdByUserId === actor.id,
  }
}

/**
 * F-001: permanent report deletion. Mirrors archiveReport's owner /
 * status checks; on success removes the JSON object from storage via
 * the same `deleteObject` primitive used by deleteSession,
 * deletePortfolioCertification, deletePortfolioEducation.
 *
 * Two-stage safety: throws NOT_ARCHIVED if status !== 'archived'.
 * Owner check: viewer role can only delete own reports.
 * Audit log: action='report.delete' with same shape as report.archive.
 */
export async function deleteReport(
  id: number,
  actor: SessionUser,
  metadata: RequestMetadata,
): Promise<{ deleted: true } | null> {
  const existing = await readJsonObject<StoredReport>(reportPath(id))
  if (!existing) return null

  if (actor.role === 'viewer' && existing.createdByUserId !== actor.id) {
    throw new Error('FORBIDDEN')
  }

  if (existing.status !== 'archived') {
    throw new Error('NOT_ARCHIVED')
  }

  await deleteObject(reportPath(id))

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'report.delete',
    entityType: 'report',
    entityId: id,
    details: { severity: existing.severity, title: existing.title },
    metadata,
  })

  return { deleted: true }
}


