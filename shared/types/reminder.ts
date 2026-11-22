
export type ReminderType =
  | 'registration_deadline'
  | 'stage_start'
  | 'stage_end'
  | 'personal'

export type ReminderStatus =
  | 'pending'
  | 'completed'
  | 'dismissed'

export interface Reminder {
  id: string
  userId: string
  title: string
  description?: string
  type: ReminderType
  status: ReminderStatus
  dueAt: string
  createdAt: string
}

export interface CreateReminderInput {
  title: string
  description?: string
  type: ReminderType
  dueAt: string
}
