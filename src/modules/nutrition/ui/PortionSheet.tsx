import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text, TextInput } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { MealUseCases } from '../application/mealUseCases';
import { referencesOf } from '../application/referencesOf';
import { isValidGrams, isValidLoggedAt, type FoodEntry } from '../domain/food';
import { sumMacros, ZERO_MACROS, type Macros } from '../domain/macros';
import type { Meal } from '../domain/meal';
import type { Nutrients } from '../domain/nutrients';
import { netCarbs } from '../domain/portion';
import { EnergyRing } from './EnergyRing';
import { asText, macrosText, parseNumber } from './format';
import { GoalsWithPortion } from './GoalsWithPortion';
import { MealPicker } from './MealPicker';
import { NutrientList } from './NutrientList';
import { WhenPicker, type PickWhen } from './WhenPicker';

// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

type Props = {
  name: string;
  /** Next to the name: the cooked or raw chip of a food. */
  badge?: ReactNode;
  /** At the end of the title row: the star of a food. */
  action?: ReactNode;
  /** Where the figures come from: « Ciqual (ANSES) », « Mon aliment ». */
  source: string;
  portions: { label: string; grams: number }[];
  initialGrams: number;
  macrosAt: (grams: number) => Macros;
  nutrientsAt: (grams: number) => Nutrients | undefined;
  initialMeal: Meal;
  /** The time of the entry being changed; a new entry starts at the present moment. */
  initialAt?: Date;
  /** The entry being changed: the totals of its day do not count it twice. */
  entryId?: string;
  meals: MealUseCases;
  profile: Profile;
  clock: Clock;
  pickWhen: PickWhen;
  submitLabel: (meal: Meal) => string;
  /** `at` is missing while the time was not touched: the entry is then logged at the moment of the touch. */
  onSubmit: (value: { grams: number; meal: Meal; at: Date | undefined }) => void;
  /** Buttons below the main one (edit, delete, back). */
  children?: ReactNode;
};

const totalsOf = (entries: FoodEntry[]) => {
  const macros = sumMacros(entries.map((e) => e.macros));
  return { ...macros, carbs: Math.round(entries.reduce((sum, e) => sum + netCarbs(e.macros, e.nutrients).grams, 0) * 10) / 10 };
};

/** A quantity of a food, for a group, a day and a time: the figures of the portion, the day's goals with it, and the way to log or save it. */
export function PortionSheet(props: Props) {
  const { name, badge, action, source, portions, initialGrams, macrosAt, nutrientsAt, initialMeal, initialAt, entryId, meals, profile, clock, pickWhen, submitLabel, onSubmit, children } = props;
  const now = useNow(clock);
  const [text, setText] = useState(asText(initialGrams));
  const [meal, setMeal] = useState(initialMeal);
  const [picked, setPicked] = useState<Date | null>(initialAt ?? null);
  const [dayEntries, setDayEntries] = useState<FoodEntry[]>([]);
  const at = picked ?? now;
  const day = dayKey(at, profile.timezone);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => meals.observeDay(day, setDayEntries, () => {}), [meals, day]);

  const grams = parseNumber(text);
  const validGrams = isValidGrams(grams);
  // The time an entry already has stays valid even if it is further back than a new one may be.
  const validWhen = isValidLoggedAt(at, now) || at.getTime() === initialAt?.getTime();
  const macros = validGrams ? macrosAt(grams) : ZERO_MACROS;
  const nutrients = validGrams ? nutrientsAt(grams) : undefined;
  const net = netCarbs(macros, nutrients);
  // Only the chosen day's: the previous day's entries stay in the state until the next snapshot answers.
  const dayTotals = totalsOf(dayEntries.filter((e) => e.day === day && e.id !== entryId));
  const references = referencesOf(profile);

  return (
    <View style={styles.sheet}>
      <View style={styles.title}>
        <Text variant="titleLarge" style={styles.name}>
          {name}
        </Text>
        {badge}
        {action && <View style={styles.action}>{action}</View>}
      </View>
      <Text variant="bodyMedium">{`Source : ${source}`}</Text>
      <View style={styles.chips}>
        {portions.map((portion, i) => (
          <Chip key={i} hitSlop={HIT_SLOP} onPress={() => setText(asText(portion.grams))}>
            {portion.label}
          </Chip>
        ))}
      </View>
      <TextInput label="Quantité (g)" accessibilityLabel="Quantité (g)" value={text} onChangeText={setText} keyboardType="decimal-pad" />
      {text.trim() !== '' && !validGrams && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          La quantité doit être comprise entre 0 et 5 000 g.
        </HelperText>
      )}
      <MealPicker meal={meal} onChange={setMeal} />
      <WhenPicker at={at} now={now} timezone={profile.timezone} pickWhen={pickWhen} onChange={setPicked} />
      {validGrams && (
        <>
          <Text variant="bodyLarge" accessibilityLiveRegion="polite">
            {macrosText(macros)}
          </Text>
          <EnergyRing kcal={macros.kcal} protein={macros.protein} carbs={net.grams} fat={macros.fat} carbsPartial={net.partial} />
          <GoalsWithPortion day={dayTotals} portion={{ kcal: macros.kcal, protein: macros.protein, carbs: net.grams, fat: macros.fat }} goals={profile.goals} />
          {nutrients && <NutrientList nutrients={nutrients} references={references} />}
        </>
      )}
      <Button mode="contained" contentStyle={styles.button} disabled={!validGrams || !validWhen} onPress={() => onSubmit({ grams, meal, at: picked ?? undefined })}>
        {submitLabel(meal)}
      </Button>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  action: { marginLeft: 'auto' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
