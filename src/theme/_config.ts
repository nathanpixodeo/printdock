import type { ThemeConfiguration } from '@/theme/types/config';

import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const enum Variant {
  DARK = 'dark',
}

const colorsLight = {
  skeleton: '#A1A1A1',
  red500: '#C13333',
  green500: '#22C55E',
  gray800: '#132F3A',
  gray400: '#50666D',
  gray200: '#A1A1A1',
  gray100: '#DFDFDF',
  gray50: '#F5F8F7',
  purple500: '#087F70',
  purple100: '#E0F4ED',
  purple50: '#102E3A',
  white: '#FFFFFF',
} as const;

const colorsDark = {
  skeleton: '#303030',
  red500: '#C13333',
  green500: '#22C55E',
  gray800: '#F0F7F4',
  gray400: '#B2C8CB',
  gray200: '#BABABA',
  gray100: '#000000',
  gray50: '#0A1E28',
  purple500: '#66E2C6',
  purple100: '#1B423F',
  purple50: '#0A1E28',
  white: '#132F3A',
} as const;

const sizes = [4, 8, 12, 14, 16, 18, 20, 24, 32, 40, 80] as const;

export const config = {
  colors: colorsLight,
  fonts: {
    sizes,
    colors: colorsLight,
  },
  gutters: sizes,
  backgrounds: colorsLight,
  borders: {
    widths: [1, 2],
    radius: [4, 8, 12, 16],
    colors: colorsLight,
  },
  navigationColors: {
    ...DefaultTheme.colors,
    background: colorsLight.gray50,
    card: colorsLight.gray50,
  },
  variants: {
    dark: {
      colors: colorsDark,
      fonts: {
        colors: colorsDark,
      },
      backgrounds: colorsDark,
      navigationColors: {
        ...DarkTheme.colors,
        background: colorsDark.purple50,
        card: colorsDark.purple50,
      },
      borders: {
        colors: colorsDark,
      },
    },
  },
} as const satisfies ThemeConfiguration;
