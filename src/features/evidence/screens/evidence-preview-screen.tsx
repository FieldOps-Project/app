import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useInspectionDraft } from '@/application/inspection-draft/inspection-draft-context';
import { NavigationDepthBadge } from '@/components/navigation-depth-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useReturnToChecklist } from '@/features/evidence/hooks/use-return-to-checklist';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/** Every exit replaces this entry or unwinds, so no path leaves an extra one. */
export function EvidencePreviewScreen() {
  const inspectionId = useInspectionId();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const router = useRouter();
  const { registerEvidence } = useInspectionDraft();
  const returnToChecklist = useReturnToChecklist(inspectionId);

  function attach() {
    if (itemId !== undefined && itemId !== '') {
      registerEvidence(itemId);
    }
    returnToChecklist();
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Conferir evidência</Text>
        <Text variant="body" tone="muted">
          Inspeção {inspectionId} · item {itemId ?? 'não informado'}
        </Text>
        <NavigationDepthBadge />
      </View>

      <Card title="Evidência capturada">
        <View className="h-56 items-center justify-center rounded-field bg-neutral-200 dark:bg-neutral-800">
          <Text variant="body" tone="muted">
            Imagem capturada (EP-05)
          </Text>
        </View>
        <Button label="Usar esta evidência" onPress={attach} />
        <Button
          label="Repetir captura"
          variant="secondary"
          onPress={() =>
            router.replace({
              pathname: '/evidence/capture',
              params: { inspectionId, itemId: itemId ?? '' },
            })
          }
        />
        <Button label="Descartar" variant="danger" onPress={returnToChecklist} />
      </Card>
    </Screen>
  );
}
