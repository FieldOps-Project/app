import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { memo, useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Badge } from '@/design-system/components/badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Input } from '@/design-system/components/input';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { hasAnswer, type ChecklistItem, type ChecklistResponse } from '@/domain/checklist';
import { evidenceUploadState, type EvidenceSummary } from '@/domain/evidence';
import { responseFieldFor } from '@/features/checklist/components/response-fields';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import { EvidenceThumbnails } from '@/features/evidence/components/evidence-thumbnails';
import {
  isEmptyAnswer,
  isSameAnswer,
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
  evidences: readonly EvidenceSummary[];
  needsObservation: boolean;
  needsEvidence: boolean;
  toCorrect: boolean;
  editable: boolean;
  focused: boolean;
  onSave: (itemId: string, answer: ResponseFormOutput) => void;
  onCaptureEvidence: (itemId: string) => void;
  onOpenEvidence: (evidence: EvidenceSummary) => void;
}

export const ChecklistItemRow = memo(function ChecklistItemRow({
  item,
  response,
  evidences,
  needsObservation,
  needsEvidence,
  toCorrect,
  editable,
  focused,
  onSave,
  onCaptureEvidence,
  onOpenEvidence,
}: ChecklistItemRowProps) {
  const evidenceCount = evidences.length;
  const waiting = evidences.filter(
    (evidence) => evidenceUploadState(evidence.syncState) === 'waiting'
  ).length;
  const failed = evidences.filter(
    (evidence) => evidenceUploadState(evidence.syncState) === 'failed'
  ).length;
  const schema = useMemo(() => responseFormSchema(item), [item]);
  const form = useForm<ResponseFormInput, unknown, ResponseFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toFormInput(item, response),
    mode: 'onChange',
  });

  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset(toFormInput(item, response));
    }
  }, [form, item, response]);

  function commit() {
    const submitted = form.getValues();
    void form.handleSubmit((answer) => {
      form.reset(submitted);
      if (!isSameAnswer(answer, response) && !(response === undefined && isEmptyAnswer(answer))) {
        onSave(item.id, answer);
      }
    })();
  }

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
            onCommit={commit}
            error={fieldState.error?.message}
            disabled={!editable}
          />
        )}
      />

      {editable || observation !== '' ? (
        <Controller
          control={form.control}
          name="observation"
          render={({ field, fieldState }) => (
            <Input
              label={needsObservation ? 'Observação (obrigatória)' : 'Observação'}
              value={field.value}
              onChangeText={field.onChange}
              onEndEditing={commit}
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
              {waiting > 0 ? ` · ${waiting} aguardando envio` : ''}
              {failed > 0 ? ` · ${failed} com falha no envio` : ''}
            </Text>
          </View>
          <EvidenceThumbnails evidences={evidences} onOpen={onOpenEvidence} />
          <FieldError
            message={
              needsEvidence ? 'Registre ao menos uma evidência desta não conformidade.' : undefined
            }
          />
          {editable ? (
            <Button
              label={evidenceCount > 0 ? 'Fotografar outra evidência' : 'Fotografar evidência'}
              variant="secondary"
              onPress={() => onCaptureEvidence(item.id)}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});
