import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Appearance } from 'react-native';
import type { App } from '@/composition';
import { signInWithGoogle, useAuthUser } from '@/platform/firebase';
import { theme } from '@/theme';

// Read when the app is composed: a test sets them to play a first launch, and a profile whose snapshots come late.
let mockFirstLaunch = false;
let mockProfileLatencyMs = 0;

jest.mock('@/platform/firebase', () => ({ useAuthUser: jest.fn(), signInWithGoogle: jest.fn() }));
// The file picker and the share sheet are native: the Data screen is tested on its own, here only that it opens.
jest.mock('@/platform/files', () => ({ shareTextFile: jest.fn(), pickTextFile: jest.fn() }));

// The real composition needs native Firebase: wire the app on in-memory adapters instead.
jest.mock('@/composition', () => {
  const { inMemoryWaterRepository, waterUseCases } = jest.requireActual('@/modules/hydration');
  const {
    foodUseCases,
    inMemoryFavoriteMealRepository,
    inMemoryFoodCatalog,
    inMemoryFoodEntryRepository,
    inMemoryFoodRepository,
    inMemoryProductSource,
    inMemoryStarredFoodRepository,
    mealUseCases,
    productSearch,
    starredFoodUseCases,
  } = jest.requireActual('@/modules/nutrition');
  const { rateLimiter } = jest.requireActual('@/modules/nutrition/domain/rateLimiter');
  const { inMemoryMilestoneRepository, inMemoryPlanRepository, inMemoryWorkoutRepository, trainingUseCases } = jest.requireActual('@/modules/training');
  const { DEFAULT_PROFILE, inMemoryProfileRepository, settingsUseCases } = jest.requireActual('@/modules/settings');
  const { inMemoryFactsSource, trackingUseCases } = jest.requireActual('@/modules/tracking');
  const { bodyUseCases, inMemoryBodyRepository } = jest.requireActual('@/modules/body');
  const { inMemoryCravingRepository, tobaccoUseCases } = jest.requireActual('@/modules/tobacco');
  const { dataUseCases, inMemoryDataStore } = jest.requireActual('@/modules/data');
  const { inMemoryHealthSource, inMemoryStepsRepository, stepsUseCases } = jest.requireActual('@/modules/steps');
  const clock = { now: () => new Date('2026-10-23T10:00:00Z') }; // 12:00 in Paris: lunch
  const rice = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [] };
  return {
    compose: (): App => ({
      profile: DEFAULT_PROFILE,
      clock,
      hydration: waterUseCases(inMemoryWaterRepository(), clock, DEFAULT_PROFILE.timezone),
      dayTotals: {
        observe: (_day, onNext) => {
          onNext({ waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, steps: 0 }, { hasPendingWrites: false, fromCache: false });
          return () => {};
        },
      },
      ...(() => {
        const milestones = inMemoryMilestoneRepository();
        const training = trainingUseCases({ plans: inMemoryPlanRepository(), workouts: inMemoryWorkoutRepository(milestones), milestones, clock, timezone: DEFAULT_PROFILE.timezone });
        const body = bodyUseCases({ repo: inMemoryBodyRepository(milestones), milestones: training.listMilestones, clock, timezone: DEFAULT_PROFILE.timezone });
        return { training, body };
      })(),
      settings: (() => {
        const repo = inMemoryProfileRepository({ latencyMs: mockProfileLatencyMs });
        // The profile was set up before, unless a test says it is a first launch.
        if (!mockFirstLaunch) void repo.saveProfile({ createdAt: new Date('2026-10-01T10:00:00Z') });
        return settingsUseCases(repo);
      })(),
      // Health Connect is there but the permission is not given yet: the screens say so.
      steps: stepsUseCases({ health: inMemoryHealthSource({ granted: false }), repo: inMemoryStepsRepository(), device: { id: 'phone-a', name: 'Pixel' }, clock, timezone: DEFAULT_PROFILE.timezone }),
      data: dataUseCases({ store: inMemoryDataStore(), clock, timezone: DEFAULT_PROFILE.timezone }),
      tobacco: tobaccoUseCases({ repo: inMemoryCravingRepository(), clock, timezone: DEFAULT_PROFILE.timezone }),
      tracking: trackingUseCases({ sources: { days: inMemoryFactsSource(), training: inMemoryFactsSource(), tobacco: inMemoryFactsSource(), meals: inMemoryFactsSource() }, clock, timezone: DEFAULT_PROFILE.timezone }),
      nutrition: {
        meals: mealUseCases({
          entries: inMemoryFoodEntryRepository(),
          favorites: inMemoryFavoriteMealRepository(),
          clock,
          timezone: DEFAULT_PROFILE.timezone,
        }),
        foods: foodUseCases({ catalog: inMemoryFoodCatalog([rice]), repo: inMemoryFoodRepository() }),
        starred: starredFoodUseCases(inMemoryStarredFoodRepository()),
        products: productSearch({ source: inMemoryProductSource(), limiter: rateLimiter(10, 60000, Date.now), lookupLimiter: rateLimiter(15, 60000, Date.now) }),
      },
    }),
  };
});

