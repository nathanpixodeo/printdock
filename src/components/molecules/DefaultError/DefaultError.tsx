import { useErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText } from '@/design/components';
import { Icon } from '@/design/Icon';
import { usePalette } from '@/design/tokens';

export default function DefaultErrorScreen({
  onReset,
}: {
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const { resetBoundary } = useErrorBoundary();
  const palette = usePalette();
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Icon color={palette.danger} name="alert" size={40} />
      <AppText accessibilityRole="header" style={styles.center} variant="title">
        {t('error_boundary.title')}
      </AppText>
      <AppText style={[styles.center, { color: palette.muted }]}>
        {t('error_boundary.description')}
      </AppText>
      <AppButton
        icon="refresh"
        label={t('error_boundary.cta')}
        onPress={() => {
          resetBoundary();
          onReset?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  center: { textAlign: 'center' },
});
