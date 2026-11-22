import { NavLink, Link } from 'react-router-dom'
import {
  ChevronRight,
  GraduationCap,
  Settings,
  X
} from 'lucide-react'

import { APP_NAVIGATION } from '@/config/navigation'

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
  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
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
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="nav-active-indicator" />
                  )}
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
            `nav-item${isActive ? ' nav-item-active' : ''}`
          }
        >
          <Settings size={19} />
          <span>Настройки</span>
        </NavLink>

        <Link
          to="/profile"
          className="profile-mini"
          onClick={onNavigate}
        >
          <div className="avatar">У</div>
          <div className="profile-mini-info">
            <strong>Мой аккаунт</strong>
            <span>Перейти в профиль</span>
          </div>

          <ChevronRight size={17} />
        </Link>
      </div>
    </aside>
  )
}
