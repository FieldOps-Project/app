import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { colors } from '@/design-system/tokens/design-tokens';

/**
 * Derived from the same tokens as the utility classes, so headers and screen
 * transitions match the styled content. The symbols come from `expo-router` to
 * avoid depending on a package the project does not declare.
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
