import { v4 as uuid } from 'uuid';
import { getDb } from './client';

export type MatchStatus = 'pending' | 'ready' | 'completed';

export interface KnockoutMatch {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  entry1Id: string | null;
  entry2Id: string | null;
  winnerId: string | null;
  score1: number | null;
  score2: number | null;
  status: MatchStatus;
  isBye: boolean;
  isThirdPlace: boolean;
}

function row(r: Record<string, unknown>): KnockoutMatch {
  return {
    id:           r['id'] as string,
    tournamentId: r['tournament_id'] as string,
    round:        r['round'] as number,
    position:     r['position'] as number,
    entry1Id:     r['entry1_id'] as string | null,
    entry2Id:     r['entry2_id'] as string | null,
    winnerId:     r['winner_id'] as string | null,
    score1:       r['score1'] as number | null,
    score2:       r['score2'] as number | null,
    status:       r['status'] as MatchStatus,
    isBye:        Boolean(r['is_bye']),
    isThirdPlace: Boolean(r['is_third_place']),
  };
}

export async function getMatches(tournamentId: string): Promise<KnockoutMatch[]> {
  const db = await getDb();
  const res = await db.query(
    'SELECT * FROM knockout_matches WHERE tournament_id = ? ORDER BY round, position',
    [tournamentId],
  );
  return (res.values ?? []).map(row);
}

export async function getMatch(id: string): Promise<KnockoutMatch | null> {
  const db = await getDb();
  const res = await db.query('SELECT * FROM knockout_matches WHERE id = ?', [id]);
  return res.values?.length ? row(res.values[0]!) : null;
}

export async function insertMatches(
  matches: Omit<KnockoutMatch, 'id'>[],
): Promise<void> {
  const db = await getDb();
  for (const m of matches) {
    await db.run(
      `INSERT INTO knockout_matches
       (id,tournament_id,round,position,entry1_id,entry2_id,winner_id,
        score1,score2,status,is_bye,is_third_place)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(), m.tournamentId, m.round, m.position,
        m.entry1Id, m.entry2Id, m.winnerId,
        m.score1, m.score2, m.status,
        m.isBye ? 1 : 0, m.isThirdPlace ? 1 : 0,
      ],
    );
  }
}

export async function setMatchResult(
  matchId: string,
  winnerId: string,
  score1: number | null,
  score2: number | null,
): Promise<KnockoutMatch | null> {
  const db = await getDb();
  await db.run(
    `UPDATE knockout_matches
     SET winner_id = ?, score1 = ?, score2 = ?, status = 'completed'
     WHERE id = ?`,
    [winnerId, score1, score2, matchId],
  );
  return getMatch(matchId);
}

export async function advanceWinner(
  tournamentId: string,
  round: number,
  position: number,
  winnerId: string,
): Promise<KnockoutMatch | null> {
  const db = await getDb();
  const nextRound = round + 1;
  const nextPosition = Math.ceil(position / 2);
  const slot = position % 2 === 1 ? 'entry1_id' : 'entry2_id';

  await db.run(
    `UPDATE knockout_matches
     SET ${slot} = ?, status = CASE
       WHEN (entry1_id IS NOT NULL AND entry2_id IS NOT NULL) OR ${slot === 'entry1_id' ? 'entry2_id' : 'entry1_id'} IS NOT NULL
       THEN 'ready' ELSE 'pending' END
     WHERE tournament_id = ? AND round = ? AND position = ? AND is_third_place = 0`,
    [winnerId, tournamentId, nextRound, nextPosition],
  );

  const res = await db.query(
    `SELECT * FROM knockout_matches
     WHERE tournament_id = ? AND round = ? AND position = ? AND is_third_place = 0`,
    [tournamentId, nextRound, nextPosition],
  );
  return res.values?.length ? row(res.values[0]!) : null;
}

export async function autoCompleteBye(match: KnockoutMatch): Promise<string | null> {
  const db = await getDb();
  const e1IsBye = await isByeEntry(match.entry1Id);
  const e2IsBye = await isByeEntry(match.entry2Id);

  if (!e1IsBye && !e2IsBye) return null;
  if (e1IsBye && e2IsBye) return null;

  const winnerId = e1IsBye ? match.entry2Id! : match.entry1Id!;
  await db.run(
    `UPDATE knockout_matches SET winner_id = ?, status = 'completed', is_bye = 1 WHERE id = ?`,
    [winnerId, match.id],
  );
  return winnerId;
}

async function isByeEntry(entryId: string | null): Promise<boolean> {
  if (!entryId) return false;
  const db = await getDb();
  const res = await db.query('SELECT is_bye FROM entries WHERE id = ?', [entryId]);
  return Boolean(res.values?.[0]?.['is_bye']);
}

export async function createThirdPlaceMatch(
  tournamentId: string,
  finalRound: number,
  loser1Id: string,
  loser2Id: string,
): Promise<void> {
  const db = await getDb();
  const exists = await db.query(
    'SELECT id FROM knockout_matches WHERE tournament_id = ? AND is_third_place = 1',
    [tournamentId],
  );
  if (exists.values?.length) return;

  await db.run(
    `INSERT INTO knockout_matches
     (id,tournament_id,round,position,entry1_id,entry2_id,winner_id,
      score1,score2,status,is_bye,is_third_place)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uuid(), tournamentId, finalRound, 0, loser1Id, loser2Id, null, null, null, 'ready', 0, 1],
  );
}