const signedInAs = (user: { uid: string } | null) => jest.mocked(useAuthUser).mockReturnValue(user as never);

/** Paper's tab bar ignores touches until it has been measured, which Jest never does: lay it out, then press the tab. */
const pressTab = async (name: string) => {
  await fireEvent(screen.getByTestId('bottom-navigation-bar'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 80 } } });
  await fireEvent.press(screen.getByRole('button', { name }));
};

afterEach(() => jest.restoreAllMocks());

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
  expect(screen.getByText('La connexion a échoué : DEVELOPER_ERROR. Réessaie.')).toBeTruthy();
});

describe('a first launch', () => {
  beforeEach(() => {
    mockFirstLaunch = true;
  });
  afterEach(() => {
    mockFirstLaunch = false;
    mockProfileLatencyMs = 0;
  });

  test('goes to the setup, which can be skipped and is then not shown again', async () => {
    signedInAs({ uid: 'alice' });
    await renderRouter();
    expect(screen).toHavePathname('/setup');
    expect(screen.getByText('Faisons connaissance')).toBeTruthy();
    await fireEvent.press(screen.getByText('Passer'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(screen.getByLabelText(/^Eau : /)).toBeTruthy();
    // Once done, a visit to the setup leaves it.
    await act(async () => router.push('/setup'));
    await waitFor(() => expect(screen).toHavePathname('/'));
  });

  test('does not bounce back to the setup when the profile snapshot comes after the write', async () => {
    mockProfileLatencyMs = 40;
    signedInAs({ uid: 'alice' });
    await renderRouter();
    await waitFor(() => expect(screen).toHavePathname('/setup'));
    await fireEvent.press(screen.getByText('Passer'));
    await waitFor(() => expect(screen).toHavePathname('/'), { timeout: 2000 });
    expect(screen.getByLabelText(/^Eau : /)).toBeTruthy();
  });
});

test('a signed-in user lands on Today, with the sync icon in the top bar', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByLabelText('Eau : 0 sur 2,5 L, 0 %')).toBeTruthy();
  expect(screen.getByLabelText('Synchronisé')).toBeTruthy();
});

test('a phone in dark mode keeps the light theme', async () => {
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByText('Eau – 0 / 2,5 L')).toHaveStyle({ color: theme.colors.onSurface });
});

test('the tabs are Paper’s Material bar: the open tab is the selected one, and the selection follows the route', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.getByRole('button', { name: 'Aujourd’hui' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Repas' })).not.toBeSelected();
  await pressTab('Repas');
  expect(screen.getByRole('button', { name: 'Repas' })).toBeSelected();
  expect(screen.getByRole('button', { name: 'Aujourd’hui' })).not.toBeSelected();
});

test('the Sport tab offers the starter programme, and creating it shows the sessions', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Sport');
  expect(screen).toHavePathname('/sport');
  await fireEvent.press(screen.getByText('Partir du modèle'));
  expect(screen.getByText('Reprise progressive')).toBeTruthy();
  expect(screen.getAllByLabelText(/^Démarrer Séance /)).toHaveLength(3);
});

test('starting a session opens the workout with its exercises', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Sport');
  await fireEvent.press(screen.getByText('Partir du modèle'));
  await fireEvent.press(screen.getByLabelText('Démarrer Séance B — Bas du corps'));
  expect(screen).toHavePathname('/workout');
  expect(screen).toHaveSearchParams({ session: '1' });
  expect(await screen.findByText('Squat gobelet')).toBeTruthy();
});

test('Today offers the next session once there is a programme, and starts it', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.queryByText('Séance du jour')).toBeNull();
  await pressTab('Sport');
  await fireEvent.press(screen.getByText('Partir du modèle'));
  await pressTab('Aujourd’hui');
  expect(screen.getByText('Séance du jour')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Démarrer Séance A — Haut du corps'));
  expect(screen).toHavePathname('/workout');
  expect(screen).toHaveSearchParams({ session: '0' });
});

