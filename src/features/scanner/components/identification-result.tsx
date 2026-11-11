import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, View } from 'react-native';

import { InspectionStatusBadge } from '@/components/inspection-status-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import type {
  EquipmentIdentification,
  EquipmentInspection,
  ServerLookup,
} from '@/domain/equipment-identification';
import type { InspectionEquipment } from '@/domain/inspection';
import { formatDateTime } from '@/utils/format-date';

const NOT_FOUND_MESSAGE: Record<ServerLookup, string> = {
  answered: 'Nenhum equipamento das suas inspeções tem este código.',
  offline:
    'Nenhuma das suas inspeções neste aparelho tem este código, e sem conexão não dá para consultar o servidor.',
  failed:
    'Nenhuma das suas inspeções neste aparelho tem este código, e o servidor não conseguiu responder agora. Tente de novo em instantes.',
};

export interface IdentificationResultProps {
  readonly result: EquipmentIdentification;
  readonly onScanAgain: () => void;
  readonly onContinue: () => void;
  readonly onOpenInspection: (inspectionId: string) => void;
}

export function IdentificationResult({
  result,
  onScanAgain,
  onContinue,
  onOpenInspection,
}: IdentificationResultProps) {
  switch (result.kind) {
    case 'confirmed':
      return (
        <Card title="Equipamento confirmado">
          <Notice icon="checkmark-circle" tone="success">
            O código lido é do equipamento previsto nesta inspeção.
          </Notice>
          <EquipmentLines equipment={result.equipment} />
          <Button label="Voltar à inspeção" onPress={onContinue} />
        </Card>
      );
    case 'divergent':
      return (
        <Card title="Equipamento diferente do previsto">
          <Notice icon="warning" tone="danger">
            O código lido não é do equipamento desta inspeção. Confira se está no equipamento certo
            antes de continuar.
          </Notice>
          <Text variant="label" tone="muted">
            Previsto
          </Text>
          <EquipmentLines equipment={result.expected} />
          <Text variant="label" tone="muted">
            Lido
          </Text>
          <EquipmentLines equipment={result.read.equipment} />
          <InspectionLinks inspections={result.read.inspections} onOpen={onOpenInspection} />
          <Button label="Ler novamente" onPress={onScanAgain} />
          <Button
            label="Seguir com o equipamento previsto"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                'Seguir mesmo assim?',
                `O código lido é de ${result.read.equipment.name}. Confirme que você está em ${result.expected.name}.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Estou no equipamento previsto', onPress: onContinue },
                ]
              )
            }
          />
        </Card>
      );
    case 'found':
      return (
        <Card title="Equipamento identificado">
          <EquipmentLines equipment={result.match.equipment} />
          <InspectionLinks inspections={result.match.inspections} onOpen={onOpenInspection} />
          <Button label="Ler outro código" variant="secondary" onPress={onScanAgain} />
        </Card>
      );
    case 'not-found':
      return (
        <Card title="Equipamento não localizado">
          <Notice icon="help-circle" tone="warning">
            {NOT_FOUND_MESSAGE[result.server]}
          </Notice>
          <Button label="Ler novamente" onPress={onScanAgain} />
        </Card>
      );
  }
}

function Notice({
  icon,
  tone,
  children,
}: {
  icon: 'checkmark-circle' | 'warning' | 'help-circle';
  tone: 'success' | 'danger' | 'warning';
  children: string;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={20} color={colors[tone].DEFAULT} />
      <Text variant="body" tone={tone} className="flex-1">
        {children}
      </Text>
    </View>
  );
}

function EquipmentLines({ equipment }: { equipment: InspectionEquipment }) {
  return (
    <View className="gap-1 rounded-field bg-neutral-100 p-3 dark:bg-neutral-800">
      <Text variant="subtitle">{equipment.name}</Text>
      {equipment.assetNumber === null ? null : (
        <Text variant="body" tone="muted">{`Patrimônio ${equipment.assetNumber}`}</Text>
      )}
      {equipment.serialNumber === null ? null : (
        <Text variant="body" tone="muted">{`Série ${equipment.serialNumber}`}</Text>
      )}
    </View>
  );
}

function InspectionLinks({
  inspections,
  onOpen,
}: {
  inspections: readonly EquipmentInspection[];
  onOpen: (inspectionId: string) => void;
}) {
  if (inspections.length === 0) {
    return null;
  }
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        Suas inspeções deste equipamento
      </Text>
      {inspections.map((inspection) => (
        <Pressable
          key={inspection.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${inspection.title}`}
          onPress={() => onOpen(inspection.id)}
          className="gap-1 rounded-field border border-neutral-200 p-3 dark:border-neutral-700"
        >
          <Text variant="body" className="font-semibold">
            {inspection.title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <InspectionStatusBadge status={inspection.status} />
            <Text variant="caption" tone="muted">
              {formatDateTime(inspection.scheduledFor)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
