import { useCallback } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import { useI18n } from '@/hooks';

function Settings() {
  const { t } = useTranslation();
  const { backgrounds, borders, fonts, gutters, layout, variant, changeTheme } =
    useTheme();
  const { toggleLanguage } = useI18n();
  const navigation = useNavigation();

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleTheme = useCallback(() => {
    changeTheme(variant === 'dark' ? 'default' : 'dark');
  }, [variant, changeTheme]);

  const handleToggleLanguage = useCallback(() => {
    toggleLanguage();
  }, [toggleLanguage]);

  return (
    <View style={[layout.flex_1, backgrounds.gray50]}>
      {/* Header */}
      <View
        style={[
          gutters.paddingHorizontal_24,
          gutters.paddingTop_16,
          gutters.paddingBottom_12,
          layout.row,
          layout.itemsCenter,
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={[gutters.padding_8, { marginRight: 12 }]}
        >
          <Text style={[fonts.size_20]}>←</Text>
        </TouchableOpacity>
        <Text style={[fonts.size_20, fonts.purple500, fonts.bold]}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={[gutters.padding_24]}>
        {/* Theme */}
        <TouchableOpacity
          onPress={handleToggleTheme}
          style={[
            gutters.padding_16,
            gutters.marginBottom_12,
            borders.rounded_12,
            backgrounds.white,
            layout.row,
            layout.justifyBetween,
            layout.itemsCenter,
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <View style={[layout.row, layout.itemsCenter]}>
            <Text style={[fonts.size_20, { marginRight: 12 }]}>
              {variant === 'dark' ? '🌙' : '☀️'}
            </Text>
            <View>
              <Text style={[fonts.size_16, fonts.gray800, fonts.bold]}>
                {t('airprint:settings.theme')}
              </Text>
              <Text style={[fonts.size_12, fonts.gray400]}>
                {variant === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
          </View>
          <Text style={[fonts.size_16, fonts.gray400]}>›</Text>
        </TouchableOpacity>

        {/* Language */}
        <TouchableOpacity
          onPress={handleToggleLanguage}
          style={[
            gutters.padding_16,
            gutters.marginBottom_12,
            borders.rounded_12,
            backgrounds.white,
            layout.row,
            layout.justifyBetween,
            layout.itemsCenter,
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <View style={[layout.row, layout.itemsCenter]}>
            <Text style={[fonts.size_20, { marginRight: 12 }]}>🌐</Text>
            <View>
              <Text style={[fonts.size_16, fonts.gray800, fonts.bold]}>
                {t('airprint:settings.language')}
              </Text>
              <Text style={[fonts.size_12, fonts.gray400]}>
                English / Français
              </Text>
            </View>
          </View>
          <Text style={[fonts.size_16, fonts.gray400]}>›</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View
          style={[
            gutters.padding_16,
            borders.rounded_12,
            backgrounds.white,
            layout.row,
            layout.justifyBetween,
            layout.itemsCenter,
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <View style={[layout.row, layout.itemsCenter]}>
            <Text style={[fonts.size_20, { marginRight: 12 }]}>ℹ️</Text>
            <View>
              <Text style={[fonts.size_16, fonts.gray800, fonts.bold]}>
                {t('airprint:settings.version')}
              </Text>
              <Text style={[fonts.size_12, fonts.gray400]}>
                1.0.0
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default Settings;
