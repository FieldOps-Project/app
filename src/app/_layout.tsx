import '@/design-system/theme/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutoSync } from '@/application/connectivity/auto-sync';
import { ConnectivityProvider } from '@/application/connectivity/connectivity-context';
import { InspectionDraftProvider } from '@/application/inspection-draft/inspection-draft-context';
import { createQueryClient } from '@/application/query-client';
import { SessionProvider } from '@/application/session/session-context';
import { OfflineBanner } from '@/components/offline-banner';
import { ScreenBannerProvider } from '@/design-system/components/screen-banner';
import { darkNavigationTheme, lightNavigationTheme } from '@/design-system/theme/navigation-theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [queryClient] = useState(createQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectivityProvider>
            <SessionProvider>
              <InspectionDraftProvider>
                <ThemeProvider value={isDark ? darkNavigationTheme : lightNavigationTheme}>
                  <ScreenBannerProvider banner={<OfflineBanner />}>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(public)" />
                      <Stack.Screen name="(protected)" />
                      <Stack.Screen
                        name="+not-found"
                        options={{ headerShown: true, title: 'Não encontrado' }}
                      />
                    </Stack>
                  </ScreenBannerProvider>
                  <AutoSync />
                  <StatusBar style={isDark ? 'light' : 'dark'} />
                </ThemeProvider>
              </InspectionDraftProvider>
            </SessionProvider>
          </ConnectivityProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
