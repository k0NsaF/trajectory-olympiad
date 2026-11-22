
import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js'

import {
  APP_CONFIG,
  IS_SUPABASE_CONFIGURED
} from '@/config/env'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!IS_SUPABASE_CONFIGURED) {
    throw new Error(
      'Supabase не настроен. Проверь VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  if (!client) {
    client = createClient(
      APP_CONFIG.supabaseUrl,
      APP_CONFIG.supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    )
  }

  return client
}
