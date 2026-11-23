import { z } from 'zod'

const reminderTypeSchema = z.enum([
  'registration_deadline',
  'stage_start',
  'stage_end',
  'personal'
])

export const createReminderSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  type: reminderTypeSchema,
  dueAt: z.string().datetime({ offset: true })
})

export const updateReminderSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  type: reminderTypeSchema.optional(),
  dueAt: z.string().datetime({ offset: true }).optional()
}).refine(
  (value) => Object.values(value).some((item) => item !== undefined),
  { message: 'Укажи хотя бы одно поле для обновления.' }
)

export const updateReminderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'completed',
    'dismissed'
  ])
})

export const reminderIdSchema = z.object({
  id: z.string().uuid()
})

export type CreateReminderInput = z.infer<
  typeof createReminderSchema
>

export type UpdateReminderInput = z.infer<
  typeof updateReminderSchema
>

export type UpdateReminderStatusInput = z.infer<
  typeof updateReminderStatusSchema
>
