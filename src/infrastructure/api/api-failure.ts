import type { ApiFieldError } from '@/infrastructure/api/api-error';

export type FieldError = ApiFieldError;

export type ApiFailure =
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'conflict'; code: string }
  | { kind: 'business'; code: string; message: string; fieldErrors?: FieldError[] }
  | { kind: 'server' };

export type PresentableApiFailure = Exclude<ApiFailure, { kind: 'network' }>;

export function isNetworkFailure(failure: ApiFailure): failure is { kind: 'network' } {
  return failure.kind === 'network';
}

export function describeApiFailure(failure: PresentableApiFailure): string {
  switch (failure.kind) {
    case 'unauthorized':
      return 'Sua sessão expirou. Entre novamente para continuar.';
    case 'forbidden':
      return 'Você não tem permissão para esta ação.';
    case 'notFound':
      return 'Não encontramos este registro no servidor.';
    case 'conflict':
      return 'Este registro mudou em outro lugar. Recarregue e tente novamente.';
    case 'business':
      return failure.message;
    case 'server':
      return 'O servidor está com problemas no momento. Tente novamente em instantes.';
  }
}
