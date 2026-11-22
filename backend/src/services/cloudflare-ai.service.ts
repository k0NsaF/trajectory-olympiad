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

export interface CloudflareRequestPayload {
  messages: CloudflareMessage[]
  temperature: number
  max_completion_tokens: number
  chat_template_kwargs: {
    enable_thinking: false
  }
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        const record = asRecord(item)
        if (!record) return ''

        const text = record.text ?? record.content
        return typeof text === 'string' ? text.trim() : ''
      })
      .filter(Boolean)

    return parts.length > 0 ? parts.join('\n').trim() : null
  }

  const record = asRecord(value)
  if (record && typeof record.text === 'string') {
    return record.text.trim() || null
  }

  return null
}

function extractChoices(value: unknown): string | null {
  if (!Array.isArray(value)) return null

  for (const item of value) {
    const choice = asRecord(item)
    if (!choice) continue

    const message = asRecord(choice.message)
    const delta = asRecord(choice.delta)
    const content = readText(message?.content)
      ?? readText(delta?.content)
      ?? readText(choice.text)

    if (content) return content
  }

  return null
}

export function extractCloudflareText(payload: unknown): string | null {
  const root = asRecord(payload)
  if (!root) return null

  const result = asRecord(root.result)
  const rootMessage = asRecord(root.message)
  const resultMessage = asRecord(result?.message)

  return (
    readText(result?.response)
    ?? readText(result?.text)
    ?? readText(result?.output_text)
    ?? extractChoices(result?.choices)
    ?? readText(resultMessage?.content)
    ?? readText(root.response)
    ?? readText(root.text)
    ?? readText(root.output_text)
    ?? extractChoices(root.choices)
    ?? readText(rootMessage?.content)
    ?? null
  )
}

export function buildCloudflareRequestPayload(input: {
  systemInstruction: string
  history?: CloudflareHistoryEntry[]
  userPrompt: string
}): CloudflareRequestPayload {
  return {
    messages: buildCloudflareMessages(input),
    temperature: 0.2,
    max_completion_tokens: 1_400,
    // GLM-4.7-Flash enables reasoning by default. Disable it for a normal
    // user-facing answer so reasoning tokens do not consume the output budget.
    chat_template_kwargs: {
      enable_thinking: false
    }
  }
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
      body: JSON.stringify(buildCloudflareRequestPayload(input)),
      signal: AbortSignal.timeout(80_000)
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
      'Cloudflare Workers AI не вернул текст итогового ответа. Повтори запрос; если ошибка останется, проверь ответ модели в журнале Render.',
      502,
      'AI_EMPTY_RESPONSE'
    )
  }

  return answer
}
