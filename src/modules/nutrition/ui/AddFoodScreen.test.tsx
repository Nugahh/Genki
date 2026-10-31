import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodCatalog } from '../adapters/inMemoryFoodCatalog';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import { inMemoryFoodRepository } from '../adapters/inMemoryFoodRepository';
import { foodUseCases, type FoodUseCases } from '../application/foodUseCases';
import { mealUseCases } from '../application/mealUseCases';
import type { FoodCatalog } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { AddFoodScreen } from './AddFoodScreen';

const clock = { now: () => new Date('2026-10-24T10:00:00Z') }; // 12:00 in Paris
const rawRice: Food = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [] };
const cookedRice: Food = {
  ref: { type: 'ciqual', id: '9101' },
  name: 'Riz blanc, cuit, sans sel ajouté',
  state: 'cooked',
  per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  portions: [],
};
const bread: FoodInput = { name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 }, portions: [{ label: '1 tranche', grams: 30 }] };

type Options = { catalog?: FoodCatalog; meal?: Meal; observeCustom?: FoodUseCases['observeCustom']; run?: (write: () => Promise<void>) => void };

async function setup({ catalog = inMemoryFoodCatalog([rawRice, cookedRice]), meal = 'lunch', observeCustom, run = (write) => void write() }: Options = {}) {
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const foods = { ...foodUseCases({ catalog, repo: inMemoryFoodRepository() }), ...(observeCustom && { observeCustom }) };
  const meals = mealUseCases({ entries, favorites, clock, timezone: DEFAULT_PROFILE.timezone });
  const onDone = jest.fn();
  await render(
    <PaperProvider>
      <AddFoodScreen meal={meal} meals={meals} foods={foods} run={run} onDone={onDone} />
    </PaperProvider>,
  );
  return { entries, favorites, foods, meals, onDone };
}

const search = (text: string) => fireEvent.changeText(screen.getByLabelText('Rechercher un aliment'), text);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

/** Paper marks the chosen segment with `accessibilityState.checked`, which the `checked` filter of `getByRole` only reads on checkboxes and radios. */
const isChecked = (name: string) => screen.getByRole('button', { name }).props.accessibilityState.checked;
/** A selected chip holds its check icon in its accessible name, hence the regular expression. */
const isSelected = (label: string) => screen.queryByRole('button', { name: new RegExp(label), selected: true }) !== null;

/** The custom foods as the repository holds them now. */
function customFoods(foods: FoodUseCases) {
  let list: Food[] = [];
  foods.observeCustom((foods) => (list = foods), () => {})();
  return list;
}

/** A catalog whose answers are released by hand, to answer out of order. */
function manualCatalog() {
  const asked: { query: string; answer: (found: Food[]) => void }[] = [];
  const catalog: FoodCatalog = {
    search: (query) => new Promise((resolve) => asked.push({ query, answer: resolve })),
    get: async () => undefined,
  };
  const answer = (query: string, found: Food[]) =>
    act(async () => {
      asked.filter((question) => question.query === query).forEach((question) => question.answer(found));
    });
  return { catalog, answer };
}

afterEach(() => jest.restoreAllMocks());

