
const portValue = Number(process.env.PORT ?? 3000)

if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
  throw new Error('Некорректное значение PORT')
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: portValue,

  frontendOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',

  yandexGptApiKey: process.env.YANDEXGPT_API_KEY ?? '',
  yandexGptFolderId: process.env.YANDEXGPT_FOLDER_ID ?? '',
  yandexGptModel: process.env.YANDEXGPT_MODEL ?? 'yandexgpt-5.1'
} as const

export const isProduction = env.nodeEnv === 'production'

export const hasSupabaseConfig = Boolean(
  env.supabaseUrl && env.supabasePublishableKey
)
