import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  GraduationCap,
  LogOut,
  Settings,
  UserRound,
  X
} from 'lucide-react'

import { APP_NAVIGATION } from '@/config/navigation'
import { useAuth } from '@/app/providers'
import { authService } from '@/services/auth.service'

interface SidebarProps {
  isOpen?: boolean
  onNavigate?: () => void
  onClose?: () => void
}

export function Sidebar({
  isOpen = false,
  onNavigate,
  onClose
}: SidebarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const displayName = typeof user?.user_metadata?.full_name === 'string'
    && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim()
    : 'Мой аккаунт'

  const handleSignOut = async () => {
    setSigningOut(true)
    setAuthError(null)

    try {
      await authService.signOut()
      onNavigate?.()
      navigate('/auth', { replace: true })
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Не удалось выйти из аккаунта.'
      )
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <aside className={isOpen ? 'sidebar sidebar-open' : 'sidebar'}>
      <div className="brand">
        <div className="brand-mark">
          <GraduationCap size={25} />
        </div>

        <div className="brand-text">
          <span>ТРАЕКТОРИЯ</span>
          <small>ОЛИМПИАДНОЕ ДВИЖЕНИЕ</small>
        </div>

        <button
          type="button"
          className="icon-button sidebar-close"
          onClick={onClose}
          aria-label="Закрыть меню"
        >
          <X size={20} />
        </button>
      </div>

      <div className="sidebar-section-label">
        РАБОЧЕЕ ПРОСТРАНСТВО
      </div>

      <nav className="navigation" aria-label="Основная навигация">
        {APP_NAVIGATION.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item-active' : 'nav-item'
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {isActive && <span className="nav-active-indicator" />}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            isActive ? 'nav-item nav-item-active' : 'nav-item'
          }
        >
          <Settings size={19} />
          <span>Настройки</span>
        </NavLink>

        {user ? (
          <div className="sidebar-account-actions">
            <Link to="/profile" className="profile-mini" onClick={onNavigate}>
              <div className="avatar">
                {user.email?.trim().charAt(0).toLocaleUpperCase('ru-RU') || 'У'}
              </div>
              <div className="profile-mini-info">
                <strong>{displayName}</strong>
                <span>{user.email || 'Перейти в профиль'}</span>
              </div>
              <ChevronRight size={17} />
            </Link>

            <button
              type="button"
              className="secondary-button sidebar-account-action"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={16} />
              {signingOut ? 'Выходим...' : 'Выйти из аккаунта'}
            </button>
            {authError && <div className="sidebar-auth-error" role="alert">{authError}</div>}
          </div>
        ) : (
          <div className="sidebar-account-actions" aria-label="Авторизация">
            <Link
              to="/auth?mode=register"
              className="primary-button sidebar-account-action"
              onClick={onNavigate}
            >
              <UserRound size={16} />
              Зарегистрироваться
            </Link>
            <Link
              to="/auth"
              className="secondary-button sidebar-account-action"
              onClick={onNavigate}
            >
              Войти в аккаунт
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
