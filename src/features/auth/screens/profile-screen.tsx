import { useState } from 'react';

import { useSession } from '@/application/session/session-context';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { canReviewInspections } from '@/domain/session';

/**
 * Signing out asks for confirmation first (ADR-001). Once the outbox exists
 * (EP-08), this confirmation is where the number of pending operations is
 * shown; leaving never deletes them.
 */
export function ProfileScreen() {
  const { session, signOut } = useSession();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  async function leave() {
    setIsLeaving(true);
    try {
      await signOut();
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <Screen scrollable>
      <Text variant="title">Perfil</Text>

      <Card title="Sessão">
        <Text variant="subtitle">{session?.name ?? 'Sem sessão'}</Text>
        {session === null ? null : (
          <Text variant="body" tone="muted">
            {session.email}
          </Text>
        )}
        <Text variant="body" tone="muted">
          {session === null
            ? 'Nenhuma sessão ativa.'
            : canReviewInspections(session)
              ? 'Supervisor · pode revisar inspeções da equipe'
              : 'Técnico · executa inspeções em campo'}
        </Text>
        <Text variant="caption" tone="muted">
          A sessão fica no armazenamento seguro do aparelho e sobrevive ao reinício do aplicativo.
        </Text>
      </Card>

      {isConfirming ? (
        <Card title="Sair do aplicativo?">
          <Text variant="body">
            Os registros feitos neste aparelho continuam salvos e voltam a aparecer quando você
            entrar de novo. Para entrar outra vez é preciso estar com internet.
          </Text>
          <Button
            label="Confirmar saída"
            variant="danger"
            loading={isLeaving}
            onPress={() => void leave()}
          />
          <Button
            label="Cancelar"
            variant="secondary"
            disabled={isLeaving}
            onPress={() => setIsConfirming(false)}
          />
        </Card>
      ) : (
        <Button label="Sair" variant="danger" onPress={() => setIsConfirming(true)} />
      )}
    </Screen>
  );
}
