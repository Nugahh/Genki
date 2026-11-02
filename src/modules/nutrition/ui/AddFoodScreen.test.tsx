import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { DEFAULT_PROFILE, type Profile } from '@/modules/settings';
import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodCatalog } from '../adapters/inMemoryFoodCatalog';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import { inMemoryFoodRepository } from '../adapters/inMemoryFoodRepository';
import { foodUseCases, type FoodUseCases } from '../application/foodUseCases';
import { productSearch } from '../application/productSearch';
import { starredFoodUseCases } from '../application/starredFoods';
import { inMemoryStarredFoodRepository } from '../adapters/inMemoryStarredFoodRepository';
import { rateLimiter } from '../domain/rateLimiter';
import { inMemoryProductSource } from '../adapters/inMemoryProductSource';
import type { OffProduct } from '../domain/openFoodFacts';
import { mealUseCases } from '../application/mealUseCases';
import type { FoodCatalog, ProductSource } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { AddFoodScreen } from './AddFoodScreen';
import type { ScanCamera } from './ScanScreen';

const clock = { now: () => new Date('2026-10-24T10:00:00Z') }; // 12:00 in Paris
const pickWhen = jest.fn(async () => undefined as Date | undefined);
const rawRice: Food = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [] };
const cookedRice: Food = {
  ref: { type: 'ciqual', id: '9101' },
  name: 'Riz blanc, cuit, sans sel ajouté',
  state: 'cooked',
  per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  portions: [],
};
const bread: FoodInput = { name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 }, portions: [{ label: '1 tranche', grams: 30 }] };

const orange: Food = {
  ref: { type: 'ciqual', id: '13014' }, name: 'Orange, pulpe, crue', state: 'raw', per100g: { kcal: 45, protein: 0.9, carbs: 9, fat: 0.2 }, portions: [],
  nutrients: { vitC: 50, fiber: 1.8, salt: 0.01 },
};

type Options = { brandProducts?: OffProduct[]; productSource?: ProductSource; profile?: Profile; catalog?: FoodCatalog; meal?: Meal; observeCustom?: FoodUseCases['observeCustom']; run?: (write: () => Promise<void>) => void };

async function setup({ catalog = inMemoryFoodCatalog([rawRice, cookedRice, orange]), meal = 'lunch', observeCustom, profile = DEFAULT_PROFILE, brandProducts = [], productSource, run = (write) => void write() }: Options = {}) {
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const foods = { ...foodUseCases({ catalog, repo: inMemoryFoodRepository() }), ...(observeCustom && { observeCustom }) };
  const meals = mealUseCases({ entries, favorites, clock, timezone: DEFAULT_PROFILE.timezone });
  const stars = starredFoodUseCases(inMemoryStarredFoodRepository());
  // No pause before asking: the tests are not about the typing.
  const products = productSearch({ source: productSource ?? inMemoryProductSource(brandProducts), limiter: rateLimiter(10, 60000, Date.now), lookupLimiter: rateLimiter(15, 60000, Date.now), pauseMs: 0 });
  let scan: (code: string) => void = () => {};
  const camera: ScanCamera = ({ onScan }) => {
    scan = onScan;
    return <Text>Caméra</Text>;
  };
  const onDone = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <AddFoodScreen meal={meal} meals={meals} foods={foods} stars={stars} products={products} camera={camera} run={run} onDone={onDone} profile={profile} clock={clock} pickWhen={pickWhen} />
    </PaperProvider>,
  );
  return { entries, favorites, foods, meals, stars, onDone, scan: (code: string) => act(async () => scan(code)) };
}

/** The saved meals sit in the third tab, under « Repas ». */
const openMeals = async () => {
  await fireEvent.press(screen.getByText('Personnalisé'));
  await fireEvent.press(screen.getByText('Repas'));
};
/** The form that creates a food: the third tab, « Créer un aliment ». */
const openCreate = async () => {
  await fireEvent.press(screen.getByText('Personnalisé'));
  await fireEvent.press(screen.getByText('Créer un aliment'));
};
const search = (text: string) => fireEvent.changeText(screen.getByLabelText('Rechercher un aliment'), text);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

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

  expect(screen.getByText('Récents')).toBeTruthy();
  await search('riz');
  expect(await screen.findByText('Riz blanc, cru')).toBeTruthy();
  expect(screen.getByText('Riz blanc, cuit, sans sel ajouté')).toBeTruthy();
  // The pills are lower case; the filter chips start with a capital.
  expect(screen.getByText('cru')).toBeTruthy();
  expect(screen.getByText('cuit')).toBeTruthy();
  expect(screen.getByText('350 kcal / 100 g')).toBeTruthy();
  expect(screen.getByText('130 kcal / 100 g')).toBeTruthy();
  expect(screen.queryByText('Récents')).toBeNull();

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
  // By relevance, wherever the food comes from: all start with « riz », so the shorter name first.
  expect(titles()).toEqual(['Riz au lait', 'Riz blanc, cru', 'Riz sauté maison', 'Riz blanc, cuit, sans sel ajouté']);
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

