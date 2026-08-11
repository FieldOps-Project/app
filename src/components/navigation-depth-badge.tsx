import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isDevelopment } from '@/config/env';
import { Text } from '@/design-system/components/text';

/**
 * Stack depth, shown only in development.
 *
 * Makes the "camera does not pile up screens" rule observable: the number must
 * return to the same value after each capture cycle.
 */
export function NavigationDepthBadge() {
  const navigation = useNavigation();
  const [depth, setDepth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setDepth(navigation.getState()?.routes.length ?? null);
    update();
    return navigation.addListener('state', update);
  }, [navigation]);

  if (!isDevelopment || depth === null) {
    return null;
  }

  return (
    <View className="self-start rounded-field bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
      <Text variant="caption" tone="muted">
        pilha: {depth} {depth === 1 ? 'tela' : 'telas'}
      </Text>
    </View>
  );
}
