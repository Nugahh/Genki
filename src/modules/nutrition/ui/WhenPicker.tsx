import { StyleSheet, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import { dayKey } from '@/shared/clock';

/** Opens the native picker for a date or a time, with the instant it starts from; undefined when it is dismissed. */
export type PickWhen = (mode: 'date' | 'time', value: Date, bounds: { min: Date; max: Date }) => Promise<Date | undefined>;

type Props = {
  at: Date;
  now: Date;
  timezone: string;
  pickWhen: PickWhen;
  onChange: (at: Date) => void;
};

const DAY = 24 * 3600 * 1000;

// shortcut: « hier » is 24 hours back, a day off twice a year around the change of hour; the native picker works in the phone's zone, taken as the profile's.
function dayText(at: Date, now: Date, timezone: string) {
  const day = dayKey(at, timezone);
  if (day === dayKey(now, timezone)) return 'Aujourd’hui';
  if (day === dayKey(new Date(now.getTime() - DAY), timezone)) return 'Hier';
  return at.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
}

/** The day and the time an entry is logged at, each opening the native picker: not in the future, not more than a year back. */
export function WhenPicker({ at, now, timezone, pickWhen, onChange }: Props) {
  const bounds = { min: new Date(now.getTime() - 365 * DAY), max: now };
  const choose = async (mode: 'date' | 'time') => {
    const chosen = await pickWhen(mode, at, bounds);
    if (chosen) onChange(chosen);
  };
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Button mode="outlined" icon="calendar" accessibilityLabel="Choisir le jour" contentStyle={styles.button} style={styles.half} onPress={() => void choose('date')}>
          {dayText(at, now, timezone)}
        </Button>
        <Button mode="outlined" icon="clock-outline" accessibilityLabel="Choisir l’heure" contentStyle={styles.button} style={styles.half} onPress={() => void choose('time')}>
          {at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}
        </Button>
      </View>
      {at.getTime() > now.getTime() && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          L’heure choisie est dans le futur.
        </HelperText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  button: { minHeight: 48 },
});
