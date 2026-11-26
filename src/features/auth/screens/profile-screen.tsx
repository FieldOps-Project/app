import { useState } from 'react';

import { useDeviceId } from '@/application/device/use-device-id';
import { usePendingOperationsCount } from '@/application/inspections/use-inspections';
import { useSession } from '@/application/session/session-context';
import { ENVIRONMENT_LABELS, env } from '@/config/env';
import { appVersionLabel } from '@/config/app-info';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { ROLE_DESCRIPTIONS } from '@/domain/session';
import { plural } from '@/utils/plural';

export function ProfileScreen() {
  const { session, signOut } = useSession();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const deviceId = useDeviceId();
  const pending = usePendingOperationsCount();

  async function leave() {
    setIsLeaving(true);
    try {
      await signOut();
    } catch {
      setLeaveFailed(true);
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
          {session === null ? 'Nenhuma sessão ativa.' : ROLE_DESCRIPTIONS[session.role]}
        </Text>
        <Text variant="caption" tone="muted">
          A sessão fica no armazenamento seguro do aparelho e sobrevive ao reinício do aplicativo.
        </Text>
      </Card>

      <Card title="Este aparelho">
        <Text variant="body">{`Versão ${appVersionLabel}`}</Text>
        {env.appEnv === 'local' ? null : (
          <Text variant="body" tone="muted">
            {`Ambiente: ${ENVIRONMENT_LABELS[env.appEnv]}`}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          Identificador do aparelho
        </Text>
        <Text variant="code" selectable>
          {deviceId.isError
            ? 'Não foi possível ler o identificador'
            : (deviceId.data ?? 'Lendo...')}
        </Text>
        <Text variant="caption" tone="muted">
          Informe a versão e o identificador ao suporte se algo não funcionar.
        </Text>
      </Card>

      {isConfirming ? (
        <Card title="Sair do aplicativo?">
          <Text variant="body">
            Os registros feitos neste aparelho continuam salvos e voltam a aparecer quando você
            entrar de novo. Para entrar outra vez é preciso estar com internet.
          </Text>
          {pending.data === undefined || pending.data === 0 ? null : (
            <Text variant="body" tone="warning" accessibilityRole="alert">
              {`${plural(pending.data, 'registro ainda não foi enviado', 'registros ainda não foram enviados')} ao servidor. Sincronize antes de sair, se puder.`}
            </Text>
          )}
          {leaveFailed ? (
            <Text variant="body" tone="danger" accessibilityRole="alert">
              Não foi possível limpar a sessão deste aparelho. Tente de novo.
            </Text>
          ) : null}
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
