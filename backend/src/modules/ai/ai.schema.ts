import { z } from 'zod'

const uuidSchema = z.string().uuid()

const subjectsSchema = z.array(z.string().trim().min(1).max(60)).max(10).optional()

export const aiAskSchema = z.object({
  question: z.string().trim().min(3, 'Напиши вопрос подробнее.').max(2000),
  context: z.object({
    grade: z.coerce.number().int().min(7).max(11).optional(),
    region: z.string().trim().min(2).max(120).optional(),
    subjects: subjectsSchema,
    targetUniversityId: uuidSchema.optional(),
    targetProgramId: uuidSchema.optional(),
    page: z.enum([
      'trajectory',
      'catalog',
      'olympiad',
      'calendar',
      'universities',
      'university',
      'profile',
      'general'
    ]).optional(),
    entityId: uuidSchema.optional()
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000)
  }).strict()).max(8).optional()
}).strict()

export type AIAskInput = z.infer<typeof aiAskSchema>
