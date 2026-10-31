import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryWaterRepository, waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE, type GoalMode } from '@/modules/settings';
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { theme } from '@/theme';
import type { DayTotalsRepository } from '../application/ports';
import { TodayScreen } from './TodayScreen';

// 15:00 in Paris: half of the daily goals is expected by now.
const afternoon = { now: () => new Date('2026-10-23T13:00:00Z') };
const evening = { now: () => new Date('2026-10-23T18:30:00Z') }; // 20:30 in Paris
const fr = (n: number) => n.toLocaleString('fr-FR');

async function renderToday({ kcal = 0, proteinG = 0, waterMl = 0, steps = 0, stepsReading = {}, stepsProblem, onRefresh, userName, clock = afternoon, session, goalMode }: { kcal?: number; proteinG?: number; waterMl?: number; steps?: number; stepsReading?: { stepsSource?: string; stepsSyncedAt?: Date }; stepsProblem?: string; onRefresh?: () => Promise<void>; userName?: string; clock?: typeof afternoon; session?: { title: string; subtitle: string; onStart: () => void }; goalMode?: GoalMode } = {}) {
  const water = inMemoryWaterRepository();
  if (waterMl > 0) water.add({ day: '2026-10-23', ml: waterMl, createdAt: clock.now() });
  // Day totals as Firestore keeps them: the water is the sum of the day's live glasses.
  const dayTotals: DayTotalsRepository = {
    observe: (day, onNext) =>
      water.observeDay(
        day,
        (entries) =>
          onNext(
            { waterMl: entries.reduce((sum, e) => sum + e.ml, 0), kcal, proteinG, carbsG: 0, fatG: 0, steps, ...stepsReading },
            { hasPendingWrites: false, fromCache: false },
          ),
        () => {},
      ),
  };
  const onAddMeal = jest.fn();
  const onOpenMetric = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <TodayScreen
        profile={{ ...DEFAULT_PROFILE, goalMode: goalMode ?? DEFAULT_PROFILE.goalMode }}
        userName={userName}
        session={session}
        clock={clock}
        dayTotals={dayTotals}
        hydration={waterUseCases(water, clock, DEFAULT_PROFILE.timezone)}
        run={(write) => void write()}
        onAddMeal={onAddMeal}
        onOpenMetric={onOpenMetric}
        stepsProblem={stepsProblem}
        onRefresh={onRefresh}
      />
    </PaperProvider>,
  );
  return { onAddMeal, onOpenMetric, water };
}

test('a quick-add button fills the water gauge', async () => {
  await renderToday();
  expect(screen.getByLabelText('Eau : 0 L, sur 2,5 L, reste 2,5 L')).toHaveAccessibilityValue({ text: 'en retard' });
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.getByLabelText('Eau : 0,5 L, sur 2,5 L, reste 2 L')).toBeTruthy();
});

test('the quick-add buttons stay outside the scrolling gauges, under the thumb whatever the day holds', async () => {
  await renderToday();
  const scrolling = within(screen.getByTestId('gauges'));
  expect(scrolling.getByLabelText(/^Eau : /)).toBeTruthy();
  expect(scrolling.queryByText('+250 ml')).toBeNull();
  expect(scrolling.queryByText('+ Repas')).toBeNull();
  expect(screen.getByText('+250 ml')).toBeTruthy();
  expect(screen.getByText('+ Repas')).toBeTruthy();
});

