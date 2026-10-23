import { View } from 'react-native';

import { useSynchronize } from '@/application/sync/use-synchronization';
import { Button, type ButtonVariant } from '@/design-system/components/button';
import { Text } from '@/design-system/components/text';
import { describeApiFailure, isNetworkFailure } from '@/infrastructure/api';

export interface SyncNowButtonProps {
  variant?: ButtonVariant;
}

/**
 * "Sincronizar": sends what is pending and downloads again. The outcome stays
 * on screen next to the button instead of a toast that disappears (document
 * 13.8).
 */
export function SyncNowButton({ variant = 'primary' }: SyncNowButtonProps) {
  const sync = useSynchronize();

  return (
    <View className="gap-2">
      <Button
        label="Sincronizar"
        variant={variant}
        loading={sync.isPending}
        onPress={() => sync.mutate()}
      />
      <SyncOutcomeText
        isSuccess={sync.isSuccess}
        refused={sync.data?.refused ?? 0}
        sent={sync.data?.sent ?? 0}
        error={sync.error}
      />
    </View>
  );
}

interface SyncOutcomeTextProps {
  isSuccess: boolean;
  sent: number;
  refused: number;
  error: ReturnType<typeof useSynchronize>['error'];
}

function SyncOutcomeText({ isSuccess, sent, refused, error }: SyncOutcomeTextProps) {
  if (error !== null) {
    return (
      <Text variant="caption" tone={isNetworkFailure(error) ? 'warning' : 'danger'}>
        {isNetworkFailure(error)
          ? 'Sem conexão. Nada foi perdido: os registros continuam salvos e serão enviados depois.'
          : describeApiFailure(error)}
      </Text>
    );
  }
  if (!isSuccess) {
    return null;
  }
  if (refused > 0) {
    return (
      <Text variant="caption" tone="danger">
        {refused === 1
          ? '1 registro foi recusado pelo servidor e continua no aparelho.'
          : `${refused} registros foram recusados pelo servidor e continuam no aparelho.`}
      </Text>
    );
  }
  return (
    <Text variant="caption" tone="success">
      {sent === 0
        ? 'Sincronizado. Nada pendente de envio.'
        : `Sincronizado. ${sent} ${sent === 1 ? 'registro enviado' : 'registros enviados'}.`}
    </Text>
  );
}
