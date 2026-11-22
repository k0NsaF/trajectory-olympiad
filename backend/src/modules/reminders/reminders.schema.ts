
import { z } from 'zod'

export const createReminderSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  type: z.enum([
    'registration_deadline',
    'stage_start',
    'stage_end',
    'personal'
  ]),
  dueAt: z.string().datetime({ offset: true })
})

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

export type UpdateReminderStatusInput = z.infer<
  typeof updateReminderStatusSchema
>
