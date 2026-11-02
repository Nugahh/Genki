import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { PaperProvider } from 'react-native-paper';
import type { FoodInput } from '../domain/food';
import { FoodForm } from './FoodForm';

async function setup(props: Partial<ComponentProps<typeof FoodForm>> = {}) {
  const onSubmit = jest.fn();
  await render(
    <PaperProvider>
      <FoodForm submitLabel="Enregistrer" onSubmit={onSubmit} {...props} />
    </PaperProvider>,
  );
  return { onSubmit };
}

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

/** Paper marks the chosen segment with `accessibilityState.checked`, which the `checked` filter of `getByRole` only reads on checkboxes and radios. */
// The text content of the chosen segment also holds the glyph of its check, which screen readers skip.
const isChecked = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}|${name}$`) }).props.accessibilityState.checked;

/** A name and the four values, one of them with a comma. */
async function fillValid(name = 'Pain maison') {
  await type('Nom', name);
  await type('Calories pour 100 g', '250');
  await type('Protéines pour 100 g', '12,5');
  await type('Glucides pour 100 g', '48');
  await type('Lipides pour 100 g', '2');
}

test('an empty form cannot be saved and says what is missing', async () => {
  const { onSubmit } = await setup();

  expect(screen.getByText('Enregistrer')).toBeDisabled();
  expect(screen.getByText('Le nom doit faire entre 1 et 100 caractères.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(onSubmit).not.toHaveBeenCalled();
});

test('a valid form is saved as a food: « Autre » by default, numbers read with a comma, names trimmed', async () => {
  const { onSubmit } = await setup();
  await fillValid(' Pain maison ');
  await fireEvent.press(screen.getByText('Ajouter une portion'));
  await type('Nom de la portion', ' 1 tranche ');
  await type('Poids (g)', '30');

  expect(screen.getByText('Enregistrer')).toBeEnabled();
  expect(screen.queryByText(/^Le nom|^Les valeurs|^Plus de|^Protéines, glucides|^Chaque portion/)).toBeNull();
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'Pain maison',
    state: 'other',
    per100g: { kcal: 250, protein: 12.5, carbs: 48, fat: 2 },
    portions: [{ label: '1 tranche', grams: 30 }],
  } satisfies FoodInput);
});

test('the state starts as « Autre » and follows the segment', async () => {
  const { onSubmit } = await setup();
  expect(isChecked('Autre')).toBe(true);
  expect(isChecked('Cuit')).toBe(false);

  await fillValid();
  await fireEvent.press(screen.getByText('Cuit'));
  expect(isChecked('Cuit')).toBe(true);
  expect(isChecked('Autre')).toBe(false);
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ state: 'cooked' }));
});

test('a value the rules refuse shows their message in place of saving', async () => {
  const { onSubmit } = await setup();
  await fillValid();

  await type('Calories pour 100 g', '901');
  expect(screen.getByText('Plus de 900 kcal pour 100 g n’est pas possible.')).toBeTruthy();
  // The button went disabled: a screen reader must hear why.
  expect(screen.getByText('Plus de 900 kcal pour 100 g n’est pas possible.').props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText('Enregistrer')).toBeDisabled();
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(onSubmit).not.toHaveBeenCalled();

  await type('Calories pour 100 g', '900');
  expect(screen.queryByText('Plus de 900 kcal pour 100 g n’est pas possible.')).toBeNull();
  expect(screen.getByText('Enregistrer')).toBeEnabled();

  await type('Protéines pour 100 g', 'abc');
  expect(screen.getByText('Les valeurs nutritionnelles doivent être des nombres positifs.')).toBeTruthy();
  expect(screen.getByText('Enregistrer')).toBeDisabled();
});

test('each of the four values is needed, and read with a comma', async () => {
  const { onSubmit } = await setup();
  await fillValid();

  for (const label of ['Calories pour 100 g', 'Protéines pour 100 g', 'Glucides pour 100 g', 'Lipides pour 100 g']) {
    await type(label, '');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
    expect(screen.getByText('Les valeurs nutritionnelles doivent être des nombres positifs.')).toBeTruthy();
    await type(label, '1,5');
    expect(screen.getByText('Enregistrer')).toBeEnabled();
  }

  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ per100g: { kcal: 1.5, protein: 1.5, carbs: 1.5, fat: 1.5 } }));
});

test('a portion is added as a blank row, which blocks saving until it is filled or removed', async () => {
  const { onSubmit } = await setup();
  await fillValid();
  expect(screen.queryByLabelText('Nom de la portion')).toBeNull();

  await fireEvent.press(screen.getByText('Ajouter une portion'));
  expect(screen.getByLabelText('Nom de la portion')).toHaveDisplayValue('');
  expect(screen.getByLabelText('Poids (g)')).toHaveDisplayValue('');
  expect(screen.getByText('Chaque portion a un nom et un poids entre 0 et 5 000 g.')).toBeTruthy();
  expect(screen.getByText('Enregistrer')).toBeDisabled();

  await fireEvent.press(screen.getByLabelText('Supprimer la portion 1'));
  expect(screen.queryByLabelText('Nom de la portion')).toBeNull();
  expect(screen.queryByLabelText('Poids (g)')).toBeNull();
  expect(screen.getByText('Enregistrer')).toBeEnabled();
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ portions: [] }));
});

test('removing a portion keeps the others, in order', async () => {
  const { onSubmit } = await setup();
  await fillValid();
  for (const [label, grams] of [['1 tranche', '30'], ['1 petit pain', '25'], ['1 baguette', '250']]) {
    await fireEvent.press(screen.getByText('Ajouter une portion'));
    const rows = screen.getAllByLabelText('Nom de la portion');
    await fireEvent.changeText(rows[rows.length - 1], label);
    const weights = screen.getAllByLabelText('Poids (g)');
    await fireEvent.changeText(weights[weights.length - 1], grams);
  }

  await fireEvent.press(screen.getByLabelText('Supprimer la portion 2'));

  expect(screen.getAllByLabelText('Nom de la portion').map((field) => field.props.value)).toEqual(['1 tranche', '1 baguette']);
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      portions: [
        { label: '1 tranche', grams: 30 },
        { label: '1 baguette', grams: 250 },
      ],
    }),
  );
});

test('an existing food comes back as it was typed, and the button carries the label it is given', async () => {
  const { onSubmit } = await setup({
    initial: { name: 'Pain', state: 'cooked', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 0.6 }, portions: [{ label: '1 tranche', grams: 37.5 }] },
    submitLabel: 'Enregistrer les modifications',
  });

  expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Pain');
  expect(screen.getByLabelText('Calories pour 100 g')).toHaveDisplayValue('250');
  expect(screen.getByLabelText('Lipides pour 100 g')).toHaveDisplayValue('0,6');
  expect(screen.getByLabelText('Nom de la portion')).toHaveDisplayValue('1 tranche');
  expect(screen.getByLabelText('Poids (g)')).toHaveDisplayValue('37,5');
  expect(isChecked('Cuit')).toBe(true);
  expect(screen.queryByText('Enregistrer')).toBeNull();

  await fireEvent.press(screen.getByText('Enregistrer les modifications'));
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'Pain',
    state: 'cooked',
    per100g: { kcal: 250, protein: 8, carbs: 48, fat: 0.6 },
    portions: [{ label: '1 tranche', grams: 37.5 }],
  });
});

test('a product of Open Food Facts keeps its source, brand, barcode and nutrients when its figures are corrected', async () => {
  const product: FoodInput = {
    name: 'Coca-Cola', state: 'other', per100g: { kcal: 42.4, protein: 0, carbs: 10.6, fat: 0 }, portions: [],
    nutrients: { sugars: 10.6 }, source: 'off', brand: 'Coca-Cola Services', barcode: '5449000000996',
  };
  const { onSubmit } = await setup({ initial: product, submitLabel: 'Enregistrer les modifications' });
  await type('Nom', 'Coca-Cola, canette');
  await fireEvent.press(screen.getByText('Enregistrer les modifications'));
  expect(onSubmit).toHaveBeenCalledWith({ ...product, name: 'Coca-Cola, canette' });
});

describe('the micronutrients', () => {
  const addMicronutrient = async (name: string) => {
    await fireEvent.press(screen.getByText('Ajouter un micronutriment'));
    await fireEvent.press(screen.getByText(name));
  };

  test('are added from the list, valued in their unit, and saved with the food', async () => {
    const { onSubmit } = await setup();
    await fillValid('Magnésium');
    await addMicronutrient('Magnésium');
    await type('Magnésium (mg)', '300');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Magnésium', nutrients: { magnesium: 300 } }));
  });

  test('a food without any saves no nutrients at all', async () => {
    const { onSubmit } = await setup();
    await fillValid();
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('nutrients');
  });

  test('the list offers what is not there yet', async () => {
    await setup();
    await addMicronutrient('Magnésium');
    await fireEvent.press(screen.getByText('Ajouter un micronutriment'));
    expect(screen.getByText('Vitamine C')).toBeTruthy();
    expect(screen.queryByText('Magnésium')).toBeNull();
  });

  test('one can be taken out again', async () => {
    const { onSubmit } = await setup();
    await fillValid();
    await addMicronutrient('Fer');
    await type('Fer (mg)', '12');
    await fireEvent.press(screen.getByLabelText('Retirer Fer'));
    expect(screen.queryByLabelText('Fer (mg)')).toBeNull();
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('nutrients');
  });

  test('one that is left empty, or is not a number, stops the food from being saved, and says why', async () => {
    await setup();
    await fillValid();
    await addMicronutrient('Zinc');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
    expect(screen.getByText('Les micronutriments doivent être des nombres positifs.').props.accessibilityLiveRegion).toBe('polite');
    await type('Zinc (mg)', '9,5');
    expect(screen.getByText('Enregistrer')).toBeEnabled();
  });

  test('a food that is changed shows its micronutrients and keeps them', async () => {
    const { onSubmit } = await setup({
      initial: { name: 'Whey', state: 'other', per100g: { kcal: 380, protein: 80, carbs: 6, fat: 5 }, portions: [], nutrients: { calcium: 450, vitD: 1.5 } },
      submitLabel: 'Enregistrer les modifications',
    });
    expect(screen.getByLabelText('Calcium (mg)')).toHaveDisplayValue('450');
    expect(screen.getByLabelText('Vitamine D (µg)')).toHaveDisplayValue('1,5');
    await fireEvent.press(screen.getByText('Enregistrer les modifications'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nutrients: { calcium: 450, vitD: 1.5 } }));
  });
});

describe('the values for a portion', () => {
  const perPortion = () => fireEvent.press(screen.getByText('Pour une portion'));

  test('are what the label gives: a capsule of 0,5 g with 300 mg of magnesium', async () => {
    const { onSubmit } = await setup();
    await type('Nom', 'Magnésium');
    await perPortion();
    await type('Poids d’une portion (g)', '0,5');
    for (const label of ['Calories pour une portion', 'Protéines pour une portion', 'Glucides pour une portion', 'Lipides pour une portion']) await type(label, '0');
    await fireEvent.press(screen.getByText('Ajouter un micronutriment'));
    await fireEvent.press(screen.getByText('Magnésium'));
    await type('Magnésium (mg)', '300');
    await fireEvent.press(screen.getByText('Enregistrer'));
    // 300 mg in 0,5 g is 60 000 mg in 100 g; the portion stays offered.
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Magnésium', state: 'other', per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, nutrients: { magnesium: 60000 }, portions: [{ label: '1 portion', grams: 0.5 }],
    });
  });

  test('macros too: 30 g of whey with 120 kcal and 24 g of protein are 400 kcal and 80 g for 100 g', async () => {
    const { onSubmit } = await setup();
    await type('Nom', 'Whey');
    await perPortion();
    await type('Poids d’une portion (g)', '30');
    await type('Calories pour une portion', '120');
    await type('Protéines pour une portion', '24');
    await type('Glucides pour une portion', '3');
    await type('Lipides pour une portion', '2');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ per100g: { kcal: 400, protein: 80, carbs: 10, fat: 6.7 }, portions: [{ label: '1 portion', grams: 30 }] }));
  });

  test('the portion is not added twice when one of the same weight is listed', async () => {
    const { onSubmit } = await setup();
    await type('Nom', 'Whey');
    await fireEvent.press(screen.getByText('Ajouter une portion'));
    await type('Nom de la portion', '1 mesure');
    await type('Poids (g)', '30');
    await perPortion();
    await type('Poids d’une portion (g)', '30');
    for (const label of ['Calories pour une portion', 'Protéines pour une portion', 'Glucides pour une portion', 'Lipides pour une portion']) await type(label, '1');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(onSubmit.mock.calls[0][0].portions).toEqual([{ label: '1 mesure', grams: 30 }]);
  });

  test('need a weight of the portion between 0 and 5 000 g', async () => {
    await setup();
    await type('Nom', 'Whey');
    await perPortion();
    for (const label of ['Calories pour une portion', 'Protéines pour une portion', 'Glucides pour une portion', 'Lipides pour une portion']) await type(label, '1');
    expect(screen.getByText('Le poids d’une portion est compris entre 0 et 5 000 g.')).toBeTruthy();
    expect(screen.getByText('Enregistrer')).toBeDisabled();
    await type('Poids d’une portion (g)', '5001');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
    await type('Poids d’une portion (g)', '25');
    expect(screen.getByText('Enregistrer')).toBeEnabled();
  });

  test('that cannot be true for 100 g are refused with the usual message', async () => {
    await setup();
    await type('Nom', 'Poudre');
    await perPortion();
    await type('Poids d’une portion (g)', '1');
    await type('Calories pour une portion', '5');
    await type('Protéines pour une portion', '2'); // 200 g of protein in 100 g
    await type('Glucides pour une portion', '0');
    await type('Lipides pour une portion', '0');
    expect(screen.getByText('Protéines, glucides et lipides dépassent 100 g pour 100 g.')).toBeTruthy();
  });

  test('the switch names the choice that is made, with a check', async () => {
    await setup();
    expect(isChecked('Pour 100 g')).toBe(true);
    await perPortion();
    expect(isChecked('Pour une portion')).toBe(true);
    expect(isChecked('Pour 100 g')).toBe(false);
  });
});