test('shows the session of the day under the gauges, and starts it', async () => {
  const onStart = jest.fn();
  await renderToday({ session: { title: 'Séance A — Haut du corps', subtitle: 'Phase 1 — Reprise · semaine 1 sur 4', onStart } });
  expect(screen.getByText('Séance du jour')).toBeTruthy();
  expect(screen.getByText('Séance A — Haut du corps')).toBeTruthy();
  expect(screen.getByText('Phase 1 — Reprise · semaine 1 sur 4')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Démarrer Séance A — Haut du corps'));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('shows no session card when there is none', async () => {
  await renderToday();
  expect(screen.queryByText('Séance du jour')).toBeNull();
});

test('the screen greets by the time of day and by first name', async () => {
  await renderToday({ userName: 'Francis' });
  expect(screen.getByText('Bonjour Francis')).toBeTruthy();
});

test('in the evening it says « Bonsoir », and without a name it only greets', async () => {
  await renderToday({ clock: evening });
  expect(screen.getByText('Bonsoir')).toBeTruthy();
});

test.each([
  [{}, 'Encore 2,5 L d’eau et 130 g de protéines aujourd’hui.'],
  [{ waterMl: 2500 }, 'Objectif d’eau atteint, bravo ! Encore 130 g de protéines.'],
  [{ proteinG: 130 }, 'Objectif de protéines atteint, bravo ! Encore 2,5 L d’eau.'],
  [{ waterMl: 3000, proteinG: 140 }, 'Objectifs d’eau et de protéines atteints, bravo !'],
  [{ waterMl: 1500, proteinG: 52.3 }, 'Encore 1 L d’eau et 77,7 g de protéines aujourd’hui.'],
])('the message under the greeting says what is left of the water and protein goals: %j', async (totals, message) => {
  await renderToday(totals);
  expect(screen.getByText(message)).toBeTruthy();
});

test('the gauges and the quick actions wear their icons: a drop, a flame, a flexed arm; two cups and a fork and knife', async () => {
  await renderToday();
  const icon = (name: keyof typeof glyphs) => screen.queryAllByText(String.fromCodePoint(glyphs[name]), { includeHiddenElements: true }).length;
  expect([icon('water'), icon('fire'), icon('arm-flex')]).toEqual([1, 1, 1]);
  expect([icon('cup-water'), icon('silverware-fork-knife')]).toEqual([2, 1]);
});

test('a quick add offers to take the glass back, and « Annuler » does', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  expect(screen.getByText('+250 ml ajoutés')).toBeTruthy();
  expect(screen.getByLabelText('Eau : 0,25 L, sur 2,5 L, reste 2,25 L')).toBeTruthy();

  await fireEvent.press(screen.getByText('Annuler'));
  expect(water.entries).toEqual([]);
  expect(screen.getByLabelText('Eau : 0 L, sur 2,5 L, reste 2,5 L')).toBeTruthy();
  expect(screen.queryByText('+250 ml ajoutés')).toBeNull();
});

test('a second quick add replaces the offer: « Annuler » takes back the last glass only', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.queryByText('+250 ml ajoutés')).toBeNull();

  await fireEvent.press(screen.getByText('Annuler'));
  expect(water.entries.map((e) => e.ml)).toEqual([250]);
});

test('the water gauge opens a small box to type any quantity of water, and adding puts it in the gauge', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByLabelText(/^Eau : /));
  expect(screen.getByText('Quantité d’eau')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Quantité (ml)'), '330');
  await fireEvent.press(screen.getByText('Ajouter'));
  expect(water.entries.map((e) => e.ml)).toEqual([330]);
  expect(screen.getByLabelText('Eau : 0,33 L, sur 2,5 L, reste 2,17 L')).toBeTruthy();
  expect(screen.queryByText('Quantité d’eau')).toBeNull();
  // The glass can be taken back, as after a quick add.
  expect(screen.getByText('+330 ml ajoutés')).toBeTruthy();
});

test('the quantity of water must be above 0 and up to 5 000 ml, with a comma or a point', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByLabelText(/^Eau : /));
  const field = screen.getByLabelText('Quantité (ml)');
  expect(screen.getByText('Ajouter')).toBeDisabled();
  for (const [text, valid] of [['0', false], ['abc', false], ['5001', false], ['5000', true], ['1', true], ['330,5', true]] as const) {
    await fireEvent.changeText(field, text);
    if (valid) expect(screen.getByText('Ajouter')).toBeEnabled();
    else expect(screen.getByText('Ajouter')).toBeDisabled();
    const reason = screen.queryByText('La quantité doit être comprise entre 1 et 5 000 ml.');
    if (valid) expect(reason).toBeNull();
    else expect(reason).toBeTruthy();
  }
  expect(water.entries).toEqual([]);
});

