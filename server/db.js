const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../tasks.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id  INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    completed  INTEGER DEFAULT 0,
    position   INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Safe migrations — no-op if columns already exist
try { db.exec('ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT NULL'); } catch (_) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN time_spent_seconds INTEGER DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN day TEXT DEFAULT NULL'); } catch (_) {}

module.exports = db;
