import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

// Simple welcome/splash screen shown on app launch while the DB initializes.
// Rendered as a fixed overlay so it can fade out over the app once ready.
export function Splash({ exiting = false }: { exiting?: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-600 text-white pt-safe pb-safe',
        'transition-opacity duration-500 ease-out',
        exiting ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex flex-col items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
        <div className="text-5xl">🏆</div>
        <h1 className="text-2xl font-bold tracking-tight">{t('splash.title')}</h1>
        <p className="text-sm text-white/80">{t('splash.tagline')}</p>
      </div>
    </div>
  );
}
