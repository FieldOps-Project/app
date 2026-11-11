import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/application/session/session-context';
import { Loading } from '@/design-system/components/loading';

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
      <Stack.Screen name="evidence/view" options={{ title: 'Evidência' }} />
      <Stack.Screen name="sync/details" options={{ title: 'Fila de envio' }} />
    </Stack>
  );
}
