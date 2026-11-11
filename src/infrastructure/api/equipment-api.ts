import { z } from 'zod';

import { fail, ok, type Result } from '@/domain/result';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import { request } from '@/infrastructure/api/http-client';

function equipmentByQrPath(qrCode: string): string {
  return `/api/v1/equipment/by-qr/${encodeURIComponent(qrCode)}`;
}

const equipmentLookupSchema = z.object({ id: z.string().min(1) });

export interface EquipmentGateway {
  findIdByQrCode(qrCode: string): Promise<Result<string | null, ApiFailure>>;
}

export const httpEquipmentGateway: EquipmentGateway = {
  async findIdByQrCode(qrCode) {
    const result = await request<unknown>({ path: equipmentByQrPath(qrCode) });
    if (!result.ok) {
      return result.error.kind === 'notFound' ? ok(null) : result;
    }
    const parsed = equipmentLookupSchema.safeParse(result.value);
    return parsed.success ? ok(parsed.data.id) : fail({ kind: 'server' });
  },
};

export const demoEquipmentGateway: EquipmentGateway = {
  findIdByQrCode: async () => ok(null),
};
