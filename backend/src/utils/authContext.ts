
import type { Request } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from './AppError.js'

export interface AuthContext {
  userId: string
  supabase: SupabaseClient
}

export function getAuthContext(req: Request): AuthContext {
  if (!req.user || !req.supabase) {
    throw new AppError(
      'Требуется авторизация.',
      401,
      'AUTHENTICATION_REQUIRED'
    )
  }

  return {
    userId: req.user.id,
    supabase: req.supabase
  }
}
