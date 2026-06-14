import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  isActive: boolean;
  label: string;
};

function StatusBadge({ isActive, label }: Props) {
  const { backgrounds, borders, fonts, gutters, layout } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
    }
  }, [isActive, pulse]);

  const animatedDot = useAnimatedStyle(() => ({
    opacity: isActive ? pulse.value : 0.3,
  }));

  return (
    <View
      style={[
        gutters.paddingHorizontal_12,
        gutters.paddingVertical_4,
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