test('a search finds the food, its fiche previews the macros, and adding logs it with those macros frozen', async () => {
  const { entries, onDone } = await setup();

  expect(screen.getByText('Tapez le nom d’un aliment.')).toBeTruthy();
  await search('riz');
  expect(await screen.findByText('Riz blanc, cru')).toBeTruthy();
  expect(screen.getByText('Riz blanc, cuit, sans sel ajouté')).toBeTruthy();
  // The pills are lower case; the filter chips start with a capital.
  expect(screen.getByText('cru')).toBeTruthy();
  expect(screen.getByText('cuit')).toBeTruthy();
  expect(screen.getByText('350 kcal / 100 g')).toBeTruthy();
  expect(screen.getByText('130 kcal / 100 g')).toBeTruthy();
  expect(screen.queryByText('Tapez le nom d’un aliment.')).toBeNull();

  await fireEvent.press(screen.getByText('Riz blanc, cru'));
  expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('100');
  expect(screen.getByText('350 kcal · 7 g de protéines · 78 g de glucides · 0,6 g de lipides')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Quantité (g)'), '200');
  expect(screen.getByText('700 kcal · 14 g de protéines · 156 g de glucides · 1,2 g de lipides')).toBeTruthy();
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));

  expect(entries.entries).toEqual([
    {
      id: expect.any(String),
      day: '2026-10-24',
      meal: 'lunch',
      foodRef: rawRice.ref,
      foodName: 'Riz blanc, cru',
      grams: 200,
      macros: { kcal: 700, protein: 14, carbs: 156, fat: 1.2 },
      createdAt: clock.now(),
    },
  ]);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the « Cuit » filter keeps the cooked foods only, custom ones included, and « Tous » brings the others back', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create({ ...bread, name: 'Riz sauté maison', state: 'cooked' });
    await foods.create({ ...bread, name: 'Riz au lait', state: 'other' });
  });
  const titles = () => screen.queryAllByText(/^Riz/).map((title) => title.props.children);

  await search('riz');
  await screen.findByText('Riz blanc, cru');
  expect(isSelected('Tous')).toBe(true);
  expect(titles()).toEqual(['Riz au lait', 'Riz sauté maison', 'Riz blanc, cru', 'Riz blanc, cuit, sans sel ajouté']);
  // A pill for each cru or cuit food, none for « Riz au lait ».
  expect(screen.getAllByText(/^(cru|cuit)$/)).toHaveLength(3);

  await fireEvent.press(screen.getByText('Cuit'));
  expect(isSelected('Cuit')).toBe(true);
  expect(isSelected('Tous')).toBe(false);
  await waitFor(() => expect(titles()).toEqual(['Riz sauté maison', 'Riz blanc, cuit, sans sel ajouté']));

  await fireEvent.press(screen.getByText('Cru'));
  await waitFor(() => expect(titles()).toEqual(['Riz blanc, cru']));

  await fireEvent.press(screen.getByText('Tous'));
  await waitFor(() => expect(titles()).toHaveLength(4));
});

test('a portion chip sets the quantity to the weight of the portion', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create(bread);
  });

  await search('pain');
  // A food that is neither raw nor cooked has no pill, in the list or in its fiche.
  expect(screen.queryByText(/^(cru|cuit)$/)).toBeNull();
  await fireEvent.press(screen.getByText('Pain maison'));
  expect(screen.queryByText(/^(cru|cuit)$/)).toBeNull();
  await fireEvent.press(screen.getByText('1 tranche (30 g)'));
  expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('30');
  expect(screen.getByText('75 kcal · 2,4 g de protéines · 14,4 g de glucides · 0,6 g de lipides')).toBeTruthy();

  await fireEvent.press(screen.getByText('100 g'));
  expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('100');
});

test('a created food shows up in the search of its name, on the « Recherche » segment', async () => {
  const { foods } = await setup();
  await fireEvent.press(screen.getByText('Créer'));
  expect(isChecked('Créer')).toBe(true);
  expect(isChecked('Recherche')).toBe(false);
  await type('Nom', 'Pain maison');
  await type('Calories pour 100 g', '250');
  await type('Protéines pour 100 g', '8');
  await type('Glucides pour 100 g', '48');
  await type('Lipides pour 100 g', '2');
  await fireEvent.press(screen.getByText('Ajouter une portion'));
  await type('Nom de la portion', '1 tranche');
  await type('Poids (g)', '30');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(isChecked('Recherche')).toBe(true);
  expect(isChecked('Créer')).toBe(false);
  expect(screen.getByLabelText('Rechercher un aliment')).toHaveDisplayValue('Pain maison');
  expect(await screen.findByText('250 kcal / 100 g')).toBeTruthy();
  expect(screen.getByText('Pain maison')).toBeTruthy();
  expect(customFoods(foods)).toEqual([{ ref: { type: 'custom', id: expect.any(String) }, ...bread }]);
});

