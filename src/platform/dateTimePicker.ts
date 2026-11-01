import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/**
 * Opens the native picker of a date or a time, starting from `value` and shown in `timezone`; the answer keeps the other part of `value`
 * (the time for a date, the date for a time). `undefined` when it is dismissed or cannot open.
 */
export function pickWhen(mode: 'date' | 'time', value: Date, bounds: { min: Date; max: Date }, timezone: string): Promise<Date | undefined> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode,
      value,
      timeZoneName: timezone,
      is24Hour: true,
      minimumDate: bounds.min,
      maximumDate: bounds.max,
      onValueChange: (_event, date) => resolve(date),
      onDismiss: () => resolve(undefined),
      onError: () => resolve(undefined),
    });
  });
}
