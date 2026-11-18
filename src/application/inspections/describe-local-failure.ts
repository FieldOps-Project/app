import { InspectionStateError } from '@/infrastructure/repositories/inspection-repository';
import { NonConformityItemError } from '@/infrastructure/repositories/non-conformity-repository';

export function describeLocalFailure(error: Error): string {
  if (error instanceof InspectionStateError || error instanceof NonConformityItemError) {
    return error.message;
  }
  return 'Não foi possível gravar no aparelho. Tente novamente.';
}
