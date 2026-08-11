import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/application/session/session-context';
import { Loading } from '@/design-system/components/loading';

/**
 * Public area layout.
 *
 * Sends an already signed-in person to the protected area, which keeps the
 * login screen out of the history and makes the Android back button leave the
 * app instead of returning to a screen that no longer applies.
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
