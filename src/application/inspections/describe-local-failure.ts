import { InspectionStateError } from '@/infrastructure/repositories/inspection-repository';
import {
  InspectionIncompleteError,
  InvalidResponseError,
  ItemNotCorrectableError,
} from '@/infrastructure/repositories/inspection-errors';
import { NON_CONFORMITY_ERRORS } from '@/infrastructure/repositories/non-conformity-errors';

const BUSINESS_ERRORS = [
  InspectionStateError,
  InspectionIncompleteError,
  InvalidResponseError,
  ItemNotCorrectableError,
  ...NON_CONFORMITY_ERRORS,
] as const;

export function describeLocalFailure(error: Error): string {
  if (BUSINESS_ERRORS.some((kind) => error instanceof kind)) {
    return error.message;
  }
  return 'Não foi possível gravar no aparelho. Tente novamente.';
}
