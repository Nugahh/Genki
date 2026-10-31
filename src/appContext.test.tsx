import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryProfileRepository, settingsUseCases } from '@/modules/settings';
import { inMemoryHealthSource, inMemoryStepsRepository, stepsUseCases } from '@/modules/steps';
import { AppProvider, useApp } from './appContext';

const MESSAGE = 'L’enregistrement a échoué.';
const denied = new Error('permission-denied');
// The provider reads the profile through the settings use cases; the rest of the app is not needed here.
const steps = () => stepsUseCases({ health: inMemoryHealthSource(), repo: inMemoryStepsRepository({ devices: [{ id: 'other', name: 'Galaxy', stepsWriter: true }] }), device: { id: 'phone-a', name: 'Pixel' }, clock: { now: () => new Date('2026-11-03T10:00:00Z') }, timezone: 'Europe/Paris' });
const app = { settings: settingsUseCases(inMemoryProfileRepository()), steps: steps() } as never;

// Runs `write` on press and shows whether a write failed.
function Saver({ write }: { write: () => Promise<void> }) {
  const { run, writeFailed } = useApp();
  return (
    <Pressable onPress={() => run(write)}>
      <Text>{writeFailed ? 'échec' : 'ok'}</Text>
    </Pressable>
  );
}

const renderSaver = (write: () => Promise<void>) =>
  render(
    <PaperProvider>
      <AppProvider app={app}>
        <Saver write={write} />
      </AppProvider>
    </PaperProvider>,
  );

let warn: jest.SpyInstance;
// Rejected writes are logged for the developer: keep the test output clean.
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

test('a rejected write is offered again: « Réessayer » runs the same write', async () => {
  const write = jest.fn().mockRejectedValueOnce(denied).mockResolvedValue(undefined);
  await renderSaver(write);
  await fireEvent.press(screen.getByText('ok'));
  expect(await screen.findByText(MESSAGE)).toBeTruthy();
  expect(screen.getByText('échec')).toBeTruthy();
  expect(warn).toHaveBeenCalledWith(denied);

  await fireEvent.press(screen.getByText('Réessayer'));
  expect(write).toHaveBeenCalledTimes(2);
  expect(screen.getByText('ok')).toBeTruthy();
  expect(screen.queryByText(MESSAGE)).toBeNull();
});

test('a retry that fails again shows the message again', async () => {
  const write = jest.fn().mockRejectedValue(denied);
  await renderSaver(write);
  await fireEvent.press(screen.getByText('ok'));
  await fireEvent.press(await screen.findByText('Réessayer'));
  expect(write).toHaveBeenCalledTimes(2);
  expect(screen.getByText('échec')).toBeTruthy();
  expect(screen.getByText(MESSAGE)).toBeTruthy();
});

test('a retry refused while the message fades out still offers « Réessayer »', async () => {
  jest.useFakeTimers();
  const write = jest
    .fn()
    .mockRejectedValueOnce(denied)
    .mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(denied), 5)));
  await renderSaver(write);
  await fireEvent.press(screen.getByText('ok'));
  await fireEvent.press(await screen.findByText('Réessayer'));
  // The refusal (5 ms) renders before the fade-out ends (16 ms under Jest's native animation mock)...
  await act(() => jest.advanceTimersByTime(5));
  // ...then the fade-out ends.
  await act(() => jest.advanceTimersByTime(300));
  expect(screen.getByText(MESSAGE)).toBeTruthy();
  expect(screen.getByText('Réessayer')).toBeTruthy();
});

test('« Fermer » drops the failed write without running it again', async () => {
  const write = jest.fn().mockRejectedValue(denied);
  await renderSaver(write);
  await fireEvent.press(screen.getByText('ok'));
  await fireEvent.press(await screen.findByLabelText('Fermer'));
  expect(write).toHaveBeenCalledTimes(1);
  expect(screen.getByText('ok')).toBeTruthy();
});

test('gives the screens the live profile, and says when it was read', async () => {
  const settings = settingsUseCases(inMemoryProfileRepository());
  function Goal() {
    const { profile, profileLoaded } = useApp();
    return <Text>{`${profile.goals.kcal} ${profileLoaded ? 'lu' : 'pas lu'}`}</Text>;
  }
  await render(
    <PaperProvider>
      <AppProvider app={{ settings, steps: steps() } as never}>
        <Goal />
      </AppProvider>
    </PaperProvider>,
  );
  expect(screen.getByText('2200 lu')).toBeTruthy();
  await act(async () => settings.saveProfile({ goals: { kcal: 1900 } as never }));
  expect(screen.getByText('1900 lu')).toBeTruthy();
});
