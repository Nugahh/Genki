import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Snackbar, Surface, Text, useTheme } from 'react-native-paper';
import { WaterAmountDialog, WaterButtons, type Hydration, type WaterEntry } from '@/modules/hydration';
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
  /** Opens the Suivi of a measure (spec §6, « Tout est touchable »). */
  onOpenMetric: (metric: 'calories' | 'protein' | 'steps') => void;
  /** Pulling the screen down reads the steps again; the screen waits for it to end. */
  onRefresh?: () => Promise<void>;
  /** Why the steps are not there (no permission, no Health Connect…), shown under the gauge. */
  stepsProblem?: string;
  /** More cards under the session (the weight, the days without tobacco): the route composes them from their modules. */
  cards?: ReactNode;
  /** The session to do next, when there is a programme in progress: « Démarrer » opens it in the host. */
  session?: { title: string; subtitle: string; onStart: () => void };
};

const NO_TOTALS: DayTotals = { waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, steps: 0 };
const STEPS_SOURCE: Record<string, string> = { fitbit: 'Fitbit', phone: 'Ce téléphone' };
const fr = (n: number, maximumFractionDigits: number) => n.toLocaleString('fr-FR', { maximumFractionDigits });
// The figures of a gauge, without their unit (the gauge shows it once, after the goal); the sentences above add theirs.
const litres = (ml: number) => fr(ml / 1000, 2);
const kcal = (n: number) => fr(n, 0);
const grams = (n: number) => fr(n, 1);
/** What is left of the water and protein goals, in a sentence: calories wait for the goal modes (spec §9). */
function encouragement(totals: DayTotals, goals: Profile['goals']) {
  const water = totals.waterMl >= goals.waterMl;
  const protein = totals.proteinG >= goals.proteinG;
  const waterLeft = `${litres(goals.waterMl - totals.waterMl)} L d’eau`;
  const proteinLeft = `${grams(goals.proteinG - totals.proteinG)} g de protéines`;
  if (water && protein) return 'Objectifs d’eau et de protéines atteints, bravo !';
  if (water) return `Objectif d’eau atteint, bravo ! Encore ${proteinLeft}.`;
  if (protein) return `Objectif de protéines atteint, bravo ! Encore ${waterLeft}.`;
  return `Encore ${waterLeft} et ${proteinLeft} aujourd’hui.`;
}
/** A gauge with no goal is drawn full. */
const progress = (value: number, goal: number) => (goal > 0 ? value / goal : 1);

export function TodayScreen({ profile, userName, clock, dayTotals, hydration, run, onAddMeal, onOpenMetric, onRefresh, stepsProblem, session, cards }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const hour = hourOfDay(now, profile.timezone);
  const [totals, setTotals] = useState(NO_TOTALS);
  const [amountOpen, setAmountOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };
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
  // Gaining: going over the goal is the point, not a problem. Losing: it is the only way to be late, and a gauge under its pace is on track.
  const overGoal = profile.goalMode !== 'surplus' && isOverGoal(totals.kcal, goals.kcal);
  const { colors } = useTheme();
  const syncedAt = totals.stepsSyncedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: profile.timezone });
  const stepsNote =
    stepsProblem ?? (syncedAt ? [STEPS_SOURCE[totals.stepsSource ?? ''], `lu à ${syncedAt}`].filter(Boolean).join(' · ') : 'Pas encore lu : tire l’écran vers le bas pour synchroniser.');
  const greeting = [hour < 18 ? 'Bonjour' : 'Bonsoir', userName].filter(Boolean).join(' ');

  return (
    <View style={styles.screen}>
      <View style={styles.readings}>
        <ScrollView testID="gauges" contentContainerStyle={styles.content} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} /> : undefined}>
          <View style={styles.greeting}>
            <Text variant="titleLarge">{greeting}</Text>
            <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>{encouragement(totals, goals)}</Text>
          </View>
          <GaugeBar
            label="Eau"
            metric="water"
            value={litres(totals.waterMl)}
            goal={litres(goals.waterMl)}
            unit="L"
            hint="Ajoute une quantité d’eau de ton choix"
            progress={progress(totals.waterMl, goals.waterMl)}
            expected={expected}
            color={paceColor(totals.waterMl, goals.waterMl, hour)}
            icon="plus"
            onPress={() => setAmountOpen(true)}
          />
          <GaugeBar
            label="Calories"
            metric="calories"
            value={kcal(totals.kcal)}
            goal={kcal(goals.kcal)}
            unit="kcal"
            hint="Ouvre le suivi des calories"
            progress={progress(totals.kcal, goals.kcal)}
            expected={expected}
            color={calorieColor(totals.kcal, goals.kcal, hour, profile.goalMode)}
            status={overGoal ? 'au-dessus de l’objectif' : profile.goalMode === 'deficit' ? 'dans l’objectif de déficit' : undefined}
            icon="chevron-right"
            onPress={() => onOpenMetric('calories')}
          />
          <GaugeBar
            label="Protéines"
            metric="protein"
            value={grams(totals.proteinG)}
            goal={grams(goals.proteinG)}
            unit="g"
            hint="Ouvre le suivi des protéines"
            progress={progress(totals.proteinG, goals.proteinG)}
            expected={expected}
            color={paceColor(totals.proteinG, goals.proteinG, hour)}
            icon="chevron-right"
            onPress={() => onOpenMetric('protein')}
          />
          <GaugeBar
            label="Pas"
            metric="steps"
            value={fr(totals.steps, 0)}
            goal={fr(goals.steps, 0)}
            note={stepsNote}
            hint="Ouvre le suivi des pas"
            progress={progress(totals.steps, goals.steps)}
            expected={expected}
            color={paceColor(totals.steps, goals.steps, hour)}
            icon="chevron-right"
            onPress={() => onOpenMetric('steps')}
          />
          {session && (
            <Surface mode="flat" elevation={1} style={styles.session}>
              <View style={styles.sessionHead}>
                <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
                  <Icon source="dumbbell" size={20} color={colors.onSecondaryContainer} />
                </View>
                <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>Séance du jour</Text>
              </View>
              <View style={styles.sessionText}>
                <Text variant="titleMedium">{session.title}</Text>
                <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{session.subtitle}</Text>
              </View>
              <Button mode="contained-tonal" icon="play" accessibilityLabel={`Démarrer ${session.title}`} contentStyle={styles.button} onPress={session.onStart}>
                Démarrer
              </Button>
            </Surface>
          )}
          {cards}
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
      {amountOpen && <WaterAmountDialog onDismiss={() => setAmountOpen(false)} onAdd={addWater} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The container the take-back snackbar rests at the bottom of: right above the actions.
  readings: { flex: 1 },
  content: { padding: 16, gap: 16 },
  greeting: { gap: 4, paddingHorizontal: 4 },
  session: { borderRadius: 16, padding: 16, gap: 12 },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionText: { gap: 2 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // The amounts and « + Repas » share one row, which wraps on a large font.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  grow: { flexGrow: 1 },
  button: { minHeight: 48 },
});
