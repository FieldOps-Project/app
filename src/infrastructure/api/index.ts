/**
 * Public surface of the API layer. Screens and hooks import from
 * `@/infrastructure/api` rather than reaching into individual files.
 */
export { httpClient, request, type HttpRequest } from '@/infrastructure/api/http-client';
export {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type FieldError,
  type PresentableApiFailure,
} from '@/infrastructure/api/api-failure';
export {
  parseApiErrorBody,
  type ApiErrorBody,
  type ApiFieldError,
} from '@/infrastructure/api/api-error';
export { queryKeys } from '@/infrastructure/api/query-keys';
