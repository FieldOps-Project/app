import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { colors } from '@/design-system/tokens/design-tokens';
import { evidenceImageUri } from '@/application/evidence/evidence-files';
import {
  evidenceUploadState,
  type EvidenceSummary,
  type EvidenceUploadState,
} from '@/domain/evidence';

const THUMBNAIL_SIZE = 64;

const UPLOAD_LABEL: Record<EvidenceUploadState, string> = {
  sent: '',
  waiting: ', aguardando envio',
  failed: ', falha no envio',
};

export interface EvidenceThumbnailsProps {
  readonly evidences: readonly EvidenceSummary[];
  readonly onOpen: (evidence: EvidenceSummary) => void;
}

export const EvidenceThumbnails = memo(function EvidenceThumbnails({
  evidences,
  onOpen,
}: EvidenceThumbnailsProps) {
  if (evidences.length === 0) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {evidences.map((evidence, index) => {
        const upload = evidenceUploadState(evidence.syncState);
        return (
          <Pressable
            key={evidence.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Abrir evidência ${index + 1}${UPLOAD_LABEL[upload]}`}
            onPress={() => onOpen(evidence)}
            className="overflow-hidden rounded-field bg-neutral-200 dark:bg-neutral-800"
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
          >
            {evidence.thumbnailPath === null ? (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="image-outline" size={22} color={colors.neutral[500]} />
              </View>
            ) : (
              <Image
                source={{ uri: evidenceImageUri(evidence.thumbnailPath) }}
                resizeMode="cover"
                style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
              />
            )}
            {upload === 'sent' ? null : (
              <View className="absolute bottom-1 right-1 rounded-full bg-neutral-0 p-0.5">
                <Ionicons
                  name={upload === 'failed' ? 'alert-circle' : 'cloud-upload-outline'}
                  size={14}
                  color={upload === 'failed' ? colors.danger.DEFAULT : colors.warning.DEFAULT}
                />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
