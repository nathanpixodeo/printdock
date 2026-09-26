import type { Language } from './schema';

import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

import { languageSchema, SupportedLanguages } from './schema';
import { storage } from './storage';

const LANGUAGE_KEY = 'app.language';

const changeLanguage = (lang: Language): void => {
  storage.set(LANGUAGE_KEY, lang);
  void i18next.changeLanguage(lang);
};

const toggleLanguage = (): void => {
  const languages = Object.values(SupportedLanguages);
  const currentIndex = languages.indexOf(i18next.language as Language);
  const nextIndex =
    currentIndex < 0 ? 0 : (currentIndex + 1) % languages.length;
  changeLanguage(languages[nextIndex]!);
};

export const useI18n = () => {
  const { i18n } = useTranslation();
  const parsedLanguage = languageSchema.safeParse(i18n.language);
  const language = parsedLanguage.success
    ? parsedLanguage.data
    : SupportedLanguages.EN_EN;

  return {
    language,
    /** Alias for language, representing the active i18next language. */
    currentLanguage: language,
    changeLanguage,
    toggleLanguage,
  };
};

export function getSavedLanguage(): Language {
  const saved = storage.getString(LANGUAGE_KEY);
  const parsedLanguage = languageSchema.safeParse(saved);
  return parsedLanguage.success
    ? parsedLanguage.data
    : SupportedLanguages.EN_EN;
}
