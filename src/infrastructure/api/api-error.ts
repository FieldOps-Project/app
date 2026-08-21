/**
 * The canonical error envelope every endpoint returns on failure: a
 * machine-readable `code`, a human `message` and optional per-field errors
 * (document 12.2 and the backend `ApiError` record).
 *
 * Hand-authored on purpose. Until the API publishes its OpenAPI document
 * (backend#3) there is no schema to generate from, so this shape is the interim
 * source of truth and must be reconciled against the generated types once
 * `npm run types:api` can run. See `generated/README.md`.
 */
export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: ApiFieldError[];
}

/**
 * Reads an error payload into the canonical envelope, trusting the contract for
 * its shape and only guarding the `code`/`message` pair that drives the
 * business failure and its message. A body missing that pair — a proxy timeout
 * page, an empty 502, an HTML gateway error — is a normal `null` the caller
 * handles, never an exception.
 */
export function parseApiErrorBody(data: unknown): ApiErrorBody | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const body = data as Partial<ApiErrorBody>;
  if (typeof body.code !== 'string' || typeof body.message !== 'string') {
    return null;
  }

  return body as ApiErrorBody;
}
