import { z } from 'zod'

const reminderTypeSchema = z.enum([
  'registration_deadline',
  'stage_start',
  'stage_end',
  'personal'
])

const notificationTimeSchema = z.string().datetime({ offset: true }).nullable().optional()

export const createReminderSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  type: reminderTypeSchema,
  dueAt: z.string().datetime({ offset: true }),
  notifyAt: notificationTimeSchema
}).refine(
  (value) => !value.notifyAt || new Date(value.notifyAt).getTime() <= new Date(value.dueAt).getTime(),
  { path: ['notifyAt'], message: 'Время уведомления должно быть не позже времени события.' }
)

export const updateReminderSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  type: reminderTypeSchema.optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  notifyAt: notificationTimeSchema
}).refine(
  (value) => Object.values(value).some((item) => item !== undefined),
  { message: 'Укажи хотя бы одно поле для обновления.' }
).refine(
  (value) => !value.notifyAt || !value.dueAt || new Date(value.notifyAt).getTime() <= new Date(value.dueAt).getTime(),
  { path: ['notifyAt'], message: 'Время уведомления должно быть не позже времени события.' }
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

export type CreateReminderInput = z.infer<typeof createReminderSchema>
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusSchema>
