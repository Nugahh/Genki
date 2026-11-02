import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { theme } from '@/theme';
import type { GaugeColor } from '../domain/gauge';
import { GaugeBar } from './GaugeBar';

type Node = { props?: { style?: unknown }; children?: (Node | string)[] | null };

/** Every background color painted in the tree, whatever the style is made of. */
const backgrounds = (node: Node | string | null): string[] => {
  if (node === null || typeof node === 'string') return [];
  const own = StyleSheet.flatten(node.props?.style as never)?.backgroundColor;
  return [...(typeof own === 'string' ? [own] : []), ...(node.children ?? []).flatMap(backgrounds)];
};

const gauge = async (color: GaugeColor) => {
  await render(
    <PaperProvider theme={theme}>
      <GaugeBar label="Eau" value="1" goal="2" unit="L" hint="Ajoute une quantité d’eau de ton choix" metric="water" progress={0.5} expected={0.6} color={color} icon="plus" onPress={() => {}} />
    </PaperProvider>,
  );
  return backgrounds(screen.toJSON() as Node);
};

test.each<GaugeColor>(['green', 'orange', 'red'])('a gauge %s is filled with that pace color of the theme and no other', async (color) => {
  const painted = await gauge(color);
  expect(painted).toContain(theme.colors.pace[color]);
  for (const other of Object.values(theme.colors.pace).filter((c) => c !== theme.colors.pace[color])) expect(painted).not.toContain(other);
});

test.each([
  ['water', 'water'],
  ['calories', 'fire'],
  ['protein', 'arm-flex'],
] as const)('a %s gauge wears its icon on the disc of its own tint', async (metric, name) => {
  await render(
    <PaperProvider theme={theme}>
      <GaugeBar label="X" value="1" goal="2" hint="" metric={metric} progress={0.5} expected={0.6} color="green" icon="plus" onPress={() => {}} />
    </PaperProvider>,
  );
  expect(screen.getByText(String.fromCodePoint(glyphs[name]), { includeHiddenElements: true })).toBeTruthy();
  expect(backgrounds(screen.toJSON() as Node)).toContain(theme.colors.metric[metric].container);
});

test('the track and the tick of a gauge take their colors from the theme roles', async () => {
  const painted = await gauge('green');
  expect(painted).toContain(theme.colors.surfaceVariant);
  expect(painted).toContain(theme.colors.onSurface);
});

const draw = (props: Partial<React.ComponentProps<typeof GaugeBar>> = {}) =>
  render(
    <PaperProvider theme={theme}>
      <GaugeBar label="Eau" value="1,25" goal="2,5" unit="L" hint="" metric="water" progress={0.5} expected={0.6} color="green" icon="plus" onPress={() => {}} {...props} />
    </PaperProvider>,
  );

test('reads « Eau – 1,25 / 2,5 L » with the percentage at the right of that line, and nothing about what is left', async () => {
  await draw();
  const head = within(screen.getByTestId('gauge-head'));
  expect(head.getByText('Eau – 1,25 / 2,5 L')).toBeTruthy();
  expect(head.getByText('50 %')).toBeTruthy();
  expect(screen.queryByText(/reste|sur /i)).toBeNull();
});

test('a gauge whose label says its unit has none after the goal', async () => {
  await draw({ label: 'Pas', value: '3 000', goal: '8 000', unit: undefined });
  expect(screen.getByText('Pas – 3 000 / 8 000')).toBeTruthy();
});

test('is read as a button with its figures and its percentage, the pace in its value and the touch in its hint', async () => {
  await draw({ hint: 'Ajoute une quantité d’eau de ton choix', note: 'Fitbit · lu à 14:30' });
  const button = screen.getByRole('button');
  expect(button.props.accessibilityLabel).toBe('Eau : 1,25 sur 2,5 L, 50 %, Fitbit · lu à 14:30');
  expect(button.props.accessibilityHint).toBe('Ajoute une quantité d’eau de ton choix');
  expect(button).toHaveAccessibilityValue({ text: 'dans le rythme' });
  expect(screen.getByText('Fitbit · lu à 14:30')).toBeTruthy();
});

test('keeps the tick of the pace on its bar', async () => {
  await draw({ expected: 0.4 });
  expect(screen.getByTestId('gauge-marker')).toBeTruthy();
});
