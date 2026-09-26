import type { Language } from '@/hooks/language/schema';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getSavedLanguage } from '@/hooks/language/useI18n';

import en from './en-EN.json';
import fr from './fr-FR.json';
import vi from './vi-VN.json';

export const defaultNS = 'printdock' as const;

export const resources = {
  'en-EN': en,
  'fr-FR': fr,
  'vi-VN': vi,
} as const satisfies Record<Language, unknown>;

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  defaultNS,
  fallbackLng: 'en-EN',
  lng: getSavedLanguage(),
  resources,
});

i18n.services.formatter?.add(
  'capitalize',
  (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
);

export default i18n;
