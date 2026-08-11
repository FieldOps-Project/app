import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isDevelopment } from '@/config/env';
import { Text } from '@/design-system/components/text';

/**
 * Shows how many screens the enclosing stack holds.
 *
 * Document 13.3 requires that repeatedly opening the camera does not pile up
 * screens. That property is invisible in a normal screenshot, so this badge
 * makes it observable while testing: the number must return to the same value
 * after each capture cycle.
 *
 * Rendered only in development builds, so it never reaches a technician.
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
