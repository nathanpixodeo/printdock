import type { SupportedLanguages } from '@/hooks/language/schema';
import type { defaultNS, resources } from '@/translations';

type defaultTranslations = (typeof resources)[typeof SupportedLanguages.EN_EN];

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: defaultTranslations;
  }
}
