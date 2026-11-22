
import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type {
  CreateReminderInput,
  UpdateReminderStatusInput
} from './reminders.schema.js'

interface ReminderRow {
  id: string
  user_id: string
  title: string
  description: string | null
  type:
    | 'registration_deadline'
    | 'stage_start'
    | 'stage_end'
    | 'personal'
  status: 'pending' | 'completed' | 'dismissed'
  due_at: string
  created_at: string
}

export interface ReminderResult {
  id: string
  userId: string
  title: string
  description?: string
  type: ReminderRow['type']
  status: ReminderRow['status']
  dueAt: string
  createdAt: string
}

const REMINDER_FIELDS =
  'id, user_id, title, description, type, status, due_at, created_at'

function mapReminder(row: ReminderRow): ReminderResult {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    ...(row.description
      ? { description: row.description }
      : {}),
    type: row.type,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at
  }
}

export async function getReminders(
  supabase: SupabaseClient,
  userId: string
): Promise<ReminderResult[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_FIELDS)
    .eq('user_id', userId)
    .order('due_at', { ascending: true })

  if (error) {
    throw new AppError(
      'Не удалось загрузить напоминания.',
      500,
      'REMINDERS_LOAD_FAILED'
    )
  }

  return ((data ?? []) as unknown as ReminderRow[])
    .map(mapReminder)
}

export async function createReminder(
  supabase: SupabaseClient,
  userId: string,
  input: CreateReminderInput
): Promise<ReminderResult> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      due_at: input.dueAt
    })
    .select(REMINDER_FIELDS)
    .single()

  if (error || !data) {
    throw new AppError(
      'Не удалось создать напоминание.',
      500,
      'REMINDER_CREATE_FAILED'
    )
  }

  return mapReminder(data as unknown as ReminderRow)
}

export async function updateReminderStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateReminderStatusInput
): Promise<ReminderResult> {
  const { data, error } = await supabase
    .from('reminders')
    .update({
      status: input.status
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select(REMINDER_FIELDS)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'Не удалось обновить напоминание.',
      500,
      'REMINDER_UPDATE_FAILED'
    )
  }

  if (!data) {
    throw new AppError(
      'Напоминание не найдено.',
      404,
      'REMINDER_NOT_FOUND'
    )
  }

  return mapReminder(data as unknown as ReminderRow)
}

export async function deleteReminder(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new AppError(
      'Не удалось удалить напоминание.',
      500,
      'REMINDER_DELETE_FAILED'
    )
  }

  if (!data) {
    throw new AppError(
      'Напоминание не найдено.',
      404,
      'REMINDER_NOT_FOUND'
    )
  }
}
