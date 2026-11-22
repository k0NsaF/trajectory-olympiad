import type { ThemePreference } from '@trajectory/shared'

export const THEME_STORAGE_KEY = 'trajectory-theme'
export const THEME_CHANGE_EVENT = 'trajectory-theme-preference-change'

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)

    if (value === 'light' || value === 'dark' || value === 'system') {
      return value
    }
  } catch {
    // The app falls back to the system theme when storage is unavailable.
  }

  return 'system'
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The current page still applies the preference through the event below.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, {
        detail: preference
      })
    )
  }
}

export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}
