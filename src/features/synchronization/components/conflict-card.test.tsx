import type { ConflictingRecord } from '@/infrastructure/repositories/conflict-repository';
import { ConflictCard } from '@/features/synchronization/components/conflict-card';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockConflicts: { current: ConflictingRecord[] | undefined } = { current: undefined };

jest.mock('@/application/inspections/use-inspections', () => ({
  useInspectionConflicts: () => ({ data: mockConflicts.current }),
}));

const BLANK = {
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  conformity: null,
  observation: null,
};

function record(overrides: Partial<ConflictingRecord> = {}): ConflictingRecord {
  return {
    operationId: 'op-1',
    entityType: 'RESPONSE',
    itemTitle: 'Proteção lateral',
    message: null,
    local: { ...BLANK, conformity: 'CONFORMING', observation: 'Revisada.' },
    server: { ...BLANK, conformity: 'NON_CONFORMING', observation: 'Trinca.' },
    ...overrides,
  };
}

function shown(conflicts: ConflictingRecord[] | undefined): string {
  mockConflicts.current = conflicts;
  return renderedText(render(<ConflictCard inspectionId="insp-1" />));
}

describe('ConflictCard (card #28)', () => {
  it('shows nothing when there is no conflict', () => {
    expect(shown([])).toBe('');
    expect(shown(undefined)).toBe('');
  });

  it('puts the value on the device next to the value on the server', () => {
    const text = shown([record()]);

    expect(text).toContain('Proteção lateral');
    expect(text).toContain('Registrado neste aparelho');
    expect(text).toContain('Conforme — Observação: Revisada.');
    expect(text).toContain('Valor no servidor');
    expect(text).toContain('Não conforme — Observação: Trinca.');
  });

  it('says the device values were preserved and that the app cannot resolve it', () => {
    const text = shown([record()]);

    expect(text).toContain('foram preservados');
    expect(text).toContain('não resolve conflitos sozinho');
    expect(text).toContain('ação administrativa');
  });

  it('asks to synchronize when the server value was not fetched yet', () => {
    const text = shown([record({ server: null })]);

    expect(text).toContain('Conforme — Observação: Revisada.');
    expect(text).toContain('ainda não foi consultado');
    expect(text).not.toContain('Valor no servidor');
  });

  it('flags a server copy that reads the same but is another version', () => {
    const same = { ...BLANK, conformity: 'CONFORMING' as const, observation: 'Revisada.' };

    expect(shown([record({ server: same })])).toContain('igual, mas em outra versão');
  });

  it('shows only the reason for a record that is not an answer', () => {
    const text = shown([
      record({ itemTitle: null, local: null, server: null, message: 'A inspeção foi cancelada.' }),
    ]);

    expect(text).toContain('Registro da inspeção');
    expect(text).toContain('A inspeção foi cancelada.');
    expect(text).not.toContain('Registrado neste aparelho');
  });
});
