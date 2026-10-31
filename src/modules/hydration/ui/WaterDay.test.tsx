import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryWaterRepository } from '../adapters/inMemoryWaterRepository';
import { waterUseCases } from '../application/waterUseCases';
import { WaterDay } from './WaterDay';

let now: Date;
const clock = { now: () => now };

async function setup() {
  now = new Date('2026-10-31T10:30:00Z'); // 11:30 in Paris
  const hydration = waterUseCases(inMemoryWaterRepository(), clock, 'Europe/Paris');
  const run = jest.fn((write: () => Promise<void>) => void write());
  const show = (day = '2026-10-31') =>
    render(
      <PaperProvider theme={theme}>
        <WaterDay hydration={hydration} day={day} timezone="Europe/Paris" run={run} />
      </PaperProvider>,
    );
  return { hydration, run, show };
}

test('lists the glasses of the day, newest first, with their time', async () => {
  const { hydration, show } = await setup();
  hydration.addWater(250);
  now = new Date('2026-10-31T12:05:00Z'); // 13:05
  hydration.addWater(500);
  await show();
  const rows = screen.getAllByText(/ml$/).map((n) => n.props.children);
  expect(rows).toEqual(['13:05 · 500 ml', '11:30 · 250 ml']);
});

test('takes a glass back through run, and the list follows', async () => {
  const { hydration, run, show } = await setup();
  hydration.addWater(250);
  await show();
  await fireEvent.press(screen.getByLabelText('Supprimer 250 ml de 11:30'));
  expect(run).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Aucun verre ce jour-là.')).toBeTruthy();
});

test('says so when the day has no glass', async () => {
  const { show } = await setup();
  await show('2026-10-30');
  expect(screen.getByText('Aucun verre ce jour-là.')).toBeTruthy();
});
