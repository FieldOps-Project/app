import '@/design-system/theme/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/application/query-client';
import { darkNavigationTheme, lightNavigationTheme } from '@/design-system/theme/navigation-theme';

/**
 * Root layout.
 *
 * Installs the providers every route depends on and selects the navigation
 * theme from the device color scheme. The query client is held in state so it
 * survives re-renders and keeps its cache.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [queryClient] = useState(createQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={isDark ? darkNavigationTheme : lightNavigationTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen
                name="+not-found"
                options={{ headerShown: true, title: 'Não encontrado' }}
              />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
