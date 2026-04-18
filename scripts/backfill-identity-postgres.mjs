import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const cwd = process.cwd()
const envFilePath = path.join(cwd, '.env.local')

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, value] = match
    if (process.env[key]) continue

    let normalized = value.trim()
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1)
    }

    process.env[key] = normalized
  }
}

loadDotEnv(envFilePath)

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const APP_STATE_BUCKET = process.env.SUPABASE_APP_STATE_BUCKET ?? 'cybersec-app-state'
const APPLY_MODE = process.argv.includes('--apply')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase environment is not configured. Expected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function userPrefix() {
  return 'state/users/by-id'
}

function sessionPrefix() {
  return 'state/sessions'
}

async function listJsonObjects(prefix) {
  const { data, error } = await client.storage.from(APP_STATE_BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    throw new Error(`storage list failed for ${prefix}: ${error.message}`)
  }

  return (data ?? [])
    .filter((item) => item.name && item.name.endsWith('.json'))
    .map((item) => `${prefix}/${item.name}`)
}

async function readJson(pathname) {
  const { data, error } = await client.storage.from(APP_STATE_BUCKET).download(pathname)
  if (error) {
    throw new Error(`storage download failed for ${pathname}: ${error.message}`)
  }

  return JSON.parse(await data.text())
}

async function loadStoredUsers() {
  const paths = await listJsonObjects(userPrefix())
  const rows = await Promise.all(paths.map((item) => readJson(item)))
  return rows
    .filter((row) => typeof row?.id === 'number')
    .sort((a, b) => a.id - b.id)
}

async function loadStoredSessions() {
  const paths = await listJsonObjects(sessionPrefix())
  const rows = await Promise.all(paths.map((item) => readJson(item)))
  return rows
    .filter((row) => typeof row?.token === 'string')
    .sort((a, b) => String(a.token).localeCompare(String(b.token)))
}

async function fetchExistingUsers() {
  const { data, error } = await client
    .schema('identity')
    .from('users')
    .select('id, username, username_key, role, status')

  if (error) {
    throw new Error(`postgres users read failed: ${error.message}`)
  }

  return data ?? []
}

async function fetchExistingSessions() {
  const { data, error } = await client
    .schema('identity')
    .from('sessions')
    .select('token, user_id, expires_at')

  if (error) {
    throw new Error(`postgres sessions read failed: ${error.message}`)
  }

  return data ?? []
}

function toUserPayload(user) {
  return {
    id: user.id,
    username: user.username,
    username_key: user.usernameKey ?? String(user.username).trim().toLowerCase(),
    display_name: user.displayName,
    role: user.role,
    password_hash: user.passwordHash,
    status: user.isActive ? 'active' : 'disabled',
    primary_domain_key: 'core_operator',
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  }
}

function toSessionPayload(session) {
  return {
    token: session.token,
    user_id: session.user.id,
    ip_address: session.ipAddress ?? null,
    user_agent: session.userAgent ?? null,
    created_at: session.createdAt,
    last_seen_at: session.lastSeenAt ?? session.createdAt,
    expires_at: session.expiresAt,
  }
}

function sequenceRepairSql(maxUserId) {
  const seed = Number.isFinite(maxUserId) && maxUserId > 0 ? maxUserId : 1
  return [
    `select setval(pg_get_serial_sequence('identity.users', 'id'), ${seed}, true);`,
  ].join('\n')
}

function printSection(title, lines) {
  console.log(`\n=== ${title} ===`)
  for (const line of lines) console.log(line)
}

