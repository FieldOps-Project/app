import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/** Confirmation step before opening the checklist of an inspection. */
export function InspectionStartScreen() {
  const inspectionId = useInspectionId();
  const router = useRouter();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Iniciar inspeção</Text>
        <Text variant="code" tone="muted">
          {inspectionId}
        </Text>
      </View>

      <Card title="Antes de começar">
        <Text variant="body" tone="muted">
          Confirme que está no local correto. O registro de data, hora e posição entra em EP-07.
        </Text>
        <Button
          label="Começar checklist"
          onPress={() =>
            router.replace({
              pathname: '/inspections/[inspectionId]/checklist',
              params: { inspectionId },
            })
          }
        />
      </Card>
    </Screen>
  );
}
