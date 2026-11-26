
import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js'

import { env, hasSupabaseConfig, hasSupabaseServiceConfig } from './env.js'
import { AppError } from '../utils/AppError.js'
import { createSupabaseServiceFetch } from './supabase-service-fetch.js'

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

/**
 * Creates a server-only Supabase client for narrowly scoped privileged RPCs.
 * The secret key must exist only in backend environment variables and must
 * never be included in frontend/Vite configuration or returned to clients.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  if (!hasSupabaseServiceConfig) {
    throw new AppError(
      'Для защищённой записи персональной траектории не настроен серверный ключ Supabase. Добавь SUPABASE_SECRET_KEY в backend/.env и в окружение backend staging.',
      503,
      'SUPABASE_SERVER_KEY_NOT_CONFIGURED'
    )
  }

  if (env.supabaseSecretKey.startsWith('sb_publishable_')) {
    throw new AppError(
      'В backend вместо серверного ключа Supabase указан публичный ключ. Используй SUPABASE_SECRET_KEY или legacy SUPABASE_SERVICE_ROLE_KEY.',
      500,
      'SUPABASE_SERVER_KEY_INVALID'
    )
  }

  return createClient(
    env.supabaseUrl,
    env.supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        fetch: createSupabaseServiceFetch(env.supabaseSecretKey)
      }
    }
  )
}
