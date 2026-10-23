import { InspectionStateError } from '@/infrastructure/repositories/inspection-repository';

/**
 * What a failed write on the device means to the technician (document 13.9).
 * A refused transition carries its own business message; anything else — a
 * storage fault — gets plain wording instead of the driver's technical text.
 */
export function describeLocalFailure(error: Error): string {
  if (error instanceof InspectionStateError) {
    return error.message;
  }
  return 'Não foi possível gravar no aparelho. Tente novamente.';
}