test('a created food is listed under Personnalisé, with its line, and found by the search', async () => {
  const { foods } = await setup();
  await openCreate();
  await type('Nom', 'Pain maison');
  await type('Calories pour 100 g', '250');
  await type('Protéines pour 100 g', '8');
  await type('Glucides pour 100 g', '48');
  await type('Lipides pour 100 g', '2');
  await fireEvent.press(screen.getByText('Ajouter une portion'));
  await type('Nom de la portion', '1 tranche');
  await type('Poids (g)', '30');
  await fireEvent.press(screen.getByText('Enregistrer'));

  // The form closes on the list of the user's foods.
  expect(screen.queryByLabelText('Nom')).toBeNull();
  expect(screen.getByText('Pain maison')).toBeTruthy();
  expect(await screen.findByText('250 kcal / 100 g')).toBeTruthy();
  expect(customFoods(foods)).toEqual([{ ref: { type: 'custom', id: expect.any(String) }, ...bread }]);

  await fireEvent.press(screen.getByText('Tout'));
  await search('pain');
  expect(await screen.findByText('Pain maison')).toBeTruthy();
});

test('« Annuler » closes the form without creating anything', async () => {
  const { foods } = await setup();
  await openCreate();
  await type('Nom', 'Brouillon');
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.getByText('Créer un aliment')).toBeTruthy();
  expect(customFoods(foods)).toEqual([]);
});

test('the foods of the user are listed by name under « Aliments », and one opens its fiche', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create({ ...bread, name: 'Pain maison' });
    await foods.create({ ...bread, name: 'Yaourt maison' });
    await foods.create({ ...bread, name: 'Boeuf haché' });
  });
  await fireEvent.press(screen.getByText('Personnalisé'));
  expect(screen.getAllByText(/ maison$| haché$/).map((n) => n.props.children)).toEqual(['Boeuf haché', 'Pain maison', 'Yaourt maison']);
  await fireEvent.press(screen.getByText('Yaourt maison'));
  expect(screen.getByText('Source : Mon aliment')).toBeTruthy();
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

  // A deleted food does not come back: the button asks first, and « Annuler » keeps the food.
  await fireEvent.press(screen.getByText('Supprimer l’aliment'));
  expect(screen.getByText('Supprimer l’aliment Pain de mie ?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByText('Supprimer l’aliment Pain de mie ?')).toBeNull();
  expect(customFoods(foods)).toHaveLength(1);
  await fireEvent.press(screen.getByText('Supprimer l’aliment'));
  await fireEvent.press(screen.getByText('Supprimer'));
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

test('the recents list what was added with its quantity, opens it with that quantity, and says when the food is gone', async () => {
  const { foods, meals } = await setup();
  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  await fireEvent.changeText(screen.getByLabelText('Quantité (g)'), '150,5');
  await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
  await fireEvent.press(screen.getByText('Retour'));

  // Nothing typed: the recents are under the field.
  await search('');
  expect(screen.getByText('Récents')).toBeTruthy();
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

  await fireEvent.press(screen.getByText('Riz blanc, cru'));

  expect(await screen.findByLabelText('Quantité (g)')).toHaveDisplayValue('100');
  expect(screen.getAllByText('100 g')).toHaveLength(1);
});

test('deleting a custom food opened from « Récents » comes back to the search', async () => {
  const { foods, meals } = await setup();
  await act(async () => {
    await foods.create(bread);
  });
  await act(async () => {
    await meals.logFood('lunch', customFoods(foods)[0], 50);
  });

  await fireEvent.press(screen.getByText('Pain maison'));
  await fireEvent.press(await screen.findByText('Supprimer l’aliment'));
  await fireEvent.press(screen.getByText('Supprimer'));

  expect(customFoods(foods)).toEqual([]);
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

  await openMeals();
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
  await openMeals();

  await fireEvent.press(screen.getByLabelText('Supprimer le repas Riz du midi'));
  expect(screen.getByText('Supprimer le repas Riz du midi ?')).toBeTruthy();
  expect(writes).toHaveLength(0);
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.queryByText('Supprimer le repas Riz du midi ?')).toBeNull();
  expect(screen.getByText('Riz du midi')).toBeTruthy();
  expect(writes).toHaveLength(0);

  // Touching outside the dialog (Paper's backdrop) keeps it too.
  await fireEvent.press(screen.getByLabelText('Supprimer le repas Riz du midi'));
  await fireEvent.press(screen.getByLabelText('Close modal'));
  expect(screen.queryByText('Supprimer le repas Riz du midi ?')).toBeNull();
  expect(writes).toHaveLength(0);

  await fireEvent.press(screen.getByLabelText('Supprimer le repas Riz du midi'));
  await fireEvent.press(screen.getByText('Supprimer'));
  expect(screen.queryByText('Supprimer le repas Riz du midi ?')).toBeNull();
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
  expect(screen.getByText('Récents')).toBeTruthy();
  expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();

  // A search that finds nothing, then nothing typed or only spaces: back to the hint.
  for (const blank of ['', '   ']) {
    await search('zzz');
    expect(await screen.findByText('Aucun aliment trouvé.')).toBeTruthy();
    expect(screen.queryByText('Récents')).toBeNull();
    await search(blank);
    expect(screen.getByText('Récents')).toBeTruthy();
    expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  }

  expect(screen.getByText('Aucun aliment récent. Cherche un aliment ou scanne un code-barres.')).toBeTruthy();
  await openMeals();
  expect(screen.getByText('Aucun repas enregistré. Dans le journal, touche « Enregistrer comme repas » sous un repas.')).toBeTruthy();
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

  await openMeals();
  await fireEvent.press(screen.getByText('Riz du midi'));
  await fireEvent.press(screen.getByText('Tout'));
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

  await openMeals();
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

  await fireEvent.press(screen.getByText('Riz blanc, cru'));

  expect(await screen.findByText('Recherche indisponible.')).toBeTruthy();
  // « Cet aliment n’existe plus. » would be false: the food was not looked up.
  expect(screen.queryByText('Cet aliment n’existe plus.')).toBeNull();
  expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
  expect(warn).toHaveBeenCalledWith(new Error('disk'));
});

test('what appears under the fields is announced to a screen reader: the empty and failed searches, the quantity error, the macros, the empty recents', async () => {
  const polite = (node: { props: { accessibilityLiveRegion?: string } }) => node.props.accessibilityLiveRegion;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await setup();
  await search('zzz');
  expect(polite(await screen.findByText('Aucun aliment trouvé.'))).toBe('polite');

  await search('riz');
  await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  await fireEvent.changeText(screen.getByLabelText('Quantité (g)'), '6000');
  expect(polite(screen.getByText('La quantité doit être comprise entre 0 et 5 000 g.'))).toBe('polite');
  await fireEvent.changeText(screen.getByLabelText('Quantité (g)'), '100');
  expect(polite(screen.getByText(/de protéines/))).toBe('polite');
  await fireEvent.press(screen.getByText('Retour'));

  await search('');
  expect(polite(screen.getByText('Aucun aliment récent. Cherche un aliment ou scanne un code-barres.'))).toBe('polite');
});

test('a search that cannot run is announced too', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await setup({ catalog: { search: () => Promise.reject(new Error('no database')), get: async () => undefined } });
  await search('riz');
  expect((await screen.findByText('Recherche indisponible.')).props.accessibilityLiveRegion).toBe('polite');
});