test('a created food shows even when a state filter was on', async () => {
  await setup();
  await search('pain');
  await fireEvent.press(screen.getByText('Cuit'));
  await fireEvent.press(screen.getByText('Créer'));
  await type('Nom', 'Pain maison');
  for (const label of ['Calories pour 100 g', 'Protéines pour 100 g', 'Glucides pour 100 g', 'Lipides pour 100 g']) await type(label, '10');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(isSelected('Tous')).toBe(true);
  expect(screen.getByText('Pain maison')).toBeTruthy();
});

test('a custom food can be changed or deleted from its fiche', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create(bread);
  });
  await search('pain');
  await fireEvent.press(screen.getByText('Pain maison'));

  // « Annuler » leaves the food as it was.
  await fireEvent.press(screen.getByText('Modifier l’aliment'));
  expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Pain maison');
  expect(screen.getByLabelText('Nom de la portion')).toHaveDisplayValue('1 tranche');
  await type('Nom', 'Brioche');
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.getByText('Pain maison')).toBeTruthy();
  expect(customFoods(foods)[0].name).toBe('Pain maison');

  await fireEvent.press(screen.getByText('Modifier l’aliment'));
  await type('Nom', 'Pain de mie');
  await type('Calories pour 100 g', '260');
  await fireEvent.press(screen.getByText('Enregistrer les modifications'));

  const id = customFoods(foods)[0].ref.id;
  expect(customFoods(foods)).toEqual([{ ref: { type: 'custom', id }, ...bread, name: 'Pain de mie', per100g: { ...bread.per100g, kcal: 260 } }]);
  // Back on the fiche, which shows the new values.
  expect(screen.getByText('Pain de mie')).toBeTruthy();
  expect(screen.getByText('260 kcal · 8 g de protéines · 48 g de glucides · 2 g de lipides')).toBeTruthy();
  expect(screen.queryByLabelText('Nom')).toBeNull();

  await fireEvent.press(screen.getByText('Supprimer l’aliment'));
  expect(customFoods(foods)).toEqual([]);
  // Back on the search, which no longer finds it.
  expect(screen.getByLabelText('Rechercher un aliment')).toHaveDisplayValue('pain');
  expect(await screen.findByText('Aucun aliment trouvé.')).toBeTruthy();
});

test('a Ciqual food has no edit or delete button, and its fiche names the meal of the screen', async () => {
  await setup({ meal: 'dinner' });
  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));

  expect(screen.getByText('Ajouter à Dîner')).toBeTruthy();
  expect(screen.getByText('Retour')).toBeTruthy();
  expect(screen.queryByText('Modifier l’aliment')).toBeNull();
  expect(screen.queryByText('Supprimer l’aliment')).toBeNull();
});

test('« Récents » lists what was added with its quantity, opens it with that quantity, and says when the food is gone', async () => {
  const { foods, meals } = await setup();
  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  await fireEvent.changeText(screen.getByLabelText('Quantité (g)'), '150,5');
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
  await fireEvent.press(screen.getByText('Retour'));

  await fireEvent.press(screen.getByText('Récents'));
  expect(screen.getByText('Riz blanc, cru')).toBeTruthy();
  expect(screen.getByText('150,5 g')).toBeTruthy();
  await fireEvent.press(screen.getByText('Riz blanc, cru'));
  expect(await screen.findByLabelText('Quantité (g)')).toHaveDisplayValue('150,5');
  // The quantity eaten last time is offered as a chip.
  expect(screen.getByText('150,5 g')).toBeTruthy();
  expect(screen.getByText('527 kcal · 10,5 g de protéines · 117,4 g de glucides · 0,9 g de lipides')).toBeTruthy();
  await fireEvent.press(screen.getByText('Retour'));

  // A custom food eaten once, then deleted.
  await act(async () => {
    await foods.create(bread);
  });
  await act(async () => {
    await meals.logFood('lunch', customFoods(foods)[0], 50);
  });
  expect(screen.getByText('Pain maison')).toBeTruthy();
  expect(screen.queryByText('Cet aliment n’existe plus.')).toBeNull();
  await act(async () => {
    await foods.remove(customFoods(foods)[0].ref.id);
  });
  await fireEvent.press(screen.getByText('Pain maison'));

  expect(await screen.findByText('Cet aliment n’existe plus.')).toBeTruthy();
  expect(screen.queryByText('Recherche indisponible.')).toBeNull();
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
});

