import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, View } from 'react-native';

import {
  useInspectionDetail,
  type InspectionWork,
} from '@/application/inspections/use-inspection-detail';
import { InspectionStatusBadge } from '@/components/inspection-status-badge';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Badge } from '@/design-system/components/badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { ProgressBar } from '@/design-system/components/progress-bar';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { isUrgentPriority, priorityLabel } from '@/domain/inspection';
import {
  canEditAnswers,
  contextualAction,
  contextualActionLabel,
} from '@/domain/inspection-actions';
import { isOverdue } from '@/domain/inspection-schedule';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { formatDateTime } from '@/utils/format-date';
import { plural } from '@/utils/plural';

/**
 * The decision screen (card #11): the technician checks place and equipment
 * and gets exactly one action, derived from the state, so the wrong one is
 * never offered. Reads the device store, so a downloaded inspection opens
 * without signal (RN-065).
 */
export function InspectionDetailsScreen() {
  const inspectionId = useInspectionId();
  const router = useRouter();
  const inspection = useInspectionDetail(inspectionId);

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
            description="Ela não está salva neste aparelho. Atualize a lista com internet para baixá-la."
            actionLabel="Voltar para a lista"
            onAction={() => router.back()}
          />
        </Screen>
      );
    case 'ready':
      return <InspectionDetails work={inspection} />;
  }
}

function InspectionDetails({ work }: { work: InspectionWork }) {
  const router = useRouter();
  const { detail, items, progress } = work;
  const action = contextualAction(detail.status);
  const overdue = isOverdue(detail, new Date());

  function runAction() {
    const params = { inspectionId: detail.id };
    if (action === 'START') {
      router.push({ pathname: '/inspections/[inspectionId]/start', params });
    } else {
      router.push({ pathname: '/inspections/[inspectionId]/checklist', params });
    }
  }

  const titleOf = new Map(items.map((item) => [item.id, item.itemTitle]));

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-2">
        <Text variant="title">{detail.title}</Text>
        <Text variant="subtitle" tone="muted">
          {detail.clientName}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <InspectionStatusBadge status={detail.status} />
          <SyncStateBadge state={detail.syncState} />
          {overdue ? <Badge tone="danger" icon="alarm-outline" label="Atrasada" /> : null}
        </View>
      </View>

      {detail.status === 'REJECTED' && detail.review !== null ? (
        <Card title="Reprovada pelo supervisor" className="border-2 border-danger">
          <Text variant="body">{detail.review.reason ?? 'Motivo não informado.'}</Text>
          {detail.review.itemsToCorrect.length > 0 ? (
            <View className="gap-1.5">
              <Text variant="label" tone="danger">
                Itens a corrigir
              </Text>
              {detail.review.itemsToCorrect.map((itemId) => (
                <Line key={itemId} icon="arrow-undo-outline" tone="danger">
                  {titleOf.get(itemId) ?? 'Item fora do checklist desta inspeção'}
                </Line>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {detail.syncError !== null &&
      (detail.syncState === 'falha' || detail.syncState === 'conflito') ? (
        <Card title="Atenção" className="border-2 border-warning">
          <Line icon="alert-circle-outline" tone="warning">
            {detail.syncError}
          </Line>
        </Card>
      ) : null}

      <Card title="Progresso">
        <ProgressBar
          percent={progress.percent}
          label={`${progress.answered} de ${plural(progress.applicable, 'item aplicável respondido', 'itens aplicáveis respondidos')}`}
        />
        {progress.pending.length > 0 && canEditAnswers(detail.status) ? (
          <Text variant="caption" tone="warning">
            {plural(progress.pending.length, 'pendência impede', 'pendências impedem')} a conclusão.
          </Text>
        ) : null}
      </Card>

      <Button label={contextualActionLabel(action)} onPress={runAction} />

      <Card title="Instruções do supervisor">
        <Text variant="body" selectable>
          {detail.instructions ?? 'Nenhuma instrução para esta inspeção.'}
        </Text>
      </Card>

      <Card title="Prazo e prioridade">
        <Line icon="calendar-outline" tone={overdue ? 'danger' : 'default'}>
          {`Data prevista: ${formatDateTime(detail.scheduledFor)}`}
        </Line>
        <Line icon="flag-outline" tone={isUrgentPriority(detail.priority) ? 'warning' : 'default'}>
          {`Prioridade ${priorityLabel(detail.priority).toLowerCase()}`}
        </Line>
        {detail.startedAtDevice === null ? null : (
          <Line icon="play-outline">{`Iniciada em ${formatDateTime(detail.startedAtDevice)}`}</Line>
        )}
        {detail.completedAtDevice === null ? null : (
          <Line icon="checkmark-done-outline">
            {`Concluída em ${formatDateTime(detail.completedAtDevice)}`}
          </Line>
        )}
      </Card>

      <Card title="Local">
        <Line icon="business-outline">{detail.client.name}</Line>
        <Line icon="location-outline">{detail.site.name}</Line>
        {detail.site.addressLine === null ? null : (
          <Line icon="map-outline">{detail.site.addressLine}</Line>
        )}
        <SiteCoordinates latitude={detail.site.latitude} longitude={detail.site.longitude} />
      </Card>

      <Card title="Equipamento">
        {detail.equipment === null ? (
          <Text variant="body" tone="muted">
            Inspeção do local, sem equipamento específico.
          </Text>
        ) : (
          <>
            <Line icon="hardware-chip-outline">{detail.equipment.name}</Line>
            {detail.equipment.assetNumber === null ? null : (
              <Line icon="pricetag-outline">{`Patrimônio ${detail.equipment.assetNumber}`}</Line>
            )}
            {detail.equipment.serialNumber === null ? null : (
              <Line icon="barcode-outline">{`Série ${detail.equipment.serialNumber}`}</Line>
            )}
            {detail.equipment.qrCode === null ? null : (
              <Line icon="qr-code-outline">{`QR ${detail.equipment.qrCode}`}</Line>
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}

interface SiteCoordinatesProps {
  latitude: number | null;
  longitude: number | null;
}

/**
 * The site's registered coordinates — never the position captured in the
 * field, which belongs to the start and the completion (card #19).
 */
function SiteCoordinates({ latitude, longitude }: SiteCoordinatesProps) {
  const [mapFailed, setMapFailed] = useState(false);

  if (latitude === null || longitude === null) {
    return (
      <Text variant="caption" tone="muted">
        Local sem coordenadas cadastradas.
      </Text>
    );
  }

  const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return (
    <View className="gap-2">
      <Line icon="navigate-outline">{`Coordenadas do cadastro: ${coordinates}`}</Line>
      <Button
        label="Abrir no mapa"
        variant="secondary"
        onPress={() =>
          void Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
          ).catch(() => setMapFailed(true))
        }
      />
      {mapFailed ? (
        <Text variant="caption" tone="danger">
          Nenhum aplicativo de mapas conseguiu abrir o local. Use as coordenadas acima.
        </Text>
      ) : null}
    </View>
  );
}

interface LineProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone?: 'default' | 'danger' | 'warning';
  children: ReactNode;
}

const ICON_COLORS = {
  default: colors.neutral[500],
  danger: colors.danger.DEFAULT,
  warning: colors.warning.DEFAULT,
} as const;

function Line({ icon, tone = 'default', children }: LineProps) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icon} size={18} color={ICON_COLORS[tone]} />
      <Text variant="body" tone={tone} className="flex-1">
        {children}
      </Text>
    </View>
  );
}
