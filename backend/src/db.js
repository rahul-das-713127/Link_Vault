import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'linkvault.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function ensureColumns(table, columns) {
  const existing = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
  for (const col of columns) {
    if (!existing.includes(col.name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('text','file')),
    text_content TEXT,
    original_filename TEXT,
    stored_filename TEXT,
    mime_type TEXT,
    byte_size INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);
`);

ensureColumns('shares', [
  { name: 'owner_user_id', type: 'INTEGER' },
  { name: 'password_hash', type: 'TEXT' },
  { name: 'one_time', type: 'INTEGER DEFAULT 0' },
  { name: 'max_views', type: 'INTEGER' },
  { name: 'max_downloads', type: 'INTEGER' },
  { name: 'view_count', type: 'INTEGER DEFAULT 0' },
  { name: 'download_count', type: 'INTEGER DEFAULT 0' },
  { name: 'delete_token_hash', type: 'TEXT' }
]);

export function insertShare(share) {
  const stmt = db.prepare(`
    INSERT INTO shares (
      id, kind, text_content, original_filename, stored_filename,
      mime_type, byte_size, created_at, expires_at,
      owner_user_id, password_hash, one_time,
      max_views, max_downloads, view_count, download_count,
      delete_token_hash
    ) VALUES (
      @id, @kind, @text_content, @original_filename, @stored_filename,
      @mime_type, @byte_size, @created_at, @expires_at,
      @owner_user_id, @password_hash, @one_time,
      @max_views, @max_downloads, @view_count, @download_count,
      @delete_token_hash
    )
  `);
  stmt.run(share);
}

export function getShare(id) {
  const stmt = db.prepare('SELECT * FROM shares WHERE id = ?');
  return stmt.get(id);
}

export function deleteShare(id) {
  const stmt = db.prepare('DELETE FROM shares WHERE id = ?');
  stmt.run(id);
}

export function listExpiredShares(nowMs) {
  const stmt = db.prepare('SELECT * FROM shares WHERE expires_at <= ?');
  return stmt.all(nowMs);
}

export function createUser({ username, password_hash, created_at }) {
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)' 
  );
  const info = stmt.run(username, password_hash, created_at);
  return Number(info.lastInsertRowid);
}

export function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

export function incrementViewCount(id) {
  const stmt = db.prepare('UPDATE shares SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?');
  stmt.run(id);
}

export function incrementDownloadCount(id) {
  const stmt = db.prepare(
    'UPDATE shares SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?'
  );
  stmt.run(id);
}

export function nullDeleteTokenHash(id) {
  const stmt = db.prepare('UPDATE shares SET delete_token_hash = NULL WHERE id = ?');
  stmt.run(id);
}
