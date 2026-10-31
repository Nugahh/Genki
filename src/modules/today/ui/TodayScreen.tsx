import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Surface, Text, useTheme } from 'react-native-paper';
import { WaterButtons, WaterSheet, type Hydration, type WaterEntry } from '@/modules/hydration';
import type { Profile } from '@/modules/settings';
import { dayKey, hourOfDay, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotals, DayTotalsRepository } from '../application/ports';
import { calorieColor, expectedProgress, isOverGoal, paceColor } from '../domain/gauge';
import { GaugeBar } from './GaugeBar';

type Props = {
  profile: Profile;
  /** The first name of the signed-in user, for the greeting; none is fine. */
  userName?: string;
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
/** What is left of the water and protein goals, in a sentence: calories wait for the goal modes (spec §9). */
function encouragement(totals: DayTotals, goals: Profile['goals']) {
  const water = totals.waterMl >= goals.waterMl;
  const protein = totals.proteinG >= goals.proteinG;
  const waterLeft = `${liters(goals.waterMl - totals.waterMl)} d’eau`;
  const proteinLeft = `${grams(goals.proteinG - totals.proteinG)} de protéines`;
  if (water && protein) return 'Objectifs d’eau et de protéines atteints, bravo !';
  if (water) return `Objectif d’eau atteint, bravo ! Encore ${proteinLeft}.`;
  if (protein) return `Objectif de protéines atteint, bravo ! Encore ${waterLeft}.`;
  return `Encore ${waterLeft} et ${proteinLeft} aujourd’hui.`;
}
/** A gauge with no goal is drawn full. */
const progress = (value: number, goal: number) => (goal > 0 ? value / goal : 1);

export function TodayScreen({ profile, userName, clock, dayTotals, hydration, run, onAddMeal, onOpenMeals }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const hour = hourOfDay(now, profile.timezone);
  const [totals, setTotals] = useState(NO_TOTALS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same document.
  useEffect(() => dayTotals.observe(day, (next) => setTotals(next), () => {}), [dayTotals, day]);

  const { goals } = profile;
  const expected = expectedProgress(hour);
  // The glass just added, offered back for a few seconds: a one-tap add is easy to mis-tap.
  const [added, setAdded] = useState<WaterEntry | null>(null);
  const addWater = (ml: number) =>
    run(() => {
      const { entry, saved } = hydration.addWater(ml);
      setAdded(entry);
      return saved;
    });
  const takeBack = (entry: WaterEntry) => {
    setAdded(null);
    run(() => hydration.removeWater(entry));
  };
  const overGoal = isOverGoal(totals.kcal, goals.kcal);
  const { colors } = useTheme();
  const greeting = [hour < 18 ? 'Bonjour' : 'Bonsoir', userName].filter(Boolean).join(' ');

  return (
    <View style={styles.screen}>
      <View style={styles.readings}>
        <ScrollView testID="gauges" contentContainerStyle={styles.content}>
          <View style={styles.greeting}>
            <Text variant="titleLarge">{greeting}</Text>
            <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>{encouragement(totals, goals)}</Text>
          </View>
          <GaugeBar
            label="Eau"
            metric="water"
            value={liters(totals.waterMl)}
            goal={liters(goals.waterMl)}
            remaining={remaining(totals.waterMl, goals.waterMl, liters)}
            hint="Ouvre les verres du jour"
            progress={progress(totals.waterMl, goals.waterMl)}
            expected={expected}
            color={paceColor(totals.waterMl, goals.waterMl, hour)}
            icon="plus"
            onPress={() => setSheetOpen(true)}
          />
          <GaugeBar
            label="Calories"
            metric="calories"
            value={kcal(totals.kcal)}
            goal={kcal(goals.kcal)}
            remaining={overGoal ? 'au-dessus de l’objectif' : remaining(totals.kcal, goals.kcal, kcal)}
            hint="Ouvre le journal des repas"
            progress={progress(totals.kcal, goals.kcal)}
            expected={expected}
            color={calorieColor(totals.kcal, goals.kcal, hour)}
            status={overGoal ? 'au-dessus de l’objectif' : undefined}
            icon="chevron-right"
            onPress={onOpenMeals}
          />
          <GaugeBar
            label="Protéines"
            metric="protein"
            value={grams(totals.proteinG)}
            goal={grams(goals.proteinG)}
            remaining={remaining(totals.proteinG, goals.proteinG, grams)}
            hint="Ouvre le journal des repas"
            progress={progress(totals.proteinG, goals.proteinG)}
            expected={expected}
            color={paceColor(totals.proteinG, goals.proteinG, hour)}
            icon="chevron-right"
            onPress={onOpenMeals}
          />
        </ScrollView>
        {/* Mounted per glass, as the failure message is: Paper's Snackbar misses a message that lands during its fade-out. It rests on the actions below. */}
        {added && (
          <Snackbar
            key={added.id}
            visible
            duration={4000}
            onDismiss={() => setAdded(null)}
            action={{ label: 'Annuler', onPress: () => takeBack(added), contentStyle: { minHeight: 48 } }}
          >
            {`+${added.ml} ml ajoutés`}
          </Snackbar>
        )}
      </View>
      {/* The frequent actions are pinned under the thumb, whatever the day holds above: the page, these actions, the tab bar are three tonal levels. */}
      <Surface mode="flat" elevation={1} style={styles.actions}>
        <WaterButtons containers={profile.waterContainers} onAdd={addWater} />
        <Button mode="contained-tonal" icon="silverware-fork-knife" accessibilityLabel="Ajouter un repas" style={styles.grow} contentStyle={styles.button} onPress={onAddMeal}>
          + Repas
        </Button>
      </Surface>
      <WaterSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        day={day}
        timezone={profile.timezone}
        containers={profile.waterContainers}
        hydration={hydration}
        run={run}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The container the take-back snackbar rests at the bottom of: right above the actions.
  readings: { flex: 1 },
  content: { padding: 16, gap: 16 },
  greeting: { gap: 4, paddingHorizontal: 4 },
  // The amounts and « + Repas » share one row, which wraps on a large font.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  grow: { flexGrow: 1 },
  button: { minHeight: 48 },
});
