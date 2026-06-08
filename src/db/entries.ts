import { v4 as uuid } from 'uuid';
import { getDb } from './client';

export interface EntryPlayer {
  id: string;
  entryId: string;
  name: string;
  slot: number;
}

export interface Entry {
  id: string;
  tournamentId: string;
  displayName: string;
  seed: number | null;
  isBye: boolean;
  players: EntryPlayer[];
  createdAt: number;
}

function buildDisplayName(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export async function getEntries(tournamentId: string): Promise<Entry[]> {
  const db = await getDb();
  const eRes = await db.query(
    'SELECT * FROM entries WHERE tournament_id = ? ORDER BY created_at ASC',
    [tournamentId],
  );
  const pRes = await db.query(
    `SELECT ep.* FROM entry_players ep
     JOIN entries e ON ep.entry_id = e.id
     WHERE e.tournament_id = ?
     ORDER BY ep.entry_id, ep.slot`,
    [tournamentId],
  );

  const playersByEntry = new Map<string, EntryPlayer[]>();
  for (const p of pRes.values ?? []) {
    const list = playersByEntry.get(p['entry_id'] as string) ?? [];
    list.push({
      id:      p['id'] as string,
      entryId: p['entry_id'] as string,
      name:    p['name'] as string,
      slot:    p['slot'] as number,
    });
    playersByEntry.set(p['entry_id'] as string, list);
  }

  return (eRes.values ?? []).map((r) => ({
    id:           r['id'] as string,
    tournamentId: r['tournament_id'] as string,
    displayName:  r['display_name'] as string,
    seed:         r['seed'] as number | null,
    isBye:        Boolean(r['is_bye']),
    players:      playersByEntry.get(r['id'] as string) ?? [],
    createdAt:    r['created_at'] as number,
  }));
}

export async function getEntry(id: string): Promise<Entry | null> {
  const db = await getDb();
  const eRes = await db.query('SELECT * FROM entries WHERE id = ?', [id]);
  if (!eRes.values?.length) return null;
  const r = eRes.values[0]!;

  const pRes = await db.query(
    'SELECT * FROM entry_players WHERE entry_id = ? ORDER BY slot',
    [id],
  );
  const players: EntryPlayer[] = (pRes.values ?? []).map((p) => ({
    id:      p['id'] as string,
    entryId: id,
    name:    p['name'] as string,
    slot:    p['slot'] as number,
  }));

  return {
    id:           r['id'] as string,
    tournamentId: r['tournament_id'] as string,
    displayName:  r['display_name'] as string,
    seed:         r['seed'] as number | null,
    isBye:        Boolean(r['is_bye']),
    players,
    createdAt:    r['created_at'] as number,
  };
}

export async function addEntry(tournamentId: string, playerNames: string[]): Promise<Entry> {
  const db = await getDb();
  const entryId = uuid();
  const displayName = buildDisplayName(playerNames);
  const now = Date.now();

  await db.run(
    'INSERT INTO entries (id,tournament_id,display_name,seed,is_bye,created_at) VALUES (?,?,?,?,?,?)',
    [entryId, tournamentId, displayName, null, 0, now],
  );

  const players: EntryPlayer[] = [];
  for (let i = 0; i < playerNames.length; i++) {
    const playerId = uuid();
    await db.run(
      'INSERT INTO entry_players (id,entry_id,name,slot) VALUES (?,?,?,?)',
      [playerId, entryId, playerNames[i], i + 1],
    );
    players.push({ id: playerId, entryId, name: playerNames[i]!, slot: i + 1 });
  }

  return { id: entryId, tournamentId, displayName, seed: null, isBye: false, players, createdAt: now };
}

export async function addByeEntry(tournamentId: string): Promise<Entry> {
  const db = await getDb();
  const entryId = uuid();
  const now = Date.now();
  await db.run(
    'INSERT INTO entries (id,tournament_id,display_name,seed,is_bye,created_at) VALUES (?,?,?,?,?,?)',
    [entryId, tournamentId, 'BYE', null, 1, now],
  );
  return { id: entryId, tournamentId, displayName: 'BYE', seed: null, isBye: true, players: [], createdAt: now };
}

export async function updateEntrySeed(id: string, seed: number | null): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE entries SET seed = ? WHERE id = ?', [seed, id]);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM entries WHERE id = ?', [id]);
}
