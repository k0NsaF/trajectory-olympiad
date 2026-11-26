import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import { createSupabaseServiceClient } from '../../config/supabase.js'
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
  weekly_study_hours: number | null
  target_admission_year: number | null
  target_education_level: 'bachelor' | 'specialist' | 'master' | null
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

interface SubjectPreparationRow {
  subject_id: string
  preparation_level: 'beginner' | 'medium' | 'advanced'
}

interface AlternativeUniversityRow {
  university_id: string
  priority: number
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
  weeklyStudyHours?: number
  targetAdmissionYear?: number
  targetEducationLevel?: 'bachelor' | 'specialist' | 'master'
  subjectPreparation: {
    subjectId: string
    preparationLevel: 'beginner' | 'medium' | 'advanced'
  }[]
  alternativeUniversityIds: string[]
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
  'id, email, full_name, grade, region, subjects, target_university_id, target_program_id, weekly_study_hours, target_admission_year, target_education_level, onboarding_completed, created_at, updated_at, theme_preference, notification_preferences'

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

function mapProfile(
  row: ProfileRow,
  preparationRows: SubjectPreparationRow[],
  alternativeRows: AlternativeUniversityRow[]
): ProfileResult {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.full_name ? { fullName: row.full_name } : {}),
    ...(row.grade !== null ? { grade: row.grade } : {}),
    ...(row.region ? { region: row.region } : {}),
    subjects: row.subjects ?? [],
    ...(row.target_university_id ? { targetUniversityId: row.target_university_id } : {}),
    ...(row.target_program_id ? { targetProgramId: row.target_program_id } : {}),
    ...(row.weekly_study_hours !== null ? { weeklyStudyHours: row.weekly_study_hours } : {}),
    ...(row.target_admission_year !== null
      ? { targetAdmissionYear: row.target_admission_year }
      : {}),
    ...(row.target_education_level
      ? { targetEducationLevel: row.target_education_level }
      : {}),
    subjectPreparation: preparationRows.map((item) => ({
      subjectId: item.subject_id,
      preparationLevel: item.preparation_level
    })),
    alternativeUniversityIds: [...alternativeRows]
      .sort((a, b) => a.priority - b.priority)
      .map((item) => item.university_id),
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

  const [preparationResult, alternativesResult] = await Promise.all([
    supabase
      .from('profile_subject_preparation')
      .select('subject_id, preparation_level')
      .eq('user_id', userId),
    supabase
      .from('profile_alternative_universities')
      .select('university_id, priority')
      .eq('user_id', userId)
      .order('priority', { ascending: true })
  ])

  if (preparationResult.error || alternativesResult.error) {
    throw new AppError(
      'Не удалось загрузить дополнительные настройки персонального профиля.',
      500,
      'PROFILE_PLANNING_LOAD_FAILED'
    )
  }

  return mapProfile(
    data as unknown as ProfileRow,
    (preparationResult.data ?? []) as SubjectPreparationRow[],
    (alternativesResult.data ?? []) as AlternativeUniversityRow[]
  )
}

export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  input: SaveProfileInput,
  email?: string,
  fullName?: string
): Promise<ProfileResult> {
  // The profile row and its planning preferences must be committed together.
  // Missing optional planning keys preserve values saved by older clients.
  const planningPreferences: Record<string, unknown> = {}

  if (input.weeklyStudyHours !== undefined) {
    planningPreferences.weeklyStudyHours = input.weeklyStudyHours
  }
  if (input.targetAdmissionYear !== undefined) {
    planningPreferences.targetAdmissionYear = input.targetAdmissionYear
  }
  if (input.targetEducationLevel !== undefined) {
    planningPreferences.targetEducationLevel = input.targetEducationLevel
  }
  if (input.subjectPreparation !== undefined) {
    planningPreferences.subjectPreparation = input.subjectPreparation
  }
  if (input.alternativeUniversityIds !== undefined) {
    planningPreferences.alternativeUniversityIds = input.alternativeUniversityIds
  }

  const profilePayload = {
    grade: input.grade,
    region: input.region,
    subjects: input.subjects,
    targetUniversityId: input.targetUniversityId ?? null,
    targetProgramId: input.targetProgramId ?? null
  }

  // This narrowly scoped RPC is executable only by the backend service role.
  // The caller's userId/email/name come from the already verified Supabase Auth
  // user attached by authenticate middleware, never from req.body.
  const serviceSupabase = createSupabaseServiceClient()
  const { error } = await serviceSupabase.rpc('save_profile_bundle', {
    p_user_id: userId,
    p_email: email ?? null,
    p_full_name: fullName ?? null,
    p_profile: profilePayload,
    p_preferences: planningPreferences
  })

  if (error) {
    throw new AppError(
      'Не удалось атомарно сохранить профиль и настройки персональной траектории.',
      500,
      'PROFILE_SAVE_FAILED'
    )
  }

  const savedProfile = await getProfile(supabase, userId)

  if (!savedProfile) {
    throw new AppError(
      'Профиль сохранён, но не удалось повторно загрузить его данные.',
      500,
      'PROFILE_RELOAD_FAILED'
    )
  }

  return savedProfile
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
  // Authenticated clients have column-level UPDATE permission only for these
  // display preferences. The database trigger owns updated_at.
  const { data, error } = await supabase
    .from('profiles')
    .update({
      theme_preference: input.themePreference,
      notification_preferences: input.notificationPreferences
    })
    .eq('id', userId)
    .select('theme_preference, notification_preferences')
    .maybeSingle()

  if (error || !data) {
    throw new AppError(
      'Не удалось сохранить настройки профиля.',
      500,
      'PROFILE_PREFERENCES_SAVE_FAILED'
    )
  }

  return mapPreferences(data as ProfilePreferencesRow)
}