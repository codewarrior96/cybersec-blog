import { randomUUID } from 'crypto'
import { isReservedUsername } from '@/lib/identity-rules'
import { verifyPassword } from '@/lib/security'
import type { RequestMetadata, SessionRecord, UserWorkload } from '@/lib/soc-store-memory'
import { isSupabaseAppStateEnabled } from '@/lib/supabase-app-state'
import { getSupabaseProductDbClient } from '@/lib/supabase-product-db'
import { ensureIdentityShadowUser, writeAuditLog } from '@/lib/soc-store-supabase'
import type { SessionUser, UserRole } from '@/lib/soc-types'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface PostgresIdentityUserRow {
  id: number
  username: string
  username_key: string
  display_name: string
  role: UserRole
  password_hash: string
  status: 'active' | 'disabled' | 'archived'
  primary_domain_key: string
  created_at: string
  updated_at: string
  // ─── Email + recovery (Phase 2 of email foundation) ──────────────────
  // Type-only mirror of Phase 2 StoredUser additions. The actual
  // identity.users SQL columns are NOT added by this commit — that's
  // a separate database migration (out of Phase 2 scope per spec).
  // The fields are nullable on the row type so reads against the
  // unmigrated table still type-check (PG returns null for missing
  // columns when extracted from `select(...)`'s explicit list — this
  // mirror exists for the day the migration runs, and the SELECT lists
  // below do NOT yet reference these columns to avoid runtime errors.
  email?: string | null
  email_key?: string | null
  email_verified?: boolean | null
  email_verify_token?: string | null
  email_verify_token_expires_at?: string | null
  password_reset_token?: string | null
  password_reset_token_expires_at?: string | null
}

interface PostgresIdentitySessionRow {
  token: string
  user_id: number
  ip_address: string | null
  user_agent: string | null
  created_at: string
  last_seen_at: string
  expires_at: string
}

function toIsoNow() {
  return new Date().toISOString()
}

function normalizeUsernameKey(username: string) {
  return username.trim().toLowerCase()
}

function getRequiredClient() {
  const client = getSupabaseProductDbClient()
  if (!client) {
    throw new Error('Supabase product database is not configured.')
  }
  return client
}

function toSessionUser(user: Pick<PostgresIdentityUserRow, 'id' | 'username' | 'display_name' | 'role'>): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  }
}

async function syncIdentityShadowUser(user: PostgresIdentityUserRow) {
  if (!isSupabaseAppStateEnabled()) return

  try {
    await ensureIdentityShadowUser({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      passwordHash: user.password_hash,
      isActive: user.status === 'active',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })
  } catch (error) {
    console.warn('[soc-store-supabase-postgres] Failed to sync identity shadow user:', error)
  }
}

async function readActiveUserByUsername(username: string): Promise<PostgresIdentityUserRow | null> {
  const client = getRequiredClient()
  const { data, error } = await client
    .schema('identity')
    .from('users')
    .select('id, username, username_key, display_name, role, password_hash, status, primary_domain_key, created_at, updated_at')
    .eq('username_key', normalizeUsernameKey(username))
    .eq('status', 'active')
    .maybeSingle<PostgresIdentityUserRow>()

  if (error) {
    throw new Error(`postgres user lookup failed: ${error.message}`)
  }

  return data ?? null
}

async function readActiveUserById(userId: number): Promise<PostgresIdentityUserRow | null> {
  const client = getRequiredClient()
  const { data, error } = await client
    .schema('identity')
    .from('users')
    .select('id, username, username_key, display_name, role, password_hash, status, primary_domain_key, created_at, updated_at')
    .eq('id', userId)
    .eq('status', 'active')
    .maybeSingle<PostgresIdentityUserRow>()

  if (error) {
    throw new Error(`postgres user-by-id lookup failed: ${error.message}`)
  }

  return data ?? null
}

export async function cleanupExpiredSessions() {
  const client = getRequiredClient()
  const { error } = await client
    .schema('identity')
    .from('sessions')
    .delete()
    .lte('expires_at', toIsoNow())

  if (error) {
    throw new Error(`postgres expired session cleanup failed: ${error.message}`)
  }
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  const user = await readActiveUserByUsername(username)
  if (!user) return null
  if (!verifyPassword(password, user.password_hash)) return null

  await syncIdentityShadowUser(user)
  return toSessionUser(user)
}

