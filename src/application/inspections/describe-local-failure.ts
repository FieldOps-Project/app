import { InspectionStateError } from '@/infrastructure/repositories/inspection-repository';
import { NON_CONFORMITY_ERRORS } from '@/infrastructure/repositories/non-conformity-errors';

export function describeLocalFailure(error: Error): string {
  if (
    error instanceof InspectionStateError ||
    NON_CONFORMITY_ERRORS.some((kind) => error instanceof kind)
  ) {
    return error.message;
  }
  return 'Não foi possível gravar no aparelho. Tente novamente.';
}
