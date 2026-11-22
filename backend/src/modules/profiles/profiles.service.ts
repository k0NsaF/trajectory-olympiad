import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type {
  SaveProfileInput,
  SaveProfilePreferencesInput
} from './profiles.schema.js'

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  grade: number | null
  region: string | null
  subjects: string[]
  target_university_id: string | null
  target_program_id: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  theme_preference: 'light' | 'dark' | 'system'
  notification_preferences: {
    registrationReminders?: boolean
    stageDeadlines?: boolean
    newsUpdates?: boolean
  } | null
}

interface ProfilePreferencesRow {
  theme_preference: 'light' | 'dark' | 'system'
  notification_preferences: {
    registrationReminders?: boolean
    stageDeadlines?: boolean
    newsUpdates?: boolean
  } | null
}

export interface ProfilePreferencesResult {
  themePreference: 'light' | 'dark' | 'system'
  notificationPreferences: {
    registrationReminders: boolean
    stageDeadlines: boolean
    newsUpdates: boolean
  }
}

export interface ProfileResult {
  id: string
  email?: string
  fullName?: string
  grade?: number
  region?: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
  preferences: ProfilePreferencesResult
}

const DEFAULT_PREFERENCES: ProfilePreferencesResult = {
  themePreference: 'system',
  notificationPreferences: {
    registrationReminders: true,
    stageDeadlines: true,
    newsUpdates: false
  }
}

const PROFILE_FIELDS =
  'id, email, full_name, grade, region, subjects, target_university_id, target_program_id, onboarding_completed, created_at, updated_at, theme_preference, notification_preferences'

function mapPreferences(row: ProfilePreferencesRow | null): ProfilePreferencesResult {
  const notifications = row?.notification_preferences ?? {}

  return {
    themePreference:
      row?.theme_preference === 'light' || row?.theme_preference === 'dark'
        ? row.theme_preference
        : 'system',
    notificationPreferences: {
      registrationReminders: typeof notifications.registrationReminders === 'boolean'
        ? notifications.registrationReminders
        : DEFAULT_PREFERENCES.notificationPreferences.registrationReminders,
      stageDeadlines: typeof notifications.stageDeadlines === 'boolean'
        ? notifications.stageDeadlines
        : DEFAULT_PREFERENCES.notificationPreferences.stageDeadlines,
      newsUpdates: typeof notifications.newsUpdates === 'boolean'
        ? notifications.newsUpdates
        : DEFAULT_PREFERENCES.notificationPreferences.newsUpdates
    }
  }
}

function mapProfile(row: ProfileRow): ProfileResult {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.full_name ? { fullName: row.full_name } : {}),
    ...(row.grade !== null ? { grade: row.grade } : {}),
    ...(row.region ? { region: row.region } : {}),
    subjects: row.subjects ?? [],
    ...(row.target_university_id ? { targetUniversityId: row.target_university_id } : {}),
    ...(row.target_program_id ? { targetProgramId: row.target_program_id } : {}),
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preferences: mapPreferences(row)
  }
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileResult | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'Не удалось загрузить профиль пользователя.',
      500,
      'PROFILE_LOAD_FAILED'
    )
  }

  if (!data) return null
  return mapProfile(data as unknown as ProfileRow)
}

export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  input: SaveProfileInput,
  email?: string,
  fullName?: string
): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        ...(email ? { email } : {}),
        ...(fullName ? { full_name: fullName } : {}),
        grade: input.grade,
        region: input.region,
        subjects: input.subjects,
        target_university_id: input.targetUniversityId ?? null,
        target_program_id: input.targetProgramId ?? null,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .select(PROFILE_FIELDS)
    .single()

  if (error || !data) {
    throw new AppError(
      'Не удалось сохранить профиль пользователя.',
      500,
      'PROFILE_SAVE_FAILED'
    )
  }

  return mapProfile(data as unknown as ProfileRow)
}

export async function getProfilePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfilePreferencesResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('theme_preference, notification_preferences')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'Не удалось загрузить настройки профиля.',
      500,
      'PROFILE_PREFERENCES_LOAD_FAILED'
    )
  }

  return mapPreferences(data as ProfilePreferencesRow | null)
}

export async function saveProfilePreferences(
  supabase: SupabaseClient,
  userId: string,
  input: SaveProfilePreferencesInput
): Promise<ProfilePreferencesResult> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        theme_preference: input.themePreference,
        notification_preferences: input.notificationPreferences,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .select('theme_preference, notification_preferences')
    .single()

  if (error || !data) {
    throw new AppError(
      'Не удалось сохранить настройки профиля.',
      500,
      'PROFILE_PREFERENCES_SAVE_FAILED'
    )
  }

  return mapPreferences(data as ProfilePreferencesRow)
}
