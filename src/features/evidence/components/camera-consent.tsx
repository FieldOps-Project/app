import { Ionicons } from '@expo/vector-icons';
import type { PermissionResponse } from 'expo-camera';
import { Linking, View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export interface CameraConsentProps {
  readonly permission: PermissionResponse;
  readonly onRequest: () => void;
  readonly onBack: () => void;
}

/**
 * Said before the system prompt (RN-058): what the camera is for and that
 * the photos stay on the device until they are sent. A refusal never stops
 * the inspection (RN-059): the technician goes back to the checklist, keeps
 * answering and can come back for the photo; a permission Android will not
 * ask for again gets a way to the settings.
 */
export function CameraConsent({ permission, onRequest, onBack }: CameraConsentProps) {
  const refused = permission.status === 'denied';
  const blocked = refused && !permission.canAskAgain;

  return (
    <Card title="Câmera">
      <View className="flex-row items-start gap-2">
        <Ionicons
          name="camera-outline"
          size={18}
          color={refused ? colors.warning.DEFAULT : colors.neutral[500]}
        />
        <Text variant="body" tone={refused ? 'warning' : 'default'} className="flex-1">
          {refused
            ? 'A permissão da câmera está negada, então não dá para fotografar agora. A inspeção continua: volte ao checklist, siga respondendo e registre a evidência quando permitir a câmera.'
            : 'A câmera é usada só para fotografar as evidências deste item. As fotos ficam guardadas no aparelho até serem enviadas, mesmo sem conexão.'}
        </Text>
      </View>
      {blocked ? (
        <Button
          label="Permitir nas configurações"
          onPress={() => void Linking.openSettings().catch(() => undefined)}
        />
      ) : (
        <Button
          label={refused ? 'Pedir permissão de novo' : 'Permitir câmera'}
          onPress={onRequest}
        />
      )}
      <Button label="Voltar ao checklist" variant="secondary" onPress={onBack} />
    </Card>
  );
}