test('« Annuler » closes the box and keeps what was typed out of the day', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByLabelText(/^Eau : /));
  await fireEvent.changeText(screen.getByLabelText('Quantité (ml)'), '330');
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByText('Quantité d’eau')).toBeNull();
  expect(water.entries).toEqual([]);
});

test('the Calories and Protéines gauges show the day against the goals', async () => {
  await renderToday({ kcal: 1500, proteinG: 52.3 });
  expect(screen.getByLabelText(`Calories : ${fr(1500)} kcal, sur ${fr(2200)} kcal, reste ${fr(700)} kcal`)).toBeTruthy();
  expect(screen.getByLabelText(`Protéines : ${fr(52.3)} g, sur ${fr(130)} g, reste ${fr(77.7)} g`)).toBeTruthy();
});

test('each gauge tells a screen reader what a touch does', async () => {
  await renderToday();
  expect(screen.getByLabelText(/^Eau : /).props.accessibilityHint).toBe('Ajoute une quantité d’eau de ton choix');
  expect(screen.getByLabelText(/^Calories : /).props.accessibilityHint).toBe('Ouvre le suivi des calories');
  expect(screen.getByLabelText(/^Protéines : /).props.accessibilityHint).toBe('Ouvre le suivi des protéines');
});

test('a gauge shows the day in big, and beneath it the goal and what is left of it', async () => {
  await renderToday({ kcal: 1500, proteinG: 52.3 });
  expect(screen.getByText(`${fr(1500)} kcal`)).toBeTruthy();
  expect(screen.getByText(`sur ${fr(2200)} kcal · reste ${fr(700)} kcal`)).toBeTruthy();
  expect(screen.getByText('sur 2,5 L · reste 2,5 L')).toBeTruthy();
});

test('a gauge at its goal says so instead of a remainder, and Calories above it says that', async () => {
  await renderToday({ kcal: 2400, proteinG: 130 });
  expect(screen.getByText(`sur ${fr(130)} g · objectif atteint`)).toBeTruthy();
  expect(screen.getByText(`sur ${fr(2200)} kcal · au-dessus de l’objectif`)).toBeTruthy();
});

test('the Calories and Protéines gauges open their Suivi', async () => {
  const { onOpenMetric } = await renderToday();
  await fireEvent.press(screen.getByLabelText(/^Calories : /));
  expect(onOpenMetric).toHaveBeenLastCalledWith('calories');
  await fireEvent.press(screen.getByLabelText(/^Protéines : /));
  expect(onOpenMetric).toHaveBeenLastCalledWith('protein');
});

test('« + Repas » adds a meal', async () => {
  const { onAddMeal } = await renderToday();
  await fireEvent.press(screen.getByLabelText('Ajouter un repas'));
  expect(onAddMeal).toHaveBeenCalledTimes(1);
});

test('the Calories gauge is red and over the goal above 110 %, while Protéines only follows the pace', async () => {
  // 2 500 of 2 200 kcal is 114 %; 200 of 130 g is far above the goal but on pace.
  await renderToday({ kcal: 2500, proteinG: 200 });
  expect(screen.getByLabelText(/^Calories : /)).toHaveAccessibilityValue({ text: 'au-dessus de l’objectif' });
  expect(screen.getByLabelText(/^Protéines : /)).toHaveAccessibilityValue({ text: 'dans le rythme' });
});

test.each([
  [300, 'en retard'], // 14 % of the goal when half is expected: the pace, as for the water
  [2300, 'dans le rythme'], // 104.5 %: not over the goal yet
  [2400, 'au-dessus de l’objectif'], // 109 %: orange because of the overshoot, not the pace
])('the Calories gauge with %i kcal is read « %s »', async (kcal, status) => {
  await renderToday({ kcal });
  expect(screen.getByLabelText(/^Calories : /)).toHaveAccessibilityValue({ text: status });
});

