import fs from 'fs'
import path from 'path'
import { open, type Database } from 'sqlite'
import { hashPassword } from '@/lib/security'
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

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_attack_events_occurred_at ON attack_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_attack_events_country ON attack_events(source_country);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_priority ON alerts(status, priority);
    CREATE INDEX IF NOT EXISTS idx_alerts_assignee ON alerts(assignee_user_id);
    CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id);
    CREATE INDEX IF NOT EXISTS idx_alert_notes_alert_id ON alert_notes(alert_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `)
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
      return db
    })()
  }

  return dbPromise
}

export function getDbPath() {
  return DB_PATH
}
