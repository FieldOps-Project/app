import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';

import { evidenceImageUri } from '@/application/evidence/evidence-files';
import { useDiscardEvidence } from '@/application/inspections/use-checklist-actions';
import { useInspectionDetail } from '@/application/inspections/use-inspection-detail';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { canEditAnswers } from '@/domain/inspection-actions';
import { useReturnToChecklist } from '@/features/checklist/hooks/use-return-to-checklist';
import { EvidenceItemLink } from '@/features/evidence/components/evidence-item-link';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { formatDateTime } from '@/utils/format-date';

/**
 * One evidence enlarged: the only place the full-resolution photo is decoded
 * (document 13.10). While the inspection is in progress the technician can
 * remove it; a photo not sent yet is deleted, one the server may hold is
 * removed after it (card #23).
 */
export function EvidenceViewScreen() {
  const inspectionId = useInspectionId();
  const { itemId = '', evidenceId = '' } = useLocalSearchParams<{
    itemId?: string;
    evidenceId?: string;
  }>();
  const inspection = useInspectionDetail(inspectionId);
  const discard = useDiscardEvidence(inspectionId);
  const returnToChecklist = useReturnToChecklist(inspectionId);

  if (inspection.state === 'loading') {
    return <Loading label="Abrindo a evidência..." />;
  }
  const evidence =
    inspection.state === 'ready'
      ? inspection.evidences[itemId]?.find((entry) => entry.id === evidenceId)
      : undefined;
  if (inspection.state !== 'ready' || evidence === undefined) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <ErrorState
          title="Evidência não encontrada"
          description="Ela pode ter sido removida. Volte ao checklist para ver as evidências do item."
          retryLabel="Voltar ao checklist"
          onRetry={returnToChecklist}
        />
      </Screen>
    );
  }

  function confirmRemoval() {
    Alert.alert('Remover evidência?', 'A foto sai deste item.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => discard.mutate({ evidenceId }, { onSuccess: returnToChecklist }),
      },
    ]);
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <EvidenceItemLink inspectionId={inspectionId} itemId={itemId} />
      {evidence.photoPath === null ? (
        <View className="h-56 items-center justify-center rounded-card bg-neutral-200 dark:bg-neutral-800">
          <Text variant="body" tone="muted">
            Registro sem foto
          </Text>
        </View>
      ) : (
        <FullPhoto path={evidence.photoPath} />
      )}
      <View className="flex-row flex-wrap items-center gap-2">
        <SyncStateBadge state={evidence.syncState} />
        <Text variant="caption" tone="muted">
          {`Registrada em ${formatDateTime(evidence.createdAtDevice)}`}
        </Text>
      </View>
      {evidence.description === null ? null : <Text variant="body">{evidence.description}</Text>}
      {discard.error === null ? null : (
        <Text variant="body" tone="danger">
          Não foi possível remover a evidência. Tente de novo.
        </Text>
      )}
      {canEditAnswers(inspection.detail.status) ? (
        <Button
          label="Remover evidência"
          variant="danger"
          loading={discard.isPending}
          onPress={confirmRemoval}
        />
      ) : null}
    </Screen>
  );
}

/** The photo at its own proportions, measured once it loads; portrait until then. */
function FullPhoto({ path }: { path: string }) {
  const [aspectRatio, setAspectRatio] = useState(3 / 4);

  return (
    <Image
      source={{ uri: evidenceImageUri(path) }}
      accessibilityLabel="Foto da evidência"
      resizeMode="contain"
      className="w-full rounded-card bg-neutral-950"
      style={{ aspectRatio }}
      onLoad={({ nativeEvent }) => {
        const { width, height } = nativeEvent.source;
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      }}
    />
  );
}
