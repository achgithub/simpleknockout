import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { AdvancementSummary } from '@/components/AdvancementSummary';
import {
  getGroups, getGroupMembers, getGroupFixtures,
  setFixtureResult, computeStandings,
  type Group, type GroupFixture, type GroupStanding,
} from '@/db/groups';
import { getEntries, type Entry } from '@/db/entries';
import { getTournament, type Tournament } from '@/db/tournaments';
import { sendTelegram, formatGroupStandings } from '@/lib/telegram';
import { selectQualifiers } from '@/lib/advancement';
import clsx from 'clsx';

interface GroupData {
  group: Group;
  members: string[];
  fixtures: GroupFixture[];
  standings: GroupStanding[];
}

type FixtureResult = GroupFixture['result'];
type SubTab = 'league' | 'fixtures';

interface ResultSheet {
  fixture: GroupFixture;
  e1Name: string;
  e2Name: string;
}

export function Groups() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [data, setData] = useState<GroupData[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sending, setSending] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('league');
  const [sheet, setSheet] = useState<ResultSheet | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setCurrentPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollToPage = (idx: number) => {
    containerRef.current?.scrollTo({ left: idx * containerRef.current.clientWidth, behavior: 'smooth' });
  };

  const shareStandings = async (g: GroupData) => {
    if (!tournament?.telegramBotToken || !tournament.telegramChannelId) {
      alert(t('groups.configureTelegram'));
      return;
    }
    setSending(true);
    try {
      const text = formatGroupStandings(tournament.name, tournament.game, g.group.name, g.standings);
      await sendTelegram({ botToken: tournament.telegramBotToken, channelId: tournament.telegramChannelId }, text);
    } catch (e) {
      alert(t('groups.telegramError', { message: (e as Error).message }));
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

  const groupSizes = data.map((g) => g.members.length);
  const qualifierIds = new Set(selectQualifiers(data.map((g) => g.standings), tournament.advancementCount));

  const openSheet = (fixture: GroupFixture) => {
    setSheet({ fixture, e1Name: entryName(fixture.entry1Id), e2Name: entryName(fixture.entry2Id) });
    setScore1(fixture.score1 != null ? String(fixture.score1) : '');
    setScore2(fixture.score2 != null ? String(fixture.score2) : '');
  };

  const submitResult = async (result: FixtureResult) => {
    if (!sheet) return;
    const s1 = score1 !== '' ? Number(score1) : null;
    const s2 = score2 !== '' ? Number(score2) : null;
    await setFixtureResult(sheet.fixture.id, result, result ? s1 : null, result ? s2 : null);
    setSheet(null);
    void load();
  };

  return (
    <Layout title={t('groups.title')} back noPad>
      {data.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">{t('groups.noGroups')}</p>
      ) : (
        <div
          className="flex flex-col"
          style={{ height: 'calc(100dvh - 3rem - env(safe-area-inset-top) - var(--ad-banner-height))' }}
        >
          <div
            ref={containerRef}
            className="flex flex-1 overflow-x-scroll"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            onScroll={handleScroll}
          >
            {data.map((g) => (
              <div
                key={g.group.id}
                className="w-full shrink-0 overflow-y-auto"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">{g.group.name}</h2>
                    <button
                      onClick={() => void shareStandings(g)}
                      disabled={sending}
                      className="text-xs text-brand-600 font-medium"
                    >
                      {t('groups.share')}
                    </button>
                  </div>

                  <div className="flex bg-gray-100 rounded-xl p-1">
                    {(['league', 'fixtures'] as SubTab[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSubTab(tab)}
                        className={clsx(
                          'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          subTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500',
                        )}
                      >
                        {t(`groups.tabs.${tab}`)}
                      </button>
                    ))}
                  </div>

                  {subTab === 'league' ? (
                    <>
                      <AdvancementSummary
                        groupSizes={groupSizes}
                        advancementCount={tournament.advancementCount}
                        className="text-xs text-gray-400 -mt-1"
                      />
                      <Card className="overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-3 py-2 font-medium text-gray-500">{t('groups.table.name')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500">{t('groups.table.played')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500">{t('groups.table.won')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500">{t('groups.table.drawn')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500">{t('groups.table.lost')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500">{t('groups.table.gd')}</th>
                              <th className="px-2 py-2 font-medium text-gray-500 pr-3">{t('groups.table.points')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.standings.map((s) => (
                              <tr
                                key={s.entryId}
                                className={clsx('border-b border-gray-50 last:border-0', qualifierIds.has(s.entryId) && 'bg-green-50')}
                              >
                                <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[100px]">{s.displayName}</td>
                                <td className="text-center px-2 py-2 text-gray-600">{s.played}</td>
                                <td className="text-center px-2 py-2 text-gray-600">{s.won}</td>
                                <td className="text-center px-2 py-2 text-gray-600">{s.drawn}</td>
                                <td className="text-center px-2 py-2 text-gray-600">{s.lost}</td>
                                <td className="text-center px-2 py-2 text-gray-600">{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</td>
                                <td className="text-center px-2 py-2 font-bold text-gray-900 pr-3">{s.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    </>
                  ) : (
                    fixturesByRound(g.fixtures).map(([round, fixtures]) => (
                      <div key={round} className="flex flex-col gap-2">
                        <p className="text-xs text-gray-500 font-medium">{t('groups.round', { number: round })}</p>
                        {fixtures.map((f) => (
                          <FixtureCard
                            key={f.id}
                            fixture={f}
                            e1Name={entryName(f.entry1Id)}
                            e2Name={entryName(f.entry2Id)}
                            onClick={() => openSheet(f)}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.length > 1 && (
            <div className="flex justify-center items-center gap-2 py-3 pb-safe shrink-0">
              {data.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  className={clsx(
                    'rounded-full transition-all',
                    i === currentPage ? 'w-4 h-2 bg-brand-600' : 'w-2 h-2 bg-gray-300',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result entry sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div
            className="bg-white rounded-t-3xl p-6 flex flex-col gap-4 pb-safe"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--ad-banner-height))' }}
          >
            <h3 className="font-bold text-lg text-center text-gray-900">{t('bracket.enterResult')}</h3>
            <p className="text-center text-sm text-gray-600">{sheet.e1Name} {t('common.vs')} {sheet.e2Name}</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                placeholder={t('bracket.scorePlaceholder')}
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-center text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="number"
                min={0}
                placeholder={t('bracket.scorePlaceholder')}
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-center text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => void submitResult('entry1')} fullWidth>{t('bracket.wins', { name: sheet.e1Name })}</Button>
              <Button variant="secondary" onClick={() => void submitResult('draw')} fullWidth>{t('common.draw')}</Button>
              <Button onClick={() => void submitResult('entry2')} fullWidth>{t('bracket.wins', { name: sheet.e2Name })}</Button>
              {sheet.fixture.result && (
                <Button variant="ghost" onClick={() => void submitResult(null)} fullWidth>{t('common.undo')}</Button>
              )}
              <Button variant="ghost" onClick={() => setSheet(null)} fullWidth>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Fixture card ─────────────────────────────────────────────────────────────

interface FixtureCardProps {
  fixture: GroupFixture;
  e1Name: string;
  e2Name: string;
  onClick: () => void;
}

function FixtureCard({ fixture, e1Name, e2Name, onClick }: FixtureCardProps) {
  const { result } = fixture;
  return (
    <Card className="px-4 py-3 flex flex-col gap-1 cursor-pointer active:bg-gray-50" onClick={onClick}>
      <FixtureRow name={e1Name} score={fixture.score1} status={result === 'entry1' ? 'win' : result === 'entry2' ? 'lose' : result === 'draw' ? 'draw' : 'pending'} />
      <div className="border-t border-gray-100 my-0.5" />
      <FixtureRow name={e2Name} score={fixture.score2} status={result === 'entry2' ? 'win' : result === 'entry1' ? 'lose' : result === 'draw' ? 'draw' : 'pending'} />
    </Card>
  );
}

function FixtureRow({ name, score, status }: { name: string; score: number | null; status: 'win' | 'lose' | 'draw' | 'pending' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={clsx(
        'flex-1 text-sm truncate',
        status === 'win'  && 'font-bold text-green-600',
        status === 'pending' ? 'text-gray-400' : status !== 'win' && 'font-medium text-gray-900',
      )}>
        {name}
      </span>
      {score != null && (
        <span className={clsx('text-sm font-bold tabular-nums', status === 'win' ? 'text-green-600' : 'text-gray-400')}>
          {score}
        </span>
      )}
      {status === 'pending' && (
        <span className="text-xs text-gray-300">›</span>
      )}
    </div>
  );
}
