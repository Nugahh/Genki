import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import type { ProfilePatch } from '../application/ports';
import { validateProfile, type Profile } from '../domain/profile';
import { asText, parseNumber } from './format';

type Props = {
  profile: Profile;
  /** Today's day key, for « Aujourd’hui ». */
  today: string;
  onSave: (patch: ProfilePatch) => void;
};

const orUndefined = (text: string) => (text.trim() === '' ? undefined : parseNumber(text));

/** The day of the last cigarette, and what a cigarette costs: the days without tobacco and the money kept come from them. */
export function TobaccoSettingsScreen({ profile, today, onSave }: Props) {
  const { colors } = useTheme();
  const [quitDate, setQuitDate] = useState(profile.quitDate ?? '');
  const [perDay, setPerDay] = useState(asText(profile.cigarettesPerDay));
  const [packSize, setPackSize] = useState(asText(profile.packSize));
  const [packPrice, setPackPrice] = useState(asText(profile.packPrice));

  const next = {
    quitDate: quitDate.trim() === '' ? undefined : quitDate.trim(),
    cigarettesPerDay: orUndefined(perDay),
    packSize: parseNumber(packSize),
    packPrice: orUndefined(packPrice),
  };
  const problem = validateProfile({ ...profile, ...next });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        La date d’arrêt est le jour de ta dernière cigarette. Les jours sans tabac se comptent à partir d’elle.
      </Text>
      <TextInput label="Date d’arrêt (AAAA-MM-JJ)" accessibilityLabel="Date d’arrêt (AAAA-MM-JJ)" value={quitDate} onChangeText={setQuitDate} placeholder={today} autoCapitalize="none" />
      <Button icon="calendar-today" contentStyle={styles.button} onPress={() => setQuitDate(today)}>
        Aujourd’hui
      </Button>
      <TextInput label="Cigarettes par jour (avant l’arrêt)" accessibilityLabel="Cigarettes par jour (avant l’arrêt)" value={perDay} onChangeText={setPerDay} keyboardType="number-pad" />
      <TextInput label="Cigarettes par paquet" accessibilityLabel="Cigarettes par paquet" value={packSize} onChangeText={setPackSize} keyboardType="number-pad" />
      <TextInput label="Prix du paquet (€)" accessibilityLabel="Prix du paquet (€)" value={packPrice} onChangeText={setPackPrice} keyboardType="decimal-pad" />
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={problem !== null}
        onPress={() =>
          onSave({
            quitDate: next.quitDate ?? null,
            cigarettesPerDay: next.cigarettesPerDay ?? null,
            packSize: next.packSize,
            packPrice: next.packPrice ?? null,
          })
        }
      >
        Enregistrer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12 }, button: { minHeight: 48 } });
