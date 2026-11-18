import type { ApiFieldError } from '@/infrastructure/api/api-error';

export type FieldError = ApiFieldError;

export type ApiFailure =
  | { kind: 'network' }
  | { kind: 'unauthorized'; inactive?: true }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'conflict'; code: string }
  | { kind: 'business'; code: string; message: string; fieldErrors?: FieldError[] }
  | { kind: 'server' };

export type PresentableApiFailure = Exclude<ApiFailure, { kind: 'network' }>;

export function isNetworkFailure(failure: ApiFailure): failure is { kind: 'network' } {
  return failure.kind === 'network';
}

const GENERIC_BUSINESS_MESSAGE =
  'O servidor recusou este registro. Se o problema persistir, fale com o supervisor.';

const BUSINESS_MESSAGES: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: 'Alguma informação enviada não é válida. Revise e tente novamente.',
  INVALID_REQUEST: 'Alguma informação enviada não é válida. Revise e tente novamente.',
  INVALID_COORDINATES: 'A localização registrada não é válida.',
  INVALID_QR_CODE: 'O código lido não é um QR Code de equipamento válido.',
  INSPECTION_ALREADY_SUBMITTED: 'Esta inspeção já foi concluída no servidor.',
  INSPECTION_CANCELED: 'Esta inspeção foi cancelada e não aceita mais registros.',
  INSPECTION_INVALID_TRANSITION: 'O servidor não aceita esta etapa no estado atual da inspeção.',
  INSPECTION_REQUIRED_ITEMS_MISSING:
    'Há itens obrigatórios sem resposta. Volte ao checklist e complete as pendências.',
  TECHNICIAN_NOT_ELIGIBLE: 'Você não pode executar esta inspeção.',
  LOCAL_OPERATION_INVALID: 'Um registro deste aparelho está inválido e não pôde ser enviado.',
};

export function describeBusinessFailure(code: string): string {
  return BUSINESS_MESSAGES[code] ?? GENERIC_BUSINESS_MESSAGE;
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
      return describeBusinessFailure(failure.code);
    case 'server':
      return 'O servidor está com problemas no momento. Tente novamente em instantes.';
  }
}
