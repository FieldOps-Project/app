import { z } from 'zod';

/**
 * Wire format of `GET /api/v1/mobile/inspections/{id}` (backend#19, document
 * 12.10). The aggregate travels in one response because the device can lose
 * the connection between calls.
 *
 * Parsing is strict on what the app cannot work without (ids, status, the
 * snapshot's order) and lenient on the rest: optional text comes as `null`,
 * and `responseType` stays an open string so a type published by a newer
 * panel reaches the checklist as an "unsupported item", not as a rejected
 * payload that hides the whole inspection (document 13.5).
 */
const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

const nullableNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

export const inspectionStatusSchema = z.enum([
  'DRAFT',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELED',
]);

export const inspectionPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const conformitySchema = z.enum(['CONFORMING', 'NON_CONFORMING', 'NOT_APPLICABLE']);

const itemRulesSchema = z
  .object({
    observationRequiredOnFailure: z.boolean().optional(),
    evidenceRequiredOnFailure: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .nullish()
  .transform((rules) => ({
    observationRequiredOnFailure: rules?.observationRequiredOnFailure ?? false,
    evidenceRequiredOnFailure: rules?.evidenceRequiredOnFailure ?? false,
    min: rules?.min ?? null,
    max: rules?.max ?? null,
  }));

const checklistItemSchema = z.object({
  id: z.string().min(1),
  sectionTitle: z.string(),
  sectionDescription: nullableText,
  sectionOrder: z.number().int(),
  itemCode: nullableText,
  itemTitle: z.string(),
  itemDescription: nullableText,
  responseType: z.string(),
  required: z.boolean(),
  rules: itemRulesSchema,
  options: z
    .array(z.string())
    .nullish()
    .transform((options) => options ?? []),
  itemOrder: z.number().int(),
});

const checklistResponseSchema = z.object({
  id: z.string().min(1),
  inspectionItemId: z.string().min(1),
  valueText: nullableText,
  valueNumber: nullableNumber,
  valueBoolean: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  valueDate: nullableText,
  conformity: conformitySchema.nullish().transform((value) => value ?? null),
  observation: nullableText,
  answeredAtDevice: z.string(),
});

const reviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: nullableText,
    itemsToCorrect: z
      .array(z.string())
      .nullish()
      .transform((items) => items ?? []),
  })
  .nullish()
  .transform((review) => review ?? null);

export const mobileInspectionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: inspectionStatusSchema,
  priority: inspectionPrioritySchema,
  scheduledFor: z.string(),
  instructions: nullableText,
  version: z.number().int(),
  updatedAt: nullableText,
  startedAtDevice: nullableText,
  completedAtDevice: nullableText,
  client: z.object({ id: z.string(), name: z.string() }),
  site: z.object({
    id: z.string(),
    name: z.string(),
    addressLine: nullableText,
    latitude: nullableNumber,
    longitude: nullableNumber,
  }),
  equipment: z
    .object({
      id: z.string(),
      name: z.string(),
      qrCode: nullableText,
      assetNumber: nullableText,
      serialNumber: nullableText,
    })
    .nullish()
    .transform((equipment) => equipment ?? null),
  items: z.array(checklistItemSchema),
  responses: z
    .array(checklistResponseSchema)
    .nullish()
    .transform((responses) => responses ?? []),
  review: reviewSchema,
});

export type MobileInspection = z.infer<typeof mobileInspectionSchema>;

/**
 * One entry of `GET /api/v1/mobile/inspections`. Only the id is required: the
 * list is a table of contents, and the full aggregate comes from the detail.
 */
const mobileInspectionEntrySchema = z.object({
  id: z.string().min(1),
  updatedAt: nullableText,
});

export type MobileInspectionEntry = z.infer<typeof mobileInspectionEntrySchema>;

/**
 * The list answers either a bare array or a Spring page (`content` + `last`);
 * the contract is still settling (backend#19), and both shapes are accepted.
 */
export const mobileInspectionListSchema = z.union([
  z.array(mobileInspectionEntrySchema).transform((content) => ({ content, last: true })),
  z.object({
    content: z.array(mobileInspectionEntrySchema),
    last: z.boolean().optional().default(true),
  }),
]);
