import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/**
 * Opens the native picker of a date or a time, starting from `value`; the answer keeps the other part of `value` (the time for a date, the date
 * for a time). `undefined` when it is dismissed. The picker works in the phone's zone.
 */
export function pickWhen(mode: 'date' | 'time', value: Date, bounds: { min: Date; max: Date }): Promise<Date | undefined> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode,
      value,
      is24Hour: true,
      minimumDate: bounds.min,
      maximumDate: bounds.max,
      onChange: (event, date) => resolve(event.type === 'set' ? date : undefined),
      onError: () => resolve(undefined),
    });
  });
}
