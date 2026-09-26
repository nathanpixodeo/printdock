import { Image, StyleSheet, View } from 'react-native';

import nexkitLogo from '@/theme/assets/brand/nexkit-logo.png';
import printDockMark from '@/theme/assets/brand/printdock-mark.png';

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <View
      accessible={false}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <Image
        accessible={false}
        resizeMode="contain"
        source={printDockMark}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

export function DeveloperBrand() {
  return (
    <View style={styles.developer}>
      <Image
        accessibilityLabel="Nexkit"
        resizeMode="contain"
        source={nexkitLogo}
        style={styles.wordmark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: '#102E3A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  developer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  wordmark: { width: 120, height: 40 },
});
