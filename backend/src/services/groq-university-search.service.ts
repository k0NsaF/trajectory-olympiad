import { env, hasGroqAIConfig } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { extractGroqText } from './groq-ai.service.js'
import {
  searchTavilyWeb,
  type TavilySearchInput,
  type TavilySearchResult
} from './tavily-search.service.js'

export interface UniversityWebSearchInput extends TavilySearchInput {}

export interface UniversityWebSearchResponse {
  provider: 'groq' | 'tavily'
  results: TavilySearchResult[]
}

interface CachedSearch {
  expiresAt: number
  response: UniversityWebSearchResponse
}

const GROQ_BROWSER_SEARCH_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
])
const CACHE_TTL_MS = 30 * 60 * 1000
const MAX_CACHE_ENTRIES = 120
const searchCache = new Map<string, CachedSearch>()

function cleanText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '::1' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    ) return null

    url.hash = ''
    return url
  } catch {
    return null
  }
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function normalizeResultList(rawResults: unknown, allowedDomain?: string): TavilySearchResult[] {
  if (!Array.isArray(rawResults)) return []

  const results: TavilySearchResult[] = []
  const seen = new Set<string>()

  for (const item of rawResults) {
    if (!item || typeof item !== 'object') continue

    const value = item as {
      title?: unknown
      name?: unknown
      url?: unknown
      domain?: unknown
      snippet?: unknown
      description?: unknown
    }

    if (typeof value.url !== 'string') continue
    const url = normalizePublicUrl(value.url.trim())
    if (!url || seen.has(url.toString())) continue
    if (allowedDomain) {
      const hostname = url.hostname.toLowerCase()
      const domain = allowedDomain.toLowerCase()
      if (hostname !== domain && !hostname.endsWith(`.${domain}`)) continue
    }

    const titleValue = typeof value.title === 'string'
      ? value.title
      : typeof value.name === 'string'
        ? value.name
        : ''
    const snippetValue = typeof value.snippet === 'string'
      ? value.snippet
      : typeof value.description === 'string'
        ? value.description
        : ''
    const title = cleanText(titleValue)
    const snippet = cleanText(snippetValue)

    if (title.length < 3) continue

    seen.add(url.toString())
    results.push({
      title: title.slice(0, 220),
      url: url.toString(),
      domain: url.hostname.replace(/^www\./, ''),
      snippet: (snippet || 'Страница найдена во внешнем поиске. Открой источник и проверь информацию.').slice(0, 900)
    })

    if (results.length >= 8) break
  }

  return results
}

function parseMarkdownLinks(text: string, allowedDomain?: string): TavilySearchResult[] {
  const results: TavilySearchResult[] = []
  const seen = new Set<string>()
  const pattern = /\[([^\]]{3,220})\]\((https:\/\/[^\s)]+)\)/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null && results.length < 8) {
    const title = cleanText(match[1] ?? '')
    const url = normalizePublicUrl(match[2] ?? '')
    if (!title || !url) continue
    if (allowedDomain) {
      const hostname = url.hostname.toLowerCase()
      const domain = allowedDomain.toLowerCase()
      if (hostname !== domain && !hostname.endsWith(`.${domain}`)) continue
    }
    if (seen.has(url.toString())) continue
    seen.add(url.toString())

    const start = Math.max(0, match.index - 220)
    const end = Math.min(text.length, match.index + match[0].length + 260)
    const snippet = cleanText(text.slice(start, end).replace(match[0], ''))

    results.push({
      title,
      url: url.toString(),
      domain: url.hostname.replace(/^www\./, ''),
      snippet: (snippet || 'Страница найдена во внешнем поиске. Открой источник и проверь информацию.').slice(0, 900)
    })
  }

  return results
}

export function parseGroqUniversitySearchResponse(payload: unknown, allowedDomain?: string): TavilySearchResult[] {
  const text = extractGroqText(payload)
  if (!text) return []

  const parsed = extractJsonObject(text)
  if (parsed && typeof parsed === 'object') {
    const record = parsed as { results?: unknown }
    const normalized = normalizeResultList(record.results, allowedDomain)
    if (normalized.length > 0) return normalized
  }

  return parseMarkdownLinks(text, allowedDomain)
}

