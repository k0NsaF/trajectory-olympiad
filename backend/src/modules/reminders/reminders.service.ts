import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type {
  CreateReminderInput,
  UpdateReminderInput,
  UpdateReminderStatusInput
} from './reminders.schema.js'

interface ReminderRow {
  id: string
  user_id: string
  title: string
  description: string | null
  type: 'registration_deadline' | 'stage_start' | 'stage_end' | 'personal'
  status: 'pending' | 'completed' | 'dismissed'
  due_at: string
  notify_at?: string | null
  time_zone?: string | null
  created_at: string
}

interface DbErrorLike {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export interface ReminderResult {
  id: string
  userId: string
  title: string
  description?: string
  type: ReminderRow['type']
  status: ReminderRow['status']
  dueAt: string
  notifyAt?: string
  timeZone?: string
  createdAt: string
}

const REMINDER_FIELDS =
  'id, user_id, title, description, type, status, due_at, notify_at, time_zone, created_at'
const LEGACY_REMINDER_FIELDS =
  'id, user_id, title, description, type, status, due_at, created_at'

function isMissingNotifyAtColumn(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (message.includes('notify_at') &&
      (message.includes('does not exist') || message.includes('not found') || message.includes('schema cache')))
  )
}

function migrationRequiredError(): AppError {
  return new AppError(
    'Чтобы сохранить время будущего уведомления, сначала примени локальную SQL-миграцию 202611240001_reminder_notify_at.sql в Supabase. Для доставки email требуется настроить серверный планировщик и почтовый провайдер.',
    409,
    'REMINDER_NOTIFY_AT_MIGRATION_REQUIRED'
  )
}

function mapReminder(row: ReminderRow): ReminderResult {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    type: row.type,
    status: row.status,
    dueAt: row.due_at,
    ...(row.notify_at ? { notifyAt: row.notify_at } : {}),
    ...(row.time_zone ? { timeZone: row.time_zone } : {}),
    createdAt: row.created_at
  }
}

export async function getReminders(
  supabase: SupabaseClient,
  userId: string
): Promise<ReminderResult[]> {
  const primary = await supabase
    .from('reminders')
    .select(REMINDER_FIELDS)
    .eq('user_id', userId)
    .order('due_at', { ascending: true })

  if (primary.error && isMissingNotifyAtColumn(primary.error)) {
    const legacy = await supabase
      .from('reminders')
      .select(LEGACY_REMINDER_FIELDS)
      .eq('user_id', userId)
      .order('due_at', { ascending: true })

    if (legacy.error) {
      throw new AppError('Не удалось загрузить напоминания.', 500, 'REMINDERS_LOAD_FAILED')
    }
    return ((legacy.data ?? []) as unknown as ReminderRow[]).map(mapReminder)
  }

  if (primary.error) {
    throw new AppError('Не удалось загрузить напоминания.', 500, 'REMINDERS_LOAD_FAILED')
  }

  return ((primary.data ?? []) as unknown as ReminderRow[]).map(mapReminder)
}

export async function createReminder(
  supabase: SupabaseClient,
  userId: string,
  input: CreateReminderInput
): Promise<ReminderResult> {
  const values = {
    user_id: userId,
    title: input.title,
    description: input.description?.trim() || null,
    type: input.type,
    due_at: input.dueAt,
    notify_at: input.notifyAt ?? null,
    time_zone: input.timeZone ?? null
  }

  const primary = await supabase
    .from('reminders')
    .insert(values)
    .select(REMINDER_FIELDS)
    .single()

  if (primary.error && isMissingNotifyAtColumn(primary.error)) {
    if (input.notifyAt) throw migrationRequiredError()

    const legacy = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description?.trim() || null,
        type: input.type,
        due_at: input.dueAt
      })
      .select(LEGACY_REMINDER_FIELDS)
      .single()

    if (legacy.error || !legacy.data) {
      throw new AppError('Не удалось создать напоминание.', 500, 'REMINDER_CREATE_FAILED')
    }
    return mapReminder(legacy.data as unknown as ReminderRow)
  }

  if (primary.error || !primary.data) {
    throw new AppError('Не удалось создать напоминание.', 500, 'REMINDER_CREATE_FAILED')
  }

  return mapReminder(primary.data as unknown as ReminderRow)
}

export async function updateReminder(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateReminderInput
): Promise<ReminderResult> {
  const updates: {
    title?: string
    description?: string | null
    type?: CreateReminderInput['type']
    due_at?: string
    notify_at?: string | null
    time_zone?: string | null
  } = {}

  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description.trim() || null
  if (input.type !== undefined) updates.type = input.type
  if (input.dueAt !== undefined) updates.due_at = input.dueAt
  if (input.notifyAt !== undefined) updates.notify_at = input.notifyAt
  if (input.timeZone !== undefined) updates.time_zone = input.timeZone

  const primary = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(REMINDER_FIELDS)
    .maybeSingle()

  if (primary.error && isMissingNotifyAtColumn(primary.error)) {
    if (input.notifyAt) throw migrationRequiredError()
    delete updates.notify_at
    const legacy = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(LEGACY_REMINDER_FIELDS)
      .maybeSingle()

    if (legacy.error) {
      throw new AppError('Не удалось изменить напоминание.', 500, 'REMINDER_EDIT_FAILED')
    }
    if (!legacy.data) {
      throw new AppError('Напоминание не найдено.', 404, 'REMINDER_NOT_FOUND')
    }
    return mapReminder(legacy.data as unknown as ReminderRow)
  }

  if (primary.error) {
    throw new AppError('Не удалось изменить напоминание.', 500, 'REMINDER_EDIT_FAILED')
  }
  if (!primary.data) {
    throw new AppError('Напоминание не найдено.', 404, 'REMINDER_NOT_FOUND')
  }

  return mapReminder(primary.data as unknown as ReminderRow)
}

export async function updateReminderStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: UpdateReminderStatusInput
): Promise<ReminderResult> {
  const primary = await supabase
    .from('reminders')
    .update({ status: input.status })
    .eq('id', id)
    .eq('user_id', userId)
    .select(REMINDER_FIELDS)
    .maybeSingle()

  if (primary.error && isMissingNotifyAtColumn(primary.error)) {
    const legacy = await supabase
      .from('reminders')
      .update({ status: input.status })
      .eq('id', id)
      .eq('user_id', userId)
      .select(LEGACY_REMINDER_FIELDS)
      .maybeSingle()

    if (legacy.error) {
      throw new AppError('Не удалось обновить напоминание.', 500, 'REMINDER_UPDATE_FAILED')
    }
    if (!legacy.data) {
      throw new AppError('Напоминание не найдено.', 404, 'REMINDER_NOT_FOUND')
    }
    return mapReminder(legacy.data as unknown as ReminderRow)
  }

  if (primary.error) {
    throw new AppError('Не удалось обновить напоминание.', 500, 'REMINDER_UPDATE_FAILED')
  }
  if (!primary.data) {
    throw new AppError('Напоминание не найдено.', 404, 'REMINDER_NOT_FOUND')
  }

  return mapReminder(primary.data as unknown as ReminderRow)
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
    throw new AppError('Не удалось удалить напоминание.', 500, 'REMINDER_DELETE_FAILED')
  }
  if (!data) {
    throw new AppError('Напоминание не найдено.', 404, 'REMINDER_NOT_FOUND')
  }
}
