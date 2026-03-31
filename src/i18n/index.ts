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

const languageCode = Localization.getLocales()[0]?.languageCode ?? 'en';

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
  lng: languageCode,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18next;
