/**
 * Outcome of an operation that can fail in an expected way.
 *
 * Returning the failure in the type forces the caller to handle it to compile.
 * `throw` is reserved for programming defects and invalid configuration.
 */
export type Result<TValue, TError = DomainError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

/** Builds a successful `Result`. */
export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

/** Builds a failed `Result`. */
export function fail<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

/**
 * Failure categories the interface distinguishes when guiding the user.
 *
 * - `offline`: no connectivity or unreachable server; the operation can be retried later.
 * - `server`: the server responded with an error the app cannot recover from.
 * - `unauthorized`: missing or expired session, or no permission for the action.
 * - `validation`: the data sent does not satisfy the business rule or API contract.
 * - `not-found`: the requested resource does not exist.
 * - `unknown`: unclassified failure.
 */
export type DomainErrorKind =
  'offline' | 'server' | 'unauthorized' | 'validation' | 'not-found' | 'unknown';

/**
 * Business failure described independently of platform.
 *
 * `message` is written to be displayed to the user. Technical detail belongs in
 * `cause` and must never carry a password, token or file content.
 */
export interface DomainError {
  readonly kind: DomainErrorKind;
  readonly message: string;
  readonly cause?: unknown;
}

/** Builds a `DomainError`. */
export function domainError(kind: DomainErrorKind, message: string, cause?: unknown): DomainError {
  return { kind, message, cause };
}
