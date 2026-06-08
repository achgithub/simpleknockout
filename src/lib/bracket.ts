import type { Entry } from '@/db/entries';
import type { KnockoutMatch } from '@/db/knockout';
import {
  insertMatches,
  advanceWinner,
  autoCompleteBye,
  createThirdPlaceMatch,
  getMatches,
} from '@/db/knockout';
import { addByeEntry } from '@/db/entries';
import { updateTournamentStatus } from '@/db/tournaments';
import type { Tournament } from '@/db/tournaments';

export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize);
}

export function roundLabel(round: number, maxRound: number): string {
  const fromFinal = maxRound - round;
  if (fromFinal === 0) return 'Final';
  if (fromFinal === 1) return 'Semi-finals';
  if (fromFinal === 2) return 'Quarter-finals';
  if (fromFinal === 3) return 'Last 16';
  if (fromFinal === 4) return 'Last 32';
  if (fromFinal === 5) return 'Last 64';
  return `Round ${round}`;
}

export async function generateBracket(
  tournament: Tournament,
  entries: Entry[],
): Promise<void> {
  const realEntries  = entries.filter((e) => !e.isBye);
  const bracketSize  = nextPowerOf2(realEntries.length);
  const numByes      = bracketSize - realEntries.length;
  const numRounds    = totalRounds(bracketSize);

  const byeEntries: Entry[] = [];
  for (let i = 0; i < numByes; i++) {
    byeEntries.push(await addByeEntry(tournament.id));
  }

  const slots = arrangeSlots(realEntries, byeEntries, tournament.seeding);

  const matches: Omit<KnockoutMatch, 'id'>[] = [];

  for (let i = 0; i < bracketSize; i += 2) {
    const pos = i / 2 + 1;
    matches.push({
      tournamentId:  tournament.id,
      round:         1,
      position:      pos,
      entry1Id:      slots[i]!.id,
      entry2Id:      slots[i + 1]!.id,
      winnerId:      null,
      score1:        null,
      score2:        null,
      status:        'ready',
      isBye:         false,
      isThirdPlace:  false,
    });
  }

  for (let r = 2; r <= numRounds; r++) {
    const count = bracketSize / Math.pow(2, r);
    for (let pos = 1; pos <= count; pos++) {
      matches.push({
        tournamentId:  tournament.id,
        round:         r,
        position:      pos,
        entry1Id:      null,
        entry2Id:      null,
        winnerId:      null,
        score1:        null,
        score2:        null,
        status:        'pending',
        isBye:         false,
        isThirdPlace:  false,
      });
    }
  }

  await insertMatches(matches);

  const dbRound1 = (await getMatches(tournament.id)).filter((m) => m.round === 1);
  for (const m of dbRound1) {
    await processAutoAdvance(tournament.id, m, numRounds, tournament.thirdPlacePlayoff);
  }
}

export async function processAfterResult(
  tournament: Tournament,
  match: KnockoutMatch,
  numRounds: number,
): Promise<void> {
  if (!match.winnerId) return;

  const nextMatch = await advanceWinner(tournament.id, match.round, match.position, match.winnerId);
  if (nextMatch) {
    await processAutoAdvance(tournament.id, nextMatch, numRounds, tournament.thirdPlacePlayoff);
  }

  if (tournament.thirdPlacePlayoff && match.round === numRounds - 1 && !match.isThirdPlace) {
    await maybeCreateThirdPlace(tournament.id, numRounds);
  }

  await maybeCompleteTournament(tournament, numRounds);
}

async function processAutoAdvance(
  tournamentId: string,
  match: KnockoutMatch,
  numRounds: number,
  thirdPlacePlayoff: boolean,
): Promise<void> {
  const winnerId = await autoCompleteBye(match);
  if (!winnerId) return;
  const next = await advanceWinner(tournamentId, match.round, match.position, winnerId);
  if (next) await processAutoAdvance(tournamentId, next, numRounds, thirdPlacePlayoff);
}

async function maybeCompleteTournament(tournament: Tournament, numRounds: number): Promise<void> {
  const allMatches = await getMatches(tournament.id);
  const final = allMatches.find((m) => m.round === numRounds && m.position === 1 && !m.isThirdPlace);
  if (!final || final.status !== 'completed') return;
  if (tournament.thirdPlacePlayoff) {
    const third = allMatches.find((m) => m.isThirdPlace);
    if (!third || third.status !== 'completed') return;
  }
  await updateTournamentStatus(tournament.id, 'completed');
}

async function maybeCreateThirdPlace(tournamentId: string, numRounds: number): Promise<void> {
  const allMatches = await getMatches(tournamentId);
  const semis = allMatches.filter(
    (m) => m.round === numRounds - 1 && !m.isThirdPlace && m.status === 'completed',
  );
  if (semis.length < 2) return;
  const loserIds = semis.map((m) =>
    m.winnerId === m.entry1Id ? m.entry2Id! : m.entry1Id!,
  );
  await createThirdPlaceMatch(tournamentId, numRounds, loserIds[0]!, loserIds[1]!);
}

