import { act, fireEvent, render } from '@testing-library/react-native';
import { MMKV } from 'react-native-mmkv';

import { ThemeProvider } from '@/theme';
import { SupportedLanguages } from '@/hooks/language/schema';
import { storage as languageStorage } from '@/hooks/language/storage';
import i18n from '@/translations';

import Settings from './Settings';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

function renderSettings(initialTheme: 'default' | 'dark' = 'default') {
  const themeStorage = new MMKV();
  themeStorage.set('theme', initialTheme);
  return {
    screen: render(
      <ThemeProvider storage={themeStorage}>
        <Settings />
      </ThemeProvider>,
    ),
    themeStorage,
  };
}

function checked(screen: ReturnType<typeof render>, name: string): boolean {
  return screen.getByRole('radio', { name }).props.accessibilityState.checked;
}

describe('Settings choices', () => {
  beforeEach(async () => {
    mockGoBack.mockClear();
    languageStorage.delete('app.language');
    await i18n.changeLanguage(SupportedLanguages.EN_EN);
  });

  it('offers explicit light and dark radio choices and changes their checked state', () => {
    const { screen, themeStorage } = renderSettings();
    expect(checked(screen, 'Light')).toBe(true);
    expect(checked(screen, 'Dark')).toBe(false);

    fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(checked(screen, 'Light')).toBe(false);
    expect(checked(screen, 'Dark')).toBe(true);
    expect(themeStorage.getString('theme')).toBe('dark');

    fireEvent.press(screen.getByRole('radio', { name: 'Light' }));
    expect(checked(screen, 'Light')).toBe(true);
    expect(checked(screen, 'Dark')).toBe(false);
    expect(themeStorage.getString('theme')).toBe('default');
  });

  it('reflects an initially dark theme', () => {
    const { screen } = renderSettings('dark');
    expect(checked(screen, 'Dark')).toBe(true);
    expect(checked(screen, 'Light')).toBe(false);
  });

  it('offers English, French, and Vietnamese radio choices with one checked', async () => {
    const { screen } = renderSettings();
    const languages = ['English', 'Français', 'Tiếng Việt'];
    expect(languages.map((name) => checked(screen, name))).toEqual([
      true,
      false,
      false,
    ]);

    for (const [name, language] of [
      ['Français', SupportedLanguages.FR_FR],
      ['Tiếng Việt', SupportedLanguages.VI_VN],
      ['English', SupportedLanguages.EN_EN],
    ] as const) {
      await act(async () => {
        fireEvent.press(screen.getByRole('radio', { name }));
      });
      expect(languages.map((choice) => checked(screen, choice))).toEqual(
        languages.map((choice) => choice === name),
      );
      expect(i18n.language).toBe(language);
      expect(languageStorage.getString('app.language')).toBe(language);
    }
  });

  it('has an accessible Back button and Nexkit developer label', () => {
    const { screen } = renderSettings();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Nexkit')).toBeTruthy();
  });
});
