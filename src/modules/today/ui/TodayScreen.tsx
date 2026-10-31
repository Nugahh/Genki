import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { WaterButtons, WaterSheet, type Hydration } from '@/modules/hydration';
import type { Profile } from '@/modules/settings';
import { dayKey, hourOfDay, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotals, DayTotalsRepository } from '../application/ports';
import { calorieColor, expectedProgress, isOverGoal, paceColor } from '../domain/gauge';
import { GaugeBar } from './GaugeBar';

type Props = {
  profile: Profile;
  clock: Clock;
  dayTotals: DayTotalsRepository;
  hydration: Hydration;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  /** « + Repas »: the host opens the add-food screen. */
  onAddMeal: () => void;
  /** The Calories and Protéines gauges: the host opens the day journal. */
  onOpenMeals: () => void;
};

const NO_TOTALS: DayTotals = { waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const fr = (n: number, maximumFractionDigits: number) => n.toLocaleString('fr-FR', { maximumFractionDigits });
const liters = (ml: number) => `${fr(ml / 1000, 2)} L`;
const kcal = (n: number) => `${fr(n, 0)} kcal`;
const grams = (n: number) => `${fr(n, 1)} g`;
/** What is left of a goal: a gauge is never read from the goal alone. */
const remaining = (value: number, goal: number, format: (n: number) => string) => (value < goal ? `reste ${format(goal - value)}` : 'objectif atteint');
/** A gauge with no goal is drawn full. */
const progress = (value: number, goal: number) => (goal > 0 ? value / goal : 1);

export function TodayScreen({ profile, clock, dayTotals, hydration, run, onAddMeal, onOpenMeals }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const hour = hourOfDay(now, profile.timezone);
  const [totals, setTotals] = useState(NO_TOTALS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same document.
  useEffect(() => dayTotals.observe(day, (next) => setTotals(next), () => {}), [dayTotals, day]);

  const { goals } = profile;
  const expected = expectedProgress(hour);
  const addWater = (ml: number) => run(() => hydration.addWater(ml));
  const overGoal = isOverGoal(totals.kcal, goals.kcal);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GaugeBar
        label="Eau"
        value={liters(totals.waterMl)}
        goal={liters(goals.waterMl)}
        remaining={remaining(totals.waterMl, goals.waterMl, liters)}
        progress={progress(totals.waterMl, goals.waterMl)}
        expected={expected}
        color={paceColor(totals.waterMl, goals.waterMl, hour)}
        icon="plus"
        onPress={() => setSheetOpen(true)}
      />
      <GaugeBar
        label="Calories"
        value={kcal(totals.kcal)}
        goal={kcal(goals.kcal)}
        remaining={overGoal ? 'au-dessus de l’objectif' : remaining(totals.kcal, goals.kcal, kcal)}
        progress={progress(totals.kcal, goals.kcal)}
        expected={expected}
        color={calorieColor(totals.kcal, goals.kcal, hour)}
        status={overGoal ? 'au-dessus de l’objectif' : undefined}
        icon="chevron-right"
        onPress={onOpenMeals}
      />
      <GaugeBar
        label="Protéines"
        value={grams(totals.proteinG)}
        goal={grams(goals.proteinG)}
        remaining={remaining(totals.proteinG, goals.proteinG, grams)}
        progress={progress(totals.proteinG, goals.proteinG)}
        expected={expected}
        color={paceColor(totals.proteinG, goals.proteinG, hour)}
        icon="chevron-right"
        onPress={onOpenMeals}
      />
      <View style={styles.buttons}>
        <WaterButtons containers={profile.waterContainers} onAdd={addWater} />
        <Button mode="contained-tonal" icon="silverware-fork-knife" accessibilityLabel="Ajouter un repas" contentStyle={styles.button} onPress={onAddMeal}>
          + Repas
        </Button>
      </View>
      <WaterSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        day={day}
        timezone={profile.timezone}
        containers={profile.waterContainers}
        hydration={hydration}
        run={run}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
