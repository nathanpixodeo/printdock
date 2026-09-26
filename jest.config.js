module.exports = {
  preset: '@testing-library/react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: [
    './node_modules/react-native-gesture-handler/jestSetup.js',
    '<rootDir>/jest.setup.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@react-navigation|@react-native-picker)',
  ],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/*.test.{ts,tsx}',
    '!<rootDir>/src/**/index.ts',
    '!<rootDir>/src/theme/assets/**',
    '!<rootDir>/src/reactotron.config.ts',
  ],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'text', 'text-summary', 'cobertura'],
  testMatch: ['**/*.test.{ts,tsx,js,jsx}'],
};
