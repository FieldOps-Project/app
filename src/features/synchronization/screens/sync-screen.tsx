import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { List } from '@/design-system/components/list';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { sampleInspections } from '@/features/inspections/data/sample-inspections';

/**
 * A tab, not a screen behind a menu: document 13.8 requires the delivery state
 * to stay visible, and one-touch reach is part of that.
 */
export function SyncScreen() {
  const router = useRouter();

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Sincronização</Text>
        <Text variant="body" tone="muted">
          Situação de envio dos registros salvos neste aparelho.
        </Text>
      </View>

      <Card title="Registros">
        <List
          data={sampleInspections}
          keyExtractor={(inspection) => inspection.id}
          renderItem={(inspection) => (
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="body" className="flex-1">
                {inspection.client}
              </Text>
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
