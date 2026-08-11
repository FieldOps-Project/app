import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/application/session/session-context';
import { Loading } from '@/design-system/components/loading';

/**
 * Sends an already signed-in person to the protected area, keeping the login
 * screen out of the history so the Android back button leaves the app.
 */
export default function PublicLayout() {
  const { session, isRestoring } = useSession();

  if (isRestoring) {
    return <Loading label="Carregando sessão..." />;
  }

  if (session !== null) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
