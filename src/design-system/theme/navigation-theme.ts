import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { colors } from '@/design-system/tokens/design-tokens';

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
