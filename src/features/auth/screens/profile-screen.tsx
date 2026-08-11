import { useState } from 'react';

import { useSession } from '@/application/session/session-context';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { canReviewInspections } from '@/domain/session';

/** Profile tab, showing the active session and ending it. */
export function ProfileScreen() {
  const { session, signOut } = useSession();
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

      <Button label="Sair" variant="danger" loading={isLeaving} onPress={() => void leave()} />
    </Screen>
  );
}