describe('the nutrients of a fiche', () => {
  const open = async () => {
    await search('orange');
    await fireEvent.press(await screen.findByText('Orange, pulpe, crue'));
  };

  test('are listed for the portion, with the share of the reference, once the list is opened', async () => {
    await setup();
    await open();
    expect(screen.queryByText('Vitamine C')).toBeNull();
    await fireEvent.press(screen.getByText('Nutriments'));
    expect(screen.getByLabelText('Vitamine C, 50 mg, 45 % du repère')).toBeTruthy();
    expect(screen.getByLabelText('Fibres, 1,8 g, 6 % du repère')).toBeTruthy();
    await type('Quantité (g)', '200');
    expect(screen.getByLabelText('Vitamine C, 100 mg, 91 % du repère')).toBeTruthy();
  });

  test('say how many the table does not give', async () => {
    await setup();
    await open();
    await fireEvent.press(screen.getByText('Nutriments'));
    expect(screen.getByText('23 nutriments ne sont pas renseignés pour cet aliment.')).toBeTruthy();
  });

  test('have no percentage without references', async () => {
    await setup({ profile: { ...DEFAULT_PROFILE, birthYear: 2012 } });
    await open();
    await fireEvent.press(screen.getByText('Nutriments'));
    expect(screen.getByLabelText('Vitamine C, 50 mg')).toBeTruthy();
  });

  test('are not offered for a quantity that is not valid', async () => {
    await setup();
    await open();
    await type('Quantité (g)', '0');
    expect(screen.queryByText('Nutriments')).toBeNull();
  });

  test('are not there for a food with none: Ciqual missing them, or a food of one’s own', async () => {
    await setup();
    await search('riz');
    await fireEvent.press(await screen.findByText('Riz blanc, cru'));
    expect(screen.queryByText('Nutriments')).toBeNull();
  });
});

