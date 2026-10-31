import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;

// react-native-health-connect adds the rationale screen to the manifest, not the permission: without it the system shows no dialog.
test('the app declares the permission to read the steps from Health Connect', () => {
  expect(config.android.permissions).toContain('android.permission.health.READ_STEPS');
  expect(config.plugins).toContain('react-native-health-connect');
});

test('Health Connect needs Android 8 or later', () => {
  const build = config.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties');
  expect(build[1].android.minSdkVersion).toBeGreaterThanOrEqual(26);
});
