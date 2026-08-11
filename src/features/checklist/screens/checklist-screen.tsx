import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useInspectionDraft } from '@/application/inspection-draft/inspection-draft-context';
import { NavigationDepthBadge } from '@/components/navigation-depth-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { ChecklistItem } from '@/domain/inspection';
import { sampleChecklist } from '@/features/checklist/data/sample-checklist';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/**
 * The screen stays mounted while the camera is open, which is what preserves
 * the scroll position. The focused item is highlighted so the technician sees
 * where they left off (document 13.9).
 */
export function ChecklistScreen() {
  const inspectionId = useInspectionId();
  const router = useRouter();
  const { focusedItemId, focusItem, evidenceCountFor } = useInspectionDraft();

  function captureEvidence(item: ChecklistItem) {
    focusItem(item.id);
    router.push({
      pathname: '/evidence/capture',
      params: { inspectionId, itemId: item.id },
    });
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Checklist</Text>
        <Text variant="body" tone="muted">
          Inspeção {inspectionId}
        </Text>
        <NavigationDepthBadge />
      </View>

      {sampleChecklist.map((item) => (
        <ChecklistRow
          key={item.id}
          item={item}
          isFocused={item.id === focusedItemId}
          evidenceCount={evidenceCountFor(item.id)}
          onCapture={() => captureEvidence(item)}
          onFocus={() => focusItem(item.id)}
        />
      ))}

      <Button
        label="Concluir e ver resumo"
        onPress={() =>
          router.push({
            pathname: '/inspections/[inspectionId]/summary',
            params: { inspectionId },
          })
        }
      />
    </Screen>
  );
}

interface ChecklistRowProps {
  item: ChecklistItem;
  isFocused: boolean;
  evidenceCount: number;
  onCapture: () => void;
  onFocus: () => void;
}

function ChecklistRow({ item, isFocused, evidenceCount, onCapture, onFocus }: ChecklistRowProps) {
  return (
    <Pressable onPress={onFocus} accessibilityRole="button">
      <Card className={isFocused ? 'border-2 border-brand-600' : 'border-2 border-transparent'}>
        <View className="flex-row items-start justify-between gap-3">
          <Text variant="body" className="flex-1">
            {item.order}. {item.question}
          </Text>
          {isFocused ? (
            <Text variant="caption" tone="brand">
              em foco
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text variant="caption" tone={evidenceCount > 0 ? 'success' : 'muted'}>
            {evidenceCount > 0
              ? `${evidenceCount} evidência${evidenceCount > 1 ? 's' : ''} registrada${evidenceCount > 1 ? 's' : ''}`
              : item.requiresEvidence
                ? 'Evidência obrigatória'
                : 'Evidência opcional'}
          </Text>
        </View>

        <Button label="Registrar evidência" variant="secondary" onPress={onCapture} />
      </Card>
    </Pressable>
  );
}
