import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import {
  useInspectionList,
  type ListedInspection,
} from '@/application/inspections/use-inspection-list';
import {
  useLastSuccessfulSync,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { filtersForView } from '@/domain/inspection-filters';
import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import { formatDateTime } from '@/utils/format-date';
import { plural } from '@/utils/plural';

const UNSENT = filtersForView('pending-sync');

export function SyncScreen() {
  const router = useRouter();
  const pending = usePendingOperationsCount();
  const lastSync = useLastSuccessfulSync();
  const unsent = useInspectionList(UNSENT);

  return (
    <Screen padded={false}>
      <FlatList<ListedInspection>
        data={unsent.isLoading || unsent.isError ? [] : unsent.visible}
        keyExtractor={(entry) => entry.inspection.id}
        contentContainerClassName="gap-3 px-screen py-4"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="gap-1">
              <Text variant="title">Sincronização</Text>
              <Text variant="body" tone="muted">
                Situação de envio dos registros salvos neste aparelho.
              </Text>
            </View>

            <Card title="Fila de envio">
              <Text variant="subtitle" tone={pending.isError ? 'danger' : 'default'}>
                {pending.isError
                  ? 'Não foi possível contar os registros do aparelho'
                  : pending.data === undefined
                    ? 'Contando registros...'
                    : pending.data === 0
                      ? 'Nenhum registro pendente'
                      : plural(
                          pending.data,
                          'registro aguardando envio',
                          'registros aguardando envio'
                        )}
              </Text>
              <Text variant="caption" tone="muted">
                {lastSync.data == null
                  ? 'Nenhuma sincronização completa neste aparelho ainda.'
                  : `Última sincronização completa: ${formatDateTime(lastSync.data)}`}
              </Text>
              <SyncNowButton />
            </Card>

            <Text variant="label" tone="muted">
              Inspeções não enviadas
            </Text>
            {unsent.isLoading ? (
              <Text variant="body" tone="muted">
                Carregando...
              </Text>
            ) : null}
            {unsent.isError ? (
              <ErrorState
                title="Não foi possível ler as inspeções"
                description="Os dados continuam no aparelho. Tente abrir de novo."
                onRetry={unsent.reload}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          unsent.isLoading || unsent.isError ? null : (
            <EmptyState
              icon="cloud-done-outline"
              title="Tudo enviado"
              description="Nenhuma inspeção com registros pendentes neste aparelho."
            />
          )
        }
        renderItem={({ item: { inspection } }) => (
          <Card>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text variant="body">{inspection.clientName}</Text>
                <Text variant="caption" tone="muted">
                  {inspection.title}
                </Text>
              </View>
              <SyncStateBadge state={inspection.syncState} />
            </View>
          </Card>
        )}
        ListFooterComponent={
          <Button
            label="Ver detalhes da fila"
            variant="secondary"
            onPress={() => router.push('/sync/details')}
          />
        }
      />
    </Screen>
  );
}
