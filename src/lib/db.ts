import fs from 'fs'
import path from 'path'
import { open, type Database } from 'sqlite'
import { hashPassword } from '@/lib/security'
import { getPortfolioSeedForUser } from '@/lib/portfolio-profile'
import type { UserRole } from '@/lib/soc-types'

type SqliteDb = Database

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'soc.db')

interface SeedUser {
  username: string
  displayName: string
  role: UserRole
  password: string
}

const SEED_USERS: SeedUser[] = [
  {
    username: 'ghost',
    displayName: 'Ghost Admin',
    role: 'admin',
    password: 'demo_pass',
  },
  {
    username: 'analyst1',
    displayName: 'SOC Analyst 1',
    role: 'analyst',
    password: 'analyst_pass',
  },
  {
    username: 'viewer1',
    displayName: 'SOC Viewer 1',
    role: 'viewer',
    password: 'viewer_pass',
  },
]

let dbPromise: Promise<SqliteDb> | null = null

async function loadSqliteDriver() {
  const sqliteModule = await import('sqlite3')
  return ('default' in sqliteModule ? sqliteModule.default : sqliteModule) as typeof import('sqlite3')
}

async function ensureColumn(db: SqliteDb, tableName: string, columnName: string, definition: string) {
  const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${tableName})`)
  if (columns.some((column) => column.name === columnName)) return
  await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

async function initializeSchema(db: SqliteDb) {
  await db.exec('PRAGMA journal_mode = WAL;')
  await db.exec('PRAGMA foreign_keys = ON;')
  await db.exec('PRAGMA busy_timeout = 5000;')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attack_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id INTEGER,
      occurred_at TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      source_country TEXT NOT NULL,
      target_port INTEGER NOT NULL,
      attack_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'low')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'blocked', 'resolved')) DEFAULT 'new',
      priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')) DEFAULT 'P3',
      source_event_id INTEGER,
      source_ip TEXT,
      source_country TEXT,
      attack_type TEXT,
      assignee_user_id INTEGER,
      created_by_user_id INTEGER,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_event_id) REFERENCES attack_events(id) ON DELETE SET NULL,
      FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      from_priority TEXT,
      to_priority TEXT,
      from_assignee_user_id INTEGER,
      to_assignee_user_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS alert_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      author_user_id INTEGER,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      severity TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      specialties_json TEXT NOT NULL DEFAULT '[]',
      tools_json TEXT NOT NULL DEFAULT '[]',
      avatar_path TEXT,
      avatar_name TEXT,
      avatar_mime_type TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      issuer TEXT NOT NULL,
      issue_date TEXT NOT NULL DEFAULT '',
      expiry_date TEXT NOT NULL DEFAULT '',
      credential_id TEXT NOT NULL DEFAULT '',
      verify_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('verified', 'active', 'planned', 'expired')),
      notes TEXT NOT NULL DEFAULT '',
      asset_path TEXT,
      asset_name TEXT,
      asset_mime_type TEXT,
      asset_size INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      institution TEXT NOT NULL,
      program TEXT NOT NULL,
      degree TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('completed', 'active', 'planned', 'paused')),
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_attack_events_occurred_at ON attack_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_attack_events_country ON attack_events(source_country);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_priority ON alerts(status, priority);
    CREATE INDEX IF NOT EXISTS idx_alerts_assignee ON alerts(assignee_user_id);
    CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id);
    CREATE INDEX IF NOT EXISTS idx_alert_notes_alert_id ON alert_notes(alert_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_certifications_user_id ON user_certifications(user_id, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_user_education_user_id ON user_education(user_id, sort_order, id);
  `)

  await ensureColumn(db, 'user_profiles', 'avatar_path', 'TEXT')
  await ensureColumn(db, 'user_profiles', 'avatar_name', 'TEXT')
  await ensureColumn(db, 'user_profiles', 'avatar_mime_type', 'TEXT')
}

async function seedUsers(db: SqliteDb) {
  const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users')
  if ((row?.count ?? 0) > 0) return

  const now = new Date().toISOString()
  for (const user of SEED_USERS) {
    await db.run(
      `
        INSERT INTO users (username, display_name, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `,
      user.username,
      user.displayName,
      hashPassword(user.password),
      user.role,
      now,
      now,
    )
  }
}

async function seedProfileData(db: SqliteDb) {
  const users = await db.all<{
    id: number
    username: string
    display_name: string
  }[]>(`
    SELECT id, username, display_name
    FROM users
    WHERE is_active = 1
  `)

  for (const user of users) {
    const existingProfile = await db.get<{ user_id: number }>(
      'SELECT user_id FROM user_profiles WHERE user_id = ? LIMIT 1',
      user.id,
    )
    if (existingProfile) continue

    const now = new Date().toISOString()
    const seed = getPortfolioSeedForUser({
      username: user.username,
      displayName: user.display_name,
    })

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
  }
}

export async function getDb(): Promise<SqliteDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true })
      }

      const sqlite3 = await loadSqliteDriver()
      const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
      })

      await initializeSchema(db)
      await seedUsers(db)
      await seedProfileData(db)
      return db
    })()
  }

  return dbPromise
}

export function getDbPath() {
  return DB_PATH
}
