import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import i18n from '@/translations';

import { SupportedLanguages } from './schema';
import { storage } from './storage';
import { getSavedLanguage, useI18n } from './useI18n';

const LANGUAGE_KEY = 'app.language';

function LanguageProbe() {
  const { language, currentLanguage, changeLanguage, toggleLanguage } =
    useI18n();

  return (
    <>
      <Text testID="language">{language}</Text>
      <Text testID="current-language">{currentLanguage}</Text>
      <Text onPress={() => changeLanguage(SupportedLanguages.VI_VN)}>
        Select Vietnamese
      </Text>
      <Text onPress={toggleLanguage}>Toggle language</Text>
    </>
  );
}

describe('useI18n', () => {
  beforeEach(async () => {
    storage.delete(LANGUAGE_KEY);
    await i18n.changeLanguage(SupportedLanguages.EN_EN);
  });

  it('defaults missing and invalid preferences to English and restores saved languages', () => {
    expect(getSavedLanguage()).toBe(SupportedLanguages.EN_EN);

    storage.set(LANGUAGE_KEY, 'invalid');
    expect(getSavedLanguage()).toBe(SupportedLanguages.EN_EN);

    storage.set(LANGUAGE_KEY, SupportedLanguages.FR_FR);
    expect(getSavedLanguage()).toBe(SupportedLanguages.FR_FR);

    storage.set(LANGUAGE_KEY, SupportedLanguages.VI_VN);
    expect(getSavedLanguage()).toBe(SupportedLanguages.VI_VN);
  });

  it('reactively exposes the current language and persists explicit selection', async () => {
    const { getByTestId, getByText } = render(<LanguageProbe />);
    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.EN_EN,
    );

    await act(async () => {
      getByText('Select Vietnamese').props.onPress();
    });

    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.VI_VN,
    );
    expect(getByTestId('current-language').props.children).toBe(
      SupportedLanguages.VI_VN,
    );
    expect(storage.getString(LANGUAGE_KEY)).toBe(SupportedLanguages.VI_VN);
  });

  it('cycles through English, French, and Vietnamese', async () => {
    const { getByTestId, getByText } = render(<LanguageProbe />);

    await act(async () => getByText('Toggle language').props.onPress());
    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.FR_FR,
    );

    await act(async () => getByText('Toggle language').props.onPress());
    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.VI_VN,
    );

    await act(async () => getByText('Toggle language').props.onPress());
    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.EN_EN,
    );
  });

  it('updates when i18next changes language outside the hook', async () => {
    const { getByTestId } = render(<LanguageProbe />);

    await act(async () => {
      await i18n.changeLanguage(SupportedLanguages.FR_FR);
    });

    expect(getByTestId('language').props.children).toBe(
      SupportedLanguages.FR_FR,
    );
  });
});
