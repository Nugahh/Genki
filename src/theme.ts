import { DefaultTheme } from 'expo-router';
import { configureFonts, MD3LightTheme, type MD3TypescaleKey } from 'react-native-paper';

/**
 * The palette: ink blue on ivory paper. Material 3 light scheme from the seed hue 262 / chroma 44 (HCT), with warm neutrals (hue 95, chroma 3),
 * the page at tone 98 and the surface levels at the container tones 96 / 94 / 92 / 90. Only the primary hue is an accent: the blue is rare by design.
 */
const colors = {
  ...MD3LightTheme.colors,
  primary: 'rgb(38, 94, 167)',
  onPrimary: 'rgb(255, 255, 255)',
  primaryContainer: 'rgb(214, 227, 255)',
  onPrimaryContainer: 'rgb(0, 27, 60)',
  secondary: 'rgb(85, 95, 113)',
  onSecondary: 'rgb(255, 255, 255)',
  secondaryContainer: 'rgb(217, 227, 248)',
  onSecondaryContainer: 'rgb(18, 28, 43)',
  tertiary: 'rgb(111, 86, 117)',
  onTertiary: 'rgb(255, 255, 255)',
  tertiaryContainer: 'rgb(249, 216, 254)',
  onTertiaryContainer: 'rgb(40, 19, 47)',
  error: 'rgb(186, 26, 26)',
  onError: 'rgb(255, 255, 255)',
  errorContainer: 'rgb(255, 218, 214)',
  onErrorContainer: 'rgb(65, 0, 2)',
  background: 'rgb(254, 248, 241)',
  onBackground: 'rgb(29, 27, 23)',
  surface: 'rgb(254, 248, 241)',
  onSurface: 'rgb(29, 27, 23)',
  surfaceVariant: 'rgb(232, 226, 216)',
  onSurfaceVariant: 'rgb(74, 70, 63)',
  surfaceDisabled: 'rgba(29, 27, 23, 0.12)',
  onSurfaceDisabled: 'rgba(29, 27, 23, 0.38)',
  outline: 'rgb(123, 119, 110)',
  outlineVariant: 'rgb(204, 198, 188)',
  inverseSurface: 'rgb(50, 48, 44)',
  inverseOnSurface: 'rgb(246, 240, 233)',
  inversePrimary: 'rgb(168, 200, 255)',
  backdrop: 'rgba(51, 48, 41, 0.4)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(249, 243, 236)',
    level2: 'rgb(243, 237, 230)',
    level3: 'rgb(237, 231, 224)',
    level4: 'rgb(237, 231, 224)',
    level5: 'rgb(231, 226, 219)',
  },
  // One pastel disc per measure under its icon: blue, lilac, turquoise, clear of the green, ochre and brick of the pace.
  metric: {
    water: { container: 'rgb(214, 227, 255)', on: 'rgb(0, 27, 60)' },
    calories: { container: 'rgb(249, 216, 254)', on: 'rgb(40, 19, 47)' },
    protein: { container: 'rgb(178, 237, 235)', on: 'rgb(0, 32, 31)' },
    steps: { container: 'rgb(225, 228, 236)', on: 'rgb(18, 28, 43)' },
  },
  // Solid marks of the Suivi charts, one per measure, each 4.5:1 or more on the page. The green, ochre and brick of the pace tell how a day went and are not reused here.
  chart: {
    water: 'rgb(38, 94, 167)',
    calories: 'rgb(125, 82, 140)',
    protein: 'rgb(0, 110, 108)',
    carbs: 'rgb(140, 95, 30)',
    fat: 'rgb(160, 65, 105)',
    micro: 'rgb(95, 105, 40)',
    steps: 'rgb(85, 95, 113)',
    weight: 'rgb(70, 80, 150)',
    waist: 'rgb(110, 100, 60)',
    training: 'rgb(40, 110, 150)',
    tobacco: 'rgb(120, 85, 70)',
  },
  // The pace of a gauge (spec §9), outside the Material roles. Each is 3:1 or more on the gauge track (surfaceVariant) and they differ in lightness.
  pace: { green: '#007334', orange: '#B56A00', red: '#9E1910' },
};

// Nunito, rounder and warmer than the system face. Android picks a font file per family, so the weight is in the name: the titles and labels
// (the 500 of the type scale) take the semi-bold, the rest the regular, and no variant asks for a weight on top.
const SEMI_BOLD = ['titleMedium', 'titleSmall', 'labelLarge', 'labelMedium', 'labelSmall'];
const fonts = configureFonts({
  config: Object.fromEntries(
    Object.keys(MD3LightTheme.fonts).map((variant) => [
      variant,
      { fontFamily: SEMI_BOLD.includes(variant) ? 'Nunito_600SemiBold' : 'Nunito_400Regular', fontWeight: '400' as const },
    ]),
  ) as Partial<Record<MD3TypescaleKey, { fontFamily: string; fontWeight: '400' }>>,
});

/** The app is light-only: without a theme of its own, Paper and the navigation chrome follow the phone's dark mode. */
export const theme = { ...MD3LightTheme, fonts, colors };
export type AppTheme = typeof theme;

/** The header and the canvas behind the screens, painted from the Paper theme instead of the navigation library's own (iOS blue, gray canvas). */
export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.outlineVariant,
    notification: colors.error,
  },
};
