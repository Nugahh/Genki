import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { MEALS, type Meal } from '../domain/meal';
import { MEAL_LABELS } from './format';

// Paper's segments are 40 dp tall: 4 dp more above and below the label make the 48 dp target. The check tells the chosen one by more than its tint.
const GROUPS = MEALS.map((meal) => ({ value: meal, label: MEAL_LABELS[meal], labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }));
// Two rows of two: « Petit-déjeuner » and the check do not fit four in a row on a 360 dp phone.
const ROWS = [GROUPS.slice(0, 2), GROUPS.slice(2)];

/** The group (meal) of an entry. */
export function MealPicker({ meal, onChange }: { meal: Meal; onChange: (meal: Meal) => void }) {
  return (
    <View style={styles.rows}>
      {ROWS.map((buttons, i) => (
        <SegmentedButtons key={i} value={meal} onValueChange={(value) => onChange(value as Meal)} buttons={buttons} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ rows: { gap: 8 } });
