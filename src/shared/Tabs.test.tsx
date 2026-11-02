import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { Tabs } from './Tabs';

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'starred', label: 'Favoris' },
  { key: 'custom', label: 'Personnalisé' },
];
const draw = (value = 'all') => {
  const onChange = jest.fn();
  return render(
    <PaperProvider theme={theme}>
      <Tabs tabs={TABS} value={value} onChange={onChange} />
    </PaperProvider>,
  ).then(() => onChange);
};

test('lists the tabs in order, in a tab list', async () => {
  await draw();
  expect(screen.getByTestId('tabs').props.accessibilityRole).toBe('tablist');
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.getAllByText(/^(Tout|Favoris|Personnalisé)$/).map((t) => t.props.children)).toEqual(['Tout', 'Favoris', 'Personnalisé']);
});

test('announces the open tab as selected and the others as not', async () => {
  await draw('starred');
  const selected = screen.getAllByRole('tab').map((tab) => tab.props.accessibilityState.selected);
  expect(selected).toEqual([false, true, false]);
});

test('touching a tab chooses it', async () => {
  const onChange = await draw();
  await fireEvent.press(screen.getByText('Personnalisé'));
  expect(onChange).toHaveBeenCalledWith('custom');
});

test('a line under the open tab only, in the ink of the text and not the accent', async () => {
  await draw('starred');
  const color = (key: string) => StyleSheet.flatten(screen.getByTestId(`tab-indicator-${key}`).props.style).backgroundColor;
  expect(color('starred')).toBe(theme.colors.onSurface);
  expect(color('all')).toBe('transparent');
  expect(color('custom')).toBe('transparent');
});

test('each tab is at least 48 dp tall', async () => {
  await draw();
  for (const tab of screen.getAllByRole('tab')) expect(StyleSheet.flatten(tab.props.style).minHeight).toBeGreaterThanOrEqual(48);
});

test('the row is not one stop for a screen reader: each tab is', async () => {
  await draw();
  expect(screen.getByTestId('tabs').props.accessible).not.toBe(true);
});

test('a label stays on one line and shrinks rather than breaks at a large font', async () => {
  await draw();
  const label = screen.getByText('Personnalisé');
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.adjustsFontSizeToFit).toBe(true);
});
