import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { inspectionStatusLabel, syncStateLabel } from '@/domain/inspection';
import { findInspection } from '@/features/inspections/data/sample-inspections';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

/** Entry point to the sub-routes, all carrying the same route parameter. */
export function InspectionDetailsScreen() {
  const inspectionId = useInspectionId();
  const router = useRouter();
  const inspection = findInspection(inspectionId);

  if (inspection === undefined) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <Text variant="subtitle">Inspeção não encontrada</Text>
        <Text variant="body" tone="muted">
          Nenhuma inspeção corresponde ao identificador {inspectionId || 'informado'}.
        </Text>
        <Button label="Voltar para a lista" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">{inspection.client}</Text>
        <Text variant="code" tone="muted">
          {inspection.id}
        </Text>
      </View>

      <Card title="Dados">
        <Text variant="body">{inspection.address}</Text>
        <Text variant="body" tone="muted">
          {inspection.scheduledFor}
        </Text>
        <Text variant="body">{inspectionStatusLabel(inspection.status)}</Text>
        <Text variant="body" tone={inspection.syncState === 'enviado' ? 'success' : 'warning'}>
          {syncStateLabel(inspection.syncState)}
        </Text>
      </Card>

      <Card title="Ações">
        <Button
          label="Iniciar inspeção"
          onPress={() =>
            router.push({
              pathname: '/inspections/[inspectionId]/start',
              params: { inspectionId },
            })
          }
        />
        <Button
          label="Abrir checklist"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/inspections/[inspectionId]/checklist',
              params: { inspectionId },
            })
          }
        />
        <Button
          label="Não conformidades"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/inspections/[inspectionId]/non-conformities',
              params: { inspectionId },
            })
          }
        />
        <Button
          label="Resumo"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/inspections/[inspectionId]/summary',
              params: { inspectionId },
            })
          }
        />
      </Card>
    </Screen>
  );
}
