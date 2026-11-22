import { env, hasCloudflareAIConfig, hasGroqAIConfig } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { generateCloudflareAnswer } from './cloudflare-ai.service.js'
import { generateGroqAnswer } from './groq-ai.service.js'

export interface AIProviderInput {
  systemInstruction: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  userPrompt: string
}

export interface AIProviderResult {
  answer: string
  provider: 'groq' | 'cloudflare'
  fallbackUsed: boolean
}

export async function generateAIAnswer(input: AIProviderInput): Promise<AIProviderResult> {
  if (!hasGroqAIConfig && !hasCloudflareAIConfig) {
    throw new AppError(
      'ИИ-консультант пока не подключён. Добавь GROQ_API_KEY или настройки Cloudflare Workers AI в переменные окружения backend на Render.',
      503,
      'AI_PROVIDER_NOT_CONFIGURED'
    )
  }

  if (hasGroqAIConfig) {
    try {
      const answer = await generateGroqAnswer(input)
      return { answer, provider: 'groq', fallbackUsed: false }
    } catch (primaryError) {
      if (!hasCloudflareAIConfig) throw primaryError

      const primaryCode = primaryError instanceof AppError ? primaryError.code : 'GROQ_UNKNOWN_ERROR'
      console.warn(`[AI] Groq request failed (${primaryCode}); switching to Cloudflare fallback.`)

      const answer = await generateCloudflareAnswer(input)
      return { answer, provider: 'cloudflare', fallbackUsed: true }
    }
  }

  const answer = await generateCloudflareAnswer(input)
  return { answer, provider: 'cloudflare', fallbackUsed: false }
}

export function getAIProviderStatus(): {
  modelConfigured: boolean
  provider: 'groq' | 'cloudflare' | 'none'
  model: string
  fallbackConfigured: boolean
} {
  const provider = hasGroqAIConfig
    ? 'groq'
    : hasCloudflareAIConfig
      ? 'cloudflare'
      : 'none'

  return {
    modelConfigured: provider !== 'none',
    provider,
    model: hasGroqAIConfig ? env.groqAiModel : hasCloudflareAIConfig ? env.cloudflareAiModel : 'не настроена',
    fallbackConfigured: hasGroqAIConfig && hasCloudflareAIConfig
  }
}
