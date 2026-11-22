
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/providers'
import { LoadingState } from '@/components/common/LoadingState'

interface RequireAuthProps {
  children: ReactNode
}

export function RequireAuth({
  children
}: RequireAuthProps) {
  const { user, loading, isConfigured } = useAuth()

  if (loading) {
    return <LoadingState message="Проверяем авторизацию..." />
  }

  if (!isConfigured || !user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}
