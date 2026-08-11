import { useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/application/session/session-context';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { SessionRole } from '@/domain/session';

/** The session is simulated in this sprint; EP-02 replaces only its origin. */
export function LoginScreen() {
  const { signIn } = useSession();
  const [pendingRole, setPendingRole] = useState<SessionRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(role: SessionRole) {
    setPendingRole(role);
    setError(null);
    try {
      await signIn(role);
    } catch {
      setError('Não foi possível iniciar a sessão neste aparelho. Tente novamente.');
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <Screen scrollable className="justify-center">
      <View className="gap-1">
        <Text variant="title">FieldOps</Text>
        <Text variant="body" tone="muted">
          Entre para acessar suas inspeções.
        </Text>
      </View>

      <Card title="Acesso">
        <Text variant="body" tone="muted">
          A autenticação real entra em EP-02. Nesta sprint, escolha um perfil para simular a sessão.
        </Text>
        {error === null ? null : (
          <Text variant="body" tone="danger">
            {error}
          </Text>
        )}
        <Button
          label="Entrar como técnico"
          loading={pendingRole === 'tecnico'}
          disabled={pendingRole !== null}
          onPress={() => void enter('tecnico')}
        />
        <Button
          label="Entrar como supervisor"
          variant="secondary"
          loading={pendingRole === 'supervisor'}
          disabled={pendingRole !== null}
          onPress={() => void enter('supervisor')}
        />
      </Card>
    </Screen>
  );
}
