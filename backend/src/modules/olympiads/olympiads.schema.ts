import { z } from 'zod'

const uuidSchema = z.string().uuid()
const academicYearSchema = z.string()
  .regex(/^\d{4}-\d{4}$/, 'Учебный год должен быть указан в формате YYYY-YYYY')
  .refine((value) => {
    const [start, end] = value.split('-').map(Number)
    return end === start + 1 && start >= 2020 && end <= 2200
  }, 'Некорректный учебный год')

const calendarYearSchema = z.coerce.number().int().min(2020).max(2200)

export const olympiadDetailsQuerySchema = z.object({
  academicYear: academicYearSchema.optional(),
  calendarYear: calendarYearSchema.optional()
}).refine((value) => !(value.academicYear && value.calendarYear), {
  message: 'Выбери либо учебный год, либо календарный год'
})

export const olympiadFiltersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  subject: z.string().trim().min(1).max(60).optional(),
  subjects: z.string().trim().max(500).transform((value) =>
    [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
  ).optional(),
  grade: z.coerce.number().int().min(7).max(11).optional(),
  level: z.coerce.number().int().min(1).max(4).optional(),
  listType: z.enum(['school_olympiad', 'intellectual_competition']).optional(),
  status: z.enum(['eligible', 'upcoming', 'closed', 'unknown']).optional(),
  format: z.enum(['online', 'offline', 'mixed']).optional(),
  region: z.string().trim().min(2).max(120).optional(),
  hasBenefits: z.enum(['true', 'false']).transform((value) =>
    value === 'true'
  ).optional(),
  universityId: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  benefitYear: z.coerce.number().int().min(2020).max(2200).optional(),
  academicYear: academicYearSchema.optional(),
  calendarYear: calendarYearSchema.optional()
}).refine((value) => !(value.academicYear && value.calendarYear), {
  message: 'Выбери либо учебный год, либо календарный год'
})

export const olympiadIdSchema = z.object({
  id: z.string().uuid()
})

export type OlympiadFiltersInput = z.infer<
  typeof olympiadFiltersSchema
>
