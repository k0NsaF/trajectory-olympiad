import { z } from 'zod'

export const universityIdSchema = z.object({
  id: z.string().uuid()
})

export const universityQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
})

const domainSchema = z.string()
  .trim()
  .min(3)
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i, 'Укажи домен без протокола и пути.')
  .optional()

export const universityDiscoverySchema = z.object({
  query: z.string().trim().min(3, 'Введи не менее трёх символов.').max(150),
  mode: z.enum(['universities', 'programs']).default('universities'),
  domain: domainSchema
}).superRefine((value, context) => {
  if (value.mode === 'programs' && !value.domain) {
    context.addIssue({
      code: 'custom',
      path: ['domain'],
      message: 'Для поиска программ нужен домен сайта выбранного университета.'
    })
  }
})

export type UniversityQuery = z.infer<typeof universityQuerySchema>
export type UniversityDiscoveryInput = z.infer<typeof universityDiscoverySchema>
