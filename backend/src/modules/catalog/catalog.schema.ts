import { z } from 'zod'

const educationLevelSchema = z.enum(['bachelor', 'specialist', 'master'])

export const catalogListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  level: educationLevelSchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12)
})

export const catalogSlugSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
})

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>
