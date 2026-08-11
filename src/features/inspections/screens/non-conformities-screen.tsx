import { View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/** Non-conformities recorded during an inspection. */
export function NonConformitiesScreen() {
  const inspectionId = useInspectionId();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Não conformidades</Text>
        <Text variant="code" tone="muted">
          {inspectionId}
        </Text>
      </View>

      <Card title="Registros">
        <Text variant="body" tone="muted">
          O registro de não conformidades com gravidade e prazo entra em EP-06.
        </Text>
      </Card>
    </Screen>
  );
}
