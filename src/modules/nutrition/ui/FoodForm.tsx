import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { isValidGrams, validateFood, type FoodInput, type FoodState } from '../domain/food';
import { scaleMacros } from '../domain/macros';
import { scaleNutrients, type NutrientId, type Nutrients } from '../domain/nutrients';
import { MicronutrientFields, type NutrientRow } from './MicronutrientFields';
import { asText, parseNumber } from './format';

type Nutrient = keyof FoodInput['per100g'];
// What is typed, as text: numbers are only read when the form is checked.
type Draft = {
  name: string;
  state: FoodState;
  /** The macros are typed for 100 g, or for one portion whose weight is `portionGrams`. */
  basis: 'per100g' | 'portion';
  portionGrams: string;
  per100g: Record<Nutrient, string>;
  nutrients: NutrientRow[];
  portions: { label: string; grams: string }[];
};

const NUTRIENTS: [Nutrient, string][] = [
  ['kcal', 'Calories pour 100 g'],
  ['protein', 'Protéines pour 100 g'],
  ['carbs', 'Glucides pour 100 g'],
  ['fat', 'Lipides pour 100 g'],
];
// Paper's segments are 40 dp tall: 4 dp more above and below the label make the 48 dp target. The check tells the chosen one by more than its tint.
const option = (value: FoodState, label: string) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true });
const STATES = [option('raw', 'Cru'), option('cooked', 'Cuit'), option('other', 'Autre')];
const BASES = [
  { value: 'per100g', label: 'Pour 100 g', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
  { value: 'portion', label: 'Pour une portion', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
];

const BLANK: Draft = { name: '', state: 'other', basis: 'per100g', portionGrams: '', per100g: { kcal: '', protein: '', carbs: '', fat: '' }, nutrients: [], portions: [] };
const draftOf = ({ name, state, per100g: p, portions, nutrients }: FoodInput): Draft => ({
  name,
  state,
  basis: 'per100g',
  portionGrams: '',
  nutrients: (Object.entries(nutrients ?? {}) as [NutrientId, number][]).map(([id, value]) => ({ id, value: asText(value) })),
  per100g: { kcal: asText(p.kcal), protein: asText(p.protein), carbs: asText(p.carbs), fat: asText(p.fat) },
  portions: portions.map((portion) => ({ label: portion.label, grams: asText(portion.grams) })),
});

type Props = {
  /** The food being changed; a new one when omitted. */
  initial?: FoodInput;
  /** The barcode of a new food, when it comes from a scan. */
  barcode?: string;
  submitLabel: string;
  onSubmit: (food: FoodInput) => void;
};

/** Creates or changes a custom food. « Enregistrer » is active once the rules accept the food; otherwise their message shows. */
export function FoodForm({ initial, barcode, submitLabel, onSubmit }: Props) {
  const [draft, setDraft] = useState(initial ? draftOf(initial) : BLANK);
  const change = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const changePortion = (i: number, patch: Partial<Draft['portions'][number]>) =>
    change({ portions: draft.portions.map((portion, j) => (j === i ? { ...portion, ...patch } : portion)) });

  const p = draft.per100g;
  const perPortion = draft.basis === 'portion';
  const portionGrams = parseNumber(draft.portionGrams);
  const weightProblem = perPortion && !isValidGrams(portionGrams) ? 'Le poids d’une portion est compris entre 0 et 5 000 g.' : null;
  const typed = { kcal: parseNumber(p.kcal), protein: parseNumber(p.protein), carbs: parseNumber(p.carbs), fat: parseNumber(p.fat) };
  const typedNutrients: Nutrients = Object.fromEntries(draft.nutrients.map((row) => [row.id, parseNumber(row.value)]));
  // What the label gives for a portion is stored for 100 g, as for every food (spec §4); an invalid weight leaves the form invalid before this matters.
  const convert = perPortion && !weightProblem;
  const portions = draft.portions.map((portion) => ({ label: portion.label.trim(), grams: parseNumber(portion.grams) }));
  const food: FoodInput = {
    // What a product of Open Food Facts came with stays when its figures are corrected.
    ...(initial?.source && { source: initial.source }),
    ...(initial?.brand && { brand: initial.brand }),
    ...((initial?.barcode ?? barcode) && { barcode: initial?.barcode ?? barcode }),
    name: draft.name.trim(),
    state: draft.state,
    per100g: convert ? scaleMacros(typed, portionGrams, 100) : typed,
    ...(draft.nutrients.length > 0 && { nutrients: convert ? scaleNutrients(typedNutrients, portionGrams, 100) : typedNutrients }),
    // The portion the values were given for stays offered, unless one of that weight is listed already.
    portions: convert && !portions.some((portion) => portion.grams === portionGrams) ? [...portions, { label: '1 portion', grams: portionGrams }] : portions,
  };
  const problem = weightProblem ?? validateFood(food);
  const basis = perPortion ? 'pour une portion' : 'pour 100 g';

  return (
    <View style={styles.form}>
      {barcode && !initial && <Text variant="bodyMedium">{`Code-barres : ${barcode}`}</Text>}
      <TextInput label="Nom" accessibilityLabel="Nom" value={draft.name} onChangeText={(name) => change({ name })} />
      <SegmentedButtons value={draft.state} onValueChange={(state) => change({ state })} buttons={STATES} />
      <SegmentedButtons value={draft.basis} onValueChange={(value) => change({ basis: value as Draft['basis'] })} buttons={BASES} />
      {perPortion && (
        <TextInput
          label="Poids d’une portion (g)"
          accessibilityLabel="Poids d’une portion (g)"
          value={draft.portionGrams}
          onChangeText={(portionGrams) => change({ portionGrams })}
          keyboardType="decimal-pad"
        />
      )}
      {NUTRIENTS.map(([nutrient, label]) => (
        <TextInput
          key={nutrient}
          label={perPortion ? label.replace('pour 100 g', 'pour une portion') : label}
          accessibilityLabel={perPortion ? label.replace('pour 100 g', 'pour une portion') : label}
          value={p[nutrient]}
          onChangeText={(text) => change({ per100g: { ...p, [nutrient]: text } })}
          keyboardType="decimal-pad"
        />
      ))}
      <MicronutrientFields rows={draft.nutrients} onChange={(nutrients) => change({ nutrients })} basis={basis} />
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
