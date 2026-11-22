import type {
  CreateProfileInput,
  NotificationPreferences,
  ProfilePreferences,
  ProfileSnapshot,
  ThemePreference,
  UserGrade
} from '@trajectory/shared'

import { DEFAULT_PROFILE_PREFERENCES } from '@trajectory/shared'
import { api } from '@/services/api'

const STORAGE_KEY = 'trajectory-guest-profile'
const PREFERENCES_STORAGE_KEY = 'trajectory-user-preferences'

interface SavedProfileResponse {
  grade?: number | null
  region?: string | null
  subjects?: string[]
  targetUniversityId?: string
  targetProgramId?: string
}

function isUserGrade(value: unknown): value is UserGrade {
  return value === 7 || value === 8 || value === 9 || value === 10 || value === 11
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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
    ...(profile.targetProgramId ? { targetProgramId: profile.targetProgramId } : {})
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
      ...(typeof profile.targetProgramId === 'string' ? { targetProgramId: profile.targetProgramId } : {})
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

export async function syncGuestProfile(accessToken: string): Promise<boolean> {
  const profile = getGuestProfile()
  if (!profile) return false

  await api.put<unknown, CreateProfileInput>('/api/profile', profile, {
    token: accessToken
  })
  clearGuestProfile()
  return true
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
