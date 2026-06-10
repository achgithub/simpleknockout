import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getTournament, updateTournamentSettings, deleteTournament, type Tournament } from '@/db/tournaments';
import { Capacitor } from '@capacitor/core';

export function Settings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTournament(id).then((t) => {
      if (!t) return;
      setTournament(t);
      setName(t.name);
      setChannelId(t.telegramChannelId ?? '');
      setBotToken(t.telegramBotToken ?? '');
    });
  }, [id]);

  const save = async () => {
    if (!id || saving) return;
    setSaving(true);
    await updateTournamentSettings(id, {
      name: name.trim() || undefined,
      telegramChannelId: channelId.trim() || null,
      telegramBotToken:  botToken.trim() || null,
    });
    setSaving(false);
    navigate(-1);
  };

  const handleDelete = async () => {
    if (!id || !confirm(t('settings.confirmDelete'))) return;
    await deleteTournament(id);
    navigate('/', { replace: true });
  };

  const exportDb = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert(t('settings.exportNativeOnly'));
      return;
    }
    // PLACEHOLDER: export SQLite DB file via Capacitor Share plugin.
    // import { Share } from '@capacitor/share';
    // const dbPath = `Library/CapacitorDatabase/simpleknockout.db`;
    // await Share.share({ title: 'simpleknockout.db', url: dbPath });
    alert(t('settings.exportPlaceholder'));
  };

  if (!tournament) return null;

  return (
    <Layout title={t('settings.title')} back>
      <div className="flex flex-col gap-4">
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('settings.tournament')}</h2>
          <input
            type="text"
            placeholder={t('common.tournamentNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('settings.telegram')}</h2>
          <p className="text-xs text-gray-500">{t('settings.telegramDescription')}</p>
          <input
            type="text"
            placeholder={t('settings.botTokenPlaceholder')}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder={t('settings.channelIdPlaceholder')}
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        <Button onClick={() => void save()} disabled={saving} fullWidth>
          {saving ? t('common.saving') : t('common.save')}
        </Button>

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{t('settings.data')}</h2>
          <Button variant="secondary" onClick={() => void exportDb()} fullWidth>
            {t('settings.exportDatabase')}
          </Button>
        </Card>

        <Button variant="danger" onClick={() => void handleDelete()} fullWidth>
          {t('settings.deleteTournament')}
        </Button>
      </div>
    </Layout>
  );
}