test('the quantity eaten last is not offered twice when it is 100 g', async () => {
  const { meals } = await setup();
  await act(async () => {
    await meals.logFood('lunch', rawRice, 100);
  });

  await fireEvent.press(screen.getByText('Récents'));
  await fireEvent.press(screen.getByText('Riz blanc, cru'));

  expect(await screen.findByLabelText('Quantité (g)')).toHaveDisplayValue('100');
  expect(screen.getAllByText('100 g')).toHaveLength(1);
});

test('deleting a custom food opened from « Récents » lands on the search', async () => {
  const { foods, meals } = await setup();
  await act(async () => {
    await foods.create(bread);
  });
  await act(async () => {
    await meals.logFood('lunch', customFoods(foods)[0], 50);
  });

  await fireEvent.press(screen.getByText('Récents'));
  await fireEvent.press(screen.getByText('Pain maison'));
  await fireEvent.press(await screen.findByText('Supprimer l’aliment'));

  expect(customFoods(foods)).toEqual([]);
  expect(isChecked('Recherche')).toBe(true);
  expect(screen.getByLabelText('Rechercher un aliment')).toBeTruthy();
});

test('a favorite is logged into the meal of the screen', async () => {
  const { entries, meals, onDone } = await setup({ meal: 'dinner' });
  await act(async () => {
    await meals.logFood('lunch', rawRice, 200);
  });
  await act(async () => {
    await meals.saveFavorite('Riz du midi', entries.entries);
  });

  await fireEvent.press(screen.getByText('Favoris'));
  expect(screen.getByText('Riz du midi')).toBeTruthy();
  expect(screen.getByText('Riz blanc, cru')).toBeTruthy();
  await fireEvent.press(screen.getByText('Riz du midi'));

  await waitFor(() => expect(entries.entries).toHaveLength(2));
  expect(entries.entries[1]).toMatchObject({ meal: 'dinner', foodRef: rawRice.ref, foodName: 'Riz blanc, cru', grams: 200, macros: { kcal: 700, protein: 14, carbs: 156, fat: 1.2 } });
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the bin of a favorite asks first: « Annuler » keeps it, « Supprimer » hands the removal to run', async () => {
  const writes: (() => Promise<void>)[] = [];
  const { entries, meals } = await setup({ run: (write) => void writes.push(write) });
  await act(async () => {
    await meals.logFood('lunch', rawRice, 200);
  });
  await act(async () => {
    await meals.saveFavorite('Riz du midi', entries.entries);
    await meals.saveFavorite('Pain du soir', entries.entries);
  });
  await fireEvent.press(screen.getByText('Favoris'));

  await fireEvent.press(screen.getByLabelText('Supprimer le favori Riz du midi'));
  expect(screen.getByText('Supprimer le favori Riz du midi ?')).toBeTruthy();
  expect(writes).toHaveLength(0);
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByText('Supprimer le favori Riz du midi ?')).toBeNull();
  expect(screen.getByText('Riz du midi')).toBeTruthy();
  expect(writes).toHaveLength(0);

  // Touching outside the dialog (Paper's backdrop) keeps it too.
  await fireEvent.press(screen.getByLabelText('Supprimer le favori Riz du midi'));
  await fireEvent.press(screen.getByLabelText('Close modal'));
  expect(screen.queryByText('Supprimer le favori Riz du midi ?')).toBeNull();
  expect(writes).toHaveLength(0);

  await fireEvent.press(screen.getByLabelText('Supprimer le favori Riz du midi'));
  await fireEvent.press(screen.getByText('Supprimer'));
  expect(screen.queryByText('Supprimer le favori Riz du midi ?')).toBeNull();
  // Nothing is deleted until run runs the write.
  expect(writes).toHaveLength(1);
  expect(screen.getByText('Riz du midi')).toBeTruthy();
  await act(async () => {
    await writes[0]();
  });
  expect(screen.queryByText('Riz du midi')).toBeNull();
  expect(screen.getByText('Pain du soir')).toBeTruthy();
  expect(entries.entries).toHaveLength(1);
});

