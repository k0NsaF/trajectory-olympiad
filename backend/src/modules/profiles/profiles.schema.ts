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

export const saveProfileSchema = z.object({
  grade: z.number().int().min(7).max(11),
  region: z.string().trim().min(2).max(120),
  subjects: z
    .array(z.enum(SUBJECT_IDS))
    .min(1)
    .max(10)
    .refine(
      (items) => new Set(items).size === items.length,
      'Предметы не должны повторяться.'
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

export const saveProfilePreferencesSchema = z.object({
  themePreference: z.enum(['light', 'dark', 'system']),
  notificationPreferences: z.object({
    registrationReminders: z.boolean(),
    stageDeadlines: z.boolean(),
    newsUpdates: z.boolean()
  }).strict()
}).strict()

export type SaveProfileInput = z.infer<typeof saveProfileSchema>
export type SaveProfilePreferencesInput = z.infer<typeof saveProfilePreferencesSchema>
