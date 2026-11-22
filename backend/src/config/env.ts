const portValue = Number(process.env.PORT ?? 3000)

if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
  throw new Error('Некорректное значение PORT')
}

const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? ''
const cloudflareAiModel =
  process.env.CLOUDFLARE_AI_MODEL?.trim() || '@cf/zai-org/glm-4.7-flash'

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: portValue,

  frontendOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  supabaseUrl: process.env.SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',

  cloudflareAccountId,
  cloudflareApiToken,
  cloudflareAiModel,

  tavilyApiKey: process.env.TAVILY_API_KEY?.trim() ?? '',
  tavilySearchEnabled: process.env.TAVILY_SEARCH_ENABLED === 'true'
} as const

export const isProduction = env.nodeEnv === 'production'

export const hasSupabaseConfig = Boolean(
  env.supabaseUrl && env.supabasePublishableKey
)

export const hasCloudflareAIConfig = Boolean(
  env.cloudflareAccountId && env.cloudflareApiToken
)
