import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { NavigationDepthBadge } from '@/components/navigation-depth-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/**
 * Evidence capture.
 *
 * The camera itself arrives in EP-05; this screen holds its place in the route
 * tree and the navigation contract around it.
 *
 * Moving to the preview uses `replace`, so the capture and the preview share a
 * single stack entry. Combined with `dismissTo` on the way back, a full capture
 * cycle leaves the stack exactly as deep as it was.
 */
export function EvidenceCaptureScreen() {
  const inspectionId = useInspectionId();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const router = useRouter();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Captura</Text>
        <Text variant="body" tone="muted">
          Inspeção {inspectionId} · item {itemId ?? 'não informado'}
        </Text>
        <NavigationDepthBadge />
      </View>

      <Card title="Visor da câmera">
        <View className="h-56 items-center justify-center rounded-field bg-neutral-200 dark:bg-neutral-800">
          <Text variant="body" tone="muted">
            Pré-visualização da câmera (EP-05)
          </Text>
        </View>
        <Button
          label="Capturar"
          onPress={() =>
            router.replace({
              pathname: '/evidence/preview',
              params: { inspectionId, itemId: itemId ?? '' },
            })
          }
        />
        <Button label="Cancelar" variant="secondary" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