// ─── Slot arrangement ─────────────────────────────────────────────────────────

function arrangeSlots(
  realEntries: Entry[],
  byeEntries: Entry[],
  seeding: 'random' | 'seeded',
): Entry[] {
  const bracketSize = realEntries.length + byeEntries.length;

  if (seeding === 'random') {
    const shuffledReal = shuffle([...realEntries]);
    const pairs: [Entry, Entry][] = [];
    let ri = 0;
    for (const bye of byeEntries) {
      const real = shuffledReal[ri++]!;
      pairs.push(Math.random() < 0.5 ? [bye, real] : [real, bye]);
    }
    while (ri < shuffledReal.length) {
      pairs.push([shuffledReal[ri]!, shuffledReal[ri + 1]!]);
      ri += 2;
    }
    return shuffle(pairs).flat();
  }

  const slots: (Entry | null)[] = Array(bracketSize).fill(null);
  const seedPositions = buildSeedPositions(bracketSize);
  const sorted = [...realEntries].sort((a, b) => {
    if (a.seed == null && b.seed == null) return 0;
    if (a.seed == null) return 1;
    if (b.seed == null) return -1;
    return a.seed - b.seed;
  });
  const unseeded: Entry[] = [];

  for (const entry of sorted) {
    if (entry.seed != null) {
      const slotIdx = seedPositions[entry.seed - 1];
      if (slotIdx !== undefined && slotIdx < bracketSize) {
        slots[slotIdx] = entry;
      } else {
        unseeded.push(entry);
      }
    } else {
      unseeded.push(entry);
    }
  }

  const byePool = [...byeEntries];
  for (const entry of sorted) {
    if (byePool.length === 0) break;
    if (entry.seed == null) continue;
    const slotIdx = seedPositions[entry.seed - 1];
    if (slotIdx === undefined || slotIdx >= bracketSize) continue;
    const partnerIdx = slotIdx ^ 1;
    if (slots[partnerIdx] === null) {
      slots[partnerIdx] = byePool.shift()!;
    }
  }

  const shuffledUnseeded = shuffle([...unseeded]);
  let ui = 0;
  let bi = 0;
  const nullPairSlots: number[] = [];
  const isolatedNullSlots: number[] = [];

  for (let i = 0; i < bracketSize; i += 2) {
    const leftNull  = slots[i]     === null;
    const rightNull = slots[i + 1] === null;
    if (leftNull && rightNull) {
      nullPairSlots.push(i, i + 1);
    } else {
      if (leftNull)  isolatedNullSlots.push(i);
      if (rightNull) isolatedNullSlots.push(i + 1);
    }
  }

  for (let i = 0; i < nullPairSlots.length; i += 2) {
    const slotA = nullPairSlots[i]!;
    const slotB = nullPairSlots[i + 1]!;
    const hasBye  = bi < byePool.length;
    const hasReal = ui < shuffledUnseeded.length;
    if (hasBye && hasReal) {
      if (Math.random() < 0.5) {
        slots[slotA] = byePool[bi++]!;
        slots[slotB] = shuffledUnseeded[ui++]!;
      } else {
        slots[slotA] = shuffledUnseeded[ui++]!;
        slots[slotB] = byePool[bi++]!;
      }
    } else if (hasReal) {
      slots[slotA] = shuffledUnseeded[ui++]!;
      slots[slotB] = shuffledUnseeded[ui++]!;
    } else {
      slots[slotA] = byePool[bi++]!;
      slots[slotB] = byePool[bi++]!;
    }
  }

  const remaining = shuffle([...shuffledUnseeded.slice(ui), ...byePool.slice(bi)]);
  let ri = 0;
  for (const slotIdx of isolatedNullSlots) {
    slots[slotIdx] = remaining[ri++] ?? null;
  }

  return slots as Entry[];
}

function buildSeedPositions(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const newSize = order.length * 2;
    for (const s of order) next.push(s, newSize + 1 - s);
    order = next;
  }
  const seedPositions = new Array(size).fill(0);
  order.forEach((seed, slot) => { seedPositions[seed - 1] = slot; });
  return seedPositions;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface BracketRound {
  round:   number;
  label:   string;
  matches: KnockoutMatch[];
}

export function groupMatchesByRound(matches: KnockoutMatch[], maxRound: number): BracketRound[] {
  const byRound = new Map<number, KnockoutMatch[]>();
  for (const m of matches) {
    if (m.isThirdPlace) continue;
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  return Array.from(byRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, ms]) => ({
      round,
      label: roundLabel(round, maxRound),
      matches: ms.sort((a, b) => a.position - b.position),
    }));
}
