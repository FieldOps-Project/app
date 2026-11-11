import { z } from 'zod';

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

const fieldPositionSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: nullableNumber,
    capturedAt: z.string(),
  })
  .nullish()
  .catch(null)
  .transform((position) => position ?? null);

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
  startLocation: fieldPositionSchema,
  completionLocation: fieldPositionSchema,
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

const mobileInspectionEntrySchema = z.object({
  id: z.string().min(1),
  updatedAt: nullableText,
});

export type MobileInspectionEntry = z.infer<typeof mobileInspectionEntrySchema>;

export const mobileInspectionListSchema = z.union([
  z.array(mobileInspectionEntrySchema).transform((content) => ({ content, last: true })),
  z.object({
    content: z.array(mobileInspectionEntrySchema),
    last: z.boolean().optional().default(true),
  }),
]);
