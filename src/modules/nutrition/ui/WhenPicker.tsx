import { StyleSheet, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import { dayKey } from '@/shared/clock';

/** Opens the native picker for a date or a time, with the instant it starts from; undefined when it is dismissed. */
export type PickWhen = (mode: 'date' | 'time', value: Date, bounds: { min: Date; max: Date }, timezone: string) => Promise<Date | undefined>;

type Props = {
  at: Date;
  now: Date;
  timezone: string;
  pickWhen: PickWhen;
  onChange: (at: Date) => void;
};

const DAY = 24 * 3600 * 1000;

// shortcut: « hier » is 24 hours back, a day off twice a year around the change of hour.
function dayText(at: Date, now: Date, timezone: string) {
  const day = dayKey(at, timezone);
  if (day === dayKey(now, timezone)) return 'Aujourd’hui';
  if (day === dayKey(new Date(now.getTime() - DAY), timezone)) return 'Hier';
  return at.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
}

/** The day and the time an entry is logged at, each opening the native picker: not in the future, not more than a year back. */
export function WhenPicker({ at, now, timezone, pickWhen, onChange }: Props) {
  const bounds = { min: new Date(now.getTime() - 365 * DAY), max: now };
  const day = dayText(at, now, timezone);
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  const choose = async (mode: 'date' | 'time') => {
    const chosen = await pickWhen(mode, at, bounds, timezone);
    if (chosen) onChange(chosen);
  };
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Button mode="outlined" icon="calendar" accessibilityLabel={`Choisir le jour, ${day}`} contentStyle={styles.button} style={styles.half} onPress={() => void choose('date')}>
          {day}
        </Button>
        <Button mode="outlined" icon="clock-outline" accessibilityLabel={`Choisir l’heure, ${time}`} contentStyle={styles.button} style={styles.half} onPress={() => void choose('time')}>
          {time}
        </Button>
      </View>
      {at.getTime() > now.getTime() && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          L’heure choisie est dans le futur.
        </HelperText>
      )}
      {at.getTime() < bounds.min.getTime() && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          L’heure choisie remonte à plus d’un an.
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
