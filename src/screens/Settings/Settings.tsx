import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { useI18n } from '@/hooks';
import { SupportedLanguages } from '@/hooks/language/schema';

import SafeScreen from '@/components/templates/SafeScreen/SafeScreen';

import { BrandMark, DeveloperBrand } from '@/design/Brand';
import {
  AppText,
  ChoiceRow,
  IconButton,
  Notice,
  Surface,
} from '@/design/components';
import { usePalette } from '@/design/tokens';

import packageInfo from '../../../package.json';

export default function Settings() {
  const { t } = useTranslation();
  const { variant, changeTheme } = useTheme();
  const { language, changeLanguage } = useI18n();
  const palette = usePalette();
  const navigation = useNavigation();
  return (
    <SafeScreen style={{ backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <IconButton
            icon="arrowLeft"
            label={t('settings.back')}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.flex}>
            <AppText accessibilityRole="header" variant="title">
              {t('settings.title')}
            </AppText>
            <AppText style={{ color: palette.muted }} variant="caption">
              {t('settings.subtitle')}
            </AppText>
          </View>
        </View>

        <Surface>
          <View style={styles.sectionIntro}>
            <AppText accessibilityRole="header" variant="heading">
              {t('settings.theme')}
            </AppText>
            <AppText style={{ color: palette.muted }} variant="caption">
              {t('settings.appearance_hint')}
            </AppText>
          </View>
          <ChoiceRow
            icon="sun"
            label={t('settings.light')}
            onPress={() => changeTheme('default')}
            selected={variant !== 'dark'}
          />
          <ChoiceRow
            icon="moon"
            label={t('settings.dark')}
            onPress={() => changeTheme('dark')}
            selected={variant === 'dark'}
          />
        </Surface>

        <Surface>
          <View style={styles.sectionIntro}>
            <AppText accessibilityRole="header" variant="heading">
              {t('settings.language')}
            </AppText>
            <AppText style={{ color: palette.muted }} variant="caption">
              {t('settings.language_hint')}
            </AppText>
          </View>
          <ChoiceRow
            label="Tiếng Việt"
            onPress={() => changeLanguage(SupportedLanguages.VI_VN)}
            selected={language === SupportedLanguages.VI_VN}
          />
          <ChoiceRow
            label="English"
            onPress={() => changeLanguage(SupportedLanguages.EN_EN)}
            selected={language === SupportedLanguages.EN_EN}
          />
          <ChoiceRow
            label="Français"
            onPress={() => changeLanguage(SupportedLanguages.FR_FR)}
            selected={language === SupportedLanguages.FR_FR}
          />
        </Surface>

        <Surface>
          <View style={styles.header}>
            <BrandMark size={56} />
            <View style={styles.flex}>
              <AppText variant="heading">{t('app_name')}</AppText>
              <AppText style={{ color: palette.muted }} variant="caption">
                {t('settings.version')} {packageInfo.version}
                {__DEV__ ? ` · ${t('settings.development_build')}` : ''}
              </AppText>
            </View>
          </View>
          <AppText variant="heading">{t('settings.about')}</AppText>
          <AppText style={{ color: palette.muted }}>
            {t('settings.about_description')}
          </AppText>
          <View style={[styles.developer, { borderTopColor: palette.border }]}>
            <AppText style={{ color: palette.muted }} variant="eyebrow">
              {t('settings.developer')}
            </AppText>
            <DeveloperBrand />
          </View>
          <AppText style={{ color: palette.muted }} variant="caption">
            {t('settings.protocol_note')}
          </AppText>
        </Surface>
        <Notice title={t('home.network_safety')}>
          {t('home.network_safety_detail')}
        </Notice>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 32,
    gap: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIntro: { gap: 4 },
  developer: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
});
