import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Badge } from '@/design-system/components/badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Input } from '@/design-system/components/input';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { hasAnswer, type ChecklistItem, type ChecklistResponse } from '@/domain/checklist';
import { responseFieldFor } from '@/features/checklist/components/response-fields';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import {
  OBSERVATION_MAX,
  responseFormSchema,
  toFormInput,
  type ResponseFormInput,
  type ResponseFormOutput,
} from '@/schemas/checklist-response';
import { plural } from '@/utils/plural';

export interface ChecklistItemRowProps {
  item: ChecklistItem;
  response: ChecklistResponse | undefined;
  evidenceCount: number;
  /** RN-038: a failure here still lacks its observation. */
  needsObservation: boolean;
  /** RN-039: a failure here still lacks its evidence. */
  needsEvidence: boolean;
  /** Flagged by the supervisor's rejection. */
  toCorrect: boolean;
  editable: boolean;
  focused: boolean;
  onSave: (itemId: string, answer: ResponseFormOutput) => void;
  onCaptureEvidence: (itemId: string) => void;
}

function sameAnswer(answer: ResponseFormOutput, stored: ChecklistResponse | undefined): boolean {
  const { columns, observation } = answer;
  return (
    (stored?.valueText ?? null) === columns.valueText &&
    (stored?.valueNumber ?? null) === columns.valueNumber &&
    (stored?.valueBoolean ?? null) === columns.valueBoolean &&
    (stored?.valueDate ?? null) === columns.valueDate &&
    (stored?.conformity ?? null) === columns.conformity &&
    (stored?.observation ?? null) === observation
  );
}

/**
 * One item of the checklist, with its own form.
 *
 * Each row owns its state, so typing in one never re-renders the others
 * (document 13.10); the screen only hears about a confirmed answer. The
 * value is validated by the item's Zod schema as it is typed and saved when
 * editing ends, never on every key.
 */
export function ChecklistItemRow({
  item,
  response,
  evidenceCount,
  needsObservation,
  needsEvidence,
  toCorrect,
  editable,
  focused,
  onSave,
  onCaptureEvidence,
}: ChecklistItemRowProps) {
  const schema = useMemo(() => responseFormSchema(item), [item]);
  const form = useForm<ResponseFormInput, unknown, ResponseFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toFormInput(item, response),
    mode: 'onChange',
  });

  /** A newer answer from the device store replaces the form, unless the technician is mid-edit. */
  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset(toFormInput(item, response));
    }
  }, [form, item, response]);

  const commit = form.handleSubmit((answer) => {
    form.reset(form.getValues());
    if (!sameAnswer(answer, response) && !(response === undefined && isBlank(answer))) {
      onSave(item.id, answer);
    }
  });

  const observation = useWatch({ control: form.control, name: 'observation' });
  const Field = responseFieldFor(item.responseType);
  const answered = hasAnswer(item, response);

  return (
    <Card className={focused ? 'border-2 border-brand-600' : 'border-2 border-transparent'}>
      <View className="gap-1.5">
        <View className="flex-row flex-wrap items-center gap-2">
          {item.itemCode === null ? null : (
            <Text variant="code" tone="muted">
              {item.itemCode}
            </Text>
          )}
          {item.required ? <Badge tone="neutral" icon="star-outline" label="Obrigatório" /> : null}
          {toCorrect ? <Badge tone="danger" icon="arrow-undo-outline" label="A corrigir" /> : null}
        </View>
        <Text variant="subtitle">{item.itemTitle}</Text>
        {item.itemDescription === null ? null : (
          <Text variant="body" tone="muted">
            {item.itemDescription}
          </Text>
        )}
      </View>

      <Controller
        control={form.control}
        name="value"
        render={({ field, fieldState }) => (
          <Field
            item={item}
            value={field.value}
            onChange={field.onChange}
            onCommit={() => void commit()}
            error={fieldState.error?.message}
            disabled={!editable}
          />
        )}
      />

      {answered || (editable && observation !== '') ? (
        <Controller
          control={form.control}
          name="observation"
          render={({ field, fieldState }) => (
            <Input
              label={needsObservation ? 'Observação (obrigatória)' : 'Observação'}
              value={field.value}
              onChangeText={field.onChange}
              onEndEditing={() => void commit()}
              multiline
              textAlignVertical="top"
              minHeight={72}
              maxLength={OBSERVATION_MAX}
              editable={editable}
              placeholder={editable ? 'Descreva o que encontrou' : 'Sem observação'}
              error={
                fieldState.error?.message ??
                (needsObservation
                  ? 'Descreva a não conformidade: a observação é obrigatória neste item.'
                  : undefined)
              }
            />
          )}
        />
      ) : null}

      {answered || evidenceCount > 0 ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={evidenceCount > 0 ? 'images-outline' : 'camera-outline'}
              size={18}
              color={evidenceCount > 0 ? colors.success.DEFAULT : colors.neutral[500]}
            />
            <Text variant="caption" tone={evidenceCount > 0 ? 'success' : 'muted'}>
              {evidenceCount > 0
                ? plural(evidenceCount, 'evidência registrada', 'evidências registradas')
                : 'Nenhuma evidência'}
            </Text>
          </View>
          <FieldError
            message={
              needsEvidence ? 'Registre ao menos uma evidência desta não conformidade.' : undefined
            }
          />
          {editable ? (
            <Button
              label="Registrar evidência"
              variant="secondary"
              onPress={() => onCaptureEvidence(item.id)}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function isBlank({ columns, observation }: ResponseFormOutput): boolean {
  return Object.values(columns).every((value) => value === null) && observation === null;
}
