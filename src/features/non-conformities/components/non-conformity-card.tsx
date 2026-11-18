import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import {
  canDeleteLocally,
  lacksRequiredEvidence,
  type NonConformity,
} from '@/domain/non-conformity';
import { SeverityBadge } from '@/features/non-conformities/components/severity-badge';
import { plural } from '@/utils/plural';

export interface NonConformityCardProps {
  nonConformity: NonConformity;
  editable: boolean;
  deleting: boolean;
  onCaptureEvidence: (nonConformityId: string) => void;
  onDelete: (nonConformityId: string) => void;
}

export function NonConformityCard({
  nonConformity,
  editable,
  deleting,
  onCaptureEvidence,
  onDelete,
}: NonConformityCardProps) {
  const [confirming, setConfirming] = useState(false);
  const missingEvidence = lacksRequiredEvidence(nonConformity);

  return (
    <Card className={missingEvidence ? 'border-2 border-danger' : 'border-2 border-transparent'}>
      <View className="flex-row flex-wrap items-center gap-2">
        <SeverityBadge severity={nonConformity.severity} />
        <SyncStateBadge state={nonConformity.syncState} />
      </View>
      <Text variant="subtitle">{nonConformity.title}</Text>
      {nonConformity.itemTitle === null ? null : (
        <Text variant="caption" tone="muted">
          {`Item: ${nonConformity.itemTitle}`}
        </Text>
      )}
      <Text variant="body">{nonConformity.description}</Text>

      <View className="flex-row items-center gap-1.5">
        <Ionicons
          name={nonConformity.evidenceCount > 0 ? 'images-outline' : 'camera-outline'}
          size={18}
          color={nonConformity.evidenceCount > 0 ? colors.success.DEFAULT : colors.neutral[500]}
        />
        <Text variant="caption" tone={nonConformity.evidenceCount > 0 ? 'success' : 'muted'}>
          {nonConformity.evidenceCount > 0
            ? plural(nonConformity.evidenceCount, 'evidência registrada', 'evidências registradas')
            : 'Nenhuma evidência'}
        </Text>
      </View>
      {missingEvidence ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          Criticidade crítica exige ao menos uma evidência. Fotografe para poder concluir a
          inspeção.
        </Text>
      ) : null}

      {editable ? (
        <View className="gap-2">
          <Button
            label={
              nonConformity.evidenceCount > 0
                ? 'Fotografar outra evidência'
                : 'Fotografar evidência'
            }
            variant={missingEvidence ? 'primary' : 'secondary'}
            onPress={() => onCaptureEvidence(nonConformity.id)}
          />
          {canDeleteLocally(nonConformity) ? (
            confirming ? (
              <View className="gap-2">
                <Text variant="body">
                  Excluir esta não conformidade? As fotos dela também serão removidas deste
                  aparelho.
                </Text>
                <Button
                  label="Confirmar exclusão"
                  variant="danger"
                  loading={deleting}
                  onPress={() => onDelete(nonConformity.id)}
                />
                <Button
                  label="Manter"
                  variant="secondary"
                  disabled={deleting}
                  onPress={() => setConfirming(false)}
                />
              </View>
            ) : (
              <Button label="Excluir" variant="secondary" onPress={() => setConfirming(true)} />
            )
          ) : (
            <Text variant="caption" tone="muted">
              Já enviada ao servidor: não pode mais ser excluída.
            </Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}
