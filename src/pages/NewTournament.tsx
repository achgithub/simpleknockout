import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { createTournament, type TournamentFormat } from '@/db/tournaments';
import clsx from 'clsx';

export function NewTournament() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('straight_knockout');
  const [entrySize, setEntrySize] = useState(1);
  const [seeding, setSeeding] = useState<'random' | 'seeded'>('random');
  const [thirdPlace, setThirdPlace] = useState(false);
  const [advancementCount, setAdvancementCount] = useState(2);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const t = await createTournament({ name, game, format, entrySize, seeding, thirdPlacePlayoff: thirdPlace, advancementCount });
      navigate(`/tournament/${t.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <Layout title="New Tournament" back>
      <div className="flex flex-col gap-6">
        {/* Step 1: Basics */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Basics</h2>
          <input
            type="text"
            placeholder="Tournament name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder="Game (e.g. Pool, Darts, Table Tennis)"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        {/* Step 2: Format */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Format</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['straight_knockout', 'group_knockout'] as TournamentFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={clsx(
                  'rounded-xl border-2 py-3 px-2 text-sm font-medium text-center transition-colors',
                  format === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600',
                )}
              >
                {f === 'straight_knockout' ? 'Straight Knockout' : 'Groups + Knockout'}
              </button>
            ))}
          </div>
        </Card>

        {/* Step 3: Entry type */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Entry Type</h2>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setEntrySize(n)}
                className={clsx(
                  'rounded-xl border-2 py-3 text-sm font-medium transition-colors',
                  entrySize === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600',
                )}
              >
                {n === 1 ? 'Singles' : n === 2 ? 'Pairs' : 'Triples'}
              </button>
            ))}
          </div>
        </Card>

        {/* Step 4: Options */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Options</h2>

          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Seeding</span>
            <select
              value={seeding}
              onChange={(e) => setSeeding(e.target.value as 'random' | 'seeded')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="random">Random draw</option>
              <option value="seeded">Seeded</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">3rd place playoff</span>
            <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} className="w-5 h-5 rounded" />
          </label>

          {format === 'group_knockout' && (
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Advance per group</span>
              <select
                value={advancementCount}
                onChange={(e) => setAdvancementCount(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </label>
          )}
        </Card>

        <Button
          onClick={() => void create()}
          disabled={!name.trim() || !game.trim() || saving}
          fullWidth
        >
          {saving ? 'Creating…' : 'Create Tournament'}
        </Button>
      </div>
    </Layout>
  );
}
