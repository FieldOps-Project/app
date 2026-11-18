import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import { OptionButton, type OptionTone } from '@/design-system/components/option-button';
import { Text } from '@/design-system/components/text';
import {
  NON_CONFORMITY_DESCRIPTION_MAX,
  NON_CONFORMITY_TITLE_MAX,
  SEVERITIES,
  SEVERITY_LABELS,
  type Severity,
} from '@/domain/non-conformity';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import {
  EMPTY_NON_CONFORMITY_FORM,
  nonConformityFormSchema,
  type NonConformityFormInput,
  type NonConformityFormOutput,
} from '@/schemas/non-conformity';

const SEVERITY_TONES: Readonly<Record<Severity, OptionTone>> = {
  LOW: 'neutral',
  MEDIUM: 'neutral',
  HIGH: 'neutral',
  CRITICAL: 'danger',
};

export interface NonConformityFormProps {
  pending: boolean;
  failure: string | undefined;
  onSubmit: (form: NonConformityFormOutput) => void;
  onCancel: () => void;
}

export function NonConformityForm({
  pending,
  failure,
  onSubmit,
  onCancel,
}: NonConformityFormProps) {
  const form = useForm<NonConformityFormInput, unknown, NonConformityFormOutput>({
    resolver: zodResolver(nonConformityFormSchema),
    defaultValues: EMPTY_NON_CONFORMITY_FORM,
    mode: 'onTouched',
  });

  return (
    <View className="gap-3">
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Input
            label="Título"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={NON_CONFORMITY_TITLE_MAX}
            editable={!pending}
            error={fieldState.error?.message}
            placeholder="Ex.: Trinca na proteção lateral"
          />
        )}
      />
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Input
            label="Descrição"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline
            textAlignVertical="top"
            minHeight={96}
            maxLength={NON_CONFORMITY_DESCRIPTION_MAX}
            editable={!pending}
            error={fieldState.error?.message}
            placeholder="Descreva o que foi encontrado"
          />
        )}
      />
      <Controller
        control={form.control}
        name="severity"
        render={({ field, fieldState }) => (
          <View accessibilityRole="radiogroup" accessibilityLabel="Criticidade" className="gap-2">
            <Text variant="label" tone="muted">
              Criticidade
            </Text>
            <View className="flex-row gap-2">
              {SEVERITIES.slice(0, 2).map((severity) => (
                <OptionButton
                  key={severity}
                  label={SEVERITY_LABELS[severity]}
                  tone={SEVERITY_TONES[severity]}
                  selected={field.value === severity}
                  disabled={pending}
                  onPress={() => field.onChange(severity)}
                />
              ))}
            </View>
            <View className="flex-row gap-2">
              {SEVERITIES.slice(2).map((severity) => (
                <OptionButton
                  key={severity}
                  label={SEVERITY_LABELS[severity]}
                  tone={SEVERITY_TONES[severity]}
                  selected={field.value === severity}
                  disabled={pending}
                  onPress={() => field.onChange(severity)}
                />
              ))}
            </View>
            <Text variant="caption" tone="muted">
              A criticidade crítica exige ao menos uma foto de evidência antes de concluir a
              inspeção. Você pode registrar agora e fotografar em seguida.
            </Text>
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />
      <FieldError message={failure} />
      <Button
        label="Registrar não conformidade"
        loading={pending}
        onPress={() => void form.handleSubmit(onSubmit)()}
      />
      <Button label="Cancelar" variant="secondary" disabled={pending} onPress={onCancel} />
    </View>
  );
}
