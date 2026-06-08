import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getAllTournaments, deleteTournament, type Tournament } from '@/db/tournaments';
import clsx from 'clsx';

const STATUS_LABEL: Record<string, string> = {
  registration:  'Registration',
  group_stage:   'Groups',
  knockout:      'Knockout',
  completed:     'Completed',
};

const STATUS_COLOR: Record<string, string> = {
  registration: 'bg-blue-100 text-blue-700',
  group_stage:  'bg-yellow-100 text-yellow-700',
  knockout:     'bg-orange-100 text-orange-700',
  completed:    'bg-green-100 text-green-700',
};

export function Home() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const load = () => getAllTournaments().then(setTournaments).catch(console.error);
  useEffect(() => { void load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tournament?')) return;
    await deleteTournament(id);
    void load();
  };

  return (
    <Layout
      title="SimpleKnockout"
      right={<Button variant="ghost" onClick={() => navigate('/tournament/new')}>+ New</Button>}
    >
      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-16 text-center">
          <p className="text-gray-500 text-sm">No tournaments yet.</p>
          <Button onClick={() => navigate('/tournament/new')}>Create Tournament</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <Card
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/tournament/${t.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.game} · {t.format === 'group_knockout' ? 'Groups + Knockout' : 'Straight Knockout'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLOR[t.status])}>
                  {STATUS_LABEL[t.status]}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDelete(t.id); }}
                  className="text-gray-400 text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
