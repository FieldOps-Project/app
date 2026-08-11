import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { NavigationDepthBadge } from '@/components/navigation-depth-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';

/** Code scanner used to identify equipment and locations. */
export function ScannerScreen() {
  const router = useRouter();

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Leitor de código</Text>
        <NavigationDepthBadge />
      </View>

      <Card title="Visor">
        <View className="h-56 items-center justify-center rounded-field bg-neutral-200 dark:bg-neutral-800">
          <Text variant="body" tone="muted">
            Leitura de código de barras e QR (EP-07)
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          A permissão de câmera é solicitada em EP-07. Se for negada, a tela orienta a liberar o
          acesso nos ajustes do aparelho e mantém a entrada manual do código.
        </Text>
        <Button label="Fechar" variant="secondary" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
