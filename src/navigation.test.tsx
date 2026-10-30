import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Appearance } from 'react-native';
import type { App } from '@/composition';
import { signInWithGoogle, useAuthUser } from '@/platform/firebase';

jest.mock('@/platform/firebase', () => ({ useAuthUser: jest.fn(), signInWithGoogle: jest.fn() }));

// The real composition needs native Firebase: wire the app on in-memory adapters instead.
jest.mock('@/composition', () => {
  const { inMemoryWaterRepository, waterUseCases } = jest.requireActual('@/modules/hydration');
  const {
    foodUseCases,
    inMemoryFavoriteMealRepository,
    inMemoryFoodCatalog,
    inMemoryFoodEntryRepository,
    inMemoryFoodRepository,
    mealUseCases,
  } = jest.requireActual('@/modules/nutrition');
  const { DEFAULT_PROFILE } = jest.requireActual('@/modules/settings');
  const clock = { now: () => new Date('2026-10-23T10:00:00Z') }; // 12:00 in Paris: lunch
  const rice = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [] };
  return {
    compose: (): App => ({
      profile: DEFAULT_PROFILE,
      clock,
      hydration: waterUseCases(inMemoryWaterRepository(), clock, DEFAULT_PROFILE.timezone),
      dayTotals: {
        observe: (_day, onNext) => {
          onNext({ waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, { hasPendingWrites: false, fromCache: false });
          return () => {};
        },
      },
      nutrition: {
        meals: mealUseCases({
          entries: inMemoryFoodEntryRepository(),
          favorites: inMemoryFavoriteMealRepository(),
          clock,
          timezone: DEFAULT_PROFILE.timezone,
        }),
        foods: foodUseCases({ catalog: inMemoryFoodCatalog([rice]), repo: inMemoryFoodRepository() }),
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

test('the Repas tab opens the day journal', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByText('Repas'));
  expect(screen).toHavePathname('/repas');
  expect(screen.getByText('Petit-déjeuner')).toBeTruthy();
});

test('the Calories gauge on Today opens the day journal', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByLabelText(/^Calories : /));
  expect(screen).toHavePathname('/repas');
  expect(screen.getByText('Petit-déjeuner')).toBeTruthy();
});

test('« + Repas » opens the search for the meal of the hour, and adding the food comes back to Today', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByLabelText('Ajouter un repas'));
  expect(screen).toHavePathname('/add-food');
  expect(screen).toHaveSearchParams({ meal: 'lunch' });
  await fireEvent.changeText(screen.getByLabelText('Rechercher un aliment'), 'riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  // The button exists only on the food's fiche.
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
  expect(screen).toHavePathname('/');
});

test('the « Ajouter » of a meal on the journal opens the search for that meal', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByText('Repas'));
  await fireEvent.press(screen.getByLabelText('Ajouter à Dîner'));
  expect(screen).toHavePathname('/add-food');
  expect(screen).toHaveSearchParams({ meal: 'dinner' });
});
