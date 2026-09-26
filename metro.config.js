const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    unstable_allowRequireContext: true,
  },
  resolver: {
    // Build evidence and temporary toolchains are not application sources.
    blockList: [/[/\\]artifacts[/\\].*/, /[/\\]coverage[/\\].*/],
    sourceExts: [...sourceExts, 'svg'],
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
  },
};

module.exports = mergeConfig(defaultConfig, config);