export async function createSession(user: SessionUser, metadata: RequestMetadata): Promise<SessionRecord> {
  const client = getRequiredClient()
  const token = randomUUID()
  const createdAt = toIsoNow()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  const { error } = await client
    .schema('identity')
    .from('sessions')
    .insert({
      token,
      user_id: user.id,
      ip_address: metadata.ipAddress,
      user_agent: metadata.userAgent,
      created_at: createdAt,
      last_seen_at: createdAt,
      expires_at: expiresAt,
    })

  if (error) {
    throw new Error(`postgres session create failed: ${error.message}`)
  }

  return {
    token,
    user,
    expiresAt,
  }
}

export async function deleteSession(token: string) {
  const client = getRequiredClient()
  const { error } = await client.schema('identity').from('sessions').delete().eq('token', token)
  if (error) {
    throw new Error(`postgres session delete failed: ${error.message}`)
  }
}

export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  if (!token) return null

  const client = getRequiredClient()
  const { data: session, error: sessionError } = await client
    .schema('identity')
    .from('sessions')
    .select('token, user_id, ip_address, user_agent, created_at, last_seen_at, expires_at')
    .eq('token', token)
    .maybeSingle<PostgresIdentitySessionRow>()

  if (sessionError) {
    throw new Error(`postgres session lookup failed: ${sessionError.message}`)
  }
  if (!session) return null

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await deleteSession(token)
    return null
  }

  const user = await readActiveUserById(session.user_id)
  if (!user) return null

  const { error: updateError } = await client
    .schema('identity')
    .from('sessions')
    .update({ last_seen_at: toIsoNow() })
    .eq('token', token)

  if (updateError) {
    console.warn('[soc-store-supabase-postgres] Failed to update session last_seen_at:', updateError)
  }

  await syncIdentityShadowUser(user)

  return {
    token: session.token,
    user: toSessionUser(user),
    expiresAt: session.expires_at,
  }
}

export async function listAssignableUsers(): Promise<UserWorkload[]> {
  const client = getRequiredClient()
  const { data, error } = await client
    .schema('identity')
    .from('users')
    .select('id, username, display_name, role')
    .eq('status', 'active')

  if (error) {
    throw new Error(`postgres list users failed: ${error.message}`)
  }

  const rows = (data ?? []) as Array<Pick<PostgresIdentityUserRow, 'id' | 'username' | 'display_name' | 'role'>>
  const roleRank = (role: UserRole) => (role === 'admin' ? 1 : role === 'analyst' ? 2 : 3)

  return rows
    .map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      activeWorkload: 0,
    }))
    .sort((a, b) => {
      if (roleRank(a.role) !== roleRank(b.role)) return roleRank(a.role) - roleRank(b.role)
      return a.username.localeCompare(b.username)
    })
}

async function insertIdentityUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
}) {
  const client = getRequiredClient()
  const now = toIsoNow()
  const payload = {
    username: input.username,
    username_key: normalizeUsernameKey(input.username),
    display_name: input.displayName,
    role: input.role,
    password_hash: input.passwordHash,
    status: 'active',
    primary_domain_key: 'core_operator',
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await client
    .schema('identity')
    .from('users')
    .insert(payload)
    .select('id, username, username_key, display_name, role, password_hash, status, primary_domain_key, created_at, updated_at')
    .single<PostgresIdentityUserRow>()

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error('User already exists')
    }
    throw new Error(`postgres user insert failed: ${error.message}`)
  }

  return data
}

export async function registerUser(input: {
  username: string
  displayName: string
  role: UserRole
  passwordHash: string
  metadata: RequestMetadata
}): Promise<SessionUser> {
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }

  const existing = await readActiveUserByUsername(input.username)
  if (existing) {
    throw new Error('User already exists')
  }

  const user = await insertIdentityUser(input)
  await syncIdentityShadowUser(user)

  try {
    await writeAuditLog({
      actorUserId: user.id,
      action: 'user.register',
      entityType: 'user',
      entityId: user.id,
      details: { username: user.username, role: user.role, store: 'postgres' },
      metadata: input.metadata,
    })
  } catch (error) {
    console.warn('[soc-store-supabase-postgres] Failed to write register audit log:', error)
  }

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
  if (isReservedUsername(input.username)) {
    throw new Error('Reserved username')
  }

  const existing = await readActiveUserByUsername(input.username)
  if (existing) {
    throw new Error('User already exists')
  }

  const user = await insertIdentityUser(input)
  await syncIdentityShadowUser(user)

  try {
    await writeAuditLog({
      actorUserId: input.actor.id,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      details: { username: user.username, role: user.role, store: 'postgres' },
      metadata: input.metadata,
    })
  } catch (error) {
    console.warn('[soc-store-supabase-postgres] Failed to write create-user audit log:', error)
  }
}
