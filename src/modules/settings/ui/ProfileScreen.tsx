import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { ProfilePatch } from '../application/ports';
import { validateProfile, type ActivityLevel, type Profile, type Sex } from '../domain/profile';
import { asText, parseNumber } from './format';

type Props = { profile: Profile; onSave: (patch: ProfilePatch) => void };

// Paper's segment is 40 dp tall: 4 dp of padding above and below the label make the 48 dp target.
const seg = <T extends string>(items: [T, string][]) => items.map(([value, label]) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true }));
const SEXES = seg<Sex>([['male', 'Homme'], ['female', 'Femme']]);
const ACTIVITIES = seg<ActivityLevel>([['sedentary', 'Sédentaire'], ['light', 'Léger'], ['active', 'Actif']]);

/** What the proposed goals are computed from: sex, birth year, height and activity (spec §9). */
export function ProfileScreen({ profile, onSave }: Props) {
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [birthYear, setBirthYear] = useState(asText(profile.birthYear));
  const [height, setHeight] = useState(asText(profile.heightCm));
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);

  const next = { sex, birthYear: parseNumber(birthYear), heightCm: parseNumber(height), activityLevel: activity };
  const problem = validateProfile({ ...profile, ...next });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleMedium" accessibilityRole="header">
        Sexe
      </Text>
      <SegmentedButtons value={sex} onValueChange={(value) => setSex(value as Sex)} buttons={SEXES} />
      <TextInput label="Année de naissance" accessibilityLabel="Année de naissance" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" />
      <TextInput label="Taille (cm)" accessibilityLabel="Taille (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
      <Text variant="titleMedium" accessibilityRole="header">
        Activité
      </Text>
      <SegmentedButtons value={activity} onValueChange={(value) => setActivity(value as ActivityLevel)} buttons={ACTIVITIES} />
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      <Button mode="contained" contentStyle={styles.button} disabled={problem !== null} onPress={() => onSave(next)}>
        Enregistrer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12 }, button: { minHeight: 48 } });
