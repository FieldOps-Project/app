import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors, minTouchTarget } from '@/design-system/tokens/design-tokens';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Toggleable filter chip.
 *
 * Selection is shown by fill, check icon and the announced `selected` state
 * together, never by colour alone (document 13.9). Height follows the touch
 * target guideline so it works with gloves.
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: minTouchTarget }}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70 ${
        selected
          ? 'border-brand-600 bg-brand-50 dark:bg-neutral-800'
          : 'border-neutral-300 bg-neutral-0 dark:border-neutral-700 dark:bg-neutral-900'
      }`}
    >
      {selected ? <Ionicons name="checkmark" size={16} color={colors.brand.DEFAULT} /> : null}
      <Text variant="body" tone={selected ? 'brand' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
