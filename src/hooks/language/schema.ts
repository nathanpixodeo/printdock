import { z } from 'zod';

export const SupportedLanguages = {
  EN_EN: 'en-EN',
  FR_FR: 'fr-FR',
} as const;

export const languageSchema = z.enum([
  SupportedLanguages.EN_EN,
  SupportedLanguages.FR_FR,
]);

export type Language = z.infer<typeof languageSchema>;
