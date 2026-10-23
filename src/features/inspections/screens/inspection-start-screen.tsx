import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useStartInspection } from '@/application/inspections/use-execution-actions';
import {
  useInspectionDetail,
  type InspectionWork,
} from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { startBlockedReason } from '@/domain/inspection-actions';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { formatDateTime } from '@/utils/format-date';

/**
 * Deliberate start of the work (UC-09, card #14). The technician confirms
 * place and equipment; the device records its own clock as the start,
 * because the server may only hear about it hours later (RN-034). Nothing on
 * this path needs the network.
 */
export function InspectionStartScreen() {
  const inspectionId = useInspectionId();
  const inspection = useInspectionDetail(inspectionId);
  const router = useRouter();

  switch (inspection.state) {
    case 'loading':
      return <Loading label="Abrindo inspeção..." />;
    case 'error':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <ErrorState
            title="Não foi possível abrir a inspeção"
            description="Os dados continuam no aparelho. Tente abrir de novo."
            onRetry={inspection.retry}
          />
        </Screen>
      );
    case 'not-found':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <EmptyState
            icon="alert-circle-outline"
            title="Inspeção não encontrada"
            description="Ela não está salva neste aparelho."
            actionLabel="Voltar"
            onAction={() => router.back()}
          />
        </Screen>
      );
    case 'ready':
      return <StartConfirmation work={inspection} />;
  }
}

function StartConfirmation({ work }: { work: InspectionWork }) {
  const { detail, progress } = work;
  const router = useRouter();
  const start = useStartInspection(detail.id);
  const blocked = startBlockedReason(detail.status);

  function confirm() {
    start.mutate(undefined, {
      onSuccess: () =>
        router.replace({
          pathname: '/inspections/[inspectionId]/checklist',
          params: { inspectionId: detail.id },
        }),
    });
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Iniciar inspeção</Text>
        <Text variant="body" tone="muted">
          Confira se está no lugar e no equipamento certos.
        </Text>
      </View>

      <Card title="Inspeção">
        <Text variant="subtitle">{detail.title}</Text>
        <Fact icon="business-outline" text={detail.client.name} />
        <Fact
          icon="location-outline"
          text={[detail.site.name, detail.site.addressLine].filter(Boolean).join(' — ')}
        />
        <Fact
          icon="hardware-chip-outline"
          text={
            detail.equipment === null
              ? 'Inspeção do local, sem equipamento específico'
              : [
                  detail.equipment.name,
                  detail.equipment.assetNumber && `patrimônio ${detail.equipment.assetNumber}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
        />
        <Fact
          icon="calendar-outline"
          text={`Data prevista: ${formatDateTime(detail.scheduledFor)}`}
        />
        <Fact icon="list-outline" text={`${progress.total} itens no checklist`} />
      </Card>

      {blocked === null ? (
        <Card title="Ao confirmar">
          <Fact
            icon="time-outline"
            text="O horário deste aparelho fica registrado como o início."
          />
          <Fact
            icon="navigate-outline"
            text="A localização não será registrada: a captura de posição ainda não está disponível nesta versão."
          />
          <Fact
            icon="cloud-offline-outline"
            text="Funciona sem internet. O início é enviado na próxima sincronização."
          />
          <FieldError
            message={
              start.error === null
                ? undefined
                : `O início não foi registrado: ${start.error.message}`
            }
          />
          <Button label="Confirmar início" loading={start.isPending} onPress={confirm} />
          <Button label="Agora não" variant="secondary" onPress={() => router.back()} />
        </Card>
      ) : (
        <Card title="Não é possível iniciar" className="border-2 border-danger">
          <Fact icon="close-circle-outline" text={blocked} tone="danger" />
          <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
        </Card>
      )}
    </Screen>
  );
}

interface FactProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  tone?: 'default' | 'danger';
}

function Fact({ icon, text, tone = 'default' }: FactProps) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'danger' ? colors.danger.DEFAULT : colors.neutral[500]}
      />
      <Text variant="body" tone={tone} className="flex-1">
        {text}
      </Text>
    </View>
  );
}