test('a late answer to an earlier search is ignored', async () => {
  const { catalog, answer } = manualCatalog();
  await setup({ catalog });

  await search('ri');
  await search('riz');
  // The second question is answered first, the first one late.
  await answer('riz', [cookedRice]);
  expect(screen.getByText('Riz blanc, cuit, sans sel ajouté')).toBeTruthy();
  await answer('ri', [rawRice]);

  expect(screen.queryByText('Riz blanc, cru')).toBeNull();
  expect(screen.getByText('Riz blanc, cuit, sans sel ajouté')).toBeTruthy();
});

test('« Aucun aliment trouvé. » waits for the answer to the current search', async () => {
  const { catalog, answer } = manualCatalog();
  await setup({ catalog });

  await search('riz');
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  await answer('riz', []);
  expect(screen.getByText('Aucun aliment trouvé.')).toBeTruthy();

  await search('riz blanc');
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  await answer('riz blanc', [rawRice]);
  expect(screen.getByText('Riz blanc, cru')).toBeTruthy();
});

test('each list says when it is empty', async () => {
  await setup();
  expect(screen.getByText('Tapez le nom d’un aliment.')).toBeTruthy();
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();

  // A search that finds nothing, then nothing typed or only spaces: back to the hint.
  for (const blank of ['', '   ']) {
    await search('zzz');
    expect(await screen.findByText('Aucun aliment trouvé.')).toBeTruthy();
    expect(screen.queryByText('Tapez le nom d’un aliment.')).toBeNull();
    await search(blank);
    expect(screen.getByText('Tapez le nom d’un aliment.')).toBeTruthy();
    expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  }

  await fireEvent.press(screen.getByText('Récents'));
  expect(screen.getByText('Aucun aliment récent.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Favoris'));
  expect(screen.getByText('Aucun favori. Enregistrez un repas depuis le journal.')).toBeTruthy();
});

test('custom foods that match come before the Ciqual results', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create({ ...bread, name: 'Riz maison' });
  });

  await search('riz');
  await screen.findByText('Riz blanc, cru');

  expect(screen.getAllByText(/^Riz/).map((title) => title.props.children)).toEqual(['Riz maison', 'Riz blanc, cru', 'Riz blanc, cuit, sans sel ajouté']);
});

test('a catalog that fails says the search is unavailable and leaves the custom foods', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const failing: FoodCatalog = { search: () => Promise.reject(new Error('disk')), get: async () => undefined };
  const { foods } = await setup({ catalog: failing });
  await act(async () => {
    await foods.create(bread);
  });

  await search('pain');
  expect(await screen.findByText('Pain maison')).toBeTruthy();
  expect(await screen.findByText('Recherche indisponible.')).toBeTruthy();
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  // « Aucun aliment trouvé. » would be false: the Ciqual foods were not searched.
  await search('zzz');
  expect(await screen.findByText('Recherche indisponible.')).toBeTruthy();
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  expect(warn).toHaveBeenCalledWith(new Error('disk'));
});

test('« Aucun aliment trouvé. » also waits for the custom foods', async () => {
  const { catalog, answer } = manualCatalog();
  let release = () => {};
  await setup({
    catalog,
    observeCustom: (onNext) => {
      release = () => onNext([]);
      return () => {};
    },
  });

  await search('zzz');
  await answer('zzz', []);
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  await act(async () => release());
  expect(screen.getByText('Aucun aliment trouvé.')).toBeTruthy();
});

