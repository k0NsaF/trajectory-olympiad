import { env, hasCloudflareAIConfig } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

export interface CloudflareHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface CloudflareMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function appendMessage(
  messages: CloudflareMessage[],
  role: 'user' | 'assistant',
  content: string
): void {
  const normalized = content.trim().slice(0, 3_000)
  if (!normalized) return

  const previous = messages[messages.length - 1]
  if (previous?.role === role) {
    previous.content += `\n\n${normalized}`
    return
  }

  messages.push({ role, content: normalized })
}

export function buildCloudflareMessages(input: {
  systemInstruction: string
  history?: CloudflareHistoryEntry[]
  userPrompt: string
}): CloudflareMessage[] {
  const messages: CloudflareMessage[] = [
    { role: 'system', content: input.systemInstruction.trim().slice(0, 12_000) }
  ]

  const history = (input.history ?? []).slice(-8)
  let foundFirstUserMessage = false

  for (const item of history) {
    if (!foundFirstUserMessage && item.role === 'assistant') continue
    if (item.role === 'user') foundFirstUserMessage = true
    appendMessage(messages, item.role, item.content)
  }

  appendMessage(messages, 'user', input.userPrompt)
  return messages
}

function readText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        const text = (item as { text?: unknown }).text
        return typeof text === 'string' ? text.trim() : ''
      })
      .filter(Boolean)
    return parts.length > 0 ? parts.join('\n').trim() : null
  }
  return null
}

export function extractCloudflareText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const root = payload as {
    result?: unknown
    choices?: unknown
  }

  if (root.result && typeof root.result === 'object') {
    const result = root.result as { response?: unknown; text?: unknown }
    const responseText = readText(result.response)
    if (responseText) return responseText

    const resultText = readText(result.text)
    if (resultText) return resultText
  }

  if (Array.isArray(root.choices) && root.choices.length > 0) {
    const first = root.choices[0] as {
      message?: { content?: unknown }
      text?: unknown
    }
    const content = readText(first?.message?.content) ?? readText(first?.text)
    if (content) return content
  }

  return null
}

function buildEndpoint(): string {
  const accountId = encodeURIComponent(env.cloudflareAccountId)
  const model = encodeURI(env.cloudflareAiModel)
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`
}

export async function generateCloudflareAnswer(input: {
  systemInstruction: string
  history?: CloudflareHistoryEntry[]
  userPrompt: string
}): Promise<string> {
  if (!hasCloudflareAIConfig) {
    throw new AppError(
      'ИИ-консультант пока не подключён. Добавь CLOUDFLARE_ACCOUNT_ID и CLOUDFLARE_API_TOKEN в переменные окружения backend на Render.',
      503,
      'AI_PROVIDER_NOT_CONFIGURED'
    )
  }

  let response: Response
  try {
    response = await fetch(buildEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.cloudflareApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: buildCloudflareMessages(input),
        temperature: 0.2,
        max_completion_tokens: 1_400
      }),
      signal: AbortSignal.timeout(40_000)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError('Cloudflare AI не успел подготовить ответ. Попробуй ещё раз.', 504, 'AI_PROVIDER_TIMEOUT')
    }
    throw new AppError('Не удалось связаться с Cloudflare Workers AI. Проверь подключение и попробуй ещё раз.', 502, 'AI_PROVIDER_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'Cloudflare отклонил запрос. Проверь Account ID, API Token и разрешения Workers AI Read/Edit в настройках Render.',
        503,
        'AI_PROVIDER_AUTH_FAILED'
      )
    }

    if (response.status === 429 || response.status === 402) {
      throw new AppError(
        'Лимит Cloudflare Workers AI временно исчерпан. Проверь дневную квоту и попробуй позже.',
        429,
        'AI_PROVIDER_RATE_LIMITED'
      )
    }

    if (response.status === 404) {
      throw new AppError(
        `Модель ${env.cloudflareAiModel} не найдена или недоступна для этого аккаунта. Проверь CLOUDFLARE_AI_MODEL в Render.`,
        503,
        'AI_MODEL_NOT_AVAILABLE'
      )
    }

    throw new AppError('Cloudflare Workers AI временно недоступен. Попробуй ещё раз позже.', 502, 'AI_PROVIDER_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  const answer = extractCloudflareText(payload)

  if (!answer) {
    throw new AppError(
      'Cloudflare Workers AI вернул пустой ответ. Попробуй переформулировать вопрос.',
      502,
      'AI_EMPTY_RESPONSE'
    )
  }

  return answer
}
