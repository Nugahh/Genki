import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { pickWhen } from './dateTimePicker';

jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const open = DateTimePickerAndroid.open as jest.Mock;
const bounds = { min: new Date('2025-10-24T10:00:00Z'), max: new Date('2026-10-24T10:00:00Z') };
const value = new Date('2026-10-24T10:00:00Z');

test('opens the native picker of the mode, from the value, within the bounds, on 24 hours', () => {
  void pickWhen('time', value, bounds);
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'time', value, is24Hour: true, minimumDate: bounds.min, maximumDate: bounds.max }));
});

test('answers with the date that was set', async () => {
  const chosen = new Date('2026-10-22T10:00:00Z');
  open.mockImplementationOnce(({ onChange }) => onChange({ type: 'set' }, chosen));
  await expect(pickWhen('date', value, bounds)).resolves.toBe(chosen);
});

test('answers with nothing when the picker is dismissed or fails', async () => {
  open.mockImplementationOnce(({ onChange }) => onChange({ type: 'dismissed' }, undefined));
  await expect(pickWhen('date', value, bounds)).resolves.toBeUndefined();
  open.mockImplementationOnce(({ onError }) => onError(new Error('no activity')));
  await expect(pickWhen('date', value, bounds)).resolves.toBeUndefined();
});
