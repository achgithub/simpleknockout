import { v4 as uuid } from 'uuid';
import { getDb } from './client';
import type { Entry } from './entries';

export interface Group {
  id: string;
  tournamentId: string;
  name: string;
}

export interface GroupFixture {
  id: string;
  groupId: string;
  tournamentId: string;
  entry1Id: string;
  entry2Id: string;
  result: 'entry1' | 'entry2' | 'draw' | null;
  score1: number | null;
  score2: number | null;
  round: number;
  createdAt: number;
}

export interface GroupStanding {
  entryId: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  goalDiff: number;
  points: number;
}

export async function getGroups(tournamentId: string): Promise<Group[]> {
  const db = await getDb();
  const res = await db.query('SELECT * FROM groups WHERE tournament_id = ? ORDER BY name', [tournamentId]);
  return (res.values ?? []).map((r) => ({
    id:           r['id'] as string,
    tournamentId: r['tournament_id'] as string,
    name:         r['name'] as string,
  }));
}

export async function getGroupMembers(groupId: string): Promise<string[]> {
  const db = await getDb();
  const res = await db.query('SELECT entry_id FROM group_members WHERE group_id = ?', [groupId]);
  return (res.values ?? []).map((r) => r['entry_id'] as string);
}

export async function getGroupFixtures(groupId: string): Promise<GroupFixture[]> {
  const db = await getDb();
  const res = await db.query(
    'SELECT * FROM group_fixtures WHERE group_id = ? ORDER BY round, rowid',
    [groupId],
  );
  return (res.values ?? []).map((r) => ({
    id:          r['id'] as string,
    groupId:     r['group_id'] as string,
    tournamentId:r['tournament_id'] as string,
    entry1Id:    r['entry1_id'] as string,
    entry2Id:    r['entry2_id'] as string,
    result:      r['result'] as GroupFixture['result'],
    score1:      r['score1'] as number | null,
    score2:      r['score2'] as number | null,
    round:       r['round'] as number,
    createdAt:   r['created_at'] as number,
  }));
}

export async function setFixtureResult(
  fixtureId: string,
  result: GroupFixture['result'],
  score1: number | null = null,
  score2: number | null = null,
): Promise<void> {
  const db = await getDb();
  await db.run(
    'UPDATE group_fixtures SET result = ?, score1 = ?, score2 = ? WHERE id = ?',
    [result, score1, score2, fixtureId],
  );
}

export function computeStandings(
  fixtures: GroupFixture[],
  members: string[],
  entries: Entry[],
): GroupStanding[] {
  const map = new Map<string, GroupStanding>();
  const nameMap = new Map(entries.map((e) => [e.id, e.displayName]));

  for (const entryId of members) {
    map.set(entryId, {
      entryId,
      displayName: nameMap.get(entryId) ?? entryId,
      played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, goalDiff: 0, points: 0,
    });
  }

  for (const f of fixtures) {
    if (!f.result) continue;
    const s1 = map.get(f.entry1Id);
    const s2 = map.get(f.entry2Id);
    if (!s1 || !s2) continue;

    s1.played++;
    s2.played++;

    if (f.score1 != null && f.score2 != null) {
      s1.for += f.score1; s1.against += f.score2;
      s2.for += f.score2; s2.against += f.score1;
    }

    if (f.result === 'entry1') {
      s1.won++;   s1.points += 3;
      s2.lost++;
    } else if (f.result === 'entry2') {
      s2.won++;   s2.points += 3;
      s1.lost++;
    } else {
      s1.drawn++; s1.points += 1;
      s2.drawn++; s2.points += 1;
    }
  }

  for (const s of map.values()) {
    s.goalDiff = s.for - s.against;
  }

  // Tie-break order: points, then goal difference, then goals scored, then name.
  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.for !== a.for) return b.for - a.for;
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function createGroups(
  tournamentId: string,
  entries: Entry[],
  groupCount: number,
): Promise<void> {
  const db = await getDb();

  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, groupCount);

  const groups: Group[] = groupNames.map((name) => ({
    id: uuid(),
    tournamentId,
    name: `Group ${name}`,
  }));

  for (const g of groups) {
    await db.run('INSERT INTO groups (id,tournament_id,name) VALUES (?,?,?)', [g.id, g.tournamentId, g.name]);
  }

  // Distribute entries round-robin across groups
  for (let i = 0; i < shuffled.length; i++) {
    const groupId = groups[i % groupCount]!.id;
    await db.run('INSERT INTO group_members (group_id,entry_id) VALUES (?,?)', [groupId, shuffled[i]!.id]);
  }

  // Generate round-robin fixtures for each group
  const { generateRoundRobin } = await import('@/lib/scheduler');
  const now = Date.now();
  const BYE = '__BYE__';

  for (const g of groups) {
    const memberRes = await db.query('SELECT entry_id FROM group_members WHERE group_id = ?', [g.id]);
    const memberIds = (memberRes.values ?? []).map((r) => r['entry_id'] as string);

    // generateRoundRobin requires an even number of teams. For odd-sized groups,
    // pad with a placeholder "bye" slot — fixtures involving it are dropped, so
    // the group simply has one team sitting out each round (no BYE entry/match).
    const scheduleIds = memberIds.length % 2 !== 0 ? [...memberIds, BYE] : memberIds;

    const fixtures = generateRoundRobin(scheduleIds);
    for (const f of fixtures) {
      if (f.homeTeamId === BYE || f.awayTeamId === BYE) continue;
      await db.run(
        `INSERT INTO group_fixtures (id,group_id,tournament_id,entry1_id,entry2_id,result,score1,score2,round,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [uuid(), g.id, tournamentId, f.homeTeamId, f.awayTeamId, null, null, null, f.week, now],
      );
    }
  }
}
