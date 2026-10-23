import { env } from '@/config/env';
import { demoMobileInspectionsGateway } from '@/infrastructure/api/demo/demo-mobile-inspections';
import { httpMobileInspectionsGateway } from '@/infrastructure/api/mobile-inspections-api';

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
export {
  login,
  logout,
  type AuthSession,
  type LoginCredentials,
} from '@/infrastructure/api/auth-api';
export { onSessionRejected } from '@/infrastructure/api/token-refresh';
export {
  type LocationPayload,
  type MobileInspectionsGateway,
  type ResponsePayload,
} from '@/infrastructure/api/mobile-inspections-api';

/**
 * The technician endpoints the app talks to. `EXPO_PUBLIC_DEMO_INSPECTIONS`
 * swaps in the in-memory demo while backend#19–#21 are pending.
 */
export const mobileInspectionsGateway = env.demoInspections
  ? demoMobileInspectionsGateway
  : httpMobileInspectionsGateway;
