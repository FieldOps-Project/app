import { View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/** Closing summary of an inspection before submission. */
export function InspectionSummaryScreen() {
  const inspectionId = useInspectionId();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Resumo</Text>
        <Text variant="code" tone="muted">
          {inspectionId}
        </Text>
      </View>

      <Card title="Fechamento">
        <Text variant="body" tone="muted">
          A consolidação das respostas, das evidências e da assinatura entra em EP-06.
        </Text>
      </Card>
    </Screen>
  );
}
