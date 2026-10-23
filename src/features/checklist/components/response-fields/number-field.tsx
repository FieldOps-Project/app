import { Input } from '@/design-system/components/input';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';
import { formatDecimal } from '@/schemas/checklist-response';

function rangeHint(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `Entre ${formatDecimal(min)} e ${formatDecimal(max)}. Use vírgula para decimais.`;
  }
  if (min !== null) {
    return `A partir de ${formatDecimal(min)}. Use vírgula para decimais.`;
  }
  if (max !== null) {
    return `Até ${formatDecimal(max)}. Use vírgula para decimais.`;
  }
  return 'Use vírgula para decimais.';
}

/**
 * NUMBER: numeric keypad, decimal comma accepted. The text stays as typed
 * while editing; the schema turns it into a number when it is saved.
 */
export function NumberField({
  item,
  value,
  onChange,
  onCommit,
  error,
  disabled,
}: ResponseFieldProps) {
  return (
    <Input
      label="Resposta"
      accessibilityLabel={item.itemTitle}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      onEndEditing={onCommit}
      keyboardType="decimal-pad"
      returnKeyType="done"
      editable={!disabled}
      error={error}
      hint={rangeHint(item.rules.min, item.rules.max)}
    />
  );
}
