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
  entry1_id      TEXT NOT NULL REFERENCES entries(id),
  entry2_id      TEXT NOT NULL REFERENCES entries(id),
  result         TEXT CHECK(result IN ('entry1','entry2','draw',NULL)),
  round          INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knockout_matches (
  id              TEXT PRIMARY KEY,
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round           INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  entry1_id       TEXT REFERENCES entries(id),
  entry2_id       TEXT REFERENCES entries(id),
  winner_id       TEXT REFERENCES entries(id),
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
`;

async function runMigrations(conn: SQLiteDBConnection): Promise<void> {
  await conn.run('PRAGMA foreign_keys = ON', []);
  await conn.execute(SCHEMA);
}
