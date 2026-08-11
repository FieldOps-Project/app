import '@/design-system/theme/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InspectionDraftProvider } from '@/application/inspection-draft/inspection-draft-context';
import { createQueryClient } from '@/application/query-client';
import { SessionProvider } from '@/application/session/session-context';
import { darkNavigationTheme, lightNavigationTheme } from '@/design-system/theme/navigation-theme';

/**
 * Root layout.
 *
 * Installs the providers every route depends on and holds the two top-level
 * groups: the public area and the protected area. The guard itself lives in
 * each group layout, so this file has no knowledge of the session.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [queryClient] = useState(createQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <InspectionDraftProvider>
              <ThemeProvider value={isDark ? darkNavigationTheme : lightNavigationTheme}>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(public)" />
                  <Stack.Screen name="(protected)" />
                  <Stack.Screen
                    name="+not-found"
                    options={{ headerShown: true, title: 'Não encontrado' }}
                  />
                </Stack>
                <StatusBar style={isDark ? 'light' : 'dark'} />
              </ThemeProvider>
            </InspectionDraftProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
