import { Ionicons } from '@expo/vector-icons';
import { Linking, View } from 'react-native';

import { useLocationPermission } from '@/application/location/use-location-permission';
import { Button } from '@/design-system/components/button';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import type { TransitionMoment } from '@/features/location/describe-location';
import { LOCATION_TIMEOUT_MS } from '@/infrastructure/location/capture-location';

const PURPOSE: Record<TransitionMoment, string> = {
  start: 'onde a inspeção começou',
  completion: 'onde a inspeção foi concluída',
};

const OUTCOME: Record<TransitionMoment, string> = {
  start: 'a inspeção começa assim mesmo',
  completion: 'a conclusão acontece assim mesmo',
};

/**
 * Said before the system prompt (RN-058): what is read, when, and that saying
 * no does not stop the work (RN-059). A permission Android will not ask for
 * again gets a way to the settings instead.
 */
export function LocationConsent({ moment }: { moment: TransitionMoment }) {
  const permission = useLocationPermission();
  const refused = permission === 'denied' || permission === 'blocked';

  const text = refused
    ? `A permissão de localização está negada: ${OUTCOME[moment]}, sem a posição, e a ausência fica registrada.`
    : `${permission === 'granted' ? 'A' : 'Ao confirmar, o aparelho pede permissão e a'} posição deste aparelho é lida uma única vez, para registrar ${PURPOSE[moment]}. Não há rastreamento contínuo; se a posição não vier, ${OUTCOME[moment]}.`;

  return (
    <View className="gap-2">
      <View className="flex-row items-start gap-2">
        <Ionicons
          name="navigate-outline"
          size={18}
          color={refused ? colors.warning.DEFAULT : colors.neutral[500]}
        />
        <Text variant="body" tone={refused ? 'warning' : 'default'} className="flex-1">
          {text}
        </Text>
      </View>
      {permission === 'blocked' ? (
        <Button
          label="Permitir nas configurações"
          variant="secondary"
          onPress={() => void Linking.openSettings().catch(() => undefined)}
        />
      ) : null}
    </View>
  );
}

/** Shown while the single reading is under way, so a slow fix never looks frozen. */
export function LocatingNotice() {
  return (
    <Text variant="caption" tone="muted">
      {`Obtendo a localização (até ${LOCATION_TIMEOUT_MS / 1000} s)...`}
    </Text>
  );
}
