import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Appearance } from 'react-native';
import type { App } from '@/composition';
import { signInWithGoogle, useAuthUser } from '@/platform/firebase';

jest.mock('@/platform/firebase', () => ({ useAuthUser: jest.fn(), signInWithGoogle: jest.fn() }));

// The real composition needs native Firebase: wire the app on in-memory adapters instead.
jest.mock('@/composition', () => {
  const { inMemoryWaterRepository, waterUseCases } = jest.requireActual('@/modules/hydration');
  const { DEFAULT_PROFILE } = jest.requireActual('@/modules/settings');
  const clock = { now: () => new Date('2026-10-23T13:00:00Z') };
  return {
    compose: (): App => ({
      profile: DEFAULT_PROFILE,
      clock,
      hydration: waterUseCases(inMemoryWaterRepository(), clock, DEFAULT_PROFILE.timezone),
      dayTotals: {
        observe: (_day, onNext) => {
          onNext({ waterMl: 0 }, { hasPendingWrites: false, fromCache: false });
          return () => {};
        },
      },
    }),
  };
});

const signedInAs = (user: { uid: string } | null) => jest.mocked(useAuthUser).mockReturnValue(user as never);

test('a signed-out user lands on the Google sign-in', async () => {
  signedInAs(null);
  await renderRouter();
  expect(screen.getByText('Se connecter avec Google')).toBeTruthy();
});

test('a failed Google sign-in shows why', async () => {
  signedInAs(null);
  jest.mocked(signInWithGoogle).mockRejectedValue(new Error('DEVELOPER_ERROR'));
  await renderRouter();
  await fireEvent.press(screen.getByText('Se connecter avec Google'));
  expect(screen.getByText('La connexion a échoué. DEVELOPER_ERROR')).toBeTruthy();
});

test('a signed-in user lands on Today, with the sync icon in the top bar', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByLabelText('Eau : 0 / 2,5 L')).toBeTruthy();
  expect(screen.getByLabelText('Synchronisé')).toBeTruthy();
});

test('a phone in dark mode keeps the light theme', async () => {
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByText('Eau')).toHaveStyle({ color: 'rgba(28, 27, 31, 1)' });
});
