import { v4 as uuid } from 'uuid';
import { getDb } from './client';

export type TournamentFormat = 'group_knockout' | 'straight_knockout';
export type TournamentStatus = 'registration' | 'group_stage' | 'knockout' | 'completed';
export type SeedingStrategy = 'random' | 'seeded';

export interface Tournament {
  id: string;
  name: string;
  game: string;
  format: TournamentFormat;
  status: TournamentStatus;
  bracketSize: number | null;
  thirdPlacePlayoff: boolean;
  telegramChannelId: string | null;
  telegramBotToken: string | null;
  advancementCount: number;
  advancementLogic: Record<string, unknown>;
  entrySize: number;
  seeding: SeedingStrategy;
  createdAt: number;
}

function row(r: Record<string, unknown>): Tournament {
  return {
    id:                 r['id'] as string,
    name:               r['name'] as string,
    game:               r['game'] as string,
    format:             r['format'] as TournamentFormat,
    status:             r['status'] as TournamentStatus,
    bracketSize:        r['bracket_size'] as number | null,
    thirdPlacePlayoff:  Boolean(r['third_place_playoff']),
    telegramChannelId:  r['telegram_channel_id'] as string | null,
    telegramBotToken:   r['telegram_bot_token'] as string | null,
    advancementCount:   r['advancement_count'] as number,
    advancementLogic:   JSON.parse((r['advancement_logic'] as string) ?? '{}'),
    entrySize:          r['entry_size'] as number,
    seeding:            r['seeding'] as SeedingStrategy,
    createdAt:          r['created_at'] as number,
  };
}

export async function getAllTournaments(): Promise<Tournament[]> {
  const db = await getDb();
  const res = await db.query('SELECT * FROM tournaments ORDER BY created_at DESC');
  return (res.values ?? []).map(row);
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const db = await getDb();
  const res = await db.query('SELECT * FROM tournaments WHERE id = ?', [id]);
  const rows = res.values ?? [];
  return rows.length > 0 ? row(rows[0]!) : null;
}

export interface CreateTournamentInput {
  name: string;
  game: string;
  format: TournamentFormat;
  entrySize?: number;
  seeding?: SeedingStrategy;
  thirdPlacePlayoff?: boolean;
  advancementCount?: number;
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament> {
  const db = await getDb();
  const t: Tournament = {
    id:                 uuid(),
    name:               input.name,
    game:               input.game,
    format:             input.format,
    status:             'registration',
    bracketSize:        null,
    thirdPlacePlayoff:  input.thirdPlacePlayoff ?? false,
    telegramChannelId:  null,
    telegramBotToken:   null,
    advancementCount:   input.advancementCount ?? 2,
    advancementLogic:   {},
    entrySize:          input.entrySize ?? 1,
    seeding:            input.seeding ?? 'random',
    createdAt:          Date.now(),
  };

  await db.run(
    `INSERT INTO tournaments
     (id,name,game,format,status,bracket_size,third_place_playoff,
      telegram_channel_id,telegram_bot_token,advancement_count,
      advancement_logic,entry_size,seeding,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      t.id, t.name, t.game, t.format, t.status, t.bracketSize,
      t.thirdPlacePlayoff ? 1 : 0, t.telegramChannelId, t.telegramBotToken,
      t.advancementCount, JSON.stringify(t.advancementLogic),
      t.entrySize, t.seeding, t.createdAt,
    ],
  );
  return t;
}

export async function updateTournamentStatus(id: string, status: TournamentStatus): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE tournaments SET status = ? WHERE id = ?', [status, id]);
}

export async function updateTournamentSettings(
  id: string,
  patch: Partial<Pick<Tournament, 'name' | 'telegramChannelId' | 'telegramBotToken' | 'thirdPlacePlayoff' | 'advancementCount' | 'seeding'>>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined)              { fields.push('name = ?');                values.push(patch.name); }
  if (patch.telegramChannelId !== undefined) { fields.push('telegram_channel_id = ?'); values.push(patch.telegramChannelId); }
  if (patch.telegramBotToken !== undefined)  { fields.push('telegram_bot_token = ?');  values.push(patch.telegramBotToken); }
  if (patch.thirdPlacePlayoff !== undefined) { fields.push('third_place_playoff = ?'); values.push(patch.thirdPlacePlayoff ? 1 : 0); }
  if (patch.advancementCount !== undefined)  { fields.push('advancement_count = ?');   values.push(patch.advancementCount); }
  if (patch.seeding !== undefined)           { fields.push('seeding = ?');             values.push(patch.seeding); }

  if (fields.length === 0) return;
  values.push(id);
  await db.run(`UPDATE tournaments SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteTournament(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM tournaments WHERE id = ?', [id]);
}