async function main() {
  console.log(`Mode: ${APPLY_MODE ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Bucket: ${APP_STATE_BUCKET}`)

  const [storedUsers, storedSessions, existingUsers, existingSessions] = await Promise.all([
    loadStoredUsers(),
    loadStoredSessions(),
    fetchExistingUsers(),
    fetchExistingSessions(),
  ])

  const existingUsersById = new Map(existingUsers.map((item) => [item.id, item]))
  const existingUsersByUsernameKey = new Map(existingUsers.map((item) => [item.username_key, item]))
  const existingSessionTokens = new Set(existingSessions.map((item) => item.token))

  const userMismatches = []
  const usersToInsert = []

  for (const user of storedUsers) {
    const payload = toUserPayload(user)
    const byId = existingUsersById.get(payload.id)
    const byUsernameKey = existingUsersByUsernameKey.get(payload.username_key)

    if (byId && byUsernameKey && byId.id === byUsernameKey.id) {
      continue
    }

    if (byId && byUsernameKey && byId.id !== byUsernameKey.id) {
      userMismatches.push(
        `User id/username_key mismatch for ${payload.username} (id=${payload.id}, username_key=${payload.username_key})`,
      )
      continue
    }

    if (byId && !byUsernameKey) {
      userMismatches.push(
        `User id exists but username_key differs for ${payload.username} (id=${payload.id})`,
      )
      continue
    }

    if (!byId && byUsernameKey) {
      userMismatches.push(
        `Username key already exists with different id for ${payload.username} (username_key=${payload.username_key})`,
      )
      continue
    }

    usersToInsert.push(payload)
  }

  const validUserIds = new Set([
    ...existingUsers.map((item) => item.id),
    ...usersToInsert.map((item) => item.id),
  ])

  const sessionsToInsert = []
  let skippedExpiredSessions = 0
  let skippedOrphanSessions = 0

  for (const session of storedSessions) {
    if (existingSessionTokens.has(session.token)) continue

    const expiresAt = new Date(session.expiresAt).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      skippedExpiredSessions += 1
      continue
    }

    if (!validUserIds.has(session.user.id)) {
      skippedOrphanSessions += 1
      continue
    }

    sessionsToInsert.push(toSessionPayload(session))
  }

  printSection('Summary', [
    `Stored users: ${storedUsers.length}`,
    `Stored sessions: ${storedSessions.length}`,
    `Existing postgres users: ${existingUsers.length}`,
    `Existing postgres sessions: ${existingSessions.length}`,
    `Users to insert: ${usersToInsert.length}`,
    `Sessions to insert: ${sessionsToInsert.length}`,
    `Skipped expired sessions: ${skippedExpiredSessions}`,
    `Skipped orphan sessions: ${skippedOrphanSessions}`,
    `User mismatches: ${userMismatches.length}`,
  ])

  if (userMismatches.length) {
    printSection('User mismatches', userMismatches)
    throw new Error('Backfill aborted because user mismatches were detected.')
  }

  if (!APPLY_MODE) {
    printSection('Next step', [
      'Dry-run completed successfully.',
      'If the summary looks correct, run:',
      'node scripts/backfill-identity-postgres.mjs --apply',
      '',
      'After apply, run this in Supabase SQL editor:',
      sequenceRepairSql(
        Math.max(
          0,
          ...existingUsers.map((item) => Number(item.id) || 0),
          ...usersToInsert.map((item) => Number(item.id) || 0),
        ),
      ),
    ])
    return
  }

  if (usersToInsert.length) {
    const { error } = await client
      .schema('identity')
      .from('users')
      .upsert(usersToInsert, { onConflict: 'id' })

    if (error) {
      throw new Error(`postgres user upsert failed: ${error.message}`)
    }
  }

  if (sessionsToInsert.length) {
    const { error } = await client
      .schema('identity')
      .from('sessions')
      .upsert(sessionsToInsert, { onConflict: 'token' })

    if (error) {
      throw new Error(`postgres session upsert failed: ${error.message}`)
    }
  }

  printSection('Apply complete', [
    `Inserted users: ${usersToInsert.length}`,
    `Inserted sessions: ${sessionsToInsert.length}`,
    '',
    'Run this SQL in Supabase SQL editor to repair the users sequence:',
    sequenceRepairSql(
      Math.max(
        0,
        ...existingUsers.map((item) => Number(item.id) || 0),
        ...usersToInsert.map((item) => Number(item.id) || 0),
      ),
    ),
  ])
}

main().catch((error) => {
  console.error('\nBackfill failed:', error.message)
  process.exit(1)
})
