
import type {
  CreateReminderInput,
  Reminder,
  ReminderStatus
} from '@trajectory/shared'

import { api } from '@/services/api'

export const reminderService = {
  getAll(): Promise<Reminder[]> {
    return api.get<Reminder[]>('/api/reminders')
  },

  create(input: CreateReminderInput): Promise<Reminder> {
    return api.post<Reminder, CreateReminderInput>(
      '/api/reminders',
      input
    )
  },

  updateStatus(
    id: string,
    status: ReminderStatus
  ): Promise<Reminder> {
    return api.patch<Reminder, { status: ReminderStatus }>(
      `/api/reminders/${encodeURIComponent(id)}/status`,
      { status }
    )
  },

  delete(id: string): Promise<void> {
    return api.delete<void>(
      `/api/reminders/${encodeURIComponent(id)}`
    )
  }
}
