
import { NavLink } from 'react-router-dom'

import { MOBILE_NAVIGATION } from '@/config/navigation'

export function MobileNavigation() {
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Мобильная навигация"
    >
      {MOBILE_NAVIGATION.map((item) => {
        const Icon = item.icon

        const label =
          item.path === '/trajectory'
            ? 'Главная'
            : item.path === '/olympiads'
              ? 'Олимпиады'
              : item.path === '/universities'
                ? 'Вузы'
                : item.path === '/profile'
                  ? 'Профиль'
                  : item.path === '/universities/compare'
                    ? 'Сравнить'
                    : item.label

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              isActive ? 'mobile-nav-active' : ''
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
