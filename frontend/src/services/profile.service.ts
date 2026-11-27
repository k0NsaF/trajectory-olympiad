import type {
  CreateProfileInput,
  EducationLevel,
  NotificationPreferences,
  PreparationLevel,
  ProfilePreferences,
  ProfileSnapshot,
  SubjectId,
  SubjectPreparation,
  ThemePreference,
  UserGrade
} from '@trajectory/shared'

import { DEFAULT_PROFILE_PREFERENCES, SUBJECTS } from '@trajectory/shared'
import { api } from '@/services/api'

const STORAGE_KEY = 'trajectory-guest-profile'
const PREFERENCES_STORAGE_KEY = 'trajectory-user-preferences'

interface SavedProfileResponse {
  grade?: number | null
  region?: string | null
  subjects?: string[]
  targetUniversityId?: string
  targetProgramId?: string
  weeklyStudyHours?: unknown
  targetAdmissionYear?: unknown
  targetEducationLevel?: unknown
  subjectPreparation?: unknown
  alternativeUniversityIds?: unknown
}

function isUserGrade(value: unknown): value is UserGrade {
  return value === 7 || value === 8 || value === 9 || value === 10 || value === 11
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isSubjectId(value: unknown): value is SubjectId {
  return SUBJECTS.some((subject) => subject.id === value)
}

function isPreparationLevel(value: unknown): value is PreparationLevel {
  return value === 'beginner' || value === 'medium' || value === 'advanced'
}

function isEducationLevel(value: unknown): value is EducationLevel {
  return value === 'bachelor' || value === 'specialist' || value === 'master'
}

function mapSubjectPreparation(value: unknown): SubjectPreparation[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<SubjectId>()
  const result: SubjectPreparation[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    if (!isSubjectId(candidate.subjectId) || !isPreparationLevel(candidate.preparationLevel)) continue
    if (seen.has(candidate.subjectId)) continue

    seen.add(candidate.subjectId)
    result.push({
      subjectId: candidate.subjectId,
      preparationLevel: candidate.preparationLevel
    })
  }

  return result
}

function mapAlternativeUniversityIds(value: unknown, primaryUniversityId?: string): string[] {
  if (!isStringArray(value)) return []
  return [...new Set(value)]
    .filter((id) => id.length > 0 && id !== primaryUniversityId)
    .slice(0, 3)
}

function mapPlanningFields(
  profile: Record<string, unknown>,
  primaryUniversityId?: string
): Partial<CreateProfileInput> {
  const weeklyStudyHours = profile.weeklyStudyHours
  const targetAdmissionYear = profile.targetAdmissionYear

  return {
    ...(typeof weeklyStudyHours === 'number' && Number.isInteger(weeklyStudyHours) && weeklyStudyHours >= 1 && weeklyStudyHours <= 40
      ? { weeklyStudyHours }
      : {}),
    ...(typeof targetAdmissionYear === 'number' && Number.isInteger(targetAdmissionYear) && targetAdmissionYear >= 2026 && targetAdmissionYear <= 2100
      ? { targetAdmissionYear }
      : {}),
    ...(isEducationLevel(profile.targetEducationLevel)
      ? { targetEducationLevel: profile.targetEducationLevel }
      : {}),
    subjectPreparation: mapSubjectPreparation(profile.subjectPreparation),
    alternativeUniversityIds: mapAlternativeUniversityIds(
      profile.alternativeUniversityIds,
      primaryUniversityId
    )
  }
}

function mapSavedProfile(profile: SavedProfileResponse | null): CreateProfileInput | null {
  if (
    !profile ||
    !isUserGrade(profile.grade) ||
    typeof profile.region !== 'string' ||
    profile.region.trim().length < 2 ||
    !isStringArray(profile.subjects) ||
    profile.subjects.length === 0
  ) {
    return null
  }

  return {
    grade: profile.grade,
    region: profile.region,
    subjects: profile.subjects,
    ...(profile.targetUniversityId ? { targetUniversityId: profile.targetUniversityId } : {}),
    ...(profile.targetProgramId ? { targetProgramId: profile.targetProgramId } : {}),
    ...mapPlanningFields(
      profile as unknown as Record<string, unknown>,
      profile.targetUniversityId
    )
  }
}

function sanitizePreferences(value: unknown): ProfilePreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROFILE_PREFERENCES
  }

  const candidate = value as {
    themePreference?: unknown
    notificationPreferences?: Partial<NotificationPreferences>
  }
  const themePreference: ThemePreference =
    candidate.themePreference === 'light' ||
    candidate.themePreference === 'dark' ||
    candidate.themePreference === 'system'
      ? candidate.themePreference
      : DEFAULT_PROFILE_PREFERENCES.themePreference

  const notifications = candidate.notificationPreferences

  return {
    themePreference,
    notificationPreferences: {
      registrationReminders: typeof notifications?.registrationReminders === 'boolean'
        ? notifications.registrationReminders
        : DEFAULT_PROFILE_PREFERENCES.notificationPreferences.registrationReminders,
      stageDeadlines: typeof notifications?.stageDeadlines === 'boolean'
        ? notifications.stageDeadlines
        : DEFAULT_PROFILE_PREFERENCES.notificationPreferences.stageDeadlines,
      newsUpdates: typeof notifications?.newsUpdates === 'boolean'
        ? notifications.newsUpdates
        : DEFAULT_PROFILE_PREFERENCES.notificationPreferences.newsUpdates
    }
  }
}

