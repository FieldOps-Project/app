/**
 * Outcome of an operation that can fail in an expected way.
 *
 * Returning the failure in the type forces the caller to handle it to compile.
 * `throw` is reserved for programming defects and invalid configuration.
 *
 * The error channel is intentionally generic: each boundary declares its own
 * failure vocabulary — the API layer uses `ApiFailure` — so `src/domain` stays
 * free of any transport or platform concern (document 11.4).
 */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function fail<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