describe('the Calories gauge follows the goal mode', () => {
  const read = () => screen.getByLabelText(/^Calories : /);

  test('in a deficit, eating less than the pace is not late', async () => {
    await renderToday({ kcal: 300, goalMode: 'deficit' });
    expect(read()).toHaveAccessibilityValue({ text: 'dans l’objectif de déficit' });
  });

  test('in a deficit, going over the goal is still read as over', async () => {
    await renderToday({ kcal: 2400, goalMode: 'deficit' });
    expect(read()).toHaveAccessibilityValue({ text: 'au-dessus de l’objectif' });
  });

  test('in a surplus, going over the goal is not a problem: the goal is reached', async () => {
    await renderToday({ kcal: 2600, goalMode: 'surplus' });
    expect(read()).toHaveAccessibilityValue({ text: 'dans le rythme' });
    expect(screen.getByText(`sur ${fr(2200)} kcal · objectif atteint`)).toBeTruthy();
  });

  test('in a surplus, being behind the pace is late', async () => {
    await renderToday({ kcal: 300, goalMode: 'surplus' });
    expect(read()).toHaveAccessibilityValue({ text: 'en retard' });
  });
});

describe('the Steps gauge', () => {
  test('reads the steps against the goal, with the pace of the day', async () => {
    await renderToday({ steps: 3000 }); // 15:00: half of 8 000 is expected, so 75 % of the pace
    expect(screen.getByLabelText(/^Pas : /)).toHaveAccessibilityValue({ text: 'un peu en retard' });
    expect(screen.getByText(`${fr(3000)} pas`)).toBeTruthy();
    expect(screen.getByText(`sur ${fr(8000)} pas · reste ${fr(5000)} pas`)).toBeTruthy();
  });

  test('is on track with the steps of the pace', async () => {
    await renderToday({ steps: 4000 });
    expect(screen.getByLabelText(/^Pas : /)).toHaveAccessibilityValue({ text: 'dans le rythme' });
  });

  test('says where the steps come from and when they were read', async () => {
    await renderToday({ steps: 5000, stepsReading: { stepsSource: 'fitbit', stepsSyncedAt: new Date('2026-10-23T12:32:00Z') } });
    expect(screen.getByText('Fitbit · lu à 14:32')).toBeTruthy();
  });

  test('reads the note aloud with the gauge: where the steps come from, or why they are missing', async () => {
    await renderToday({ steps: 5000, stepsReading: { stepsSource: 'fitbit', stepsSyncedAt: new Date('2026-10-23T12:32:00Z') } });
    expect(screen.getByLabelText(/^Pas : .*, Fitbit · lu à 14:32$/)).toBeTruthy();
  });

  test('says they were not read yet, and how to read them', async () => {
    await renderToday();
    expect(screen.getByText('Pas encore lu : tire l’écran vers le bas pour synchroniser.')).toBeTruthy();
  });

  test('says why they cannot be read, instead of the time', async () => {
    await renderToday({ stepsProblem: 'Autorise la lecture des pas dans Réglages › Pas.', stepsReading: { stepsSource: 'phone', stepsSyncedAt: new Date('2026-10-23T12:32:00Z') } });
    expect(screen.getByText('Autorise la lecture des pas dans Réglages › Pas.')).toBeTruthy();
    expect(screen.queryByText(/lu à/)).toBeNull();
  });

  test('opens the steps in the Suivi', async () => {
    const { onOpenMetric } = await renderToday();
    await fireEvent.press(screen.getByLabelText(/^Pas : /));
    expect(onOpenMetric).toHaveBeenLastCalledWith('steps');
  });

  test('pulling the screen down reads the steps again', async () => {
    const onRefresh = jest.fn(async () => {});
    await renderToday({ onRefresh });
    const { refreshControl } = screen.getByTestId('gauges').props;
    await act(async () => refreshControl.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('has no pull to refresh when the host gives no way to sync', async () => {
    await renderToday();
    expect(screen.getByTestId('gauges').props.refreshControl).toBeUndefined();
  });
});
