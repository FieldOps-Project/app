import { z } from 'zod';

/**
 * The canonical error envelope every endpoint returns on failure.
 *
 * Mirrors the contract fixed in document 12.2 and the backend `ApiError`
 * record: a machine-readable `code`, a human `message` and optional per-field
 * errors, wrapped with tracing metadata.
 *
 * This file is hand-authored on purpose. Until the API publishes its OpenAPI
 * document (backend#3) there is no schema to generate from, so this envelope is
 * the interim source of truth. See `generated/README.md`: once
 * `npm run types:api` produces the real types, this shape must be reconciled
 * against them.
 */
const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

const apiErrorSchema = z.object({
  timestamp: z.string().optional(),
  status: z.number().optional(),
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  requestId: z.string().optional(),
  fieldErrors: z.array(fieldErrorSchema).optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type ApiFieldError = z.infer<typeof fieldErrorSchema>;

/**
 * Parses an error payload into the canonical envelope without ever throwing.
 *
 * A malformed or absent body — a proxy timeout page, an empty 502, an HTML
 * error from a misconfigured gateway — is expected in the field, so a parse
 * miss is a normal `null` the caller handles, not an exception.
 */
export function parseApiErrorBody(data: unknown): ApiErrorBody | null {
  const parsed = apiErrorSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
