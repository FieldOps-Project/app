import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { SyncState } from '@/domain/inspection';
import { syncStateLabel } from '@/domain/inspection';
import { sampleInspections } from '@/features/inspections/data/sample-inspections';

/**
 * Synchronization tab.
 *
 * Document 13.8 requires the delivery state to stay visible rather than appear
 * as a temporary message, which is why synchronization is a tab reachable in
 * one touch and not a screen hidden behind a menu.
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
        {sampleInspections.map((inspection) => (
          <View key={inspection.id} className="flex-row items-center justify-between gap-3">
            <Text variant="body" className="flex-1">
              {inspection.client}
            </Text>
            <Text variant="caption" tone={toneFor(inspection.syncState)}>
              {syncStateLabel(inspection.syncState)}
            </Text>
          </View>
        ))}
      </Card>

      <Button
        label="Ver detalhes da fila"
        variant="secondary"
        onPress={() => router.push('/sync/details')}
      />
    </Screen>
  );
}

/** Maps a delivery state to a text tone. The label always carries the meaning on its own. */
function toneFor(state: SyncState): 'success' | 'warning' | 'danger' | 'muted' {
  if (state === 'enviado') {
    return 'success';
  }
  if (state === 'falha' || state === 'conflito') {
    return 'danger';
  }
  if (state === 'aguardando-envio') {
    return 'warning';
  }
  return 'muted';
}
