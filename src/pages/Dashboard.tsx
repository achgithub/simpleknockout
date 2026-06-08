import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getTournament, updateTournamentStatus, type Tournament } from '@/db/tournaments';
import { getEntries, type Entry } from '@/db/entries';
import { createGroups } from '@/db/groups';
import { generateBracket, nextPowerOf2, totalRounds } from '@/lib/bracket';

export function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [groupCount, setGroupCount] = useState(2);
  const [working, setWorking] = useState(false);

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
        // Advancement from groups — placeholder: use all real entries for now.
        // TODO: wire up advancementLogic to pick top-N per group.
      }
      await generateBracket(tournament, entriesToUse);
      await updateTournamentStatus(tournament.id, 'knockout');
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
          <p className="text-sm text-gray-500">{tournament.game} · {tournament.format === 'group_knockout' ? 'Groups + Knockout' : 'Straight Knockout'}</p>
          <p className="text-sm text-gray-500">{realEntries.length} entries registered</p>
          {realEntries.length >= 2 && (
            <p className="text-xs text-gray-400">Bracket size: {bracketSize} ({numRounds} rounds, {bracketSize - realEntries.length} byes)</p>
          )}
        </Card>

        {/* Actions */}
        {tournament.status === 'registration' && (
          <>
            <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/register`)} fullWidth>
              Manage Entries ({realEntries.length})
            </Button>

            {realEntries.length >= 2 && tournament.format === 'group_knockout' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Number of groups</span>
                  <select
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    {[2, 3, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>{n} groups</option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => void startGroups()} disabled={working} fullWidth>
                  {working ? 'Drawing groups…' : 'Start Group Stage'}
                </Button>
              </div>
            )}

            {realEntries.length >= 2 && tournament.format === 'straight_knockout' && (
              <Button onClick={() => void startKnockout()} disabled={working} fullWidth>
                {working ? 'Drawing bracket…' : 'Generate Bracket'}
              </Button>
            )}
          </>
        )}

        {tournament.status === 'group_stage' && (
          <>
            <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/groups`)} fullWidth>
              View Groups
            </Button>
            <Button onClick={() => void startKnockout(true)} disabled={working} fullWidth>
              {working ? 'Starting knockout…' : 'Start Knockout Phase'}
            </Button>
          </>
        )}

        {(tournament.status === 'knockout' || tournament.status === 'completed') && (
          <Button variant="secondary" onClick={() => navigate(`/tournament/${tournament.id}/bracket`)} fullWidth>
            View Bracket
          </Button>
        )}
      </div>
    </Layout>
  );
}
