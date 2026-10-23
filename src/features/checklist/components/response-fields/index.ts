import type { ComponentType } from 'react';

import { isKnownResponseType, type ResponseType } from '@/domain/checklist';
import {
  BooleanField,
  ConformityField,
  SingleChoiceField,
} from '@/features/checklist/components/response-fields/choice-fields';
import { DateField } from '@/features/checklist/components/response-fields/date-field';
import { NumberField } from '@/features/checklist/components/response-fields/number-field';
import type { ResponseFieldProps } from '@/features/checklist/components/response-fields/response-field-props';
import {
  TextLongField,
  TextShortField,
} from '@/features/checklist/components/response-fields/text-field';
import { UnsupportedField } from '@/features/checklist/components/response-fields/unsupported-field';

/**
 * The explicit type → component map of document 13.5. A `Record` over the
 * known types makes a missing entry a compile error; reading it only through
 * `responseFieldFor` makes an unknown type a warning, never a crash.
 */
const RESPONSE_FIELDS: Record<ResponseType, ComponentType<ResponseFieldProps>> = {
  TEXT_SHORT: TextShortField,
  TEXT_LONG: TextLongField,
  NUMBER: NumberField,
  BOOLEAN: BooleanField,
  CONFORMITY: ConformityField,
  SINGLE_CHOICE: SingleChoiceField,
  DATE: DateField,
};

export function responseFieldFor(responseType: string): ComponentType<ResponseFieldProps> {
  return isKnownResponseType(responseType) ? RESPONSE_FIELDS[responseType] : UnsupportedField;
}

export type { ResponseFieldProps };
