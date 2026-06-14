import { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { IconByVariant } from '@/components/atoms';

type Props = {
  onReset?: () => void;
};

function DefaultErrorScreen({ onReset }: Props) {
  const { gutters, layout, colors, fonts } = useTheme();
  const { t } = useTranslation();
  const { resetBoundary } = useErrorBoundary();

  const handleReset = useCallback(() => {
    resetBoundary();
    onReset?.();
  }, [onReset, resetBoundary]);

  return (
    <View
      style={[
        layout.flex_1,
        layout.justifyCenter,
        layout.itemsCenter,
        gutters.gap_16,
        gutters.padding_16,
      ]}
    >
      <IconByVariant
        height={42}
        path="fire"
        stroke={colors.red500}
        width={42}
      />
      <Text style={[fonts.gray800, fonts.bold, fonts.size_16]}>
        {t('airprint:error_boundary.title')}
      </Text>
      <Text style={[fonts.gray800, fonts.size_12, fonts.alignCenter]}>
        {t('airprint:error_boundary.description')}
      </Text>

      <TouchableOpacity onPress={handleReset}>
        <Text style={[fonts.gray800, fonts.size_16]}>
          {t('airprint:error_boundary.cta')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default DefaultErrorScreen;
