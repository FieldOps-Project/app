import { NON_CONFORMITY_DESCRIPTION_MAX, NON_CONFORMITY_TITLE_MAX } from '@/domain/non-conformity';
import { nonConformityFormSchema } from '@/schemas/non-conformity';

const VALID = { title: 'Trinca', description: 'Trinca de 5 cm.', severity: 'HIGH' as const };

function messages(input: unknown): string[] {
  const result = nonConformityFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('nonConformityFormSchema', () => {
  it('accepts a complete registration and trims the text', () => {
    const result = nonConformityFormSchema.parse({
      ...VALID,
      title: '  Trinca  ',
      description: ' Trinca de 5 cm. ',
    });

    expect(result).toEqual({
      title: 'Trinca',
      description: 'Trinca de 5 cm.',
      severity: 'HIGH',
    });
  });

  it.each([
    ['title', { ...VALID, title: '   ' }, 'Informe o título.'],
    ['description', { ...VALID, description: '' }, 'Descreva o que foi encontrado.'],
    ['severity', { ...VALID, severity: null }, 'Escolha a criticidade.'],
  ])('requires the %s', (_field, input, message) => {
    expect(messages(input)).toEqual([message]);
  });

  it('refuses a severity outside the four levels (RN-054)', () => {
    expect(messages({ ...VALID, severity: 'URGENT' })).not.toEqual([]);
  });

  it('refuses text above the limits', () => {
    expect(messages({ ...VALID, title: 'a'.repeat(NON_CONFORMITY_TITLE_MAX + 1) })).toEqual([
      `Use até ${NON_CONFORMITY_TITLE_MAX} caracteres.`,
    ]);
    expect(
      messages({ ...VALID, description: 'a'.repeat(NON_CONFORMITY_DESCRIPTION_MAX + 1) })
    ).toEqual([`Use até ${NON_CONFORMITY_DESCRIPTION_MAX} caracteres.`]);
  });
});
