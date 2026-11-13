import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : join(here, '../../../data')
mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'chess.sqlite')
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL,
    setup_json TEXT NOT NULL,
    state_json TEXT NOT NULL,
    white_player_id TEXT,
    black_player_id TEXT,
    result TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS game_events (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    host_player_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

export const db = drizzle(sqlite, { schema })
export { schema }
