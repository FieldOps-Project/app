import { View } from 'react-native';

import { OptionButton } from '@/design-system/components/option-button';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';

function choose(props: ResponseFieldProps, value: string | boolean) {
  props.onChange(value);
  props.onCommit();
}

/** BOOLEAN: two large buttons rather than a small switch. */
export function BooleanField(props: ResponseFieldProps) {
  const { item, value, error, disabled } = props;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={item.itemTitle} className="gap-2">
      <View className="flex-row gap-2">
        <OptionButton
          label="Sim"
          selected={value === true}
          disabled={disabled}
          onPress={() => choose(props, true)}
        />
        <OptionButton
          label="Não"
          selected={value === false}
          disabled={disabled}
          onPress={() => choose(props, false)}
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

/**
 * CONFORMITY: nothing comes selected. A preselected "Conforme" would approve
 * the item by inertia — the technician skips it and the checklist records a
 * conformity nobody checked (card #13).
 */
export function ConformityField(props: ResponseFieldProps) {
  const { item, value, error, disabled } = props;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={item.itemTitle} className="gap-2">
      <View className="flex-row gap-2">
        <OptionButton
          label="Conforme"
          tone="success"
          selected={value === 'CONFORMING'}
          disabled={disabled}
          onPress={() => choose(props, 'CONFORMING')}
        />
        <OptionButton
          label="Não conforme"
          tone="danger"
          selected={value === 'NON_CONFORMING'}
          disabled={disabled}
          onPress={() => choose(props, 'NON_CONFORMING')}
        />
      </View>
      <OptionButton
        label="Não aplicável"
        selected={value === 'NOT_APPLICABLE'}
        disabled={disabled}
        onPress={() => choose(props, 'NOT_APPLICABLE')}
      />
      <FieldError message={error} />
    </View>
  );
}

/** SINGLE_CHOICE: exactly the options published in the snapshot, in their order. */
export function SingleChoiceField(props: ResponseFieldProps) {
  const { item, value, error, disabled } = props;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={item.itemTitle} className="gap-2">
      {item.options.map((option) => (
        <View key={option} className="flex-row">
          <OptionButton
            label={option}
            selected={value === option}
            disabled={disabled}
            onPress={() => choose(props, option)}
          />
        </View>
      ))}
      <FieldError message={error} />
    </View>
  );
}
