
const apiUrl = import.meta.env.VITE_API_URL?.trim() ?? ''

export const APP_CONFIG = {
  name: 'Траектория в олимпиаду',
  version: '1.0.0',
  apiUrl: apiUrl.replace(/\/+$/, ''),
  requestTimeout: 15000,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
} as const

export const API_BASE_URL = APP_CONFIG.apiUrl

export const IS_DEVELOPMENT = import.meta.env.DEV

export const IS_SUPABASE_CONFIGURED = Boolean(
  APP_CONFIG.supabaseUrl &&
  APP_CONFIG.supabasePublishableKey
)
