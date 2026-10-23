import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';

/**
 * Stands in for a response type this version does not know (document 13.5).
 * The rest of the checklist keeps working; a required item of this kind is
 * listed as pending, which blocks the completion with this same explanation.
 */
export function UnsupportedField({ item }: ResponseFieldProps) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-field bg-warning-soft p-3 dark:bg-neutral-800"
    >
      <Ionicons name="warning-outline" size={20} color={colors.warning.DEFAULT} />
      <View className="flex-1 gap-1">
        <Text variant="body" tone="warning" className="font-semibold">
          Item incompatível com esta versão do aplicativo
        </Text>
        <Text variant="caption" tone="muted">
          {item.required
            ? 'Este item é obrigatório: atualize o aplicativo para responder e concluir a inspeção.'
            : 'Atualize o aplicativo para responder este item. Ele não impede a conclusão.'}
        </Text>
      </View>
    </View>
  );
}
