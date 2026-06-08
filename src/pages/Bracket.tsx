import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { getTournament, type Tournament } from '@/db/tournaments';
import { getEntries, type Entry } from '@/db/entries';
import { getMatches, setMatchResult, type KnockoutMatch } from '@/db/knockout';
import { processAfterResult, groupMatchesByRound, totalRounds, nextPowerOf2, type BracketRound } from '@/lib/bracket';
import { sendTelegram, formatBracketRound } from '@/lib/telegram';
import clsx from 'clsx';

interface MatchResultSheet {
  match: KnockoutMatch;
  e1Name: string;
  e2Name: string;
}

export function Bracket() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [thirdPlace, setThirdPlace] = useState<KnockoutMatch | null>(null);
  const [sheet, setSheet] = useState<MatchResultSheet | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!id) return;
    const [t, allEntries, matches] = await Promise.all([
      getTournament(id),
      getEntries(id),
      getMatches(id),
    ]);
    setTournament(t);
    setEntries(allEntries);

    if (!t) return;
    const bracketSize  = nextPowerOf2(allEntries.filter((e) => !e.isBye).length);
    const numRounds    = totalRounds(bracketSize);
    const normalMatches = matches.filter((m) => !m.isThirdPlace);
    setRounds(groupMatchesByRound(normalMatches, numRounds));
    setThirdPlace(matches.find((m) => m.isThirdPlace) ?? null);
  };

  useEffect(() => { void load(); }, [id]);

  const entryName = (entryId: string | null) => {
    if (!entryId) return 'TBD';
    return entries.find((e) => e.id === entryId)?.displayName ?? 'TBD';
  };

  const openSheet = (match: KnockoutMatch) => {
    if (match.status !== 'ready' || match.isBye) return;
    setSheet({
      match,
      e1Name: entryName(match.entry1Id),
      e2Name: entryName(match.entry2Id),
    });
    setScore1('');
    setScore2('');
  };

  const submitResult = async (winnerId: string) => {
    if (!sheet || !tournament) return;
    const s1 = score1 !== '' ? Number(score1) : null;
    const s2 = score2 !== '' ? Number(score2) : null;
    const updated = await setMatchResult(sheet.match.id, winnerId, s1, s2);
    if (updated) {
      const bracketSize = nextPowerOf2(entries.filter((e) => !e.isBye).length);
      const numRounds   = totalRounds(bracketSize);
      await processAfterResult(tournament, updated, numRounds);
    }
    setSheet(null);
    void load();
  };

  const shareRound = async (round: BracketRound) => {
    if (!tournament?.telegramBotToken || !tournament.telegramChannelId) {
      alert('Configure Telegram in tournament settings first.');
      return;
    }
    setSending(true);
    try {
      const matchData = round.matches.map((m) => ({
        entry1Name: entryName(m.entry1Id),
        entry2Name: entryName(m.entry2Id),
        score1: m.score1,
        score2: m.score2,
        winnerName: m.winnerId ? entryName(m.winnerId) : null,
      }));
      const text = formatBracketRound(tournament.name, tournament.game, round.label, matchData);
      await sendTelegram({ botToken: tournament.telegramBotToken, channelId: tournament.telegramChannelId }, text);
    } catch (e) {
      alert(`Telegram error: ${(e as Error).message}`);
    }
    setSending(false);
  };

  if (!tournament) return null;

  return (
    <Layout title="Bracket" back>
      <div className="flex flex-col gap-6">
        {rounds.map((round) => (
          <div key={round.round} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{round.label}</h2>
              <button
                onClick={() => void shareRound(round)}
                disabled={sending}
                className="text-xs text-brand-600 font-medium"
              >
                Share →
              </button>
            </div>
            {round.matches.map((m) => {
              const e1Name = entryName(m.entry1Id);
              const e2Name = entryName(m.entry2Id);
              const winnerName = m.winnerId ? entryName(m.winnerId) : null;
              return (
                <Card
                  key={m.id}
                  className={clsx(
                    'px-4 py-3 flex flex-col gap-1',
                    m.status === 'ready' && !m.isBye && 'cursor-pointer active:bg-gray-50',
                  )}
                  onClick={() => openSheet(m)}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className={clsx(
                      'truncate font-medium',
                      m.status === 'completed' && m.winnerId === m.entry1Id && 'text-green-600 font-bold',
                      m.status === 'pending' && 'text-gray-400',
                    )}>
                      {e1Name}
                    </span>
                    <span className="text-gray-400 text-xs shrink-0">
                      {m.status === 'completed' && m.score1 != null
                        ? `${m.score1} – ${m.score2}`
                        : m.status === 'ready' ? 'vs' : '–'}
                    </span>
                    <span className={clsx(
                      'truncate font-medium text-right',
                      m.status === 'completed' && m.winnerId === m.entry2Id && 'text-green-600 font-bold',
                      m.status === 'pending' && 'text-gray-400',
                    )}>
                      {e2Name}
                    </span>
                  </div>
                  {m.isBye && m.status === 'completed' && (
                    <p className="text-xs text-gray-400">Bye — {winnerName} advances</p>
                  )}
                </Card>
              );
            })}
          </div>
        ))}

        {/* 3rd place */}
        {thirdPlace && (
          <div className="flex flex-col gap-2">
            <h2 className="font-bold text-gray-800">3rd Place</h2>
            <Card
              className={clsx('px-4 py-3 flex flex-col gap-1', thirdPlace.status === 'ready' && 'cursor-pointer active:bg-gray-50')}
              onClick={() => openSheet(thirdPlace)}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={clsx('truncate font-medium', thirdPlace.winnerId === thirdPlace.entry1Id && 'text-green-600 font-bold')}>
                  {entryName(thirdPlace.entry1Id)}
                </span>
                <span className="text-gray-400 text-xs shrink-0">
                  {thirdPlace.status === 'completed' && thirdPlace.score1 != null
                    ? `${thirdPlace.score1} – ${thirdPlace.score2}`
                    : 'vs'}
                </span>
                <span className={clsx('truncate font-medium text-right', thirdPlace.winnerId === thirdPlace.entry2Id && 'text-green-600 font-bold')}>
                  {entryName(thirdPlace.entry2Id)}
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Winner banner */}
        {tournament.status === 'completed' && (() => {
          const finalMatch = rounds[rounds.length - 1]?.matches[0];
          const winner = finalMatch?.winnerId ? entryName(finalMatch.winnerId) : null;
          return winner ? (
            <Card className="p-6 text-center bg-yellow-50 border-yellow-200">
              <p className="text-3xl mb-2">🏆</p>
              <p className="font-bold text-xl text-gray-900">{winner}</p>
              <p className="text-sm text-gray-500">Tournament winner</p>
            </Card>
          ) : null;
        })()}
      </div>

      {/* Result entry bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-3xl p-6 flex flex-col gap-4 pb-safe">
            <h3 className="font-bold text-lg text-center text-gray-900">Enter Result</h3>
            <p className="text-center text-sm text-gray-600">{sheet.e1Name} vs {sheet.e2Name}</p>

            {/* Optional scores */}
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                placeholder="Score"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-center text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="number"
                min={0}
                placeholder="Score"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-center text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => void submitResult(sheet.match.entry1Id!)} fullWidth>
                {sheet.e1Name} wins
              </Button>
              <Button onClick={() => void submitResult(sheet.match.entry2Id!)} fullWidth>
                {sheet.e2Name} wins
              </Button>
              <Button variant="ghost" onClick={() => setSheet(null)} fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
