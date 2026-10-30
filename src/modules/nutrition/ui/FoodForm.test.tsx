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
const isChecked = (name: string) => screen.getByRole('button', { name }).props.accessibilityState.checked;

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
