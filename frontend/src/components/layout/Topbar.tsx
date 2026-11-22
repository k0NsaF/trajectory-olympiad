
import { useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Menu,
  Moon,
  Search,
  Sun
} from 'lucide-react'

import { ROUTE_TITLES } from '@/config/navigation'

export type AppTheme = 'dark' | 'light'

interface TopbarProps {
  theme: AppTheme
  searchQuery: string
  onMenuClick: () => void
  onThemeToggle: () => void
  onSearchChange: (value: string) => void
  onNotificationsClick: () => void
}

export function Topbar({
  theme,
  searchQuery,
  onMenuClick,
  onThemeToggle,
  onSearchChange,
  onNotificationsClick
}: TopbarProps) {
  const location = useLocation()

  const title = ROUTE_TITLES[location.pathname] ?? 'Рабочее пространство'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Открыть меню"
        >
          <Menu size={22} />
        </button>

        <div className="breadcrumb">
          <span>Рабочее пространство</span>
          <ChevronRight size={15} />
          <strong>{title}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="search-box">
          <Search size={17} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Найти..."
            aria-label="Поиск по разделу"
          />

          <kbd>Ctrl K</kbd>
        </label>

        <button
          type="button"
          className="icon-button"
          onClick={onThemeToggle}
          aria-label={
            theme === 'dark'
              ? 'Включить светлую тему'
              : 'Включить тёмную тему'
          }
        >
          {theme === 'dark' ? (
            <Sun size={19} />
          ) : (
            <Moon size={19} />
          )}
        </button>

        <button
          type="button"
          className="icon-button notification-button"
          onClick={onNotificationsClick}
          aria-label="Уведомления"
        >
          <Bell size={19} />
          <span />
        </button>

        <div className="topbar-avatar" aria-label="Профиль пользователя">
          У
        </div>
      </div>
    </header>
  )
}