describe('the sheet of a food', () => {
  const kcal = (n: number) => n.toLocaleString('fr-FR');
  const openRice = async () => {
    await search('riz');
    await fireEvent.press(await screen.findByText('Riz blanc, cru'));
  };

  test('names where the figures come from', async () => {
    const { foods } = await setup();
    await openRice();
    expect(screen.getByText('Source : Ciqual (ANSES)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retour'));
    await act(async () => {
      await foods.create(bread);
    });
    await search('pain maison');
    await fireEvent.press(await screen.findByText('Pain maison'));
    expect(screen.getByText('Source : Mon aliment')).toBeTruthy();
  });

  test('adds the food to the group chosen in the sheet', async () => {
    const { entries } = await setup({ meal: 'lunch' });
    await openRice();
    await fireEvent.press(screen.getByText('Dîner'));
    await fireEvent.press(screen.getByText('Ajouter à Dîner'));
    expect(entries.entries[0].meal).toBe('dinner');
  });

  test('adds the food at the day and time chosen, in the zone of the profile', async () => {
    pickWhen.mockResolvedValueOnce(new Date('2026-10-22T22:30:00Z')); // 00:30 in Paris on the 23rd
    const { entries } = await setup();
    await openRice();
    await fireEvent.press(screen.getByLabelText(/^Choisir le jour/));
    expect(screen.getByText('Hier')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
    expect(entries.entries[0]).toMatchObject({ day: '2026-10-23', createdAt: new Date('2026-10-22T22:30:00Z') });
  });

  test('without a choice the food is logged at the moment it is added', async () => {
    const { entries } = await setup();
    await openRice();
    await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
    expect(entries.entries[0]).toMatchObject({ day: '2026-10-24', createdAt: new Date('2026-10-24T10:00:00Z') });
  });

  test('refuses a time in the future: said, and nothing to add', async () => {
    pickWhen.mockResolvedValueOnce(new Date('2026-10-24T11:00:00Z'));
    const { entries } = await setup();
    await openRice();
    await fireEvent.press(screen.getByLabelText(/^Choisir l’heure/));
    expect(screen.getByText('L’heure choisie est dans le futur.')).toBeTruthy();
    expect(screen.getByText('Ajouter à Déjeuner')).toBeDisabled();
    expect(entries.entries).toEqual([]);
  });

  test('shows the energy ring of the portion and the goals of the day with it, counting what the day holds already', async () => {
    const { meals } = await setup();
    await act(async () => {
      await meals.logFood('breakfast', rawRice, 100);
    });
    await openRice();
    expect(screen.getByRole('image').props.accessibilityLabel).toMatch(/^Énergie : 350 kcal\./);
    expect(screen.getByText('Objectifs avec cette portion')).toBeTruthy();
    expect(screen.getByLabelText(`Énergie : ${kcal(700)} sur ${kcal(2200)} kcal avec cette portion`)).toBeTruthy();
    await type('Quantité (g)', '200');
    expect(screen.getByLabelText(`Énergie : ${kcal(1050)} sur ${kcal(2200)} kcal avec cette portion`)).toBeTruthy();
  });

  test('says the net carbs are only the carbohydrates when the fibre is not known', async () => {
    await setup();
    await openRice();
    expect(screen.getByText('Glucides nets (partiel)')).toBeTruthy();
  });
});

test('editing a custom food from its sheet keeps the quantity, group and time typed so far', async () => {
  const { foods } = await setup();
  await act(async () => {
    await foods.create(bread);
  });
  await search('pain');
  await fireEvent.press(await screen.findByText('Pain maison'));
  await type('Quantité (g)', '55');
  await fireEvent.press(screen.getByText('Dîner'));
  await fireEvent.press(screen.getByText('Modifier l’aliment'));
  expect(screen.getByText('Enregistrer les modifications')).toBeTruthy();
  await fireEvent.press(screen.getByText('Annuler'));
  expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('55');
  expect(screen.getByText('Ajouter à Dîner')).toBeTruthy();
});

describe('the products of brands', () => {
  const cocaCola: OffProduct = {
    code: '5449000000996', product_name_fr: 'Coca-Cola', brands: 'Coca-Cola Services', quantity: '330 ml', serving_size: '1 portion (330 ml)',
    nutriments: { 'energy-kcal_100g': 42.4, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0, sugars_100g: 10.6 },
  };
  const zero: OffProduct = {
    code: '5449000131805', product_name_fr: 'Zéro sucres', brands: 'Coca-Cola Services', quantity: '1,5 L',
    nutriments: { 'energy-kcal_100g': 0.3, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
  };
  /** A source whose answer comes when the test says so. */
  const deferred = () => {
    let resolve!: (products: OffProduct[]) => void;
    const answer = new Promise<OffProduct[]>((r) => (resolve = r));
    const source: ProductSource = { search: () => answer, byBarcode: async () => undefined };
    return { source, resolve };
  };

  test('are in the one list, under their name: the size of the package and the brand, and the source on the right', async () => {
    await setup({ brandProducts: [cocaCola] });
    await search('coca');
    expect(await screen.findByText('Coca-Cola')).toBeTruthy();
    expect(screen.getByText('330 ml · Coca-Cola Services · 42 kcal / 100 g')).toBeTruthy();
    expect(screen.getByText('Open Food Facts')).toBeTruthy();
  });

  test('arrive after Ciqual and the foods of the user, and take their place by relevance', async () => {
    const { source, resolve } = deferred();
    const ciqualCoco: Food = { ref: { type: 'ciqual', id: '1' }, name: 'Boisson cocacolatée', state: 'other', per100g: { kcal: 40, protein: 0, carbs: 10, fat: 0 }, portions: [] };
    await setup({ catalog: inMemoryFoodCatalog([ciqualCoco]), productSource: source });
    await search('coca');
    expect(await screen.findByText('Boisson cocacolatée')).toBeTruthy();
    expect(screen.getByText('Recherche de produits…')).toBeTruthy();
    expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();

    await act(async () => resolve([cocaCola]));
    await screen.findByText('Coca-Cola');
    expect(screen.queryByText('Recherche de produits…')).toBeNull();
    // « Coca-Cola » starts with the search, « Boisson cocacolatée » only contains it.
    const names = screen.getAllByText(/^(Coca-Cola|Boisson cocacolatée)$/).map((n) => n.props.children);
    expect(names).toEqual(['Coca-Cola', 'Boisson cocacolatée']);
  });

  test('the brand answers too: « coca » finds « Zéro sucres » of Coca-Cola, below the names that start with it', async () => {
    await setup({ brandProducts: [zero, cocaCola] });
    await search('coca');
    await screen.findByText('Zéro sucres');
    const names = screen.getAllByText(/^(Coca-Cola|Zéro sucres)$/).map((n) => n.props.children);
    expect(names).toEqual(['Coca-Cola', 'Zéro sucres']);
  });

  test('say when they cannot be reached, and keep the rest', async () => {
    const source: ProductSource = { search: async () => { throw new Error('Network request failed'); }, byBarcode: async () => undefined };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await setup({ productSource: source });
    await search('riz');
    expect(await screen.findByText('Produits de marque indisponibles pour le moment (hors-ligne ou service occupé).')).toBeTruthy();
    expect(screen.getByText('Riz blanc, cru')).toBeTruthy();
    expect(screen.queryByText('Aucun aliment trouvé.')).toBeNull();
  });

  test('can be asked again after a failure', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const search_ = jest.fn().mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValueOnce([cocaCola]);
    await setup({ productSource: { search: search_, byBarcode: async () => undefined } });
    await search('coca');
    await fireEvent.press(await screen.findByText('Réessayer'));
    expect(await screen.findByText('Coca-Cola')).toBeTruthy();
    expect(screen.queryByText(/indisponibles/)).toBeNull();
    expect(search_).toHaveBeenCalledTimes(2);
  });

  test('are not asked for a food that has just been created: only what the user types is asked', async () => {
    const asked: string[] = [];
    const source: ProductSource = { search: async (q) => (asked.push(q), []), byBarcode: async () => undefined };
    await setup({ productSource: source });
    await openCreate();
    await type('Nom', 'Gâteau maison');
    await type('Calories pour 100 g', '300');
    await type('Protéines pour 100 g', '5');
    await type('Glucides pour 100 g', '40');
    await type('Lipides pour 100 g', '12');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(await screen.findByText('Gâteau maison')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(asked).toEqual([]);
    // What the user types next is asked.
    await fireEvent.press(screen.getByText('Tout'));
    await search('gâteau');
    await waitFor(() => expect(asked).toEqual(['gâteau']));
  });

  test('are not asked for under three characters, nor with the raw or cooked filter', async () => {
    const asked: string[] = [];
    const source: ProductSource = { search: async (q) => (asked.push(q), []), byBarcode: async () => undefined };
    await setup({ productSource: source });
    await search('ri');
    await search('riz');
    await waitFor(() => expect(asked).toEqual(['riz']));
    await fireEvent.press(screen.getByText('Cru'));
    await search('riz blanc');
    await new Promise((r) => setTimeout(r, 20));
    expect(asked).toEqual(['riz']);
  });

  test('are not asked again when the user comes back from a fiche', async () => {
    const asked: string[] = [];
    const source: ProductSource = { search: async (q) => (asked.push(q), [cocaCola]), byBarcode: async () => undefined };
    await setup({ productSource: source });
    await search('coca');
    await fireEvent.press(await screen.findByText('Coca-Cola'));
    await fireEvent.press(await screen.findByText('Retour'));
    expect(await screen.findByText('Coca-Cola')).toBeTruthy();
    expect(asked).toEqual(['coca']);
  });

  test('a product opens a fiche that names Open Food Facts, and adding it makes it a food of the user, once', async () => {
    const { entries, foods } = await setup({ brandProducts: [cocaCola] });
    await search('coca');
    await fireEvent.press(await screen.findByText('Coca-Cola'));
    expect(await screen.findByText('Source : Open Food Facts')).toBeTruthy();
    expect(screen.queryByText('Modifier l’aliment')).toBeNull();
    // The portion of the label, a volume taken for water, says so.
    await fireEvent.press(screen.getByText('Portion 330 ml ≈ 330 g'));
    expect(screen.getByLabelText('Quantité (g)')).toHaveDisplayValue('330');
    await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));

    let mine: Food[] = [];
    foods.observeCustom((list) => (mine = list), () => {});
    await waitFor(() => expect(entries.entries).toHaveLength(1));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: 'Coca-Cola', source: 'off', brand: 'Coca-Cola Services', barcode: '5449000000996' });
    expect(entries.entries[0]).toMatchObject({ foodRef: mine[0].ref, foodName: 'Coca-Cola', grams: 330, macros: { kcal: 139.9 } });
  });

  test('« Réessayer » after a refused write makes no second food: the retry writes the same one', async () => {
    const writes: (() => Promise<void>)[] = [];
    const { foods } = await setup({ brandProducts: [cocaCola], run: (write) => void writes.push(write) });
    await search('coca');
    await fireEvent.press(await screen.findByText('Coca-Cola'));
    await fireEvent.press(await screen.findByText('Ajouter à Déjeuner'));
    expect(writes).toHaveLength(1);
    await act(async () => {
      await writes[0]();
      await writes[0](); // « Réessayer »
    });
    let mine: Food[] = [];
    foods.observeCustom((list) => (mine = list), () => {});
    expect(mine).toHaveLength(1);
  });

  describe('touching a product', () => {
    // The list holds the name, the quantity and the macros; the portion of the label and the vitamins are in the product itself.
    const hit: OffProduct = { code: '5449000000996', product_name_fr: 'Coca-Cola', brands: 'Coca-Cola Services', quantity: '330 ml', nutriments: cocaCola.nutriments };
    const full: OffProduct = { ...hit, serving_size: '1 portion (150 ml)', nutriments: { ...cocaCola.nutriments, 'vitamin-c_100g': 0.01 } };

    test('reads the product, for its portion and its nutrients, before opening it', async () => {
      let release!: (p: OffProduct) => void;
      const byBarcode = jest.fn(() => new Promise<OffProduct>((r) => (release = r)));
      await setup({ productSource: { search: async () => [hit], byBarcode } });
      await search('coca');
      await fireEvent.press(await screen.findByText('Coca-Cola'));
      expect(byBarcode).toHaveBeenCalledWith('5449000000996', expect.anything());
      expect(screen.getByText('Chargement du produit…')).toBeTruthy();
      await act(async () => release(full));
      expect(await screen.findByText('Portion 150 ml ≈ 150 g')).toBeTruthy();
      expect(screen.getByText('Emballage 330 ml ≈ 330 g')).toBeTruthy();
      expect(screen.queryByText('Chargement du produit…')).toBeNull();
    });

    test('opens from the list when the product cannot be read: the macros are there already', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const byBarcode = jest.fn(async () => { throw new Error('HTTP 503'); });
      await setup({ productSource: { search: async () => [hit], byBarcode } });
      await search('coca');
      await fireEvent.press(await screen.findByText('Coca-Cola'));
      expect(await screen.findByText('Source : Open Food Facts')).toBeTruthy();
      expect(screen.getByText('Emballage 330 ml ≈ 330 g')).toBeTruthy();
      expect(screen.queryByText('Portion 150 ml ≈ 150 g')).toBeNull();
    });

    test('opens from the list when Open Food Facts has no such product any more', async () => {
      await setup({ productSource: { search: async () => [hit], byBarcode: async () => undefined } });
      await search('coca');
      await fireEvent.press(await screen.findByText('Coca-Cola'));
      expect(await screen.findByText('Source : Open Food Facts')).toBeTruthy();
    });

    test('« Retour » while it loads comes back to the list, and the late answer opens nothing', async () => {
      let release!: (p: OffProduct) => void;
      const byBarcode = jest.fn(() => new Promise<OffProduct>((r) => (release = r)));
      await setup({ productSource: { search: async () => [hit], byBarcode } });
      await search('coca');
      await fireEvent.press(await screen.findByText('Coca-Cola'));
      await fireEvent.press(screen.getByText('Retour'));
      expect(screen.queryByText('Chargement du produit…')).toBeNull();
      expect(screen.getByLabelText('Rechercher un aliment')).toBeTruthy();
      await act(async () => release(full));
      expect(screen.queryByText('Source : Open Food Facts')).toBeNull();
    });
  });

  test('a product the user already has is found by its brand too, even when the network has nothing', async () => {
    const { foods } = await setup({ brandProducts: [] });
    await act(async () => {
      await foods.create({ ...bread, name: 'Pâte à tartiner', barcode: '3017620422003', source: 'off', brand: 'Nutella' });
    });
    await search('nutella');
    expect(await screen.findByText('Pâte à tartiner')).toBeTruthy();
  });

  test('a product the user already has is shown as theirs, not twice', async () => {
    const { foods } = await setup({ brandProducts: [cocaCola] });
    await act(async () => {
      await foods.create({ ...bread, name: 'Coca-Cola', barcode: '5449000000996', source: 'off', brand: 'Coca-Cola Services' });
    });
    await search('coca');
    await screen.findByText('Coca-Cola');
    await waitFor(() => expect(screen.queryByText('Recherche de produits…')).toBeNull());
    expect(screen.getAllByText('Coca-Cola')).toHaveLength(1);
  });

  test('a product that is refused is not proposed', async () => {
    await setup({ brandProducts: [{ ...cocaCola, nutriments: {} }] });
    await search('coca');
    expect(await screen.findByText('Aucun aliment trouvé.')).toBeTruthy();
  });
});

