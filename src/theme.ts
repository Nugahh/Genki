import { DefaultTheme } from 'expo-router';
import { MD3LightTheme } from 'react-native-paper';

/** The app is light-only: without a theme of its own, Paper and the navigation chrome follow the phone's dark mode. */
export const theme = MD3LightTheme;

/** The header and the canvas behind the screens, painted from the Paper theme instead of the navigation library's own (iOS blue, gray canvas). */
export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.onSurface,
    border: theme.colors.outlineVariant,
    notification: theme.colors.error,
  },
};
