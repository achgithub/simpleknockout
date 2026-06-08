import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getTournament, updateTournamentSettings, deleteTournament, type Tournament } from '@/db/tournaments';
import { Capacitor } from '@capacitor/core';

export function Settings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
    if (!id || !confirm('Delete this tournament? This cannot be undone.')) return;
    await deleteTournament(id);
    navigate('/', { replace: true });
  };

  const exportDb = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('DB export is only available on device.');
      return;
    }
    // PLACEHOLDER: export SQLite DB file via Capacitor Share plugin.
    // import { Share } from '@capacitor/share';
    // const dbPath = `Library/CapacitorDatabase/simpleknockout.db`;
    // await Share.share({ title: 'simpleknockout.db', url: dbPath });
    alert('Export: wire up @capacitor/share pointing to the SQLite DB file.');
  };

  if (!tournament) return null;

  return (
    <Layout title="Settings" back>
      <div className="flex flex-col gap-4">
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Tournament</h2>
          <input
            type="text"
            placeholder="Tournament name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Telegram</h2>
          <p className="text-xs text-gray-500">Create a bot via @BotFather, add it to your channel as admin, then paste the credentials below.</p>
          <input
            type="text"
            placeholder="Bot token (123456:ABC-...)"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder="Channel ID (e.g. @mychannel or -100123456789)"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        <Button onClick={() => void save()} disabled={saving} fullWidth>
          {saving ? 'Saving…' : 'Save'}
        </Button>

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Data</h2>
          <Button variant="secondary" onClick={() => void exportDb()} fullWidth>
            Export Database
          </Button>
        </Card>

        <Button variant="danger" onClick={() => void handleDelete()} fullWidth>
          Delete Tournament
        </Button>
      </div>
    </Layout>
  );
}
