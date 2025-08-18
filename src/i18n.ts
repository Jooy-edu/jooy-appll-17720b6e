import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Add cache-busting timestamp to force fresh translation loads
const CACHE_BUSTER = Date.now();

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ar', // Arabic as default
    lng: 'ar', // Set Arabic as the initial language
    debug: true,

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    backend: {
      // Add cache-busting parameter to ensure fresh translation files
      loadPath: `/locales/{{lng}}.json?v=${CACHE_BUSTER}`,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;