import { z } from 'zod'

export const benefitCompareSchema = z.object({
  universityId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  olympiadId: z.string().uuid().optional(),
  validYear: z.coerce.number().int().min(2020).max(2200).optional(),
  verificationStatus: z
    .enum(['all', 'draft', 'official', 'archived'])
    .optional()
})

export type BenefitCompareFilters = z.infer<
  typeof benefitCompareSchema
>
