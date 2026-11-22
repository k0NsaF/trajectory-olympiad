
import type {
  SupabaseClient,
  User
} from '@supabase/supabase-js'

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
    supabase?: SupabaseClient
  }
}

export {}
