import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useInspectionList } from '@/application/inspections/use-inspection-list';
import {
  useLastSuccessfulSync,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { List } from '@/design-system/components/list';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { filtersForView } from '@/domain/inspection-filters';
import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import { formatDateTime } from '@/utils/format-date';

const UNSENT = filtersForView('pending-sync');

/**
 * A tab, not a screen behind a menu: document 13.8 requires the delivery state
 * to stay visible, and one-touch reach is part of that. The full queue view
 * with per-operation failures is card #27.
 */
export function SyncScreen() {
  const router = useRouter();
  const pending = usePendingOperationsCount();
  const lastSync = useLastSuccessfulSync();
  const unsent = useInspectionList(UNSENT);

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Sincronização</Text>
        <Text variant="body" tone="muted">
          Situação de envio dos registros salvos neste aparelho.
        </Text>
      </View>

      <Card title="Fila de envio">
        <Text variant="subtitle">
          {pending.data === undefined
            ? 'Contando registros...'
            : pending.data === 0
              ? 'Nenhum registro pendente'
              : `${pending.data} ${pending.data === 1 ? 'registro aguardando envio' : 'registros aguardando envio'}`}
        </Text>
        <Text variant="caption" tone="muted">
          {lastSync.data == null
            ? 'Nenhuma sincronização completa neste aparelho ainda.'
            : `Última sincronização completa: ${formatDateTime(lastSync.data)}`}
        </Text>
        <SyncNowButton />
      </Card>

      <Card title="Inspeções não enviadas">
        <List
          data={unsent.visible}
          keyExtractor={(entry) => entry.inspection.id}
          empty={
            <EmptyState
              icon="cloud-done-outline"
              title="Tudo enviado"
              description="Nenhuma inspeção com registros pendentes neste aparelho."
            />
          }
          renderItem={({ inspection }) => (
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text variant="body">{inspection.clientName}</Text>
                <Text variant="caption" tone="muted">
                  {inspection.title}
                </Text>
              </View>
              <SyncStateBadge state={inspection.syncState} />
            </View>
          )}
        />
      </Card>

      <Button
        label="Ver detalhes da fila"
        variant="secondary"
        onPress={() => router.push('/sync/details')}
      />
    </Screen>
  );
}
