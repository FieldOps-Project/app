import { InspectionStateError } from '@/infrastructure/repositories/inspection-repository';

export function describeLocalFailure(error: Error): string {
  if (error instanceof InspectionStateError) {
    return error.message;
  }
  return 'Não foi possível gravar no aparelho. Tente novamente.';
}
