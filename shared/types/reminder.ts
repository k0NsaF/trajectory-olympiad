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
  /** Planned email delivery time; sent by the server-side staging scheduler when configured. */
  notifyAt?: string
  timeZone?: string
  createdAt: string
}

export interface CreateReminderInput {
  title: string
  description?: string
  type: ReminderType
  dueAt: string
  notifyAt?: string | null
  timeZone?: string
}

export interface UpdateReminderInput {
  title?: string
  description?: string
  type?: ReminderType
  dueAt?: string
  notifyAt?: string | null
  timeZone?: string
}
