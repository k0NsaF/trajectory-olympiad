export type UserGrade = 7 | 8 | 9 | 10 | 11

export type ThemePreference = 'light' | 'dark' | 'system'

export interface NotificationPreferences {
  registrationReminders: boolean
  stageDeadlines: boolean
  newsUpdates: boolean
}

export interface ProfilePreferences {
  themePreference: ThemePreference
  notificationPreferences: NotificationPreferences
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  registrationReminders: true,
  stageDeadlines: true,
  newsUpdates: false
}

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  themePreference: 'system',
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES
}

export interface UserProfile {
  id: string
  email?: string
  fullName?: string
  grade: UserGrade
  region: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
  preferences?: ProfilePreferences
}

export interface ProfileSnapshot {
  id: string
  email?: string
  fullName?: string
  grade?: UserGrade
  region?: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProfileInput {
  grade: UserGrade
  region: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
}
