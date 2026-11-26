import { z } from 'zod';

import { CONFORMITIES } from '@/domain/checklist';

export const pulledChangeSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  changeType: z.string(),
  version: z.number().int().min(0),
  payload: z.unknown(),
});

export const syncPullSchema = z.object({
  changes: z.array(pulledChangeSchema),
  nextCursor: z.string().nullable().default(null),
  hasMore: z.boolean(),
});

export const pulledResponseSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  inspectionItemId: z.string(),
  valueText: z.string().nullable().default(null),
  valueNumber: z.number().nullable().default(null),
  valueBoolean: z.boolean().nullable().default(null),
  valueDate: z.string().nullable().default(null),
  conformity: z.enum(CONFORMITIES).nullable().default(null),
  observation: z.string().nullable().default(null),
  answeredAtDevice: z.string(),
  version: z.number().int().min(0),
});

export type PulledChange = z.infer<typeof pulledChangeSchema>;
export type SyncPull = z.infer<typeof syncPullSchema>;
export type PulledResponse = z.infer<typeof pulledResponseSchema>;
export const RESPONSE_ENTITY = 'INSPECTION_RESPONSE';
