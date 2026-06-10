import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAppSettings, type FontScale } from '@/context/appSettings';
import { type LanguagePref } from '@/i18n';
import { getAllTournaments, type Tournament } from '@/db/tournaments';
import { exportUsers, importUsers, pickXlsxFile } from '@/lib/userExport';
import { exportKnockout, importKnockout, pickJsonFile } from '@/lib/knockoutExport';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';
import clsx from 'clsx';

const APP_VERSION = '0.1.0';

const FONT_OPTIONS: { key: FontScale; labelKey: string; subKey: string }[] = [
  { key: 'normal', labelKey: 'appSettings.fontScale.normal', subKey: 'appSettings.fontScale.normalSub' },
  { key: 'large',  labelKey: 'appSettings.fontScale.large',  subKey: 'appSettings.fontScale.largeSub' },
  { key: 'xl',     labelKey: 'appSettings.fontScale.xl',     subKey: 'appSettings.fontScale.xlSub' },
];

const LANGUAGE_OPTIONS: { key: LanguagePref; labelKey: string; subKey?: string }[] = [
  { key: 'auto', labelKey: 'appSettings.languageOptions.auto', subKey: 'appSettings.languageOptions.autoSub' },
  { key: 'en',   labelKey: 'appSettings.languageOptions.en' },
  { key: 'es',   labelKey: 'appSettings.languageOptions.es' },
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function AppSettings() {
  const { fontScale, setFontScale, language, setLanguage } = useAppSettings();
  const { t } = useTranslation();
  const navigate    = useNavigate();
  const { showAd }  = useInterstitialAd();
  const [tapCount, setTapCount]   = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Knockouts section
  const [tournaments, setTournaments]   = useState<Tournament[]>([]);
  const [selectedTId, setSelectedTId]  = useState('');
  const [busy, setBusy]                = useState<string | null>(null); // which op is running

  useEffect(() => {
    getAllTournaments().then((all) => {
      const knockouts = all.filter((t) => t.status === 'knockout' || t.status === 'completed');
      setTournaments(knockouts);
      if (knockouts.length) setSelectedTId(knockouts[0]!.id);
    });
  }, []);

  function handleVersionTap() {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    const next = tapCount + 1;
    if (next >= 7) { setTapCount(0); navigate('/diagnostics'); }
    else { setTapCount(next); tapTimer.current = setTimeout(() => setTapCount(0), 2000); }
  }

  // ── Users export / import ──────────────────────────────────────────────────

  const handleExportUsers = async () => {
    setBusy('exportUsers');
    try { await exportUsers(); } catch (e) { alert((e as Error).message); }
    setBusy(null);
  };

  const handleImportUsers = async () => {
    setBusy('importUsers');
    try {
      const file = await pickXlsxFile();
      const { added } = await importUsers(file);
      await showAd();
      alert(t('appSettings.importedPlayers', { count: added }));
    } catch (e) {
      if ((e as Error).message !== 'No file selected') alert((e as Error).message);
    }
    setBusy(null);
  };

  // ── Knockout export / import ───────────────────────────────────────────────

  const handleExportKnockout = async () => {
    if (!selectedTId) return;
    setBusy('exportKO');
    try { await exportKnockout(selectedTId); } catch (e) { alert((e as Error).message); }
    setBusy(null);
  };

  const handleImportKnockout = async () => {
    setBusy('importKO');
    try {
      const json = await pickJsonFile();
      const imported = await importKnockout(json);
      alert(t('appSettings.importedKnockout', { name: imported.name }));
      navigate(`/tournament/${imported.id}/bracket`);
    } catch (e) {
      if ((e as Error).message !== 'No file selected') alert((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <Layout title={t('settings.title')}>
      <div className="flex flex-col gap-4">

        {/* Text size */}
        <Card className="p-0 overflow-hidden">
          <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 pt-4 pb-2">{t('appSettings.textSize')}</p>
          {FONT_OPTIONS.map((opt, i) => {
            const active = fontScale === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFontScale(opt.key)}
                className={clsx(
                  'w-full flex items-center px-4 py-3 gap-3 text-left active:bg-gray-50',
                  i < FONT_OPTIONS.length - 1 && 'border-b border-gray-100',
                )}
              >
                <div className="flex-1">
                  <p className={clsx('text-sm', active ? 'font-semibold text-brand-600' : 'text-gray-900')}>{t(opt.labelKey)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t(opt.subKey)}</p>
                </div>
                {active && <span className="text-brand-600"><CheckIcon /></span>}
              </button>
            );
          })}
        </Card>

        {/* Language */}
        <Card className="p-0 overflow-hidden">
          <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 pt-4 pb-2">{t('appSettings.language')}</p>
          {LANGUAGE_OPTIONS.map((opt, i) => {
            const active = language === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setLanguage(opt.key)}
                className={clsx(
                  'w-full flex items-center px-4 py-3 gap-3 text-left active:bg-gray-50',
                  i < LANGUAGE_OPTIONS.length - 1 && 'border-b border-gray-100',
                )}
              >
                <div className="flex-1">
                  <p className={clsx('text-sm', active ? 'font-semibold text-brand-600' : 'text-gray-900')}>{t(opt.labelKey)}</p>
                  {opt.subKey && <p className="text-xs text-gray-500 mt-0.5">{t(opt.subKey)}</p>}
                </div>
                {active && <span className="text-brand-600"><CheckIcon /></span>}
              </button>
            );
          })}
          <p className="text-xs text-gray-400 px-4 pb-4 pt-2">{t('appSettings.translationNotice')}</p>
        </Card>

        {/* Players */}
        <Card className="p-0 overflow-hidden">
          <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 pt-4 pb-2">{t('appSettings.playersSection')}</p>
          <div className="px-4 pb-4 flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleExportUsers()}
              disabled={busy === 'exportUsers'}
            >
              {busy === 'exportUsers' ? t('common.exporting') : t('appSettings.exportPlayers')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleImportUsers()}
              disabled={busy === 'importUsers'}
            >
              {busy === 'importUsers' ? t('common.importing') : t('appSettings.importPlayers')}
            </Button>
          </div>
        </Card>

        {/* Knockouts */}
        <Card className="p-0 overflow-hidden">
          <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide px-4 pt-4 pb-2">{t('appSettings.knockoutsSection')}</p>
          <div className="px-4 pb-4 flex flex-col gap-2">
            {tournaments.length > 0 ? (
              <>
                <select
                  value={selectedTId}
                  onChange={(e) => setSelectedTId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>{tournament.name} — {tournament.game}</option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => void handleExportKnockout()}
                  disabled={busy === 'exportKO' || !selectedTId}
                >
                  {busy === 'exportKO' ? t('common.exporting') : t('appSettings.shareKnockoutJson')}
                </Button>
              </>
            ) : (
              <p className="text-xs text-gray-400 pb-1">{t('appSettings.noKnockoutTournaments')}</p>
            )}
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleImportKnockout()}
              disabled={busy === 'importKO'}
            >
              {busy === 'importKO' ? t('common.importing') : t('appSettings.importKnockout')}
            </Button>
          </div>
        </Card>

        {/* Version */}
        <button onClick={handleVersionTap} className="text-center py-6 active:opacity-70 select-none">
          <p className="text-xs text-gray-400">{t('appSettings.version', { version: APP_VERSION })}</p>
          {tapCount === 6 && <p className="text-xs text-brand-500 mt-1">{t('appSettings.oneMoreTap')}</p>}
        </button>

      </div>
    </Layout>
  );
}
