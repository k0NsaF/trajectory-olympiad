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

const subjectPreparationSchema = z.object({
  subjectId: z.enum(SUBJECT_IDS),
  preparationLevel: z.enum(['beginner', 'medium', 'advanced'])
}).strict()

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
  targetProgramId: z.string().uuid().optional(),

  weeklyStudyHours: z.number().int().min(1).max(40).optional(),
  targetAdmissionYear: z.number().int().min(2026).max(2100).optional(),
  targetEducationLevel: z.enum(['bachelor', 'specialist', 'master', 'basic_higher', 'specialized_higher']).optional(),

  subjectPreparation: z.array(subjectPreparationSchema).max(10)
    .refine(
      (items) => new Set(items.map((item) => item.subjectId)).size === items.length,
      'Уровень подготовки для предмета должен быть указан один раз.'
    )
    .optional(),

  alternativeUniversityIds: z.array(z.string().uuid()).max(3)
    .refine(
      (items) => new Set(items).size === items.length,
      'Альтернативные университеты не должны повторяться.'
    )
    .optional()
}).superRefine((value, context) => {
  if (value.targetProgramId && !value.targetUniversityId) {
    context.addIssue({
      code: 'custom',
      path: ['targetUniversityId'],
      message: 'Для выбора программы необходимо указать университет.'
    })
  }

  if (
    value.targetUniversityId &&
    value.alternativeUniversityIds?.includes(value.targetUniversityId)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['alternativeUniversityIds'],
      message: 'Основной университет не может одновременно быть альтернативным.'
    })
  }

  for (const preparation of value.subjectPreparation ?? []) {
    if (!value.subjects.includes(preparation.subjectId)) {
      context.addIssue({
        code: 'custom',
        path: ['subjectPreparation'],
        message: 'Уровень подготовки можно задать только для выбранного предмета.'
      })
      break
    }
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