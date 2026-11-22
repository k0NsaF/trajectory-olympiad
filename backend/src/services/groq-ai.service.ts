import { env, hasGroqAIConfig } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

export interface GroqHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqRequestPayload {
  model: string
  messages: GroqMessage[]
  max_completion_tokens: number
  reasoning_effort: 'low'
}

function appendMessage(
  messages: GroqMessage[],
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

export function buildGroqMessages(input: {
  systemInstruction: string
  history?: GroqHistoryEntry[]
  userPrompt: string
}): GroqMessage[] {
  const messages: GroqMessage[] = [
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

function readContent(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!Array.isArray(value)) return null

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

export function extractGroqText(payload: unknown): string | null {
  const root = asRecord(payload)
  if (!root || !Array.isArray(root.choices)) return null

  for (const item of root.choices) {
    const choice = asRecord(item)
    const message = asRecord(choice?.message)
    if (!message) continue

    const content = readContent(message.content)
    if (content) return content

    const refusal = typeof message.refusal === 'string' ? message.refusal.trim() : ''
    if (refusal) return refusal
  }

  return null
}

export function buildGroqRequestPayload(input: {
  systemInstruction: string
  history?: GroqHistoryEntry[]
  userPrompt: string
}): GroqRequestPayload {
  return {
    model: env.groqAiModel,
    messages: buildGroqMessages(input),
    max_completion_tokens: 2_600,
    reasoning_effort: 'low'
  }
}

export async function generateGroqAnswer(input: {
  systemInstruction: string
  history?: GroqHistoryEntry[]
  userPrompt: string
}): Promise<string> {
  if (!hasGroqAIConfig) {
    throw new AppError(
      'Groq не настроен. Добавь GROQ_API_KEY в переменные окружения backend на Render.',
      503,
      'GROQ_NOT_CONFIGURED'
    )
  }

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGroqRequestPayload(input)),
      signal: AbortSignal.timeout(55_000)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError('Groq не успел подготовить ответ за отведённое время.', 504, 'GROQ_TIMEOUT')
    }
    throw new AppError('Не удалось связаться с Groq API.', 502, 'GROQ_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Groq отклонил API-ключ. Проверь GROQ_API_KEY в Render.', 502, 'GROQ_AUTH_FAILED')
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      const suffix = retryAfter ? ` Повтори запрос через ${retryAfter} сек.` : ' Попробуй ещё раз немного позже.'
      throw new AppError(`Groq временно ограничил запрос.${suffix}`, 429, 'GROQ_RATE_LIMITED')
    }

    if (response.status === 400 || response.status === 404) {
      throw new AppError(
        `Groq не принял запрос или модель ${env.groqAiModel} недоступна. Проверь GROQ_AI_MODEL в Render.`,
        502,
        'GROQ_MODEL_OR_REQUEST_ERROR'
      )
    }

    throw new AppError(`Groq API временно недоступен (HTTP ${response.status}).`, 502, 'GROQ_PROVIDER_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  const answer = extractGroqText(payload)

  if (!answer) {
    throw new AppError(
      'Groq вернул пустой текстовый ответ. Попробуй повторить запрос.',
      502,
      'GROQ_EMPTY_RESPONSE'
    )
  }

  return answer
}
