import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  isActive: boolean;
  label: string;
};

function StatusBadge({ isActive, label }: Props) {
  const { backgrounds, borders, fonts, gutters } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = isActive
      ? withRepeat(
          withTiming(0.4, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true,
        )
      : 1;
  }, [isActive, pulse]);

  const animatedDot = useAnimatedStyle(() => ({
    opacity: isActive ? pulse.value : 0.3,
  }));

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={[
        gutters.paddingHorizontal_12,
        { paddingVertical: 4 },
        borders.rounded_16,
        isActive ? backgrounds.green500 : backgrounds.gray200,
        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
      ]}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: 6,
          },
          isActive ? backgrounds.green500 : backgrounds.gray400,
          animatedDot,
        ]}
      />
      <Text style={[fonts.size_12, isActive ? fonts.white : fonts.gray800]}>
        {label}
      </Text>
    </View>
  );
}

export default StatusBadge;
