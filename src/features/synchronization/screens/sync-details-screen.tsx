import { View } from 'react-native';

import { usePendingOperationsCount } from '@/application/inspections/use-inspections';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import { plural } from '@/utils/plural';

export function SyncDetailsScreen() {
  const pending = usePendingOperationsCount();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Fila de envio</Text>
        <Text variant="body" tone="muted">
          Registros salvos neste aparelho que aguardam o envio ao servidor.
        </Text>
      </View>

      <Card title="Situação">
        <Text variant="subtitle" tone={pending.isError ? 'danger' : 'default'}>
          {pending.isError
            ? 'Não foi possível contar os registros do aparelho'
            : pending.data === undefined
              ? 'Contando registros...'
              : pending.data === 0
                ? 'Nenhum registro pendente'
                : plural(pending.data, 'registro aguardando envio', 'registros aguardando envio')}
        </Text>
        <Text variant="body" tone="muted">
          Nada é descartado enquanto não for enviado. Sem internet, os registros esperam no aparelho
          e seguem na próxima sincronização.
        </Text>
        <SyncNowButton />
      </Card>
    </Screen>
  );
}
