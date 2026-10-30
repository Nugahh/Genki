import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import { mealUseCases, type MealUseCases } from '../application/mealUseCases';
import type { FavoriteMeal } from '../domain/food';
import { MealsScreen } from './MealsScreen';

const clock = { now: () => new Date('2026-10-24T10:00:00Z') }; // 12:00 in Paris
const rice = { ref: { type: 'ciqual' as const, id: '9100' }, name: 'Riz blanc, cru', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } };
const yogurt = { ref: { type: 'custom' as const, id: 'c1' }, name: 'Yaourt nature', per100g: { kcal: 60, protein: 4, carbs: 5, fat: 3 } };
// The thousands separator depends on the ICU data, so the expected text is built the way the screen does.
const goal = (2200).toLocaleString('fr-FR');

async function setup(at = clock, run: (write: () => Promise<void>) => void = (write) => void write()) {
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const meals = mealUseCases({ entries, favorites, clock: at, timezone: DEFAULT_PROFILE.timezone });
  const onAdd = jest.fn();
  await render(
    <PaperProvider>
      <MealsScreen profile={DEFAULT_PROFILE} clock={at} meals={meals} onAdd={onAdd} run={run} />
    </PaperProvider>,
  );
  return { entries, favorites, meals, onAdd };
}

const lunchOfRice = (meals: MealUseCases) =>
  act(async () => {
    await meals.logFood('lunch', rice, 200);
  });

/** Opens the actions of the rice line, then its quantity field. */
async function openQuantity() {
  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 200 g'));
  await fireEvent.press(screen.getByText('Modifier la quantité'));
  return screen.getByLabelText('Quantité (g)');
}

function savedFavorites(meals: MealUseCases) {
  let list: FavoriteMeal[] = [];
  meals.observeFavorites((favorites) => (list = favorites), () => {})();
  return list;
}

test('the journal lists the day under each meal, with the subtotals and the day totals', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);

  expect(screen.getAllByTestId(/^meal-\w+$/).map((section) => section.props.testID)).toEqual(['meal-breakfast', 'meal-lunch', 'meal-dinner', 'meal-snack']);
  // The meal titles are headings, for TalkBack to jump from one meal to the next.
  for (const label of ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collations']) expect(screen.getByRole('header', { name: label })).toBeTruthy();
  const lunch = within(screen.getByTestId('meal-lunch'));
  expect(lunch.getByText('Riz blanc, cru')).toBeTruthy();
  expect(lunch.getByText('200 g · 700 kcal')).toBeTruthy();
  expect(lunch.getByText('700 kcal')).toBeTruthy();
  expect(lunch.queryByText('Rien pour l’instant.')).toBeNull();
  expect(screen.getAllByText('Rien pour l’instant.')).toHaveLength(3);
  expect(screen.getAllByText('0 kcal')).toHaveLength(3);
  expect(screen.getByText(`Calories : 700 / ${goal} kcal`)).toBeTruthy();
  expect(screen.getByText('Protéines : 14 / 130 g')).toBeTruthy();
  expect(screen.getByText('Glucides 156 g · Lipides 1,2 g')).toBeTruthy();
});

test('« Ajouter » asks to add to that meal', async () => {
  const { onAdd } = await setup();
  await fireEvent.press(screen.getByLabelText('Ajouter à Dîner'));
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onAdd).toHaveBeenCalledWith('dinner');
});

test('a touched line opens its actions, and the corrected quantity reaches the line and the totals', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);

  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 200 g'));
  expect(screen.getByRole('header', { name: 'Riz blanc, cru' })).toBeTruthy();
  await fireEvent.press(screen.getByText('Modifier la quantité'));
  const field = screen.getByLabelText('Quantité (g)');
  expect(field).toHaveDisplayValue('200');
  await fireEvent.changeText(field, '150');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(screen.getByText('150 g · 525 kcal')).toBeTruthy();
  expect(screen.getByLabelText('Riz blanc, cru, 150 g')).toBeTruthy();
  expect(screen.getByText(`Calories : 525 / ${goal} kcal`)).toBeTruthy();
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
});

test('the quantity accepts a comma as the decimal separator, and is offered back with one', async () => {
  const { entries, meals } = await setup();
  await lunchOfRice(meals);

  await fireEvent.changeText(await openQuantity(), '150,5');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(screen.getByText('150,5 g · 527 kcal')).toBeTruthy();
  expect(entries.entries[0].grams).toBe(150.5);
  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 150,5 g'));
  await fireEvent.press(screen.getByText('Modifier la quantité'));
  expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('150,5');
});

test('« Enregistrer » needs a quantity above 0 and up to 5 000 g', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);

  const field = await openQuantity();
  for (const [text, valid] of [['0', false], ['', false], ['abc', false], ['5001', false], ['5000', true], ['0,1', true], ['12.5', true]] as const) {
    await fireEvent.changeText(field, text);
    if (valid) expect(screen.getByText('Enregistrer')).toBeEnabled();
    else expect(screen.getByText('Enregistrer')).toBeDisabled();
  }
});

