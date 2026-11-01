import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import type { ProfilePatch } from '../application/ports';
import { proposeGoals } from '../domain/goals';
import { validateProfile, type GoalMode, type Profile } from '../domain/profile';
import { GOAL_MODES } from './goalMode';
import { asText, parseNumber } from './format';

type Props = {
  profile: Profile;
  /** The latest weight, to start the proposal from. */
  weightKg?: number;
  year: number;
  onSave: (patch: ProfilePatch) => void;
};

// Paper's segment is 40 dp tall: 4 dp of padding above and below the label make the 48 dp target.
const MODES = GOAL_MODES.map((m) => ({ ...m, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }));

/** The six daily goals, and what the calories goal is for. « Proposer » starts from the profile and a weight, within the guard-rails. */
export function GoalsScreen({ profile, weightKg, year, onSave }: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<GoalMode>(profile.goalMode);
  const [kcal, setKcal] = useState(asText(profile.goals.kcal));
  const [protein, setProtein] = useState(asText(profile.goals.proteinG));
  const [carbs, setCarbs] = useState(asText(profile.goals.carbsNetG));
  const [fat, setFat] = useState(asText(profile.goals.fatG));
  const [water, setWater] = useState(asText(profile.goals.waterMl));
  const [steps, setSteps] = useState(asText(profile.goals.steps));
  const [loss, setLoss] = useState(asText(profile.weeklyLossKg));
  const [weight, setWeight] = useState(asText(weightKg));
  const [notes, setNotes] = useState<string[]>([]);

  const goals = { kcal: parseNumber(kcal), proteinG: parseNumber(protein), carbsNetG: parseNumber(carbs), fatG: parseNumber(fat), waterMl: parseNumber(water), steps: parseNumber(steps) };
  // The loss is only asked for in a deficit: outside it, whatever is left in the hidden field must not block the screen.
  const weeklyLossKg = mode === 'deficit' && loss.trim() !== '' ? parseNumber(loss) : undefined;
  const problem = validateProfile({ ...profile, goalMode: mode, goals, weeklyLossKg });
  const weightNumber = parseNumber(weight);
  const canPropose = Number.isFinite(weightNumber) && weightNumber > 20 && weightNumber < 400 && (weeklyLossKg === undefined || Number.isFinite(weeklyLossKg));

  const propose = () => {
    const proposal = proposeGoals({ profile: { ...profile, goalMode: mode, weeklyLossKg }, weightKg: weightNumber, year });
    setKcal(asText(proposal.goals.kcal));
    setProtein(asText(proposal.goals.proteinG));
    setCarbs(asText(proposal.goals.carbsNetG));
    setFat(asText(proposal.goals.fatG));
    setWater(asText(proposal.goals.waterMl));
    setSteps(asText(proposal.goals.steps));
    setNotes(proposal.notes);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleMedium" accessibilityRole="header">
        Objectif des calories
      </Text>
      <SegmentedButtons value={mode} onValueChange={(value) => setMode(value as GoalMode)} buttons={MODES} />
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        {mode === 'deficit' && 'Manger moins que ce que tu dépenses : la jauge reste verte tant que tu ne dépasses pas l’objectif.'}
        {mode === 'maintenance' && 'Manger ce que tu dépenses : la jauge suit ton rythme dans la journée et signale un dépassement.'}
        {mode === 'surplus' && 'Manger plus que ce que tu dépenses : la jauge suit ton rythme, et dépasser n’est pas un problème.'}
      </Text>
      {mode === 'deficit' && (
        <TextInput label="Perte visée (kg par semaine)" accessibilityLabel="Perte visée (kg par semaine)" value={loss} onChangeText={setLoss} keyboardType="decimal-pad" placeholder="0,4" />
      )}

      <Surface mode="flat" elevation={1} style={styles.card}>
        <Text variant="titleMedium" accessibilityRole="header">
          Proposition
        </Text>
        <TextInput label="Poids (kg)" accessibilityLabel="Poids (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Button mode="contained-tonal" icon="auto-fix" contentStyle={styles.button} disabled={!canPropose} onPress={propose}>
          Proposer à partir de mon profil
        </Button>
        {notes.length > 0 && (
          <Text variant="bodyMedium" accessibilityLiveRegion="polite">
            {notes.join('\n')}
          </Text>
        )}
      </Surface>

      <TextInput label="Calories (kcal par jour)" accessibilityLabel="Calories (kcal par jour)" value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
      {goals.kcal < 1500 && (
        <HelperText type="info" accessibilityLiveRegion="polite">
          Moins de 1 500 kcal par jour : consulte un professionnel avant de manger si peu.
        </HelperText>
      )}
      <TextInput label="Protéines (g par jour)" accessibilityLabel="Protéines (g par jour)" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
      <TextInput label="Glucides nets (g par jour)" accessibilityLabel="Glucides nets (g par jour)" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
      <TextInput label="Lipides (g par jour)" accessibilityLabel="Lipides (g par jour)" value={fat} onChangeText={setFat} keyboardType="number-pad" />
      <TextInput label="Eau (ml par jour)" accessibilityLabel="Eau (ml par jour)" value={water} onChangeText={setWater} keyboardType="number-pad" />
      <TextInput label="Pas (par jour)" accessibilityLabel="Pas (par jour)" value={steps} onChangeText={setSteps} keyboardType="number-pad" />
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={problem !== null}
        onPress={() => onSave({ goalMode: mode, weeklyLossKg: weeklyLossKg ?? null, goals })}
      >
        Enregistrer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { padding: 16, gap: 12, borderRadius: 16 },
  button: { minHeight: 48 },
});
