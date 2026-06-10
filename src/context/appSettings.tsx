import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import i18n from '@/i18n';
import { LANGUAGE_KEY, detectDeviceLanguage, type LanguagePref } from '@/i18n';

export type FontScale = 'normal' | 'large' | 'xl';

interface AppSettingsCtx {
  fontScale: FontScale;
  setFontScale: (f: FontScale) => void;
  language: LanguagePref;
  setLanguage: (l: LanguagePref) => void;
}

const Ctx = createContext<AppSettingsCtx | null>(null);

const FS_KEY = 'sk_fontScale';

const FS_PX: Record<FontScale, string> = {
  normal: '16px',
  large:  '18px',
  xl:     '20px',
};

function applyScale(fs: FontScale) {
  document.documentElement.style.fontSize = FS_PX[fs];
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(
    () => (localStorage.getItem(FS_KEY) as FontScale) ?? 'normal',
  );
  const [language, setLanguageState] = useState<LanguagePref>(
    () => (localStorage.getItem(LANGUAGE_KEY) as LanguagePref) ?? 'auto',
  );

  useEffect(() => { applyScale(fontScale); }, [fontScale]);

  function setFontScale(fs: FontScale) {
    localStorage.setItem(FS_KEY, fs);
    setFontScaleState(fs);
    applyScale(fs);
  }

  function setLanguage(l: LanguagePref) {
    localStorage.setItem(LANGUAGE_KEY, l);
    setLanguageState(l);
    void i18n.changeLanguage(l === 'auto' ? detectDeviceLanguage() : l);
  }

  return <Ctx.Provider value={{ fontScale, setFontScale, language, setLanguage }}>{children}</Ctx.Provider>;
}

export function useAppSettings(): AppSettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppSettings outside AppSettingsProvider');
  return ctx;
}
