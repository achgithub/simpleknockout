import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

let db: SQLiteDBConnection | null = null;
const sqlite = new SQLiteConnection(CapacitorSQLite);

export async function getDb(): Promise<SQLiteDBConnection> {
  if (db) return db;

  const isConn = (await sqlite.isConnection('simpleknockout', false)).result;
  if (isConn) {
    db = await sqlite.retrieveConnection('simpleknockout', false);
  } else {
    db = await sqlite.createConnection('simpleknockout', false, 'no-encryption', 1, false);
  }

  await db.open();
  await runMigrations(db);
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tournaments (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  game                 TEXT NOT NULL,
  format               TEXT NOT NULL CHECK(format IN ('group_knockout','straight_knockout')),
  status               TEXT NOT NULL DEFAULT 'registration',
  bracket_size         INTEGER,
  third_place_playoff  INTEGER NOT NULL DEFAULT 0,
  telegram_channel_id  TEXT,
  telegram_bot_token   TEXT,
  advancement_count    INTEGER NOT NULL DEFAULT 2,
  advancement_logic    TEXT NOT NULL DEFAULT '{}',
  entry_size           INTEGER NOT NULL DEFAULT 1,
  seeding              TEXT NOT NULL DEFAULT 'random',
  created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id              TEXT PRIMARY KEY,
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  seed            INTEGER,
  is_bye          INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_players (
  id        TEXT PRIMARY KEY,
  entry_id  TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  slot      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id             TEXT PRIMARY KEY,
  tournament_id  TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  entry_id  TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, entry_id)
);

CREATE TABLE IF NOT EXISTS group_fixtures (
  id             TEXT PRIMARY KEY,
  group_id       TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tournament_id  TEXT NOT NULL,
  entry1_id      TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  entry2_id      TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  result         TEXT CHECK(result IS NULL OR result IN ('entry1','entry2','draw')),
  score1         INTEGER,
  score2         INTEGER,
  round          INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knockout_matches (
  id              TEXT PRIMARY KEY,
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round           INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  entry1_id       TEXT REFERENCES entries(id) ON DELETE CASCADE,
  entry2_id       TEXT REFERENCES entries(id) ON DELETE CASCADE,
  winner_id       TEXT REFERENCES entries(id) ON DELETE SET NULL,
  score1          INTEGER,
  score2          INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending',
  is_bye          INTEGER NOT NULL DEFAULT 0,
  is_third_place  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_group_members (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- Indexes on the foreign-key / filter columns every read narrows by.
CREATE INDEX IF NOT EXISTS idx_entries_tournament       ON entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_entry_players_entry       ON entry_players(entry_id);
CREATE INDEX IF NOT EXISTS idx_groups_tournament         ON groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group       ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_fixtures_group      ON group_fixtures(group_id);
CREATE INDEX IF NOT EXISTS idx_knockout_matches_tournament ON knockout_matches(tournament_id);
`;

async function runMigrations(conn: SQLiteDBConnection): Promise<void> {
  await conn.run('PRAGMA foreign_keys = ON', []);
  await conn.execute(SCHEMA);

  // Older installs won't have score columns on group_fixtures — add them if missing.
  const cols = await conn.query('PRAGMA table_info(group_fixtures)');
  const colNames = new Set((cols.values ?? []).map((r) => r['name'] as string));
  if (!colNames.has('score1')) await conn.execute('ALTER TABLE group_fixtures ADD COLUMN score1 INTEGER');
  if (!colNames.has('score2')) await conn.execute('ALTER TABLE group_fixtures ADD COLUMN score2 INTEGER');
}

/**
 * Full database backup as a JSON string. Used by Settings → "Export Database".
 * The shape is @capacitor-community/sqlite's own import/export format, so the
 * same file can be re-imported later via `importFromJson` if needed.
 */
export async function exportDatabaseJson(): Promise<string> {
  const conn = await getDb();
  const { export: jsonExport } = await conn.exportToJson('full');
  return JSON.stringify(jsonExport, null, 2);
}
