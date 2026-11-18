import { z } from 'zod';

import {
  NON_CONFORMITY_DESCRIPTION_MAX,
  NON_CONFORMITY_TITLE_MAX,
  SEVERITIES,
} from '@/domain/non-conformity';

export const nonConformityFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título.')
    .max(NON_CONFORMITY_TITLE_MAX, `Use até ${NON_CONFORMITY_TITLE_MAX} caracteres.`),
  description: z
    .string()
    .trim()
    .min(1, 'Descreva o que foi encontrado.')
    .max(NON_CONFORMITY_DESCRIPTION_MAX, `Use até ${NON_CONFORMITY_DESCRIPTION_MAX} caracteres.`),
  severity: z
    .enum(SEVERITIES)
    .nullable()
    .transform((value, context) => {
      if (value === null) {
        context.addIssue({ code: 'custom', message: 'Escolha a criticidade.' });
        return z.NEVER;
      }
      return value;
    }),
});

export type NonConformityFormInput = z.input<typeof nonConformityFormSchema>;

export type NonConformityFormOutput = z.infer<typeof nonConformityFormSchema>;

export const EMPTY_NON_CONFORMITY_FORM: NonConformityFormInput = {
  title: '',
  description: '',
  severity: null,
};
