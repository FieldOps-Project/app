import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { colors } from '@/design-system/tokens/design-tokens';
import type { EvidenceSummary } from '@/domain/evidence';

const THUMBNAIL_SIZE = 64;

export interface EvidenceThumbnailsProps {
  readonly evidences: readonly EvidenceSummary[];
  readonly onOpen: (evidence: EvidenceSummary) => void;
}

/**
 * The item's photos as small copies (document 13.10): the full file is only
 * decoded when one is opened. A photo not sent yet carries an upload mark,
 * so pending work is visible without a connection.
 */
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
        const sent = evidence.syncState === 'enviado';
        return (
          <Pressable
            key={evidence.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Abrir evidência ${index + 1}${sent ? '' : ', aguardando envio'}`}
            onPress={() => onOpen(evidence)}
            className="overflow-hidden rounded-field bg-neutral-200 dark:bg-neutral-800"
            style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
          >
            {evidence.thumbnailUri === null ? (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="image-outline" size={22} color={colors.neutral[500]} />
              </View>
            ) : (
              <Image
                source={{ uri: evidence.thumbnailUri }}
                resizeMode="cover"
                style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
              />
            )}
            {sent ? null : (
              <View className="absolute bottom-1 right-1 rounded-full bg-neutral-0 p-0.5">
                <Ionicons name="cloud-upload-outline" size={14} color={colors.warning.DEFAULT} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
