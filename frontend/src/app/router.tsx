import { createBrowserRouter } from 'react-router-dom'

import { PublicSiteLayout } from '@/app/PublicSiteLayout'
import { AuthPage } from '@/pages/Auth/AuthPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { HomePage } from '@/pages/Home/HomePage'
import { ProfessionCatalogPage, ProfessionDetailsPage } from '@/pages/Catalog/ProfessionCatalogPage'
import { DirectionCatalogPage, DirectionDetailsPage } from '@/pages/Catalog/DirectionCatalogPage'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { OlympiadsPage } from '@/pages/Olympiads/OlympiadsPage'
import { OlympiadDetailsPage } from '@/pages/Olympiads/OlympiadDetailsPage'
import { UniversitiesPage } from '@/pages/Universities/UniversitiesPage'
import { UniversityDetailsPage } from '@/pages/Universities/UniversityDetailsPage'
import { UniversityComparisonPage } from '@/pages/Universities/UniversityComparisonPage'
import { AIPage } from '@/pages/AI/AIPage'
import { CalendarPage } from '@/pages/Calendar/CalendarPage'
import { FavoritesPage } from '@/pages/Favorites/FavoritesPage'
import { ProfilePage } from '@/pages/Profile/ProfilePage'
import { AchievementsPage } from '@/pages/Achievements/AchievementsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OnboardingPage } from '@/pages/Onboarding/OnboardingPage'
import { TrajectoryPage } from '@/pages/Trajectory/TrajectoryPage'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />
  },
  {
    path: '/',
    element: <PublicSiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'professions', element: <ProfessionCatalogPage /> },
      { path: 'professions/:slug', element: <ProfessionDetailsPage /> },
      { path: 'directions', element: <DirectionCatalogPage /> },
      { path: 'directions/:slug', element: <DirectionDetailsPage /> },
      { path: 'olympiads', element: <OlympiadsPage /> },
      { path: 'olympiads/:id', element: <OlympiadDetailsPage /> },
      { path: 'universities/compare', element: <UniversityComparisonPage /> },
      { path: 'universities', element: <UniversitiesPage /> },
      { path: 'universities/:id', element: <UniversityDetailsPage /> },
      { path: 'ai', element: <AIPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'trajectory', element: <TrajectoryPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
])