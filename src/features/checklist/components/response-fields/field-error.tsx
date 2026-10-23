import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

/** The error right under the control, icon and text, as `Input` shows it. */
export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-1.5"
    >
      <Ionicons name="alert-circle" size={16} color={colors.danger.DEFAULT} />
      <Text variant="caption" tone="danger" className="flex-1">
        {message}
      </Text>
    </View>
  );
}
