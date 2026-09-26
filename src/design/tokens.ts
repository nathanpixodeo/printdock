import { useTheme } from '@/theme';

export const lightPalette = {
  background: '#F5F8F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EAF1EE',
  text: '#132F3A',
  muted: '#50666D',
  border: '#D5E1DC',
  controlBorder: '#6A827A',
  primary: '#087F70',
  onPrimary: '#FFFFFF',
  primarySoft: '#E0F4ED',
  danger: '#AC303D',
  dangerSoft: '#FFF0F1',
  hero: '#102E3A',
  onHero: '#FFFFFF',
  heroMuted: '#B8D1D7',
  heroAccent: '#66E2C6',
} as const;

export const darkPalette = {
  background: '#0A1E28',
  surface: '#132F3A',
  surfaceMuted: '#1B3A45',
  text: '#F0F7F4',
  muted: '#B2C8CB',
  border: '#36535D',
  controlBorder: '#709890',
  primary: '#66E2C6',
  onPrimary: '#102E3A',
  primarySoft: '#1B423F',
  danger: '#FFABB2',
  dangerSoft: '#482D36',
  hero: '#102E3A',
  onHero: '#FFFFFF',
  heroMuted: '#B8D1D7',
  heroAccent: '#66E2C6',
} as const;

export type Palette = { [K in keyof typeof lightPalette]: string };

export function usePalette(): Palette {
  const { variant } = useTheme();
  return variant === 'dark' ? darkPalette : lightPalette;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
};

export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  eyebrow: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
} as const;
