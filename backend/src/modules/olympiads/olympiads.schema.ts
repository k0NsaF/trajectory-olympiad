import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const olympiadFiltersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  subject: z.string().trim().min(1).max(60).optional(),
  subjects: z.string().trim().max(500).transform((value) =>
    [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
  ).optional(),
  grade: z.coerce.number().int().min(7).max(11).optional(),
  level: z.coerce.number().int().min(1).max(4).optional(),
  status: z.enum(['eligible', 'upcoming', 'closed', 'unknown']).optional(),
  format: z.enum(['online', 'offline', 'mixed']).optional(),
  region: z.string().trim().min(2).max(120).optional(),
  hasBenefits: z.enum(['true', 'false']).transform((value) =>
    value === 'true'
  ).optional(),
  universityId: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  benefitYear: z.coerce.number().int().min(2020).max(2200).optional()
})

export const olympiadIdSchema = z.object({
  id: z.string().uuid()
})

export type OlympiadFiltersInput = z.infer<
  typeof olympiadFiltersSchema
>