export function getGuestProfile(): CreateProfileInput | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object') return null

    const profile = value as Record<string, unknown>
    if (
      !isUserGrade(profile.grade) ||
      typeof profile.region !== 'string' ||
      profile.region.trim().length < 2 ||
      !isStringArray(profile.subjects) ||
      profile.subjects.length === 0
    ) {
      return null
    }

    return {
      grade: profile.grade,
      region: profile.region,
      subjects: profile.subjects,
      ...(typeof profile.targetUniversityId === 'string' ? { targetUniversityId: profile.targetUniversityId } : {}),
      ...(typeof profile.targetProgramId === 'string' ? { targetProgramId: profile.targetProgramId } : {}),
      ...mapPlanningFields(profile, typeof profile.targetUniversityId === 'string' ? profile.targetUniversityId : undefined)
    }
  } catch {
    return null
  }
}

export function saveGuestProfile(profile: CreateProfileInput): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function clearGuestProfile(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasGuestProfile(): boolean {
  return getGuestProfile() !== null
}

export async function getAuthenticatedProfile(
  accessToken: string
): Promise<CreateProfileInput | null> {
  const profile = await api.get<SavedProfileResponse | null>('/api/profile', {
    token: accessToken
  })
  return mapSavedProfile(profile)
}

export async function getProfileSnapshot(
  accessToken: string
): Promise<ProfileSnapshot | null> {
  return api.get<ProfileSnapshot | null>('/api/profile', { token: accessToken })
}

let guestProfileSyncPromise: Promise<boolean> | null = null

export function syncGuestProfile(accessToken: string): Promise<boolean> {
  if (guestProfileSyncPromise) return guestProfileSyncPromise

  const profile = getGuestProfile()
  if (!profile) return Promise.resolve(false)

  const pending = api.put<unknown, CreateProfileInput>('/api/profile', profile, {
    token: accessToken
  }).then(() => {
    clearGuestProfile()
    return true
  })

  guestProfileSyncPromise = pending
  return pending.finally(() => {
    if (guestProfileSyncPromise === pending) guestProfileSyncPromise = null
  })
}

export async function saveAuthenticatedProfile(
  profile: CreateProfileInput,
  accessToken: string
): Promise<void> {
  await api.put<unknown, CreateProfileInput>('/api/profile', profile, {
    token: accessToken
  })
  clearGuestProfile()
}

export function getGuestPreferences(): ProfilePreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    return stored
      ? sanitizePreferences(JSON.parse(stored))
      : DEFAULT_PROFILE_PREFERENCES
  } catch {
    return DEFAULT_PROFILE_PREFERENCES
  }
}

export function saveGuestPreferences(preferences: ProfilePreferences): void {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

export async function getAuthenticatedPreferences(
  accessToken: string
): Promise<ProfilePreferences> {
  const preferences = await api.get<ProfilePreferences>('/api/profile/preferences', {
    token: accessToken
  })
  return sanitizePreferences(preferences)
}

export async function saveAuthenticatedPreferences(
  preferences: ProfilePreferences,
  accessToken: string
): Promise<ProfilePreferences> {
  const saved = await api.put<ProfilePreferences, ProfilePreferences>(
    '/api/profile/preferences',
    preferences,
    { token: accessToken }
  )
  return sanitizePreferences(saved)
}
