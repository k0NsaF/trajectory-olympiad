import { z } from 'zod'

const SUBJECT_IDS = [
  'mathematics',
  'informatics',
  'physics',
  'biology',
  'chemistry',
  'economics',
  'russian',
  'history',
  'social_studies',
  'foreign_language'
] as const

export const createTrajectorySchema = z.object({
  grade: z.coerce.number().int().min(7).max(11),
  region: z.string().trim().min(2).max(120),
  subjects: z
    .array(z.enum(SUBJECT_IDS))
    .min(1)
    .max(10)
    .refine(
      (subjects) => new Set(subjects).size === subjects.length,
      'Один и тот же предмет нельзя выбрать несколько раз.'
    ),
  targetUniversityId: z.string().uuid().optional(),
  targetProgramId: z.string().uuid().optional()
}).superRefine((value, context) => {
  if (value.targetProgramId && !value.targetUniversityId) {
    context.addIssue({
      code: 'custom',
      path: ['targetUniversityId'],
      message: 'Для выбора программы необходимо указать университет.'
    })
  }
})

export type CreateTrajectoryInput = z.infer<
  typeof createTrajectorySchema
>
