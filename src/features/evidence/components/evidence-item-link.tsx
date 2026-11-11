import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useInspectionDetail } from '@/application/inspections/use-inspection-detail';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

/**
 * Which item the photo belongs to, shown on every evidence screen so a photo
 * is never attached to the wrong item (card #17).
 */
export function EvidenceItemLink({
  inspectionId,
  itemId,
}: {
  inspectionId: string;
  itemId: string;
}) {
  const inspection = useInspectionDetail(inspectionId);
  const item =
    inspection.state === 'ready'
      ? inspection.items.find((entry) => entry.id === itemId)
      : undefined;

  return (
    <View className="flex-row items-start gap-2 rounded-field bg-brand-50 p-3 dark:bg-neutral-800">
      <Ionicons name="link-outline" size={18} color={colors.brand[600]} />
      <View className="flex-1 gap-0.5">
        <Text variant="caption" tone="muted">
          {item === undefined ? 'Evidência do item' : `Evidência do item · ${item.sectionTitle}`}
        </Text>
        <Text variant="subtitle">
          {item === undefined
            ? 'Item não encontrado'
            : `${item.itemCode === null ? '' : `${item.itemCode} · `}${item.itemTitle}`}
        </Text>
      </View>
    </View>
  );
}
