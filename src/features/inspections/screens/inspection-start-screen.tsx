import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { describeLocalFailure } from '@/application/inspections/describe-local-failure';
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
import { locationAbsenceLabel } from '@/domain/field-location';
import { startBlockedReason } from '@/domain/inspection-actions';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { LocatingNotice, LocationConsent } from '@/features/location/components/location-consent';
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
  /**
   * Once confirmed, the stored inspection becomes IN_PROGRESS before the
   * screen is replaced; the confirmation stays up during that instant instead
   * of flashing "já foi iniciada".
   */
  const starting = start.isPending || start.isSuccess;
  const blocked = starting ? null : startBlockedReason(detail.status);

  function openChecklist() {
    router.replace({
      pathname: '/inspections/[inspectionId]/checklist',
      params: { inspectionId: detail.id },
    });
  }

  /**
   * Started without a position: the technician is told why before moving on
   * (card #19). With a position, straight to the checklist.
   */
  function confirm() {
    start.mutate(undefined, {
      onSuccess: (location) => {
        if (location.status === 'captured') {
          openChecklist();
        }
      },
    });
  }

  const startedWithoutLocation =
    start.isSuccess && start.data?.status === 'missing' ? start.data.reason : null;

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

      {startedWithoutLocation !== null ? (
        <Card title="Inspeção iniciada" className="border-2 border-warning">
          <Fact
            icon="alert-circle-outline"
            text={`O início foi registrado sem localização: ${locationAbsenceLabel(startedWithoutLocation)}. A ausência fica registrada na inspeção.`}
            tone="warning"
          />
          <Button label="Continuar para o checklist" onPress={openChecklist} />
        </Card>
      ) : blocked === null ? (
        <Card title="Ao confirmar">
          <Fact
            icon="time-outline"
            text="O horário deste aparelho fica registrado como o início."
          />
          <LocationConsent moment="start" />
          <Fact
            icon="cloud-offline-outline"
            text="Funciona sem internet. O início é enviado na próxima sincronização."
          />
          <FieldError
            message={
              start.error === null
                ? undefined
                : `O início não foi registrado: ${describeLocalFailure(start.error)}`
            }
          />
          {start.locating ? <LocatingNotice /> : null}
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
  tone?: 'default' | 'danger' | 'warning';
}

const FACT_COLORS = {
  default: colors.neutral[500],
  danger: colors.danger.DEFAULT,
  warning: colors.warning.DEFAULT,
} as const;

function Fact({ icon, text, tone = 'default' }: FactProps) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={18} color={FACT_COLORS[tone]} />
      <Text variant="body" tone={tone} className="flex-1">
        {text}
      </Text>
    </View>
  );
}
