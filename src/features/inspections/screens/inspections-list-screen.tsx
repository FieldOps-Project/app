import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { InspectionSummary } from '@/domain/inspection';
import { inspectionStatusLabel, syncStateLabel } from '@/domain/inspection';
import { sampleInspections } from '@/features/inspections/data/sample-inspections';

export function InspectionsListScreen() {
  const router = useRouter();

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Inspeções</Text>
        <Text variant="body" tone="muted">
          Toque em uma inspeção para ver os detalhes.
        </Text>
      </View>

      {sampleInspections.map((inspection) => (
        <Pressable
          key={inspection.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/inspections/[inspectionId]',
              params: { inspectionId: inspection.id },
            })
          }
        >
          <InspectionCard inspection={inspection} />
        </Pressable>
      ))}
    </Screen>
  );
}

/** Delivery state as text, not only colour, per document 13.9. */
function InspectionCard({ inspection }: { inspection: InspectionSummary }) {
  return (
    <Card>
      <Text variant="subtitle">{inspection.client}</Text>
      <Text variant="body" tone="muted">
        {inspection.address}
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Text variant="caption" tone="muted">
          {inspection.scheduledFor}
        </Text>
        <Text variant="caption">{inspectionStatusLabel(inspection.status)}</Text>
        <Text variant="caption" tone={inspection.syncState === 'enviado' ? 'success' : 'warning'}>
          {syncStateLabel(inspection.syncState)}
        </Text>
      </View>
      <Text variant="code" tone="muted">
        {inspection.id}
      </Text>
    </Card>
  );
}
