import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { AppProvider, useApp } from './appContext';

const MESSAGE = 'L’enregistrement a échoué.';
const denied = new Error('permission-denied');

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
      <AppProvider app={{} as never}>
        <Saver write={write} />
      </AppProvider>
    </PaperProvider>,
  );

let warn: jest.SpyInstance;
// Rejected writes are logged for the developer: keep the test output clean.
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

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
  await waitFor(() => expect(screen.queryByText(MESSAGE)).toBeNull());
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

test('« Fermer » drops the failed write without running it again', async () => {
  const write = jest.fn().mockRejectedValue(denied);
  await renderSaver(write);
  await fireEvent.press(screen.getByText('ok'));
  await fireEvent.press(await screen.findByLabelText('Fermer'));
  expect(write).toHaveBeenCalledTimes(1);
  expect(screen.getByText('ok')).toBeTruthy();
});
