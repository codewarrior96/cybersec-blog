#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const TMP_DIR = path.join(ROOT, 'tmp')
const SQLITE_PATH = path.join(ROOT, 'data', 'soc.db')
const ENV_PATH = path.join(ROOT, '.env.local')
const APPLY = process.argv.includes('--apply')
const BUCKET = 'cybersec-app-state'

const EXACT_USERNAMES = new Set(['ghost', 'analyst1', 'viewer1'])
const USERNAME_PATTERNS = [
  /^localtest\d+$/i,
  /^postfix\d+$/i,
  /^avatartest\d+$/i,
  /^relogtest\d+$/i,
  /^cachefix\d+$/i,
  /^zerox\d+$/i,
  /^certstore\d+$/i,
  /^permstore\d+$/i,
  /^supastore[a-z]*\d+$/i,
]

function isLegacyUsername(username) {
  return EXACT_USERNAMES.has(username.toLowerCase()) || USERNAME_PATTERNS.some((pattern) => pattern.test(username))
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const text = fs.readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    if (!match) continue
    env[match[1]] = match[2]
  }
  return env
}

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
  }
}

async function readStorageJson(supabase, objectPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath)
  if (error) return null
  return JSON.parse(await data.text())
}

async function listAllStorageObjects(supabase, prefix) {
  const all = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data?.length) break
    all.push(...data.map((item) => item.name))
    if (data.length < 100) break
    offset += data.length
  }
  return all
}

async function collectSupabasePurgePlan(supabase) {
  const usernames = await listAllStorageObjects(supabase, 'state/users/by-username')
  const legacyUsers = []

  for (const fileName of usernames) {
    if (!fileName.endsWith('.json')) continue
    const username = fileName.replace(/\.json$/i, '')
    if (!isLegacyUsername(username)) continue
    const user = await readStorageJson(supabase, `state/users/by-username/${fileName}`)
    if (!user) continue
    legacyUsers.push(user)
  }

  const sessions = await listAllStorageObjects(supabase, 'state/sessions')
  const sessionPaths = []
  for (const sessionFile of sessions) {
    if (!sessionFile.endsWith('.json')) continue
    const objectPath = `state/sessions/${sessionFile}`
    const session = await readStorageJson(supabase, objectPath)
    if (!session?.user?.username) continue
    if (isLegacyUsername(session.user.username)) {
      sessionPaths.push(objectPath)
    }
  }

  const deletePaths = new Set(sessionPaths)
  const backup = { users: [], sessions: [] }

  for (const user of legacyUsers) {
    backup.users.push(user)
    deletePaths.add(`state/users/by-username/${user.username}.json`)
    deletePaths.add(`state/users/by-id/${user.id}.json`)
    deletePaths.add(`state/profiles/${user.id}/profile.json`)

    for (const prefix of [
      `state/profiles/${user.id}/certifications`,
      `state/profiles/${user.id}/education`,
      `avatars/user-${user.id}`,
      `certifications/user-${user.id}`,
    ]) {
      const objects = await listAllStorageObjects(supabase, prefix)
      for (const name of objects) {
        deletePaths.add(`${prefix}/${name}`)
      }
    }
  }

  for (const objectPath of sessionPaths) {
    const session = await readStorageJson(supabase, objectPath)
    if (session) backup.sessions.push(session)
  }

  return {
    legacyUsers,
    deletePaths: [...deletePaths].sort(),
    backup,
  }
}

async function purgeSupabaseIdentities(supabase, deletePaths) {
  if (!deletePaths.length) return
  const chunkSize = 100
  for (let index = 0; index < deletePaths.length; index += chunkSize) {
    const chunk = deletePaths.slice(index, index + chunkSize)
    const { error } = await supabase.storage.from(BUCKET).remove(chunk)
    if (error) throw error
  }
}

async function collectSqlitePurgePlan() {
  if (!fs.existsSync(SQLITE_PATH)) {
    return { users: [] }
  }

  const db = await open({ filename: SQLITE_PATH, driver: sqlite3.Database })
  const users = await db.all(
    `SELECT id, username, display_name as displayName, role, is_active as isActive, created_at as createdAt
     FROM users
     ORDER BY id`,
  )
  await db.close()

  return {
    users: users.filter((user) => isLegacyUsername(user.username)),
  }
}

async function purgeSqliteIdentities(userIds) {
  if (!userIds.length || !fs.existsSync(SQLITE_PATH)) return
  const db = await open({ filename: SQLITE_PATH, driver: sqlite3.Database })
  const placeholders = userIds.map(() => '?').join(', ')
  await db.exec('BEGIN')
  try {
    await db.run(`DELETE FROM sessions WHERE user_id IN (${placeholders})`, ...userIds)
    await db.run(`DELETE FROM user_certifications WHERE user_id IN (${placeholders})`, ...userIds)
    await db.run(`DELETE FROM user_education WHERE user_id IN (${placeholders})`, ...userIds)
    await db.run(`DELETE FROM user_profiles WHERE user_id IN (${placeholders})`, ...userIds)
    await db.run(`DELETE FROM users WHERE id IN (${placeholders})`, ...userIds)
    await db.exec('COMMIT')
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  } finally {
    await db.close()
  }
}

async function main() {
  ensureTmpDir()
  const env = readEnvFile(ENV_PATH)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const supabasePlan = await collectSupabasePurgePlan(supabase)
  const sqlitePlan = await collectSqlitePurgePlan()

  const backup = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    supabase: supabasePlan.backup,
    sqlite: sqlitePlan.users,
  }

  const backupPath = path.join(TMP_DIR, `legacy-identity-purge-${Date.now()}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2))

  if (APPLY) {
    await purgeSupabaseIdentities(supabase, supabasePlan.deletePaths)
    await purgeSqliteIdentities(sqlitePlan.users.map((user) => user.id))
  }

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        backupPath,
        supabaseUsers: supabasePlan.legacyUsers.map((user) => user.username),
        supabaseDeleteCount: supabasePlan.deletePaths.length,
        sqliteUsers: sqlitePlan.users.map((user) => user.username),
      },
      null,
      2,
    ),
  )
}

await main()

