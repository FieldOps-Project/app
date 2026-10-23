import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Text } from '@/design-system/components/text';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';

/** `YYYY-MM-DD` as a local calendar date; never through UTC, which shifts the day. */
function toDate(value: ResponseFieldProps['value']): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  }
  return new Date();
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value: ResponseFieldProps['value']): string | null {
  return typeof value === 'string' && value !== ''
    ? toDate(value).toLocaleDateString('pt-BR')
    : null;
}

/**
 * DATE: the native picker only, with no free typing — a typed date is a
 * format to guess and a value to mistype (card #13). Android opens its system
 * dialog; iOS shows the calendar inline until confirmed.
 */
export function DateField({
  item,
  value,
  onChange,
  onCommit,
  error,
  disabled,
}: ResponseFieldProps) {
  const [pending, setPending] = useState<Date | null>(null);
  const label = formatDate(value);

  function pick(date: Date) {
    onChange(toIsoDate(date));
    onCommit();
  }

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date !== undefined) {
            pick(date);
          }
        },
      });
      return;
    }
    setPending(toDate(value));
  }

  return (
    <View className="gap-2">
      <Text variant="body" tone={label === null ? 'muted' : 'default'}>
        {label ?? 'Nenhuma data escolhida'}
      </Text>
      {pending === null ? (
        <Button
          label={label === null ? 'Escolher data' : 'Alterar data'}
          variant="secondary"
          disabled={disabled}
          accessibilityHint={`Abre o calendário para ${item.itemTitle}`}
          onPress={open}
        />
      ) : (
        <View className="gap-2">
          <DateTimePicker
            value={pending}
            mode="date"
            display="inline"
            onChange={(_event, date) => {
              if (date !== undefined) {
                setPending(date);
              }
            }}
          />
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setPending(null)}
            />
            <Button
              label="Confirmar"
              className="flex-1"
              onPress={() => {
                pick(pending);
                setPending(null);
              }}
            />
          </View>
        </View>
      )}
      <FieldError message={error} />
    </View>
  );
}
