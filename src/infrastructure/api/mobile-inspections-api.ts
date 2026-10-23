import { fail, ok, type Result } from '@/domain/result';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import { request } from '@/infrastructure/api/http-client';
import {
  mobileInspectionListSchema,
  mobileInspectionSchema,
  type MobileInspection,
  type MobileInspectionEntry,
} from '@/schemas/mobile-inspection';

export const MOBILE_INSPECTIONS_PATH = '/api/v1/mobile/inspections';

/** Safety net against a server that never reports the last page. */
const MAX_PAGES = 50;

export interface LocationPayload {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number | null;
  readonly capturedAt: string;
}

export interface StartPayload {
  readonly startedAtDevice: string;
  readonly location: LocationPayload | null;
}

export interface SubmitPayload {
  readonly completedAtDevice: string;
  readonly location: LocationPayload | null;
}

export interface ResponsePayload {
  readonly id: string;
  readonly inspectionItemId: string;
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly conformity: string | null;
  readonly observation: string | null;
  readonly answeredAtDevice: string;
  readonly baseVersion: number;
}

/**
 * The technician's side of the inspection API (backend#19, #20, #21). The
 * server scopes everything to the token's user (RN-004): nothing here sends a
 * technician id.
 */
export interface MobileInspectionsGateway {
  list(): Promise<Result<readonly MobileInspectionEntry[], ApiFailure>>;
  detail(inspectionId: string): Promise<Result<MobileInspection, ApiFailure>>;
  start(inspectionId: string, payload: StartPayload): Promise<Result<void, ApiFailure>>;
  submit(inspectionId: string, payload: SubmitPayload): Promise<Result<void, ApiFailure>>;
  putResponse(inspectionId: string, payload: ResponsePayload): Promise<Result<void, ApiFailure>>;
}

/** A body that does not match the contract is a server fault, never a crash. */
function parseWith<TOutput>(
  schema: { safeParse: (data: unknown) => { success: true; data: TOutput } | { success: false } },
  data: unknown
): Result<TOutput, ApiFailure> {
  const parsed = schema.safeParse(data);
  return parsed.success ? ok(parsed.data) : fail({ kind: 'server' });
}

export const httpMobileInspectionsGateway: MobileInspectionsGateway = {
  async list() {
    const entries: MobileInspectionEntry[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await request<unknown>({ path: MOBILE_INSPECTIONS_PATH, params: { page } });
      if (!result.ok) {
        return result;
      }
      const parsed = parseWith(mobileInspectionListSchema, result.value);
      if (!parsed.ok) {
        return parsed;
      }
      entries.push(...parsed.value.content);
      if (parsed.value.last) {
        break;
      }
    }

    return ok(entries);
  },

  async detail(inspectionId) {
    const result = await request<unknown>({
      path: `${MOBILE_INSPECTIONS_PATH}/${encodeURIComponent(inspectionId)}`,
    });
    return result.ok ? parseWith(mobileInspectionSchema, result.value) : result;
  },

  start(inspectionId, payload) {
    return request<void>({
      method: 'POST',
      path: `/api/v1/inspections/${encodeURIComponent(inspectionId)}/start`,
      data: payload,
    });
  },

  submit(inspectionId, payload) {
    return request<void>({
      method: 'POST',
      path: `/api/v1/inspections/${encodeURIComponent(inspectionId)}/submit`,
      data: payload,
    });
  },

  putResponse(inspectionId, payload) {
    return request<void>({
      method: 'PUT',
      path: `/api/v1/inspections/${encodeURIComponent(inspectionId)}/responses/${encodeURIComponent(payload.id)}`,
      data: payload,
    });
  },
};