describe('the scan', () => {
  const cocaProduct: OffProduct = {
    code: '5449000000996', product_name_fr: 'Coca-Cola', brands: 'Coca-Cola Services', quantity: '330 ml',
    nutriments: { 'energy-kcal_100g': 42.4, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 },
  };

  test('opens the camera from the add screen, and « Retour » comes back to the lists', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    expect(screen.getByText('Caméra')).toBeTruthy();
    expect(screen.queryByText('Favoris')).toBeNull();
    await fireEvent.press(screen.getByText('Retour'));
    expect(screen.getByText('Favoris')).toBeTruthy();
    expect(screen.getByLabelText('Rechercher un aliment')).toBeTruthy();
  });

  test('a barcode of a product of Open Food Facts opens its fiche, to be added to the meal', async () => {
    const { scan, entries } = await setup({ brandProducts: [cocaProduct] });
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    await scan('5449000000996');
    expect(await screen.findByText('Source : Open Food Facts')).toBeTruthy();
    expect(screen.getByText('Coca-Cola')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
    await waitFor(() => expect(entries.entries).toHaveLength(1));
    expect(entries.entries[0]).toMatchObject({ foodName: 'Coca-Cola', grams: 100 });
  });

  test('an unknown barcode leads to the form that creates the food, with the barcode, and the food keeps it', async () => {
    const { scan, foods } = await setup();
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    await scan('3017620422003');
    await fireEvent.press(await screen.findByText('Créer un aliment'));
    expect(screen.getByText('Code-barres : 3017620422003')).toBeTruthy();
    await type('Nom', 'Pâte maison');
    await type('Calories pour 100 g', '500');
    await type('Protéines pour 100 g', '5');
    await type('Glucides pour 100 g', '50');
    await type('Lipides pour 100 g', '30');
    await fireEvent.press(screen.getByText('Enregistrer'));

    let mine: Food[] = [];
    foods.observeCustom((list) => (mine = list), () => {});
    await waitFor(() => expect(mine).toHaveLength(1));
    expect(mine[0]).toMatchObject({ name: 'Pâte maison', barcode: '3017620422003' });
  });

  test('a barcode already used is found among the foods of the user, with no network', async () => {
    const asked: string[] = [];
    const source: ProductSource = { search: async () => [], byBarcode: async (code) => (asked.push(code), undefined) };
    const { scan, foods } = await setup({ productSource: source });
    await act(async () => {
      await foods.create({ ...bread, name: 'Mon yaourt', barcode: '3033710065967' });
    });
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    await scan('3033710065967');
    expect(await screen.findByText('Source : Mon aliment')).toBeTruthy();
    expect(asked).toEqual([]);
  });
});

