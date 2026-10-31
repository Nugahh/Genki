import { navigationTheme, theme } from './theme';

test('the navigation chrome (header, canvas, tabs) is painted from the Paper theme, not from the navigation library defaults', () => {
  const { colors } = navigationTheme;
  expect(colors).toEqual({
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.onSurface,
    border: theme.colors.outlineVariant,
    notification: theme.colors.error,
  });
});

test('the app has one light theme, whatever the phone does', () => {
  expect(theme.dark).toBe(false);
  expect(navigationTheme.dark).toBe(false);
});
