import { Input } from '@/design-system/components/input';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';
import { TEXT_LONG_MAX, TEXT_SHORT_MAX } from '@/schemas/checklist-response';

function asText(value: ResponseFieldProps['value']): string {
  return typeof value === 'string' ? value : '';
}

/** TEXT_SHORT: one line, with the remaining room always visible. */
export function TextShortField({
  item,
  value,
  onChange,
  onCommit,
  error,
  disabled,
}: ResponseFieldProps) {
  const text = asText(value);
  return (
    <Input
      label="Resposta"
      accessibilityLabel={item.itemTitle}
      value={text}
      onChangeText={onChange}
      onEndEditing={onCommit}
      returnKeyType="done"
      maxLength={TEXT_SHORT_MAX}
      editable={!disabled}
      error={error}
      hint={`${text.length} de ${TEXT_SHORT_MAX} caracteres`}
    />
  );
}

/** TEXT_LONG: grows with the text; the screen keeps it above the keyboard. */
export function TextLongField({
  item,
  value,
  onChange,
  onCommit,
  error,
  disabled,
}: ResponseFieldProps) {
  const text = asText(value);
  return (
    <Input
      label="Resposta"
      accessibilityLabel={item.itemTitle}
      value={text}
      onChangeText={onChange}
      onEndEditing={onCommit}
      multiline
      textAlignVertical="top"
      minHeight={112}
      maxLength={TEXT_LONG_MAX}
      editable={!disabled}
      error={error}
      hint={`${text.length} de ${TEXT_LONG_MAX} caracteres`}
    />
  );
}
