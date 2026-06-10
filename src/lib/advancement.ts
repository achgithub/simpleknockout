import { nextPowerOf2 } from './bracket';

export interface AdvancementPlan {
  groupCount: number;
  advancementCount: number;
  /** Teams that automatically qualify (top N from each group). */
  guaranteed: number;
  /** Knockout bracket size the qualifiers feed into. */
  bracketSize: number;
  /** Extra slots in the bracket beyond the guaranteed qualifiers. */
  extrasNeeded: number;
  /** How many non-automatic places exist across all groups (e.g. 3rd-placed teams). */
  extrasAvailable: number;
  /** Of extrasNeeded, how many can be filled by best-placed teams from other groups. */
  extrasFilled: number;
  /** Remaining bracket slots that must be filled with byes. */
  byesNeeded: number;
  /** If extrasFilled teams all share the same finishing rank, that rank (1-based); otherwise null. */
  extraRank: number | null;
}

/**
 * Works out how many teams advance from group play and how they map onto a
 * knockout bracket — including the "best placed" runners-up needed to fill a
 * bracket that isn't an exact power of two (as used in tournaments like the
 * World Cup / Euros for "best third-placed teams").
 */
export function computeAdvancementPlan(groupSizes: number[], advancementCount: number): AdvancementPlan {
  const groupCount = groupSizes.length;
  const guaranteed = groupSizes.reduce((sum, size) => sum + Math.min(advancementCount, size), 0);
  const bracketSize = guaranteed <= 1 ? guaranteed : nextPowerOf2(guaranteed);
  const extrasNeeded = Math.max(0, bracketSize - guaranteed);
  const extrasAvailable = groupSizes.reduce((sum, size) => sum + Math.max(0, size - advancementCount), 0);
  const extrasFilled = Math.min(extrasNeeded, extrasAvailable);
  const byesNeeded = extrasNeeded - extrasFilled;
  const groupsWithExtra = groupSizes.filter((size) => size > advancementCount).length;
  const extraRank = extrasFilled > 0 && extrasFilled <= groupsWithExtra ? advancementCount + 1 : null;

  return {
    groupCount, advancementCount, guaranteed, bracketSize,
    extrasNeeded, extrasAvailable, extrasFilled, byesNeeded, extraRank,
  };
}

export interface RankedEntry {
  entryId: string;
  points: number;
  goalDiff: number;
  for: number;
}

/**
 * Picks the entries that advance from group play, in qualification order:
 * the top `advancementCount` from every group, followed by the best-placed
 * remaining teams (ranked by points, then goal difference, then goals scored)
 * needed to fill out a knockout bracket sized to a power of two.
 */
export function selectQualifiers(groupStandings: RankedEntry[][], advancementCount: number): string[] {
  const guaranteed: string[] = [];
  const remainder: RankedEntry[] = [];

  for (const standings of groupStandings) {
    standings.forEach((s, i) => {
      if (i < advancementCount) guaranteed.push(s.entryId);
      else remainder.push(s);
    });
  }

  const bracketSize = guaranteed.length <= 1 ? guaranteed.length : nextPowerOf2(guaranteed.length);
  const extrasNeeded = Math.max(0, bracketSize - guaranteed.length);

  remainder.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.for - a.for;
  });

  return [...guaranteed, ...remainder.slice(0, extrasNeeded).map((s) => s.entryId)];
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

/** Locale-aware ordinal for "3rd-placed" / "3º" style labels. */
export function ordinal(n: number, locale = 'en'): string {
  if (locale.startsWith('es')) return `${n}º`;
  const v = n % 100;
  const suffix = ORDINAL_SUFFIXES[(v - 20) % 10] ?? ORDINAL_SUFFIXES[v] ?? 'th';
  return `${n}${suffix}`;
}

/** Even-as-possible group sizes for `entryCount` entries split into `groupCount` groups. */
export function estimateGroupSizes(entryCount: number, groupCount: number): number[] {
  const base = Math.floor(entryCount / groupCount);
  const remainder = entryCount % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0));
}
