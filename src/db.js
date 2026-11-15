import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const active=resolve(ROOT,'config/active-database.json');
export const DB_PATH = resolve(ROOT, process.env.FIRESENSE_DB || (existsSync(active)?JSON.parse(readFileSync(active,'utf8')).path:'data/processed/firesense.sqlite'));
export function openDb(path = DB_PATH) {
  mkdirSync(dirname(path), {recursive:true});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, sha256 TEXT UNIQUE NOT NULL,
      product TEXT NOT NULL, processing TEXT NOT NULL, rows INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0, min_date TEXT, max_date TEXT,
      west REAL, south REAL, east REAL, north REAL, satellites TEXT, versions TEXT,
      imported_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'loading');
    CREATE TABLE IF NOT EXISTS daily (
      source_id INTEGER NOT NULL REFERENCES sources(id), date TEXT NOT NULL,
      x INTEGER NOT NULL, y INTEGER NOT NULL, satellite TEXT NOT NULL,
      detections INTEGER NOT NULL, frp REAL NOT NULL, nominal INTEGER NOT NULL,
      PRIMARY KEY(source_id,date,x,y,satellite)) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS daily_date ON daily(date);`);
  return db;
}
