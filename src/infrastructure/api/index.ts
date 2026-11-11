import { env } from '@/config/env';
import { demoMobileInspectionsGateway } from '@/infrastructure/api/demo/demo-mobile-inspections';
import { httpMobileInspectionsGateway } from '@/infrastructure/api/mobile-inspections-api';

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

export const mobileInspectionsGateway = env.demoInspections
  ? demoMobileInspectionsGateway
  : httpMobileInspectionsGateway;
