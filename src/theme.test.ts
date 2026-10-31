import { navigationTheme, theme } from './theme';

const { colors } = theme;

/** WCAG relative luminance of « rgb(r, g, b) » or « #rrggbb ». */
const luminance = (color: string) => {
  const [r, g, b] = color.startsWith('#') ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) : (color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

test('the navigation chrome (header, canvas, tabs) is painted from the Paper theme, not from the navigation library defaults', () => {
  expect(navigationTheme.colors).toEqual({
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.outlineVariant,
    notification: colors.error,
  });
});

test('the app has one light theme, whatever the phone does', () => {
  expect(theme.dark).toBe(false);
  expect(navigationTheme.dark).toBe(false);
});

test.each([
  ['text on the page', colors.onSurface, colors.surface],
  ['secondary text on the page', colors.onSurfaceVariant, colors.surface],
  ['text button on the page', colors.primary, colors.surface],
  ['text button in a dialog', colors.primary, colors.elevation.level3],
  ['label of a filled button', colors.onPrimary, colors.primary],
  ['label of a tonal button, a chip, the chosen tab', colors.onSecondaryContainer, colors.secondaryContainer],
  ['label of a text field', colors.onSurfaceVariant, colors.surfaceVariant],
  ['label of a focused text field', colors.primary, colors.surfaceVariant],
  ['error text', colors.error, colors.surface],
  ['tab label', colors.onSurfaceVariant, colors.elevation.level2],
  ['snackbar text', colors.inverseOnSurface, colors.inverseSurface],
  ['snackbar action', colors.inversePrimary, colors.inverseSurface],
])('%s reads at 4.5:1 or more', (_, foreground, background) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

test.each([
  ['the border of a field, a segment or an outlined button', colors.outline, colors.surface],
  ['the tick of a gauge on its track', colors.onSurface, colors.surfaceVariant],
  ['the fill of a gauge on pace', colors.pace.green, colors.surfaceVariant],
  ['the fill of a gauge a little late', colors.pace.orange, colors.surfaceVariant],
  ['the fill of a gauge late', colors.pace.red, colors.surfaceVariant],
])('%s stands out at 3:1 or more', (_, foreground, background) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
});

test.each(['water', 'calories', 'protein'] as const)('the icon of the %s disc reads on its tint', (metric) => {
  expect(contrast(colors.metric[metric].on, colors.metric[metric].container)).toBeGreaterThanOrEqual(4.5);
});

test('the three discs are three different tints, none of them a pace color', () => {
  const tints = Object.values(colors.metric).map((m) => m.container);
  expect(new Set(tints).size).toBe(3);
  for (const tint of tints) expect(Object.values(colors.pace)).not.toContain(tint);
});

test('the text is set in Nunito: regular for reading, semi-bold for titles and labels, with no synthetic weight', () => {
  const medium = ['titleMedium', 'titleSmall', 'labelLarge', 'labelMedium', 'labelSmall'];
  for (const [variant, font] of Object.entries(theme.fonts)) {
    expect(font.fontFamily).toBe(medium.includes(variant) ? 'Nunito_600SemiBold' : 'Nunito_400Regular');
    expect(font.fontWeight).toBe('400');
  }
});

test('the three paces differ in lightness too, not only in hue (red and green look alike to some eyes)', () => {
  const { green, orange, red } = colors.pace;
  expect(contrast(green, red)).toBeGreaterThanOrEqual(1.3);
  expect(contrast(orange, green)).toBeGreaterThanOrEqual(1.3);
});

test('no accent but the primary one: the container tints are the primary hue, none is a Material default violet', () => {
  expect(colors.primary).not.toBe('rgb(103, 80, 164)');
  expect(colors.secondaryContainer).not.toBe('rgb(232, 222, 248)');
});
