import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getTournament, updateTournamentStatus, type Tournament } from '@/db/tournaments';
import { getEntries, type Entry } from '@/db/entries';
import { createGroups, getGroups, getGroupMembers, getGroupFixtures, computeStandings } from '@/db/groups';
import { generateBracket, nextPowerOf2, totalRounds } from '@/lib/bracket';
import { selectQualifiers, estimateGroupSizes } from '@/lib/advancement';
import { AdvancementSummary } from '@/components/AdvancementSummary';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';

export function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [groupCount, setGroupCount] = useState(2);
  const [working, setWorking] = useState(false);
  const { showAd } = useInterstitialAd();

  const load = async () => {
    if (!id) return;
    const [t, e] = await Promise.all([getTournament(id), getEntries(id)]);
    setTournament(t);
    setEntries(e.filter((e) => !e.isBye));
    if (t && t.format === 'group_knockout' && e.length > 0) {
      setGroupCount(Math.max(2, Math.ceil(e.length / 4)));
    }
  };

  useEffect(() => { void load(); }, [id]);

  if (!tournament) return null;

  const realEntries = entries.filter((e) => !e.isBye);
  const bracketSize = nextPowerOf2(realEntries.length);
  const numRounds   = totalRounds(bracketSize);

  const startGroups = async () => {
    setWorking(true);
    try {
      await createGroups(tournament.id, realEntries, groupCount);
      await updateTournamentStatus(tournament.id, 'group_stage');
      navigate(`/tournament/${tournament.id}/groups`);
    } catch (e) { console.error(e); }
    setWorking(false);
  };

  const startKnockout = async (fromGroups = false) => {
    setWorking(true);
    try {
      let entriesToUse = realEntries;
      if (fromGroups) {
        const groups = await getGroups(tournament.id);
        const standingsByGroup = await Promise.all(groups.map(async (g) => {
          const [members, fixtures] = await Promise.all([getGroupMembers(g.id), getGroupFixtures(g.id)]);
          return computeStandings(fixtures, members, realEntries);
        }));
        const qualifierIds = selectQualifiers(standingsByGroup, tournament.advancementCount);
        const byId = new Map(realEntries.map((e) => [e.id, e]));
        entriesToUse = qualifierIds.map((qid) => byId.get(qid)).filter((e): e is Entry => !!e);
      }
      await generateBracket(tournament, entriesToUse);
      await updateTournamentStatus(tournament.id, 'knockout');
      await showAd(); // shown when moving to knockout (straight or from groups)
      navigate(`/tournament/${tournament.id}/bracket`);
    } catch (e) { console.error(e); }
    setWorking(false);
  };

  return (
    <Layout
      title={tournament.name}
      back
      right={
        <button onClick={() => navigate(`/tournament/${tournament.id}/settings`)} className="text-gray-500 text-xl px-1">
          ⚙
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Info */}
        <Card className="p-4 flex flex-col gap-1">
          <p className="text-sm text-gray-500">{tournament.game} · {tournament.format === 'group_knockout' ? t('common.format.groupKnockout') : t('common.format.straightKnockout')}</p>
          <p className="text-sm text-gray-500">{t('dashboard.entriesRegistered', { count: realEntries.length })}</p>
          {realEntries.length >= 2 && (
            <p className="text-xs text-gray-400">{t('dashboard.bracketSizeInfo', { size: bracketSize, rounds: numRounds, byes: bracketSize - realEntries.length })}</p>
          )}
        </Card>

        {/* Actions */}
        {tournament.status === 'registration' && (
          <>
            <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/register`)} fullWidth>
              {t('dashboard.manageEntries', { count: realEntries.length })}
            </Button>

            {realEntries.length >= 2 && tournament.format === 'group_knockout' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{t('dashboard.numberOfGroups')}</span>
                  <select
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    {[2, 3, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>{t('dashboard.groupsCount', { count: n })}</option>
                    ))}
                  </select>
                </div>
                <AdvancementSummary
                  groupSizes={estimateGroupSizes(realEntries.length, groupCount)}
                  advancementCount={tournament.advancementCount}
                  className="text-xs text-gray-400"
                />
                <Button onClick={() => void startGroups()} disabled={working} fullWidth>
                  {working ? t('dashboard.drawingGroups') : t('dashboard.startGroupStage')}
                </Button>
              </div>
            )}

            {realEntries.length >= 2 && tournament.format === 'straight_knockout' && (
              <Button onClick={() => void startKnockout()} disabled={working} fullWidth>
                {working ? t('dashboard.drawingBracket') : t('dashboard.generateBracket')}
              </Button>
            )}
          </>
        )}

        {tournament.status === 'group_stage' && (
          <>
            <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/groups`)} fullWidth>
              {t('dashboard.viewGroups')}
            </Button>
            <Button onClick={() => void startKnockout(true)} disabled={working} fullWidth>
              {working ? t('dashboard.startingKnockout') : t('dashboard.startKnockoutPhase')}
            </Button>
          </>
        )}

        {(tournament.status === 'knockout' || tournament.status === 'completed') && (
          <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/bracket`)} fullWidth>
            {t('dashboard.viewBracket')}
          </Button>
        )}
      </div>
    </Layout>
  );
}
