import { render, screen } from '@testing-library/react-native';
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
      <GaugeBar label="Eau" value="1 L" goal="2 L" remaining="reste 1 L" hint="Ouvre les verres du jour" metric="water" progress={0.5} expected={0.6} color={color} icon="plus" onPress={() => {}} />
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
      <GaugeBar label="X" value="1" goal="2" remaining="reste 1" hint="" metric={metric} progress={0.5} expected={0.6} color="green" icon="plus" onPress={() => {}} />
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
