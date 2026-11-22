
import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js'

import { env, hasSupabaseConfig } from './env.js'
import { AppError } from '../utils/AppError.js'

export function createSupabaseClient(
  accessToken?: string
): SupabaseClient {
  if (!hasSupabaseConfig) {
    throw new AppError(
      'Supabase пока не настроен. Добавь SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY в переменные окружения.',
      503,
      'SUPABASE_NOT_CONFIGURED'
    )
  }

  return createClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      ...(accessToken
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          }
        : {})
    }
  )
}