test('« Modifier le programme » opens the editor, and an exercise opens its history', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Sport');
  await fireEvent.press(screen.getByText('Partir du modèle'));
  await fireEvent.press(screen.getByText('Modifier le programme'));
  expect(screen).toHavePathname('/plan');
  await fireEvent.press(screen.getByTestId('exercise-0-0-1'));
  await fireEvent.press(screen.getByText('Voir l’historique'));
  expect(screen).toHavePathname('/exercise');
  expect(screen).toHaveSearchParams({ id: 'rowing-haltere', name: 'Rowing haltère' });
  expect(await screen.findByText('Aucune séance pour cet exercice.')).toBeTruthy();
});

test('the gear in the header opens the settings, and a page saves the goals and comes back', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByLabelText('Réglages'));
  expect(screen).toHavePathname('/settings');
  await fireEvent.press(screen.getByText('Objectifs'));
  expect(screen).toHavePathname('/settings/goals');
  await fireEvent.changeText(screen.getByLabelText('Calories (kcal par jour)'), '2000');
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(screen).toHavePathname('/settings');
  // The settings list shows the new goal.
  expect(await screen.findByLabelText(/^Objectifs, 2.000 kcal/)).toBeTruthy();
});

test('the settings reach the data page, which recomputes the totals', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/settings' });
  await fireEvent.press(screen.getByText('Données'));
  expect(screen).toHavePathname('/settings/data');
  await fireEvent.press(screen.getByText('Recalculer les totaux'));
  await fireEvent.press(screen.getByText('Recalculer'));
  expect(await screen.findByText('Les totaux de 0 jour étaient justes.')).toBeTruthy();
});

test('the settings reach the profile and the water containers', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/settings' });
  await fireEvent.press(screen.getByText('Profil'));
  expect(screen).toHavePathname('/settings/profile');
  await act(async () => router.back());
  await fireEvent.press(screen.getByText('Eau'));
  expect(screen).toHavePathname('/settings/water');
});

test('Today has a weight card: one tap enters a measure, a touch opens the weight in Suivi', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(await screen.findByText('Pas encore de pesée')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Saisir une mesure'));
  await fireEvent.changeText(screen.getByLabelText('Poids (kg)'), '80,5');
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(await screen.findByText('80,5 kg')).toBeTruthy();
  await fireEvent.press(screen.getByText('Poids'));
  expect(screen).toHavePathname('/suivi/corps');
  expect(screen).toHaveSearchParams({ section: 'corps', metric: 'weight' });
});

test('the goals start the proposal from the weight entered', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(await screen.findByLabelText('Saisir une mesure'));
  await fireEvent.changeText(screen.getByLabelText('Poids (kg)'), '80');
  await fireEvent.press(screen.getByText('Enregistrer'));
  await screen.findByText('80 kg');
  await fireEvent.press(screen.getByLabelText('Réglages'));
  await fireEvent.press(screen.getByText('Objectifs'));
  expect(await screen.findByLabelText('Poids (kg)')).toHaveDisplayValue('80');
});

test('Today shows the days without tobacco once the quit date is set, and opens the tobacco section', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(screen.queryByText('Sans tabac')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Réglages'));
  await fireEvent.press(screen.getByText('Tabac'));
  expect(screen).toHavePathname('/settings/tobacco');
  await fireEvent.changeText(screen.getByLabelText('Date d’arrêt (AAAA-MM-JJ)'), '2026-10-13');
  await fireEvent.press(screen.getByText('Enregistrer'));
  await act(async () => router.back()); // back to Today
  expect(await screen.findByText('10 jours')).toBeTruthy();
  await fireEvent.press(screen.getByText('Sans tabac'));
  expect(screen).toHavePathname('/suivi/tabac');
  expect(screen).toHaveSearchParams({ section: 'tabac', metric: 'cravings' });
  await fireEvent.press(screen.getByText('Envie résistée'));
  expect(await screen.findByText('Envie résistée notée.')).toBeTruthy();
});

test('Today says the steps cannot be read yet, and the Steps gauge opens the Activité section', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  expect(await screen.findByText('Autorise la lecture des pas dans Réglages › Pas.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Pas : /));
  expect(screen).toHavePathname('/suivi/activite');
  expect(screen).toHaveSearchParams({ section: 'activite', metric: 'steps' });
  expect(screen.getByText('Synchroniser')).toBeTruthy();
});

test('the steps settings ask for the permission, from the Activité section', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/suivi/activite?metric=steps' });
  await fireEvent.press(await screen.findByText('Réglages des pas'));
  expect(screen).toHavePathname('/settings/steps');
  expect(await screen.findByText('Pas encore accordée')).toBeTruthy();
  await fireEvent.press(screen.getByText('Autoriser la lecture des pas'));
  expect(await screen.findByText('Accordée')).toBeTruthy();
});