test('« Retour » brings the results back, with the search and the filter as they were', async () => {
  await setup();
  await search('riz');
  await fireEvent.press(screen.getByText('Cru'));
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  expect(screen.queryByLabelText('Rechercher un aliment')).toBeNull();

  await fireEvent.press(screen.getByText('Retour'));

  expect(screen.getByLabelText('Rechercher un aliment')).toHaveDisplayValue('riz');
  expect(isSelected('Cru')).toBe(true);
  expect(await screen.findByText('Riz blanc, cru')).toBeTruthy();
  expect(screen.queryByText('Riz blanc, cuit, sans sel ajouté')).toBeNull();
});

test('« Ajouter » needs a quantity above 0 and up to 5 000 g, typed with a comma or a point', async () => {
  const { entries } = await setup();
  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));

  const field = screen.getByLabelText('Quantité (g)');
  for (const [text, valid] of [['0', false], ['', false], ['abc', false], ['5001', false], ['5000', true], ['0,1', true], ['12.5', true]] as const) {
    await fireEvent.changeText(field, text);
    if (valid) expect(screen.getByText('Ajouter à Déjeuner')).toBeEnabled();
    else expect(screen.getByText('Ajouter à Déjeuner')).toBeDisabled();
    // The reason is given for a quantity that was typed and is wrong, not for an empty field.
    const reason = screen.queryByText('La quantité doit être comprise entre 0 et 5 000 g.');
    if (valid || text === '') expect(reason).toBeNull();
    else expect(reason).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  }

  await fireEvent.changeText(field, '150,5');
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
  expect(entries.entries.map((entry) => entry.grams)).toEqual([150.5]);
});

test('a favorite or a recent does nothing until the custom foods have arrived', async () => {
  let release = () => {};
  const { entries, meals, onDone } = await setup({
    observeCustom: (onNext) => {
      release = () => onNext([]);
      return () => {};
    },
  });
  await act(async () => {
    await meals.logFood('lunch', rawRice, 200);
  });
  await act(async () => {
    await meals.saveFavorite('Riz du midi', entries.entries);
  });

  await fireEvent.press(screen.getByText('Favoris'));
  await fireEvent.press(screen.getByText('Riz du midi'));
  await fireEvent.press(screen.getByText('Récents'));
  await fireEvent.press(screen.getByText('Riz blanc, cru'));
  expect(entries.entries).toHaveLength(1);
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();

  await act(async () => release());
  await fireEvent.press(screen.getByText('Riz blanc, cru'));
  expect(await screen.findByLabelText('Quantité (g)')).toBeTruthy();
});

test('« Ajouter à … » adds the food once, however often it is touched before the screen is left', async () => {
  const { entries, onDone } = await setup();
  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));

  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));

  expect(entries.entries).toHaveLength(1);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a favorite is logged once, however often it is touched before the screen is left', async () => {
  const { entries, meals, onDone } = await setup({ meal: 'dinner' });
  await act(async () => {
    await meals.logFood('lunch', rawRice, 200);
  });
  await act(async () => {
    await meals.saveFavorite('Riz du midi', entries.entries);
  });

  await fireEvent.press(screen.getByText('Favoris'));
  await fireEvent.press(screen.getByText('Riz du midi'));
  await fireEvent.press(screen.getByText('Riz du midi'));

  await waitFor(() => expect(entries.entries).toHaveLength(2));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a recent whose lookup fails says the search is unavailable, not that the food is gone', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const failing: FoodCatalog = { ...inMemoryFoodCatalog([rawRice]), get: () => Promise.reject(new Error('disk')) };
  const { meals } = await setup({ catalog: failing });
  await act(async () => {
    await meals.logFood('lunch', rawRice, 100);
  });

  await fireEvent.press(screen.getByText('Récents'));
  await fireEvent.press(screen.getByText('Riz blanc, cru'));

  expect(await screen.findByText('Recherche indisponible.')).toBeTruthy();
  // « Cet aliment n’existe plus. » would be false: the food was not looked up.
  expect(screen.queryByText('Cet aliment n’existe plus.')).toBeNull();
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
  expect(warn).toHaveBeenCalledWith(new Error('disk'));
});
