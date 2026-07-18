import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { seed } from './seed';

export type DB = InstanceType<typeof DatabaseSync>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  team_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  manager_id INTEGER
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  creator_id INTEGER NOT NULL,
  assignee_id INTEGER,
  assigned_team_id INTEGER,
  project_id INTEGER,
  parent_id INTEGER,
  batch_id TEXT,
  board_id INTEGER,
  due_at INTEGER NOT NULL,
  eta_at INTEGER,
  acknowledged_at INTEGER,
  started_at INTEGER,
  done_at INTEGER,
  cancelled_at INTEGER,
  cancel_reason TEXT,
  blocked_reason TEXT,
  sla_deadline_at INTEGER,
  sla_breached_at INTEGER,
  warn_sent INTEGER NOT NULL DEFAULT 0,
  due_soon_sent INTEGER NOT NULL DEFAULT 0,
  escalated_at INTEGER,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  actor_id INTEGER,
  type TEXT NOT NULL,
  meta TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity(task_id);
CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  explanation TEXT,
  explanation_at INTEGER,
  proposed_eta_at INTEGER,
  review_status TEXT,
  reviewer_id INTEGER,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  UNIQUE(project_id, user_id)
);
CREATE TABLE IF NOT EXISTS project_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  task_id INTEGER,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  project_id INTEGER,
  comment_id INTEGER,
  uploader_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  scene TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS task_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  alias TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

declare global {
  // eslint-disable-next-line no-var
  var __tfdb: DB | undefined;
}

export function getDb(): DB {
  if (globalThis.__tfdb) return globalThis.__tfdb;
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'taskflow.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  // Idempotent column migrations for databases created before v1.1
  const MIGRATIONS = [
    'ALTER TABLE tasks ADD COLUMN task_type_id INTEGER',
    'ALTER TABLE tasks ADD COLUMN target_count INTEGER',
    'ALTER TABLE tasks ADD COLUMN delivered_count INTEGER NOT NULL DEFAULT 0',
  ];
  for (const m of MIGRATIONS) { try { db.exec(m); } catch {} }
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as any).c;
  if (userCount === 0) seed(db);
  globalThis.__tfdb = db;
  return db;
}

export const now = () => Date.now();
