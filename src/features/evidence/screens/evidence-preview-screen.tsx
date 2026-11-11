import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { discardCapturedPhoto } from '@/application/evidence/evidence-files';
import { useAttachPhoto } from '@/application/inspections/use-checklist-actions';
import { Button } from '@/design-system/components/button';
import { ErrorState } from '@/design-system/components/error-state';
import { Input } from '@/design-system/components/input';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { EVIDENCE_DESCRIPTION_MAX } from '@/domain/evidence';
import { useReturnToChecklist } from '@/features/checklist/hooks/use-return-to-checklist';
import { EvidenceItemLink } from '@/features/evidence/components/evidence-item-link';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

type PreviewParams = {
  itemId?: string;
  photoUri?: string;
  width?: string;
  height?: string;
};

function toSize(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * UC-11, second half: the photo as taken, the item it will belong to, and an
 * optional description. Confirming stores the photo and returns to the same
 * point of the checklist (document 13.9); retaking and discarding throw the
 * camera's file away. Every exit replaces this entry or unwinds, so no path
 * leaves an extra one.
 */
export function EvidencePreviewScreen() {
  const inspectionId = useInspectionId();
  const { itemId = '', photoUri, width, height } = useLocalSearchParams<PreviewParams>();
  const router = useRouter();
  const attach = useAttachPhoto(inspectionId);
  const returnToChecklist = useReturnToChecklist(inspectionId);
  const [description, setDescription] = useState('');

  if (photoUri === undefined || photoUri === '' || itemId === '') {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <ErrorState
          title="Nenhuma foto para conferir"
          description="Volte ao checklist e fotografe a evidência do item."
          retryLabel="Voltar ao checklist"
          onRetry={returnToChecklist}
        />
      </Screen>
    );
  }

  const photoWidth = toSize(width);
  const photoHeight = toSize(height);
  const aspectRatio = photoWidth > 0 && photoHeight > 0 ? photoWidth / photoHeight : 3 / 4;

  function confirm() {
    if (photoUri === undefined) {
      return;
    }
    attach.mutate(
      {
        inspectionItemId: itemId,
        photo: { uri: photoUri, width: photoWidth, height: photoHeight },
        description,
      },
      { onSuccess: returnToChecklist }
    );
  }

  function retake() {
    if (photoUri !== undefined) {
      discardCapturedPhoto(photoUri);
    }
    router.replace({ pathname: '/evidence/capture', params: { inspectionId, itemId } });
  }

  function discard() {
    if (photoUri !== undefined) {
      discardCapturedPhoto(photoUri);
    }
    returnToChecklist();
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <EvidenceItemLink inspectionId={inspectionId} itemId={itemId} />
      <Image
        source={{ uri: photoUri }}
        accessibilityLabel="Foto capturada"
        resizeMode="contain"
        className="w-full rounded-card bg-neutral-950"
        style={{ aspectRatio, maxHeight: 420 }}
      />
      <Input
        label="Descrição (opcional)"
        value={description}
        onChangeText={setDescription}
        maxLength={EVIDENCE_DESCRIPTION_MAX}
        multiline
        textAlignVertical="top"
        minHeight={72}
        editable={!attach.isPending}
        placeholder="O que a foto mostra"
      />
      {attach.error === null ? null : (
        <Text variant="body" tone="danger">
          {attach.error.message}
        </Text>
      )}
      <View className="gap-3">
        <Button label="Usar esta foto" loading={attach.isPending} onPress={confirm} />
        <Button label="Refazer" variant="secondary" disabled={attach.isPending} onPress={retake} />
        <Button label="Descartar" variant="danger" disabled={attach.isPending} onPress={discard} />
      </View>
    </Screen>
  );
}
