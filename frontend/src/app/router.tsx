
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppLayout } from '@/app/AppLayout'
import { AuthPage } from '@/pages/Auth/AuthPage'
import { RequireAuth } from '@/components/common/RequireAuth'
import { UniversityDetailsPage } from '@/pages/Universities/UniversityDetailsPage'
import { AchievementsPage } from '@/pages/Achievements/AchievementsPage'
import { AIPage } from '@/pages/AI/AIPage'
import { CalendarPage } from '@/pages/Calendar/CalendarPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OlympiadDetailsPage } from '@/pages/Olympiads/OlympiadDetailsPage'
import { OlympiadsPage } from '@/pages/Olympiads/OlympiadsPage'
import { OnboardingPage } from '@/pages/Onboarding/OnboardingPage'
import { ProfilePage } from '@/pages/Profile/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TrajectoryPage } from '@/pages/Trajectory/TrajectoryPage'
import { UniversitiesPage } from '@/pages/Universities/UniversitiesPage'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
 
      {
        index: true,
        element: <Navigate to="/trajectory" replace />
      },
      {
        path: 'trajectory',
        element: <TrajectoryPage />
      },
      {
        path: 'olympiads',
        element: <OlympiadsPage />
      },
      {
        path: 'olympiads/:id',
        element: <OlympiadDetailsPage />
      },
      {
        path: 'calendar',
        element: (
          <RequireAuth>
            <CalendarPage />
          </RequireAuth>
        )
      },
      {
        path: 'universities',
        element: <UniversitiesPage />
      },
      {
        path: 'universities/:id',
        element: <UniversityDetailsPage />
      }, 
      {
        path: 'achievements',
        element: (
          <RequireAuth>
            <AchievementsPage />
          </RequireAuth>
        )
      },
      {
        path: 'ai',
        element: <AIPage />
      },
      {
        path: 'profile',
        element: <ProfilePage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: 'onboarding',
        element: <OnboardingPage />
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
])
