
import { useEffect, useRef } from 'react'

import { useAuth } from '@/app/providers'
import { syncGuestProfile } from '@/services/profile.service'
import { migrateGuestFavoritesToUser } from '@/services/favorites.store'
import { migrateGuestCalendarSelectionToUser } from '@/services/calendar-selection.store'

export function GuestProfileSync() {
  const { session } = useAuth()
  const lastAttemptedToken = useRef<string | null>(null)

  useEffect(() => {
    const accessToken = session?.access_token

    if (!accessToken || lastAttemptedToken.current === accessToken) {
      return
    }

    lastAttemptedToken.current = accessToken
    const userId = session?.user?.id
    if (userId) {
      migrateGuestFavoritesToUser(userId)
      migrateGuestCalendarSelectionToUser(userId)
    }

    void syncGuestProfile(accessToken).catch((error: unknown) => {
      lastAttemptedToken.current = null

      console.error(
        'Не удалось перенести гостевую анкету в профиль:',
        error
      )
    })
  }, [session])

  return null
}
