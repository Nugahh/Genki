import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, SegmentedButtons, TextInput } from 'react-native-paper';
import { validateFood, type FoodInput, type FoodState } from '../domain/food';
import { asText, parseNumber } from './format';

type Nutrient = keyof FoodInput['per100g'];
// What is typed, as text: numbers are only read when the form is checked.
type Draft = { name: string; state: FoodState; per100g: Record<Nutrient, string>; portions: { label: string; grams: string }[] };

const NUTRIENTS: [Nutrient, string][] = [
  ['kcal', 'Calories pour 100 g'],
  ['protein', 'Protéines pour 100 g'],
  ['carbs', 'Glucides pour 100 g'],
  ['fat', 'Lipides pour 100 g'],
];
// Paper's segments are 40 dp tall: 4 dp more above and below the label make the 48 dp target. The check tells the chosen one by more than its tint.
const option = (value: FoodState, label: string) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true });
const STATES = [option('raw', 'Cru'), option('cooked', 'Cuit'), option('other', 'Autre')];

const BLANK: Draft = { name: '', state: 'other', per100g: { kcal: '', protein: '', carbs: '', fat: '' }, portions: [] };
const draftOf = ({ name, state, per100g: p, portions }: FoodInput): Draft => ({
  name,
  state,
  per100g: { kcal: asText(p.kcal), protein: asText(p.protein), carbs: asText(p.carbs), fat: asText(p.fat) },
  portions: portions.map((portion) => ({ label: portion.label, grams: asText(portion.grams) })),
});

type Props = {
  /** The food being changed; a new one when omitted. */
  initial?: FoodInput;
  submitLabel: string;
  onSubmit: (food: FoodInput) => void;
};

/** Creates or changes a custom food. « Enregistrer » is active once the rules accept the food; otherwise their message shows. */
export function FoodForm({ initial, submitLabel, onSubmit }: Props) {
  const [draft, setDraft] = useState(initial ? draftOf(initial) : BLANK);
  const change = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const changePortion = (i: number, patch: Partial<Draft['portions'][number]>) =>
    change({ portions: draft.portions.map((portion, j) => (j === i ? { ...portion, ...patch } : portion)) });

  const p = draft.per100g;
  const food: FoodInput = {
    // What a product of Open Food Facts came with stays when its figures are corrected.
    ...(initial?.nutrients && { nutrients: initial.nutrients }),
    ...(initial?.source && { source: initial.source }),
    ...(initial?.brand && { brand: initial.brand }),
    ...(initial?.barcode && { barcode: initial.barcode }),
    name: draft.name.trim(),
    state: draft.state,
    per100g: { kcal: parseNumber(p.kcal), protein: parseNumber(p.protein), carbs: parseNumber(p.carbs), fat: parseNumber(p.fat) },
    portions: draft.portions.map((portion) => ({ label: portion.label.trim(), grams: parseNumber(portion.grams) })),
  };
  const problem = validateFood(food);

  return (
    <View style={styles.form}>
      <TextInput label="Nom" accessibilityLabel="Nom" value={draft.name} onChangeText={(name) => change({ name })} />
      <SegmentedButtons value={draft.state} onValueChange={(state) => change({ state })} buttons={STATES} />
      {NUTRIENTS.map(([nutrient, label]) => (
        <TextInput
          key={nutrient}
          label={label}
          accessibilityLabel={label}
          value={p[nutrient]}
          onChangeText={(text) => change({ per100g: { ...p, [nutrient]: text } })}
          keyboardType="decimal-pad"
        />
      ))}
      {draft.portions.map((portion, i) => (
        <View key={i} style={styles.portion}>
          <TextInput
            label="Nom de la portion"
            accessibilityLabel="Nom de la portion"
            style={styles.portionName}
            value={portion.label}
            onChangeText={(label) => changePortion(i, { label })}
          />
          <TextInput
            label="Poids (g)"
            accessibilityLabel="Poids (g)"
            style={styles.portionWeight}
            value={portion.grams}
            onChangeText={(grams) => changePortion(i, { grams })}
            keyboardType="decimal-pad"
          />
          <IconButton
            icon="delete-outline"
            style={styles.iconButton}
            accessibilityLabel={`Supprimer la portion ${i + 1}`}
            onPress={() => change({ portions: draft.portions.filter((_, j) => j !== i) })}
          />
        </View>
      ))}
      <Button icon="plus" contentStyle={styles.button} onPress={() => change({ portions: [...draft.portions, { label: '', grams: '' }] })}>
        Ajouter une portion
      </Button>
      {problem !== null && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      <Button mode="contained" contentStyle={styles.button} disabled={problem !== null} onPress={() => onSubmit(food)}>
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  portion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  portionName: { flex: 2 },
  portionWeight: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