describe('the tabs', () => {
  const starredList = (stars: { observe: (n: (l: { name: string }[]) => void, e: () => void) => () => void }) => {
    let list: { name: string }[] = [];
    stars.observe((next) => (list = next), () => {})();
    return list;
  };

  test('are Tout, Favoris and Personnalisé, and the page opens on Tout with the search field', async () => {
    await setup();
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityState.selected)).toEqual([true, false, false]);
    expect(screen.getAllByText(/^(Tout|Favoris|Personnalisé)$/).map((t) => t.props.children)).toEqual(['Tout', 'Favoris', 'Personnalisé']);
    expect(screen.getByLabelText('Rechercher un aliment')).toBeTruthy();
  });

  test('the scan icon sits next to the search field and opens the camera', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    expect(screen.getByText('Caméra')).toBeTruthy();
  });

  test('Favoris says what to do while no food has a star', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Favoris'));
    expect(screen.getByText('Touche l’étoile sur la fiche d’un aliment pour le retrouver ici.')).toBeTruthy();
  });

  test('Favoris lists the foods with a star, and one opens its fiche', async () => {
    const { stars } = await setup();
    await act(async () => {
      await stars.star({ ref: rawRice.ref, name: rawRice.name });
    });
    await fireEvent.press(screen.getByText('Favoris'));
    await fireEvent.press(await screen.findByLabelText('Riz blanc, cru, favori'));
    expect(await screen.findByText('Source : Ciqual (ANSES)')).toBeTruthy();
    expect(screen.getByLabelText('Retirer des favoris')).toBeTruthy();
  });

  test('a food that is gone is said, not opened', async () => {
    const { stars } = await setup();
    await act(async () => {
      await stars.star({ ref: { type: 'custom', id: 'disparu' }, name: 'Gâteau d’hier' });
    });
    await fireEvent.press(screen.getByText('Favoris'));
    await fireEvent.press(await screen.findByLabelText('Gâteau d’hier, favori'));
    expect(await screen.findByText('Cet aliment n’existe plus.')).toBeTruthy();
  });

  test('the star of a fiche puts the food in Favoris, and touching it again takes it out', async () => {
    const { stars } = await setup();
    await search('riz');
    await fireEvent.press(await screen.findByText('Riz blanc, cru'));
    await fireEvent.press(screen.getByLabelText('Mettre en favori'));
    expect(screen.getByLabelText('Retirer des favoris')).toBeTruthy();
    expect(starredList(stars).map((f) => f.name)).toEqual(['Riz blanc, cru']);

    await fireEvent.press(screen.getByLabelText('Retirer des favoris'));
    expect(screen.getByLabelText('Mettre en favori')).toBeTruthy();
    expect(starredList(stars)).toEqual([]);
  });

  test('stay on the tab that was open when the user comes back from a fiche', async () => {
    const { stars } = await setup();
    await act(async () => {
      await stars.star({ ref: rawRice.ref, name: rawRice.name });
    });
    await fireEvent.press(screen.getByText('Favoris'));
    await fireEvent.press(await screen.findByLabelText('Riz blanc, cru, favori'));
    await fireEvent.press(await screen.findByText('Retour'));
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityState.selected)).toEqual([false, true, false]);
  });

  test('« Annuler » forgets the barcode of a scan: the next food created is not given it', async () => {
    const { scan } = await setup();
    await fireEvent.press(screen.getByLabelText('Scanner un code-barres'));
    await scan('3017620422003');
    await fireEvent.press(await screen.findByText('Créer un aliment'));
    expect(screen.getByText('Code-barres : 3017620422003')).toBeTruthy();
    await fireEvent.press(screen.getByText('Annuler'));
    await fireEvent.press(screen.getByText('Créer un aliment'));
    expect(screen.queryByText(/Code-barres/)).toBeNull();
  });

  test('the third tab offers the foods and the saved meals', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Personnalisé'));
    expect(screen.getByText('Créer un aliment')).toBeTruthy();
    await fireEvent.press(screen.getByText('Repas'));
    expect(screen.queryByText('Créer un aliment')).toBeNull();
    expect(screen.getByText('Aucun repas enregistré. Dans le journal, touche « Enregistrer comme repas » sous un repas.')).toBeTruthy();
  });

  test('deleting a food takes its star with it', async () => {
    const { foods, stars } = await setup();
    await act(async () => {
      await foods.create(bread);
    });
    const food = customFoods(foods)[0];
    await act(async () => {
      await stars.star({ ref: food.ref, name: food.name });
    });
    await fireEvent.press(screen.getByText('Favoris'));
    await fireEvent.press(await screen.findByLabelText('Pain maison, favori'));
    await fireEvent.press(await screen.findByText('Supprimer l’aliment'));
    await fireEvent.press(screen.getByText('Supprimer'));
    expect(customFoods(foods)).toEqual([]);
    expect(starredList(stars)).toEqual([]);
  });

  test('the star of a food that is gone can be taken off from the list', async () => {
    const { stars } = await setup();
    await act(async () => {
      await stars.star({ ref: { type: 'custom', id: 'disparu' }, name: 'Gâteau d’hier' });
    });
    await fireEvent.press(screen.getByText('Favoris'));
    await fireEvent.press(await screen.findByLabelText('Gâteau d’hier, favori'));
    await fireEvent.press(await screen.findByText('Retirer Gâteau d’hier des favoris'));
    expect(starredList(stars)).toEqual([]);
    expect(screen.queryByText('Cet aliment n’existe plus.')).toBeNull();
    expect(screen.getByText('Touche l’étoile sur la fiche d’un aliment pour le retrouver ici.')).toBeTruthy();
  });

  test('the star of a product of a brand makes it a food of the user, then stars it', async () => {
    const cocaCola: OffProduct = {
      code: '5449000000996', product_name_fr: 'Coca-Cola', brands: 'Coca-Cola Services', quantity: '330 ml',
      nutriments: { 'energy-kcal_100g': 42.4, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 },
    };
    const { foods, stars, entries } = await setup({ brandProducts: [cocaCola] });
    await search('coca');
    await fireEvent.press(await screen.findByText('Coca-Cola'));
    await fireEvent.press(await screen.findByLabelText('Mettre en favori'));
    expect(customFoods(foods)).toHaveLength(1);
    expect(customFoods(foods)[0]).toMatchObject({ name: 'Coca-Cola', barcode: '5449000000996' });
    expect(starredList(stars).map((f) => f.name)).toEqual(['Coca-Cola']);
    // The fiche is now the food of the user: adding it uses it and makes no second one.
    await fireEvent.press(screen.getByText('Ajouter à Déjeuner'));
    await waitFor(() => expect(entries.entries).toHaveLength(1));
    expect(customFoods(foods)).toHaveLength(1);
    expect(entries.entries[0].foodRef).toEqual(customFoods(foods)[0].ref);
  });
});
