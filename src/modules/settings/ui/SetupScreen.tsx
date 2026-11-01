import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import type { ProfilePatch } from '../application/ports';
import { proposeGoals } from '../domain/goals';
import { validateProfile, type ActivityLevel, type GoalMode, type Profile, type Sex } from '../domain/profile';
import { GOAL_MODES } from './goalMode';
import { asText, parseNumber } from './format';

type Props = {
  profile: Profile;
  year: number;
  /** The profile and the goals chosen, the weight to record as the first measure, and the moment it was done. */
  onDone: (patch: ProfilePatch, weightKg: number) => void;
  /** Keeps the defaults: the screen is not shown again. */
  onSkip: () => void;
};

// Paper's segment is 40 dp tall: 4 dp of padding above and below the label make the 48 dp target.
const seg = <T extends string>(items: [T, string][]) => items.map(([value, label]) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }));
const SEXES = seg<Sex>([['male', 'Homme'], ['female', 'Femme']]);
const ACTIVITIES = seg<ActivityLevel>([['sedentary', 'Sédentaire'], ['light', 'Léger'], ['active', 'Actif']]);
const MODES = GOAL_MODES.map((m) => ({ ...m, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }));

/** First launch (spec §6): the profile, a weight, what the calories are for; then the goals proposed, to keep or change. */
export function SetupScreen({ profile, year, onDone, onSkip }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'you' | 'goals'>('you');
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);
  const [mode, setMode] = useState<GoalMode>('deficit');
  const [goalFields, setGoalFields] = useState({ kcal: '', proteinG: '', carbsNetG: '', fatG: '', waterMl: '', steps: '' });
  const [notes, setNotes] = useState<string[]>([]);

  const you = { sex, birthYear: parseNumber(birthYear), heightCm: parseNumber(height), activityLevel: activity, goalMode: mode };
  const weightKg = parseNumber(weight);
  const youProblem = validateProfile({ ...profile, ...you }) ?? (weightKg > 20 && weightKg < 400 ? null : 'Le poids est compris entre 20 et 400 kg.');
  const goals = { kcal: parseNumber(goalFields.kcal), proteinG: parseNumber(goalFields.proteinG), carbsNetG: parseNumber(goalFields.carbsNetG), fatG: parseNumber(goalFields.fatG), waterMl: parseNumber(goalFields.waterMl), steps: parseNumber(goalFields.steps) };
  const goalsProblem = validateProfile({ ...profile, ...you, goals });

  const seeGoals = () => {
    const proposal = proposeGoals({ profile: { ...profile, ...you }, weightKg, year });
    setGoalFields({ kcal: asText(proposal.goals.kcal), proteinG: asText(proposal.goals.proteinG), carbsNetG: asText(proposal.goals.carbsNetG), fatG: asText(proposal.goals.fatG), waterMl: asText(proposal.goals.waterMl), steps: asText(proposal.goals.steps) });
    setNotes(proposal.notes);
    setStep('goals');
  };
  const field = (key: keyof typeof goalFields) => (value: string) => setGoalFields((all) => ({ ...all, [key]: value }));

  if (step === 'goals') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleLarge" accessibilityRole="header">
          Tes objectifs
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Une proposition à partir de ton profil. Change ce que tu veux : tout se retrouve dans les réglages.
        </Text>
        <TextInput label="Calories (kcal par jour)" accessibilityLabel="Calories (kcal par jour)" value={goalFields.kcal} onChangeText={field('kcal')} keyboardType="number-pad" />
        <TextInput label="Protéines (g par jour)" accessibilityLabel="Protéines (g par jour)" value={goalFields.proteinG} onChangeText={field('proteinG')} keyboardType="number-pad" />
        <TextInput label="Glucides nets (g par jour)" accessibilityLabel="Glucides nets (g par jour)" value={goalFields.carbsNetG} onChangeText={field('carbsNetG')} keyboardType="number-pad" />
        <TextInput label="Lipides (g par jour)" accessibilityLabel="Lipides (g par jour)" value={goalFields.fatG} onChangeText={field('fatG')} keyboardType="number-pad" />
        <TextInput label="Eau (ml par jour)" accessibilityLabel="Eau (ml par jour)" value={goalFields.waterMl} onChangeText={field('waterMl')} keyboardType="number-pad" />
        <TextInput label="Pas (par jour)" accessibilityLabel="Pas (par jour)" value={goalFields.steps} onChangeText={field('steps')} keyboardType="number-pad" />
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="bodyMedium" accessibilityLiveRegion="polite">
            {notes.join('\n')}
          </Text>
        </Surface>
        {goalsProblem && (
          <HelperText type="error" accessibilityLiveRegion="polite">
            {goalsProblem}
          </HelperText>
        )}
        <Button mode="contained" contentStyle={styles.button} disabled={goalsProblem !== null} onPress={() => onDone({ ...you, weeklyLossKg: null, goals, createdAt: new Date() }, weightKg)}>
          Terminer
        </Button>
        <Button contentStyle={styles.button} onPress={() => setStep('you')}>
          Retour
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleLarge" accessibilityRole="header">
        Faisons connaissance
      </Text>
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        Quelques informations pour proposer des objectifs. Elles restent dans ton compte.
      </Text>
      <SegmentedButtons value={sex} onValueChange={(value) => setSex(value as Sex)} buttons={SEXES} />
      <TextInput label="Année de naissance" accessibilityLabel="Année de naissance" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" />
      <TextInput label="Taille (cm)" accessibilityLabel="Taille (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
      <TextInput label="Poids (kg)" accessibilityLabel="Poids (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      <Text variant="titleMedium" accessibilityRole="header">
        Activité
      </Text>
      <SegmentedButtons value={activity} onValueChange={(value) => setActivity(value as ActivityLevel)} buttons={ACTIVITIES} />
      <Text variant="titleMedium" accessibilityRole="header">
        Objectif des calories
      </Text>
      <SegmentedButtons value={mode} onValueChange={(value) => setMode(value as GoalMode)} buttons={MODES} />
      <Button mode="contained" contentStyle={styles.button} disabled={youProblem !== null} onPress={seeGoals}>
        Voir mes objectifs
      </Button>
      <Button contentStyle={styles.button} onPress={onSkip}>
        Passer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 16 },
  button: { minHeight: 48 },
});