export function buildGroqUniversitySearchPayload(input: UniversityWebSearchInput): Record<string, unknown> {
  const query = input.query.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  const searchQuery = input.mode === 'programs' && input.domain
    ? `site:${input.domain} ${query} образовательные программы бакалавриата направления подготовки`
    : `${query} российские университеты официальные сайты приёмные комиссии образовательные программы`

  const systemPrompt = [
    'Ты — поисковый агент образовательной платформы для поиска университетов и образовательных программ.',
    'Обязательно используй встроенный инструмент browser_search: не отвечай по памяти.',
    'Ищи реальные страницы в интернете. Приоритет — официальные сайты университетов, приёмных комиссий и страницы образовательных программ.',
    'Не выдумывай названия организаций, адреса страниц, направления подготовки или содержание страниц.',
    'В поле url указывай полный HTTPS-адрес конкретной страницы, который действительно встретился в результатах поиска. Не конструируй адреса по шаблону.',
    'Для каждого результата дай краткий фактический фрагмент: что это за университет или страница и почему она подходит запросу.',
    'Не выдавай поисковое совпадение за подтверждение аккредитации, бюджетных мест или льгот при поступлении.',
    'Верни только валидный JSON без Markdown и комментариев в формате: {"results":[{"title":"...","url":"https://...","snippet":"..."}]}.',
    'Верни не более 8 результатов. Если надёжных страниц меньше — верни только найденные. Если ничего не найдено — верни {"results":[]}.',
    input.mode === 'programs' && input.domain
      ? `Ограничь поиск доменом ${input.domain}. Не включай страницы других доменов.`
      : 'Ищи прежде всего первоисточники университетов, избегай каталогов-агрегаторов и рекламных подборок.'
  ].join('\n')

  return {
    model: env.groqAiModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Найди университеты или программы по запросу: ${searchQuery}` }
    ],
    max_completion_tokens: 2_800,
    reasoning_effort: 'low',
    temperature: 1,
    top_p: 1,
    stream: false,
    tool_choice: 'required',
    tools: [{ type: 'browser_search' }]
  }
}

function cacheKey(input: UniversityWebSearchInput): string {
  return `${input.mode}|${input.domain ?? ''}|${input.query}`
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ')
    .trim()
}

function readCache(key: string): UniversityWebSearchResponse | null {
  const cached = searchCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key)
    return null
  }
  return cached.response
}

function writeCache(key: string, response: UniversityWebSearchResponse): void {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = searchCache.keys().next().value
    if (firstKey) searchCache.delete(firstKey)
  }
  searchCache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS })
}

function canUseGroqBrowserSearch(): boolean {
  return hasGroqAIConfig && GROQ_BROWSER_SEARCH_MODELS.has(env.groqAiModel)
}

function canUseTavilyFallback(): boolean {
  return env.tavilySearchEnabled && Boolean(env.tavilyApiKey)
}

async function searchWithGroq(input: UniversityWebSearchInput): Promise<TavilySearchResult[]> {
  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGroqUniversitySearchPayload(input)),
      signal: AbortSignal.timeout(75_000)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError('Groq Search не успел найти университеты. Попробуй уточнить запрос или повторить позже.', 504, 'UNIVERSITY_SEARCH_TIMEOUT')
    }
    throw new AppError('Не удалось связаться с Groq Browser Search.', 502, 'UNIVERSITY_SEARCH_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Groq отклонил API-ключ. Проверь GROQ_API_KEY в Render.', 503, 'UNIVERSITY_SEARCH_AUTH_FAILED')
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      throw new AppError(
        retryAfter
          ? `Groq Search временно ограничил запрос. Повтори через ${retryAfter} сек.`
          : 'Groq Search временно ограничил запрос. Попробуй ещё раз через минуту.',
        429,
        'UNIVERSITY_SEARCH_RATE_LIMITED'
      )
    }
    throw new AppError(`Groq Browser Search временно недоступен (HTTP ${response.status}).`, 502, 'UNIVERSITY_SEARCH_PROVIDER_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  const results = parseGroqUniversitySearchResponse(payload, input.mode === 'programs' ? input.domain : undefined)

  if (results.length === 0) {
    throw new AppError('Groq выполнил поиск, но не вернул проверяемые ссылки. Попробуй уточнить запрос.', 502, 'UNIVERSITY_SEARCH_EMPTY')
  }

  return results
}

export function getUniversitySearchStatus(): {
  enabled: boolean
  configured: boolean
  provider: 'groq' | 'tavily' | 'none'
} {
  const groqReady = canUseGroqBrowserSearch()
  const tavilyReady = canUseTavilyFallback()

  return {
    enabled: groqReady || env.tavilySearchEnabled,
    configured: groqReady || tavilyReady,
    provider: groqReady ? 'groq' : tavilyReady ? 'tavily' : 'none'
  }
}

export async function searchUniversitiesWeb(
  input: UniversityWebSearchInput
): Promise<UniversityWebSearchResponse> {
  const query = input.query.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (query.length < 3) return { provider: 'groq', results: [] }

  const normalizedInput = { ...input, query }
  const key = cacheKey(normalizedInput)
  const cached = readCache(key)
  if (cached) return cached

  let response: UniversityWebSearchResponse

  if (canUseGroqBrowserSearch()) {
    try {
      response = {
        provider: 'groq',
        results: await searchWithGroq(normalizedInput)
      }
    } catch (error) {
      if (!canUseTavilyFallback()) throw error
      response = {
        provider: 'tavily',
        results: await searchTavilyWeb(normalizedInput)
      }
    }
  } else if (canUseTavilyFallback()) {
    response = {
      provider: 'tavily',
      results: await searchTavilyWeb(normalizedInput)
    }
  } else if (!hasGroqAIConfig) {
    throw new AppError('Внешний поиск не настроен. Добавь GROQ_API_KEY в переменные backend.', 503, 'UNIVERSITY_SEARCH_NOT_CONFIGURED')
  } else {
    throw new AppError('Для Browser Search нужна модель openai/gpt-oss-120b или openai/gpt-oss-20b.', 503, 'UNIVERSITY_SEARCH_MODEL_UNSUPPORTED')
  }

  writeCache(key, response)
  return response
}
