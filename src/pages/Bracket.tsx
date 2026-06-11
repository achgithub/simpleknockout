import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { getTournament, type Tournament } from '@/db/tournaments';
import { getEntries, type Entry } from '@/db/entries';
import { getMatches, setMatchResult, type KnockoutMatch } from '@/db/knockout';
import {
  processAfterResult,
  groupMatchesByRound,
  totalRounds,
  nextPowerOf2,
  type BracketRound,
} from '@/lib/bracket';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';
import { useRewardedAd } from '@/hooks/useRewardedAd';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import clsx from 'clsx';

interface ResultSheet {
  match:  KnockoutMatch;
  e1Name: string;
  e2Name: string;
}

export function Bracket() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds,     setRounds]     = useState<BracketRound[]>([]);
  const [entries,    setEntries]    = useState<Entry[]>([]);
  const [thirdPlace, setThirdPlace] = useState<KnockoutMatch | null>(null);
  const [sheet,      setSheet]      = useState<ResultSheet | null>(null);
  const [score1,     setScore1]     = useState('');
  const [score2,     setScore2]     = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const containerRef  = useRef<HTMLDivElement>(null);
  const captureRef    = useRef<HTMLDivElement>(null);
  const didScroll     = useRef(false);
  const { showAd }    = useInterstitialAd();
  const { showRewardedAd } = useRewardedAd();
  const [capturing,   setCapturing] = useState(false);

  const captureAndShare = async () => {
    if (!captureRef.current || capturing) return;
    setCapturing(true);
    try {
      // Gate sharing behind a rewarded video: the user watches to unlock the
      // export. The rewarded ad resolves only once it has fully dismissed, so
      // the share sheet that follows never collides with the ad modal.
      const unlocked = await showRewardedAd();
      if (!unlocked) return; // user closed the ad early — nothing to share

      // Wait for fonts/emoji to be ready so the capture isn't missing glyphs.
      if (document.fonts?.ready) await document.fonts.ready;
      // html2canvas paints the DOM directly to a canvas. We use this instead of
      // html-to-image because the latter rasterizes blank in WKWebView (its SVG
      // <foreignObject> rendering path is broken on iOS).
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const base64  = dataUrl.split(',')[1]!;
      if (Capacitor.isNativePlatform()) {
        const filename = `bracket-${tournament?.name ?? 'knockout'}.png`
          .replace(/[^a-z0-9.\-_]/gi, '-');
        const { uri } = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        try {
          await Share.share({ files: [uri], title: tournament?.name ?? 'Bracket' });
        } catch (shareErr) {
          // The user dismissing the share sheet rejects — that's not an error.
          if (!/cancel/i.test((shareErr as Error).message)) throw shareErr;
        }
      } else {
        const a  = document.createElement('a');
        a.href   = dataUrl;
        a.download = 'bracket.png';
        a.click();
      }
    } catch (e) {
      // Surface real failures (e.g. image generation) instead of failing silently.
      alert(t('bracket.shareError', { message: (e as Error).message }));
    } finally {
      setCapturing(false);
    }
  };

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
    const bracketSize   = nextPowerOf2(allEntries.filter((e) => !e.isBye).length);
    const numRounds     = totalRounds(bracketSize);
    const normalMatches = matches.filter((m) => !m.isThirdPlace);
    setRounds(groupMatchesByRound(normalMatches, numRounds));
    setThirdPlace(matches.find((m) => m.isThirdPlace) ?? null);
  };

  useEffect(() => { void load(); }, [id]);

  // Default to the earliest round that still has 'ready' matches
  const defaultPage = useMemo(() => {
    const idx = rounds.findIndex((r) => r.matches.some((m) => m.status === 'ready'));
    return idx >= 0 ? idx : Math.max(0, rounds.length - 1);
  }, [rounds]);

  // Scroll to defaultPage once after rounds load
  useEffect(() => {
    if (didScroll.current || !containerRef.current || rounds.length === 0) return;
    const el = containerRef.current;
    // instant jump — no animation on first render
    el.scrollLeft = defaultPage * el.clientWidth;
    setCurrentPage(defaultPage);
    didScroll.current = true;
  }, [rounds, defaultPage]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setCurrentPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollToPage = (idx: number) => {
    containerRef.current?.scrollTo({ left: idx * containerRef.current.clientWidth, behavior: 'smooth' });
  };

  const entryName = (eid: string | null) =>
    !eid ? t('common.tbd') : (entries.find((e) => e.id === eid)?.displayName ?? t('common.tbd'));

  const openSheet = (match: KnockoutMatch) => {
    if (match.status !== 'ready' || match.isBye) return;
    setSheet({ match, e1Name: entryName(match.entry1Id), e2Name: entryName(match.entry2Id) });
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
      // Show ad when a round finishes, but NOT on the final
      const roundJustCompleted = updated.round;
      if (roundJustCompleted < numRounds) {
        const allMatches = await getMatches(tournament.id);
        const roundDone  = allMatches
          .filter((m) => m.round === roundJustCompleted && !m.isThirdPlace)
          .every((m) => m.status === 'completed');
        if (roundDone) await showAd();
      }
    }
    setSheet(null);
    didScroll.current = false; // allow re-default after result
    void load();
  };

  if (!tournament) return null;

  const isFinal        = (pageIdx: number) => pageIdx === rounds.length - 1;
  const currentRound   = rounds[currentPage];
  const finalRound     = rounds[rounds.length - 1];
  const finalMatch     = finalRound?.matches[0];
  const winner         = finalMatch?.winnerId ? entryName(finalMatch.winnerId) : null;
  const isCompleted    = tournament.status === 'completed';

  const shareButton = (
    <button
      onClick={() => void captureAndShare()}
      disabled={capturing}
      className="text-brand-600 active:opacity-60 disabled:opacity-40 p-1"
      aria-label={t('bracket.shareBracket')}
    >
      {capturing ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
    </button>
  );

  return (
    <Layout title={currentRound?.label ?? t('bracket.title')} back right={shareButton} noPad>
      {/* Hidden full-bracket capture div — rendered off-screen */}
      <div
        ref={captureRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '390px',
          backgroundColor: '#ffffff',
          padding: '20px 16px 28px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Tournament header — name first so the recipient immediately sees
            which tournament this bracket belongs to, with the game beneath. */}
        <div style={{ marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{tournament?.name}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500, marginTop: '4px' }}>
            {tournament?.game}
          </p>
        </div>

        {/* Only the round currently being viewed — so each share is just that
            round (e.g. "Last 64"), not the entire bracket. */}
        {rounds.map((round, rIdx) => {
          if (rIdx !== currentPage) return null;
          const isFinalRound = rIdx === rounds.length - 1;
          return (
            <div key={round.round} style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                {round.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {round.matches.map((m) => {
                  const n1 = entryName(m.entry1Id);
                  const n2 = entryName(m.entry2Id);
                  const w  = m.winnerId;
                  const borderColor = isFinalRound
                    ? (m.status === 'completed' ? '#fcd34d' : '#818cf8')
                    : '#e5e7eb';
                  return (
                    <div key={m.id} style={{ border: `2px solid ${borderColor}`, borderRadius: '12px', padding: '10px 14px', backgroundColor: isFinalRound && m.status === 'completed' ? '#fffbeb' : '#ffffff' }}>
                      {isFinalRound && (
                        <p style={{ fontSize: '9px', fontWeight: 700, color: isFinalRound && m.status === 'completed' ? '#d97706' : '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                          {t('bracket.final')}
                        </p>
                      )}
                      {/* Player 1 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: w === m.entry1Id ? 700 : 500, color: w === m.entry1Id ? '#15803d' : (m.status === 'pending' ? '#9ca3af' : '#111827') }}>
                          {w === m.entry1Id && '👑 '}{n1}
                        </span>
                        {m.score1 != null && (
                          <span style={{ fontSize: '14px', fontWeight: 700, color: w === m.entry1Id ? '#15803d' : '#9ca3af' }}>{m.score1}</span>
                        )}
                      </div>
                      <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: '6px' }} />
                      {/* Player 2 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: w === m.entry2Id ? 700 : 500, color: w === m.entry2Id ? '#15803d' : (m.status === 'pending' ? '#9ca3af' : '#111827') }}>
                          {w === m.entry2Id && '👑 '}{n2}
                        </span>
                        {m.score2 != null && (
                          <span style={{ fontSize: '14px', fontWeight: 700, color: w === m.entry2Id ? '#15803d' : '#9ca3af' }}>{m.score2}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 3rd place playoff — only on the final round's share */}
        {thirdPlace && currentPage === rounds.length - 1 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {t('bracket.thirdPlacePlayoff')}
            </p>
            <div style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '10px 14px' }}>
              {[{ name: entryName(thirdPlace.entry1Id), id: thirdPlace.entry1Id, score: thirdPlace.score1 },
                { name: entryName(thirdPlace.entry2Id), id: thirdPlace.entry2Id, score: thirdPlace.score2 }]
                .map((p, i) => (
                  <div key={i}>
                    {i === 1 && <div style={{ borderTop: '1px solid #f3f4f6', margin: '6px 0' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: thirdPlace.winnerId === p.id ? 700 : 500, color: thirdPlace.winnerId === p.id ? '#c2410c' : '#111827' }}>
                        {thirdPlace.winnerId === p.id && '🥉 '}{p.name}
                      </span>
                      {p.score != null && (
                        <span style={{ fontSize: '14px', fontWeight: 700, color: thirdPlace.winnerId === p.id ? '#c2410c' : '#9ca3af' }}>{p.score}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Winner banner — only on the final round's share */}
        {isCompleted && winner && currentPage === rounds.length - 1 && (
          <div style={{ backgroundColor: '#fffbeb', border: '2px solid #fcd34d', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏆</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{winner}</div>
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: 600, marginTop: '4px' }}>{t('bracket.tournamentChampion')}</div>
          </div>
        )}
      </div>

      {/* Full-height swipe container */}
      <div
        className="flex flex-col"
        style={{ height: 'calc(100dvh - 3rem - env(safe-area-inset-top) - var(--ad-banner-height))' }}
      >
        {/* Swipeable round pages */}
        <div
          ref={containerRef}
          className="flex flex-1 overflow-x-scroll"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          onScroll={handleScroll}
        >
          {rounds.map((round, pageIdx) => {
            const isFinalPage = isFinal(pageIdx);
            return (
              <div
                key={round.round}
                className="w-full shrink-0 overflow-y-auto"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className={clsx('p-4 flex flex-col gap-3', isFinalPage && 'pb-6')}>

                  {isFinalPage ? (
                    /* ── Final page ── */
                    <>
                      {/* Final match — prominent card */}
                      {finalMatch && (
                        <FinalMatchCard
                          match={finalMatch}
                          e1Name={entryName(finalMatch.entry1Id)}
                          e2Name={entryName(finalMatch.entry2Id)}
                          winner={winner}
                          onClick={() => openSheet(finalMatch)}
                        />
                      )}

                      {/* Winner banner */}
                      {isCompleted && winner && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
                          <span className="text-4xl">🏆</span>
                          <p className="text-xl font-bold text-gray-900">{winner}</p>
                          <p className="text-sm text-amber-700 font-medium">{t('bracket.tournamentChampion')}</p>
                        </div>
                      )}

                      {/* 3rd / 4th playoff */}
                      {thirdPlace && (
                        <div className="flex flex-col gap-2 mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                            {t('bracket.thirdPlacePlayoff')}
                          </p>
                          <MatchCard
                            match={thirdPlace}
                            e1Name={entryName(thirdPlace.entry1Id)}
                            e2Name={entryName(thirdPlace.entry2Id)}
                            onClick={() => openSheet(thirdPlace)}
                          />
                          {thirdPlace.status === 'completed' && thirdPlace.winnerId && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                              <span className="text-lg mr-2">🥉</span>
                              <span className="text-sm font-semibold text-orange-800">
                                {entryName(thirdPlace.winnerId)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── Regular round pages ── */
                    round.matches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        e1Name={entryName(m.entry1Id)}
                        e2Name={entryName(m.entry2Id)}
                        onClick={() => openSheet(m)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dot indicators */}
        {rounds.length > 1 && (
          <div className="flex justify-center items-center gap-2 py-3 pb-safe shrink-0">
            {rounds.map((_, i) => (
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
              <Button onClick={() => void submitResult(sheet.match.entry1Id!)} fullWidth>{t('bracket.wins', { name: sheet.e1Name })}</Button>
              <Button onClick={() => void submitResult(sheet.match.entry2Id!)} fullWidth>{t('bracket.wins', { name: sheet.e2Name })}</Button>
              <Button variant="ghost" onClick={() => setSheet(null)} fullWidth>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Match cards ──────────────────────────────────────────────────────────────

interface MatchCardProps {
  match:   KnockoutMatch;
  e1Name:  string;
  e2Name:  string;
  onClick: () => void;
}

function MatchCard({ match, e1Name, e2Name, onClick }: MatchCardProps) {
  const { t } = useTranslation();
  const tappable = match.status === 'ready' && !match.isBye;
  return (
    <Card
      className={clsx('px-4 py-3 flex flex-col gap-1', tappable && 'cursor-pointer active:bg-gray-50')}
      onClick={tappable ? onClick : undefined}
    >
      <MatchRow match={match} name={e1Name} side="entry1" />
      <div className="border-t border-gray-100 my-0.5" />
      <MatchRow match={match} name={e2Name} side="entry2" />
      {match.isBye && match.status === 'completed' && (
        <p className="text-xs text-gray-400 mt-1">{t('bracket.byeAdvances', { name: match.winnerId ? (match.winnerId === match.entry1Id ? e1Name : e2Name) : '' })}</p>
      )}
    </Card>
  );
}

function MatchRow({ match, name, side }: { match: KnockoutMatch; name: string; side: 'entry1' | 'entry2' }) {
  const entryId  = side === 'entry1' ? match.entry1Id  : match.entry2Id;
  const score    = side === 'entry1' ? match.score1    : match.score2;
  const isWinner = match.status === 'completed' && match.winnerId === entryId;
  const isPending = match.status === 'pending';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={clsx(
        'flex-1 text-sm truncate',
        isWinner  ? 'font-bold text-green-600' : '',
        isPending ? 'text-gray-400' : 'font-medium text-gray-900',
      )}>
        {name}
      </span>
      {match.status === 'completed' && score != null && (
        <span className={clsx('text-sm font-bold tabular-nums', isWinner ? 'text-green-600' : 'text-gray-400')}>
          {score}
        </span>
      )}
      {match.status === 'ready' && (
        <span className="text-xs text-gray-300">›</span>
      )}
    </div>
  );
}

// ── Final match card (larger, gold-accented) ─────────────────────────────────

interface FinalCardProps extends MatchCardProps { winner: string | null }

function FinalMatchCard({ match, e1Name, e2Name, winner: _winner, onClick }: FinalCardProps) {
  const { t } = useTranslation();
  const tappable = match.status === 'ready' && !match.isBye;
  return (
    <div
      className={clsx(
        'rounded-2xl border-2 p-5 flex flex-col gap-3',
        match.status === 'completed'
          ? 'bg-amber-50 border-amber-300'
          : 'bg-white border-brand-300',
        tappable && 'cursor-pointer active:opacity-90',
      )}
      onClick={tappable ? onClick : undefined}
    >
      <p className={clsx(
        'text-xs font-bold uppercase tracking-widest text-center',
        match.status === 'completed' ? 'text-amber-600' : 'text-brand-500',
      )}>
        {t('bracket.final')}
      </p>
      <FinalPlayerRow match={match} name={e1Name} side="entry1" />
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-gray-200" />
        <span className={clsx(
          'text-xs font-semibold',
          match.status === 'ready' ? 'text-brand-500' : 'text-gray-300',
        )}>
          {match.status === 'ready' ? t('common.vs') : '—'}
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
      <FinalPlayerRow match={match} name={e2Name} side="entry2" />
    </div>
  );
}

function FinalPlayerRow({ match, name, side }: { match: KnockoutMatch; name: string; side: 'entry1' | 'entry2' }) {
  const entryId  = side === 'entry1' ? match.entry1Id  : match.entry2Id;
  const score    = side === 'entry1' ? match.score1    : match.score2;
  const isWinner = match.status === 'completed' && match.winnerId === entryId;
  const isPending = match.status === 'pending';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={clsx(
        'text-lg flex-1 truncate',
        isWinner  ? 'font-bold text-amber-700' : '',
        isPending ? 'text-gray-400 text-base' : 'font-semibold text-gray-900',
      )}>
        {isWinner && <span className="mr-1">👑</span>}
        {name}
      </span>
      {match.status === 'completed' && score != null && (
        <span className={clsx('text-xl font-bold tabular-nums', isWinner ? 'text-amber-700' : 'text-gray-400')}>
          {score}
        </span>
      )}
    </div>
  );
}
