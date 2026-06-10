import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePref = SupportedLanguage | 'auto';

export const LANGUAGE_KEY = 'sk_language';

export function detectDeviceLanguage(): SupportedLanguage {
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(nav) ? (nav as SupportedLanguage) : 'en';
}

function resolveInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(LANGUAGE_KEY) as LanguagePref | null;
  if (stored && stored !== 'auto' && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) return stored;
  return detectDeviceLanguage();
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
