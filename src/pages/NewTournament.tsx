import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { createTournament, type TournamentFormat } from '@/db/tournaments';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';
import clsx from 'clsx';

export function NewTournament() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showAd } = useInterstitialAd();
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
      await showAd();
      navigate(`/tournament/${t.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <Layout title={t('newTournament.title')} back>
      <div className="flex flex-col gap-6">
        {/* Step 1: Basics */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('newTournament.basics')}</h2>
          <input
            type="text"
            placeholder={t('common.tournamentNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder={t('newTournament.gamePlaceholder')}
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        {/* Step 2: Format */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('newTournament.format')}</h2>
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
                {f === 'straight_knockout' ? t('common.format.straightKnockout') : t('common.format.groupKnockout')}
              </button>
            ))}
          </div>
        </Card>

        {/* Step 3: Entry type */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('newTournament.entryType')}</h2>
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
                {n === 1 ? t('common.entrySize.singles') : n === 2 ? t('common.entrySize.pairs') : t('common.entrySize.triples')}
              </button>
            ))}
          </div>
        </Card>

        {/* Step 4: Options */}
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('newTournament.options')}</h2>

          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('newTournament.seeding')}</span>
            <select
              value={seeding}
              onChange={(e) => setSeeding(e.target.value as 'random' | 'seeded')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="random">{t('newTournament.randomDraw')}</option>
              <option value="seeded">{t('newTournament.seeded')}</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('newTournament.thirdPlacePlayoff')}</span>
            <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} className="w-5 h-5 rounded" />
          </label>

          {format === 'group_knockout' && (
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{t('newTournament.advancePerGroup')}</span>
              <select
                value={advancementCount}
                onChange={(e) => setAdvancementCount(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{t('newTournament.topN', { count: n })}</option>
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
          {saving ? t('newTournament.creating') : t('newTournament.createTournament')}
        </Button>
      </div>
    </Layout>
  );
}
