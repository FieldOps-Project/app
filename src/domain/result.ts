/**
 * Outcome of an operation that can fail in an expected way.
 *
 * Returning the failure in the type forces the caller to handle it to compile.
 * `throw` is reserved for programming defects and invalid configuration.
 */
export type Result<TValue, TError = DomainError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function fail<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

/** Failure categories the interface distinguishes when guiding the user. */
export type DomainErrorKind =
  'offline' | 'server' | 'unauthorized' | 'validation' | 'not-found' | 'unknown';

/**
 * Business failure described independently of platform.
 *
 * `message` is displayed to the user. Technical detail belongs in `cause` and
 * must never carry a password, token or file content.
 */
export interface DomainError {
  readonly kind: DomainErrorKind;
  readonly message: string;
  readonly cause?: unknown;
}

export function domainError(kind: DomainErrorKind, message: string, cause?: unknown): DomainError {
  return { kind, message, cause };
}
