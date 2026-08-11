import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { colors } from '@/design-system/tokens/design-tokens';

/**
 * React Navigation themes derived from the same tokens used by the utility
 * classes, so headers and screen transitions match the styled content.
 *
 * The symbols come from `expo-router`, which re-exports the React Navigation
 * theme. Importing `@react-navigation/native` directly would depend on a
 * package the project does not declare.
 */
export const lightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand.DEFAULT,
    background: colors.neutral[50],
    card: colors.neutral[0],
    text: colors.neutral[900],
    border: colors.neutral[200],
    notification: colors.danger.DEFAULT,
  },
};

/** Dark counterpart of {@link lightNavigationTheme}. */
export const darkNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.brand[400],
    background: colors.neutral[950],
    card: colors.neutral[900],
    text: colors.neutral[50],
    border: colors.neutral[800],
    notification: colors.danger.DEFAULT,
  },
};
