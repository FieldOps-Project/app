import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/application/session/session-context';
import { Loading } from '@/design-system/components/loading';

/**
 * Route guard. `Redirect` replaces the entry instead of pushing one, so no
 * history is left behind and the Android back button never returns to a
 * protected screen after signing out. It waits for the stored session to be
 * read, otherwise a signed-in person would be bounced out on every cold start.
 */
export default function ProtectedLayout() {
  const { session, isRestoring } = useSession();

  if (isRestoring) {
    return <Loading label="Carregando sessão..." />;
  }

  if (session === null) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="inspections/[inspectionId]/index" options={{ title: 'Inspeção' }} />
      <Stack.Screen name="inspections/[inspectionId]/start" options={{ title: 'Iniciar' }} />
      <Stack.Screen name="inspections/[inspectionId]/checklist" options={{ title: 'Checklist' }} />
      <Stack.Screen name="inspections/[inspectionId]/summary" options={{ title: 'Resumo' }} />
      <Stack.Screen
        name="inspections/[inspectionId]/non-conformities"
        options={{ title: 'Não conformidades' }}
      />
      <Stack.Screen name="scanner" options={{ title: 'Leitor de código' }} />
      <Stack.Screen name="evidence/capture" options={{ title: 'Captura' }} />
      <Stack.Screen name="evidence/preview" options={{ title: 'Conferir evidência' }} />
      <Stack.Screen name="sync/details" options={{ title: 'Fila de envio' }} />
    </Stack>
  );
}
