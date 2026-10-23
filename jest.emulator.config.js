// Firestore rules and adapter tests against the emulator: `npm run test:emulator`.
const { transform } = require('jest-expo/node/jest-preset');

module.exports = {
  testEnvironment: 'node',
  // jest-expo only compiles TypeScript here; modules resolve as in plain Node.
  transform,
  testMatch: ['<rootDir>/**/*.emulator.test.ts'],
  moduleNameMapper: {
    // React Native Firebase's modular API mirrors the web SDK: adapters run on it against the emulator.
    '^@react-native-firebase/firestore$': 'firebase/firestore',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
};
