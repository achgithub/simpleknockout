import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import {
  getGroups, getGroupMembers, getGroupFixtures,
  setFixtureResult, computeStandings,
  type Group, type GroupFixture, type GroupStanding,
} from '@/db/groups';
import { getEntries, type Entry } from '@/db/entries';
import { getTournament, type Tournament } from '@/db/tournaments';
import { sendTelegram, formatGroupStandings } from '@/lib/telegram';
import clsx from 'clsx';

interface GroupData {
  group: Group;
  members: string[];
  fixtures: GroupFixture[];
  standings: GroupStanding[];
}

type FixtureResult = GroupFixture['result'];

export function Groups() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [data, setData] = useState<GroupData[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!id) return;
    const [t, allEntries, groups] = await Promise.all([
      getTournament(id),
      getEntries(id),
      getGroups(id),
    ]);
    setTournament(t);
    setEntries(allEntries);

    const groupData: GroupData[] = await Promise.all(
      groups.map(async (g) => {
        const [members, fixtures] = await Promise.all([getGroupMembers(g.id), getGroupFixtures(g.id)]);
        const standings = computeStandings(fixtures, members, allEntries);
        return { group: g, members, fixtures, standings };
      }),
    );
    setData(groupData);
  };

  useEffect(() => { void load(); }, [id]);

  const setResult = async (fixtureId: string, result: FixtureResult) => {
    await setFixtureResult(fixtureId, result);
    void load();
  };

  const shareStandings = async (g: GroupData) => {
    if (!tournament?.telegramBotToken || !tournament.telegramChannelId) {
      alert('Configure Telegram in tournament settings first.');
      return;
    }
    setSending(true);
    try {
      const text = formatGroupStandings(tournament.name, tournament.game, g.group.name, g.standings);
      await sendTelegram({ botToken: tournament.telegramBotToken, channelId: tournament.telegramChannelId }, text);
    } catch (e) {
      alert(`Telegram error: ${(e as Error).message}`);
    }
    setSending(false);
  };

  if (!tournament) return null;

  const fixturesByRound = (fixtures: GroupFixture[]) => {
    const map = new Map<number, GroupFixture[]>();
    for (const f of fixtures) {
      const arr = map.get(f.round) ?? [];
      arr.push(f);
      map.set(f.round, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  };

  const entryName = (entryId: string) =>
    entries.find((e) => e.id === entryId)?.displayName ?? entryId;

  return (
    <Layout title="Groups" back>
      <div className="flex flex-col gap-6">
        {data.map((g) => (
          <div key={g.group.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{g.group.name}</h2>
              <button
                onClick={() => void shareStandings(g)}
                disabled={sending}
                className="text-xs text-brand-600 font-medium"
              >
                Share →
              </button>
            </div>

            {/* Standings */}
            <Card className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                    <th className="px-2 py-2 font-medium text-gray-500">P</th>
                    <th className="px-2 py-2 font-medium text-gray-500">W</th>
                    <th className="px-2 py-2 font-medium text-gray-500">D</th>
                    <th className="px-2 py-2 font-medium text-gray-500">L</th>
                    <th className="px-2 py-2 font-medium text-gray-500 pr-3">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {g.standings.map((s, i) => (
                    <tr key={s.entryId} className={clsx('border-b border-gray-50 last:border-0', i < tournament.advancementCount && 'bg-green-50')}>
                      <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[120px]">{s.displayName}</td>
                      <td className="text-center px-2 py-2 text-gray-600">{s.played}</td>
                      <td className="text-center px-2 py-2 text-gray-600">{s.won}</td>
                      <td className="text-center px-2 py-2 text-gray-600">{s.drawn}</td>
                      <td className="text-center px-2 py-2 text-gray-600">{s.lost}</td>
                      <td className="text-center px-2 py-2 font-bold text-gray-900 pr-3">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Fixtures by round */}
            {fixturesByRound(g.fixtures).map(([round, fixtures]) => (
              <div key={round} className="flex flex-col gap-2">
                <p className="text-xs text-gray-500 font-medium">Round {round}</p>
                {fixtures.map((f) => {
                  const e1 = entryName(f.entry1Id);
                  const e2 = entryName(f.entry2Id);
                  return (
                    <Card key={f.id} className="p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                        <span className={clsx('truncate', f.result === 'entry1' && 'text-green-600 font-bold')}>{e1}</span>
                        <span className="text-gray-400 shrink-0">vs</span>
                        <span className={clsx('truncate text-right', f.result === 'entry2' && 'text-green-600 font-bold')}>{e2}</span>
                      </div>
                      {!f.result && (
                        <div className="grid grid-cols-3 gap-1">
                          {(['entry1', 'draw', 'entry2'] as FixtureResult[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => void setResult(f.id, r)}
                              className="text-xs py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium active:bg-brand-100 active:text-brand-700"
                            >
                              {r === 'entry1' ? e1.split(' ')[0] : r === 'entry2' ? e2.split(' ')[0] : 'Draw'}
                            </button>
                          ))}
                        </div>
                      )}
                      {f.result && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {f.result === 'draw' ? 'Draw' : `Won: ${f.result === 'entry1' ? e1 : e2}`}
                          </span>
                          <button
                            onClick={() => void setResult(f.id, null)}
                            className="text-xs text-gray-400"
                          >
                            Undo
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Layout>
  );
}
