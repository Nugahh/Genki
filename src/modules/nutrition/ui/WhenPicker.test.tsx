import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { WhenPicker } from './WhenPicker';

const now = new Date('2026-10-24T10:30:00Z'); // 12:30 in Paris, a Saturday
const zone = 'Europe/Paris';

async function draw(at: Date, pickWhen = jest.fn(async () => undefined as Date | undefined)) {
  const onChange = jest.fn();
  await render(
    <PaperProvider>
      <WhenPicker at={at} now={now} timezone={zone} pickWhen={pickWhen} onChange={onChange} />
    </PaperProvider>,
  );
  return { onChange, pickWhen };
}

test('says today and the time in the zone of the profile', async () => {
  await draw(now);
  expect(screen.getByText('Aujourd’hui')).toBeTruthy();
  expect(screen.getByText('12:30')).toBeTruthy();
});

test('says yesterday, then the date', async () => {
  await draw(new Date('2026-10-23T08:00:00Z'));
  expect(screen.getByText('Hier')).toBeTruthy();
  expect(screen.getByText('10:00')).toBeTruthy();
  await screen.unmount();
  await draw(new Date('2026-10-20T08:00:00Z'));
  expect(screen.getByText('mar. 20 oct.')).toBeTruthy();
});

test('the day button asks the picker for a date, within a year back and now, and keeps the answer', async () => {
  const chosen = new Date('2026-10-22T10:30:00Z');
  const { onChange, pickWhen } = await draw(now, jest.fn(async () => chosen));
  await fireEvent.press(screen.getByLabelText('Choisir le jour'));
  expect(pickWhen).toHaveBeenCalledWith('date', now, { min: new Date('2025-10-24T10:30:00Z'), max: now });
  expect(onChange).toHaveBeenCalledWith(chosen);
});

test('the time button asks for a time', async () => {
  const chosen = new Date('2026-10-24T07:15:00Z');
  const { onChange, pickWhen } = await draw(now, jest.fn(async () => chosen));
  await fireEvent.press(screen.getByLabelText('Choisir l’heure'));
  expect(pickWhen).toHaveBeenCalledWith('time', now, expect.anything());
  expect(onChange).toHaveBeenCalledWith(chosen);
});

test('a picker that is dismissed changes nothing', async () => {
  const { onChange } = await draw(now);
  await fireEvent.press(screen.getByLabelText('Choisir l’heure'));
  expect(onChange).not.toHaveBeenCalled();
});

test('a time in the future is said, as an error', async () => {
  await draw(new Date('2026-10-24T11:00:00Z'));
  expect(screen.getByText('L’heure choisie est dans le futur.').props.accessibilityLiveRegion).toBe('polite');
});
