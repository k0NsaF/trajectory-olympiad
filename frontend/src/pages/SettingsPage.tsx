import { useEffect, useState } from 'react'
import {
  BellRing,
  Check,
  Newspaper,
  Save,
} from 'lucide-react'

import type {
  NotificationPreferences,
  ProfilePreferences,
} from '@trajectory/shared'
import { DEFAULT_PROFILE_PREFERENCES } from '@trajectory/shared'

import { useAuth } from '@/app/providers'
import { PageHeader } from '@/components/common/PageHeader'
import {
  getAuthenticatedPreferences,
  getGuestPreferences,
  saveAuthenticatedPreferences,
  saveGuestPreferences
} from '@/services/profile.service'
import { setThemePreference } from '@/lib/theme'

import './Profile/profile-settings.css'

const NOTIFICATION_OPTIONS: Array<{
  key: keyof NotificationPreferences
  title: string
  description: string
  icon: typeof BellRing
}> = [
  {
    key: 'registrationReminders',
    title: 'Регистрация на олимпиады',
    description: 'Напоминания о начале и окончании регистрации.',
    icon: BellRing
  },
  {
    key: 'stageDeadlines',
    title: 'Этапы и дедлайны',
    description: 'Важные даты отборочных и заключительных этапов.',
    icon: Check
  },
  {
    key: 'newsUpdates',
    title: 'Новости и обновления',
    description: 'Изменения в каталоге и новые материалы проекта.',
    icon: Newspaper
  }
]

export function SettingsPage() {
  const { session, loading: authLoading } = useAuth()
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PROFILE_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    async function loadPreferences() {
      setLoading(true)
      setError(null)

      try {
        const saved = session?.access_token
          ? await getAuthenticatedPreferences(session.access_token)
          : getGuestPreferences()

        if (cancelled) return
        setPreferences(saved)
        setThemePreference(saved.themePreference)
      } catch {
        if (!cancelled) {
          setPreferences(getGuestPreferences())
          setError('Не удалось загрузить настройки аккаунта. Изменения можно сохранить на этом устройстве.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPreferences()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token])

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setPreferences((current) => ({
      ...current,
      notificationPreferences: {
        ...current.notificationPreferences,
        [key]: !current.notificationPreferences[key]
      }
    }))
    setError(null)
    setMessage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      if (session?.access_token) {
        const saved = await saveAuthenticatedPreferences(
          preferences,
          session.access_token
        )
        setPreferences(saved)
      } else {
        saveGuestPreferences(preferences)
      }

      setThemePreference(preferences.themePreference)
      setMessage(session
        ? 'Настройки сохранены в твоём аккаунте.'
        : 'Настройки сохранены на этом устройстве.')
    } catch (saveError) {
      setError(saveError instanceof Error
        ? `${saveError.message} Тема уже применена локально, но настройки сервера не обновлены.`
        : 'Не удалось сохранить настройки. Тема применена локально, попробуй сохранить ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ПЕРСОНАЛИЗАЦИЯ"
        title="Настройки"
      />



      <section className="panel settings-panel">
        <div className="settings-panel-heading">
          <div className="settings-panel-icon"><BellRing size={19} /></div>
          <div>
            <h2>Уведомления</h2>
            <p>Выбери, о каких событиях ты хочешь получать напоминания.</p>
          </div>
        </div>

        <div className="settings-notification-list">
          {NOTIFICATION_OPTIONS.map((option) => {
            const Icon = option.icon
            const enabled = preferences.notificationPreferences[option.key]
            return (
              <div className="settings-notification-row" key={option.key}>
                <div className="settings-notification-icon"><Icon size={18} /></div>
                <div className="settings-notification-copy">
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </div>
                <button
                  type="button"
                  className={`settings-switch ${enabled ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={option.title}
                  disabled={loading}
                  onClick={() => toggleNotification(option.key)}
                >
                  <span />
                </button>
              </div>
            )
          })}
        </div>

        <p className="settings-notification-note">
          Настройки сохраняют твои предпочтения. Автоматическая отправка push- и email-уведомлений будет подключена отдельным этапом.
        </p>
      </section>

      {error && <div className="profile-inline-error" role="alert">{error}</div>}
      {message && <div className="profile-inline-success" role="status"><Check size={16} />{message}</div>}

      <div className="settings-save-row">
        <span>{session ? 'Настройки привязаны к аккаунту' : 'Гостевые настройки хранятся в этом браузере'}</span>
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          <Save size={16} />{saving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  )
}
