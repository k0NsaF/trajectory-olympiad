import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import type { ThemePreference } from '@trajectory/shared'
import { useAuth } from '@/app/providers'
import { MobileNavigation } from '@/components/layout/MobileNavigation'
import { AIQuickAccess } from '@/components/common/AIQuickAccess'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar, type AppTheme } from '@/components/layout/Topbar'
import { getAuthenticatedPreferences } from '@/services/profile.service'
import {
  getSystemTheme,
  getThemePreference,
  setThemePreference as applyThemePreference,
  THEME_CHANGE_EVENT
} from '@/lib/theme'

export interface AppLayoutContext {
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function AppLayout() {
  const { session } = useAuth()
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getThemePreference)
  const [systemTheme, setSystemTheme] = useState<AppTheme>(getSystemTheme)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigate = useNavigate()
  const theme: AppTheme = themePreference === 'system'
    ? systemTheme
    : themePreference

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextPreference = (event as CustomEvent<ThemePreference>).detail
      if (nextPreference === 'light' || nextPreference === 'dark' || nextPreference === 'system') {
        setThemePreferenceState(nextPreference)
      }
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light')

    updateSystemTheme()
    media.addEventListener('change', updateSystemTheme)

    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    let active = true
    const accessToken = session?.access_token

    if (!accessToken) return

    void getAuthenticatedPreferences(accessToken)
      .then((preferences) => {
        if (active) applyThemePreference(preferences.themePreference)
      })
      .catch(() => {
        // Keep the locally selected preference when the profile endpoint is unavailable.
      })

    return () => {
      active = false
    }
  }, [session?.access_token])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const toggleTheme = () => {
    applyThemePreference(theme === 'dark' ? 'light' : 'dark')
  }

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const outletContext: AppLayoutContext = {
    searchQuery,
    setSearchQuery
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-overlay"
          onClick={closeMobileMenu}
          aria-label="Закрыть меню"
        />
      )}

      <Sidebar
        isOpen={mobileMenuOpen}
        onNavigate={closeMobileMenu}
        onClose={closeMobileMenu}
      />

      <main className="main-content">
        <Topbar
          theme={theme}
          searchQuery={searchQuery}
          onMenuClick={() => setMobileMenuOpen(true)}
          onThemeToggle={toggleTheme}
          onSearchChange={setSearchQuery}
          onNotificationsClick={() => navigate('/calendar')}
        />

        <div className="page-content">
          <Outlet context={outletContext} />
        </div>
      </main>

      <MobileNavigation />
      <AIQuickAccess />
    </div>
  )
}
