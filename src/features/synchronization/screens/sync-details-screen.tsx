import { View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';

/** Detail of the pending operations queue. */
export function SyncDetailsScreen() {
  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Fila de envio</Text>
        <Text variant="body" tone="muted">
          Operações aguardando conexão para serem enviadas ao servidor.
        </Text>
      </View>

      <Card title="Detalhes">
        <Text variant="body" tone="muted">
          A outbox com repetição e resolução de conflito entra em EP-08. Nenhuma operação pendente é
          descartada por esta tela.
        </Text>
      </Card>
    </Screen>
  );
}