test('« Annuler » closes the actions, which open again on the three choices', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);

  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 200 g'));
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByText('Modifier la quantité')).toBeNull();

  await fireEvent.changeText(await openQuantity(), '150');
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
  expect(screen.getByText('200 g · 700 kcal')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 200 g'));
  expect(screen.getByText('Modifier la quantité')).toBeTruthy();
  expect(screen.getByText('Supprimer')).toBeTruthy();
});

test('« Supprimer » removes the line and the totals fall back to zero', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);

  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 200 g'));
  await fireEvent.press(screen.getByText('Supprimer'));

  expect(screen.queryByText('Supprimer')).toBeNull();
  expect(screen.queryByText('Riz blanc, cru')).toBeNull();
  expect(screen.getAllByText('Rien pour l’instant.')).toHaveLength(4);
  expect(screen.getByText(`Calories : 0 / ${goal} kcal`)).toBeTruthy();
  expect(screen.getByText('Protéines : 0 / 130 g')).toBeTruthy();
  expect(screen.getByText('Glucides 0 g · Lipides 0 g')).toBeTruthy();
});

test('a meal is saved as a favorite: the name starts as its label and only its lines are kept', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);
  await act(async () => {
    await meals.logFood('dinner', yogurt, 125);
  });

  await fireEvent.press(screen.getByLabelText('Enregistrer Déjeuner comme favori'));
  expect(screen.getByRole('header', { name: 'Nom du favori' })).toBeTruthy();
  expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Déjeuner');
  await fireEvent.changeText(screen.getByLabelText('Nom'), 'Riz du midi');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(savedFavorites(meals)).toEqual([
    { id: expect.any(String), name: 'Riz du midi', items: [{ foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 200 }] },
  ]);
  expect(screen.queryByLabelText('Nom')).toBeNull();
});

test('a favorite needs a name, and « Annuler » saves nothing', async () => {
  const { meals } = await setup();
  await lunchOfRice(meals);
  // Only a meal with something in it can be saved.
  expect(screen.getAllByText('Enregistrer comme favori')).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText('Enregistrer Déjeuner comme favori'));
  // The rules refuse a longer name, which could then never be saved.
  expect(screen.getByLabelText('Nom')).toHaveProp('maxLength', 100);
  for (const blank of ['', '   ']) {
    await fireEvent.changeText(screen.getByLabelText('Nom'), blank);
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  }
  await fireEvent.press(screen.getByText('Annuler'));

  expect(screen.queryByLabelText('Nom')).toBeNull();
  expect(savedFavorites(meals)).toEqual([]);
});

test('a quantity change, a removal and a favorite are handed to run: nothing is written until it runs them', async () => {
  const writes: (() => Promise<void>)[] = [];
  const { entries, meals } = await setup(clock, (write) => void writes.push(write));
  await lunchOfRice(meals);
  const runWrite = (i: number) =>
    act(async () => {
      await writes[i]();
    });

  await fireEvent.changeText(await openQuantity(), '150');
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(writes).toHaveLength(1);
  expect(entries.entries[0].grams).toBe(200);
  await runWrite(0);
  expect(entries.entries[0].grams).toBe(150);

  await fireEvent.press(screen.getByLabelText('Enregistrer Déjeuner comme favori'));
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(writes).toHaveLength(2);
  expect(savedFavorites(meals)).toEqual([]);
  await runWrite(1);
  expect(savedFavorites(meals)).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText('Riz blanc, cru, 150 g'));
  await fireEvent.press(screen.getByText('Supprimer'));
  expect(writes).toHaveLength(3);
  expect(entries.entries).toHaveLength(1);
  await runWrite(2);
  expect(entries.entries).toEqual([]);
});

test('an entry of another day is neither listed nor counted', async () => {
  const { entries, meals } = await setup();
  await act(async () => {
    await entries.add({
      day: '2026-10-23',
      meal: 'lunch',
      foodRef: { type: 'ciqual', id: '7000' },
      foodName: 'Pain',
      grams: 100,
      macros: { kcal: 250, protein: 8, carbs: 50, fat: 1 },
      createdAt: new Date('2026-10-23T10:00:00Z'),
    });
  });
  await lunchOfRice(meals);

  expect(screen.queryByText('Pain')).toBeNull();
  expect(screen.getByText('Riz blanc, cru')).toBeTruthy();
  expect(screen.getByText(`Calories : 700 / ${goal} kcal`)).toBeTruthy();
});

test('the day follows the profile time zone, not UTC', async () => {
  // 23:30 UTC on the 24th is already the 25th in Paris.
  const { meals } = await setup({ now: () => new Date('2026-10-24T23:30:00Z') });
  await act(async () => {
    await meals.logFood('dinner', rice, 100);
  });

  expect(within(screen.getByTestId('meal-dinner')).getByText('Riz blanc, cru')).toBeTruthy();
});