test('the settings list has the steps page', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/settings' });
  await fireEvent.press(screen.getByText('Pas'));
  expect(screen).toHavePathname('/settings/steps');
});

test('the Repas tab opens the day journal', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Repas');
  expect(screen).toHavePathname('/repas');
  expect(screen.getByText('Petit-déjeuner')).toBeTruthy();
});

test('the Calories and Protéines gauges on Today open their Suivi', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByLabelText(/^Calories : /));
  expect(screen).toHavePathname('/suivi/nutrition');
  expect(screen).toHaveSearchParams({ section: 'nutrition', metric: 'calories' });
  expect(screen.getByText('Ajoute un repas pour voir tes calories.')).toBeTruthy();
  await act(async () => router.back()); // the hub, under the section
  expect(screen).toHavePathname('/suivi');
});

test('the nutrition section opens the micronutrients, and a nutrient opens its curve', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/suivi/nutrition?metric=calories' });
  await fireEvent.press(await screen.findByText('Micronutriments'));
  expect(screen).toHavePathname('/suivi/micro');
  expect(await screen.findByText('Pas encore de moyenne : elle compte les jours terminés avec un repas.')).toBeTruthy();
  await act(async () => router.push({ pathname: '/suivi/[section]', params: { section: 'micro', metric: 'iron' } }));
  expect(screen).toHaveSearchParams({ section: 'micro', metric: 'iron' });
  expect(await screen.findByText('Ajoute un aliment de la table Ciqual pour voir ce nutriment.')).toBeTruthy();
});

test('the Protéines gauge opens the protein curve', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await fireEvent.press(screen.getByLabelText(/^Protéines : /));
  expect(screen).toHaveSearchParams({ section: 'nutrition', metric: 'protein' });
  expect(screen.getByText('Ajoute un repas pour voir tes protéines.')).toBeTruthy();
});

test('the Suivi tab opens the hub, and a card opens its section', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Suivi');
  expect(screen).toHavePathname('/suivi');
  expect(screen.getByText('Semaine du 19 oct. au 25 oct.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('card-water'));
  expect(screen).toHavePathname('/suivi/eau');
  expect(screen).toHaveSearchParams({ section: 'eau', metric: 'water' });
});

test('an unknown Suivi section goes back to the hub', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/suivi/bogus' });
  expect(screen).toHavePathname('/suivi');
});

test('from Suivi the back button goes back to Today, not to the first tab of a list', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Repas');
  await pressTab('Suivi');
  await act(async () => router.back());
  expect(screen).toHavePathname('/repas');
  await act(async () => router.back());
  expect(screen).toHavePathname('/');
});

test('touching the Suivi tab again, from a section, goes back to the hub', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Suivi');
  await fireEvent.press(screen.getByTestId('card-water'));
  await pressTab('Suivi');
  // The stack pops on the next frame.
  await waitFor(() => expect(screen).toHavePathname('/suivi'));
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
  await pressTab('Repas');
  await fireEvent.press(screen.getByLabelText('Ajouter à Dîner'));
  expect(screen).toHavePathname('/add-food');
  expect(screen).toHaveSearchParams({ meal: 'dinner' });
});

test('adding a food from the journal comes back to the Repas tab, not to Today', async () => {
  signedInAs({ uid: 'alice' });
  await renderRouter();
  await pressTab('Repas');
  await fireEvent.press(screen.getByLabelText('Ajouter à Dîner'));
  await fireEvent.changeText(screen.getByLabelText('Rechercher un aliment'), 'riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  await fireEvent.press(screen.getByText('Ajouter à Dîner'));
  expect(screen).toHavePathname('/repas');
});

test('a link to the add-food screen with an unknown meal adds to the snacks', async () => {
  // Opened straight on the modal, expo-router warns that no screen lies under it: not what this test is about.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  signedInAs({ uid: 'alice' });
  await renderRouter(undefined, { initialUrl: '/add-food?meal=bogus' });
  await fireEvent.changeText(screen.getByLabelText('Rechercher un aliment'), 'riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  expect(screen.getByText('Ajouter à Collations')).toBeTruthy();
});
