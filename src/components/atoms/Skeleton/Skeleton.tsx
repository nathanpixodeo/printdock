import type { DimensionValue, ViewProps } from 'react-native';

import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = ViewProps & {
  height?: DimensionValue;
  loading?: boolean;
  width?: DimensionValue;
};

const FROM = 0.2;
const TO = 1;
const DURATION = 800;

function SkeletonLoader({
  children,
  height = 24,
  loading = false,
  width = '100%',
  ...props
}: Props) {
  const { backgrounds, borders } = useTheme();
  const opacity = useSharedValue(FROM);
  const isAnimating = useRef(false);

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (loading && !isAnimating.current) {
      isAnimating.current = true;
      opacity.value = withRepeat(
        withTiming(TO, { duration: DURATION }),
        -1,
        true,
      );
    }

    if (!loading) {
      isAnimating.current = false;
    }
  }, [loading, opacity]);

  return (
    <View
      {...props}
      style={[{ minHeight: height, minWidth: width }, props.style]}
    >
      {loading ? (
        <Animated.View
          style={[
            animatedStyles,
            backgrounds.skeleton,
            borders.rounded_4,
            { height, width },
            props.style,
          ]}
          testID="skeleton-loader"
        />
      ) : (
        children
      )}
    </View>
  );
}

export default SkeletonLoader;
