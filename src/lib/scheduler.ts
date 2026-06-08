export interface ScheduledFixture {
  homeTeamId: string;
  awayTeamId: string;
  week: number;
}

export function generateRoundRobin(teamIds: string[]): ScheduledFixture[] {
  const n = teamIds.length;
  if (n < 2) return [];
  if (n % 2 !== 0) throw new Error('generateRoundRobin requires an even number of teams');

  const teams = [...teamIds];
  const weeksPerHalf = n - 1;
  const fixtures: ScheduledFixture[] = [];

  for (let w = 0; w < weeksPerHalf; w++) {
    const isEven = w % 2 === 0;
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i]!;
      const b = teams[n - 1 - i]!;
      fixtures.push({
        homeTeamId: isEven ? a : b,
        awayTeamId: isEven ? b : a,
        week: w + 1,
      });
    }
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  const firstHalf = [...fixtures];
  for (const f of firstHalf) {
    fixtures.push({ homeTeamId: f.awayTeamId, awayTeamId: f.homeTeamId, week: f.week + weeksPerHalf });
  }

  return fixtures;
}
