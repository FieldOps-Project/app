import type { ApiFieldError } from '@/infrastructure/api/api-error';

/** A single field-level validation error, as returned by the API (12.2). */
export type FieldError = ApiFieldError;

/**
 * Every way an API call can fail, in the vocabulary the rest of the app
 * consumes. A screen maps a `kind` to an action — retry, re-authenticate, show
 * the field errors — never to a stack trace or a raw HTTP status.
 *
 * `network` carries no detail on purpose: on an offline-first app the absence
 * of a connection is a normal operating state, shown as offline mode, never as
 * an error (document 13.8). It is the one failure `describeApiFailure` refuses
 * to turn into a message.
 */
export type ApiFailure =
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'conflict'; code: string }
  | { kind: 'business'; code: string; message: string; fieldErrors?: FieldError[] }
  | { kind: 'server' };

/** A failure that is shown to the user — every kind except the silent `network`. */
export type PresentableApiFailure = Exclude<ApiFailure, { kind: 'network' }>;

/**
 * True when the failure is the routine loss of connectivity rather than an
 * error. Callers check this first and render offline mode; only then is the
 * remaining failure narrow enough to describe.
 */
export function isNetworkFailure(failure: ApiFailure): failure is { kind: 'network' } {
  return failure.kind === 'network';
}

/**
 * Business-language copy for a failure that must be surfaced.
 *
 * `network` is intentionally not accepted: the type forces the caller to rule
 * it out with `isNetworkFailure` before asking for a message, so a "no
 * connection" state can never leak into an error banner. A `business` failure
 * carries the server's own wording, which the API guarantees is safe to show.
 */
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
