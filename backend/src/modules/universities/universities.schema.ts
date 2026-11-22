
import { z } from 'zod'

export const universityIdSchema = z.object({
  id: z.string().uuid()
})

export const universityQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional()
})

export type UniversityQuery = z.infer<
  typeof universityQuerySchema
>
