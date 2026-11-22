
import {
  LayoutDashboard,
  Compass,
  CalendarDays,
  GraduationCap,
  Trophy,
  Bot,
  UserRound,
  type LucideIcon
} from 'lucide-react'

export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
}

export const APP_NAVIGATION: NavigationItem[] = [
  {
    label: 'Моя траектория',
    path: '/trajectory',
    icon: LayoutDashboard
  },
  {
    label: 'Каталог олимпиад',
    path: '/olympiads',
    icon: Compass
  },
  {
    label: 'Календарь',
    path: '/calendar',
    icon: CalendarDays
  },
  {
    label: 'Университеты',
    path: '/universities',
    icon: GraduationCap
  },
  {
    label: 'Мои достижения',
    path: '/achievements',
    icon: Trophy
  },
  {
    label: 'ИИ-консультант',
    path: '/ai',
    icon: Bot
  },
  {
    label: 'Мой профиль',
    path: '/profile',
    icon: UserRound
  }
]

export const MOBILE_NAVIGATION = APP_NAVIGATION.filter(
  (item) =>
    item.path === '/trajectory' ||
    item.path === '/olympiads' ||
    item.path === '/calendar' ||
    item.path === '/universities' ||
    item.path === '/profile'
)

export const ROUTE_TITLES: Record<string, string> = {
  '/trajectory': 'Моя траектория',
  '/olympiads': 'Каталог олимпиад',
  '/calendar': 'Календарь',
  '/universities': 'Университеты',
  '/achievements': 'Мои достижения',
  '/ai': 'ИИ-консультант',
  '/profile': 'Мой профиль',
  '/settings': 'Настройки',
  '/onboarding': 'Настройка профиля'
}
