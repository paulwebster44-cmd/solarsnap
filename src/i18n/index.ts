import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en';
import fr from './locales/fr';
import de from './locales/de';
import es from './locales/es';
import it from './locales/it';
import nl from './locales/nl';
import pl from './locales/pl';

/** The language code detected from the device OS. */
export const DEVICE_LANGUAGE = Localization.getLocales()[0]?.languageCode ?? 'en';

/** All languages supported by the app. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

i18next.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
    es: { translation: es },
    it: { translation: it },
    nl: { translation: nl },
    pl: { translation: pl },
  },
  lng: DEVICE_LANGUAGE,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18next;
