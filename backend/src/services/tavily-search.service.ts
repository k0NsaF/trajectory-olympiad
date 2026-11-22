import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import {
  filterAndRankUniversityResults,
  isSpecificUniversityQuery,
  type UniversitySearchQualityInput
} from './university-search-quality.service.js'

export interface TavilySearchResult {
  title: string
  url: string
  domain: string
  snippet: string
}

export interface TavilySearchInput {
  query: string
  mode: 'universities' | 'programs'
  domain?: string
}

interface CachedSearch {
  expiresAt: number
  results: TavilySearchResult[]
}

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

export function parseTavilySearchResponse(
  payload: unknown,
  input?: UniversitySearchQualityInput
): TavilySearchResult[] {
  if (!payload || typeof payload !== 'object') return []
  const rawResults = (payload as { results?: unknown }).results
  if (!Array.isArray(rawResults)) return []

  const results: TavilySearchResult[] = []
  const seen = new Set<string>()

  for (const item of rawResults) {
    if (!item || typeof item !== 'object') continue
    const value = item as { title?: unknown; url?: unknown; content?: unknown }
    if (typeof value.url !== 'string') continue

    const url = normalizePublicUrl(value.url)
    if (!url || seen.has(url.toString())) continue

    const title = typeof value.title === 'string' ? cleanText(value.title) : ''
    const snippet = typeof value.content === 'string' ? cleanText(value.content) : ''
    if (!title || !snippet) continue

    seen.add(url.toString())
    results.push({
      title: title.slice(0, 220),
      url: url.toString(),
      domain: url.hostname.replace(/^www\./, ''),
      snippet: snippet.slice(0, 900)
    })

    if (results.length >= 20) break
  }

  return input ? filterAndRankUniversityResults(results, input) : results
}

function ensureSearchIsConfigured(): void {
  if (!env.tavilySearchEnabled) {
    throw new AppError(
      'Внешний поиск выключен. Добавь TAVILY_API_KEY и включи TAVILY_SEARCH_ENABLED=true в настройках backend.',
      503,
      'UNIVERSITY_SEARCH_DISABLED'
    )
  }

  if (!env.tavilyApiKey) {
    throw new AppError(
      'Для внешнего поиска нужен TAVILY_API_KEY в настройках backend на Render.',
      503,
      'UNIVERSITY_SEARCH_NOT_CONFIGURED'
    )
  }
}

function cacheKey(query: string): string {
  return query.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim()
}

function readCache(key: string): TavilySearchResult[] | null {
  const cached = searchCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key)
    return null
  }
  return cached.results
}

function writeCache(key: string, results: TavilySearchResult[]): void {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = searchCache.keys().next().value
    if (firstKey) searchCache.delete(firstKey)
  }
  searchCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function buildUniversitySearchQuery(input: TavilySearchInput): string {
  const query = input.query.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()

  if (input.mode === 'programs' && input.domain) {
    return `site:${input.domain} ${query} образовательные программы бакалавриат направления подготовки`
  }

  if (isSpecificUniversityQuery(query)) {
    return `\"${query}\" официальный сайт приёмная комиссия абитуриент образовательные программы`
  }

  return `${query} официальный сайт университета приёмная комиссия абитуриент образовательные программы бакалавриат`
}

export async function searchTavilyWeb(input: TavilySearchInput): Promise<TavilySearchResult[]> {
  ensureSearchIsConfigured()

  const query = buildUniversitySearchQuery(input).slice(0, 420)
  if (query.length < 3) return []

  const key = cacheKey(`${query}|${input.domain ?? ''}`)
  const cached = readCache(key)
  if (cached) return cached

  let response: Response
  try {
    response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.tavilyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        topic: 'general',
        max_results: 12,
        include_answer: false,
        include_raw_content: false,
        ...(input.mode === 'programs' && input.domain
          ? { include_domains: [input.domain] }
          : {})
      }),
      signal: AbortSignal.timeout(20_000)
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AppError('Поиск университетов не успел ответить. Попробуй ещё раз.', 504, 'UNIVERSITY_SEARCH_TIMEOUT')
    }
    throw new AppError('Не удалось связаться с Tavily. Проверь подключение и попробуй ещё раз.', 502, 'UNIVERSITY_SEARCH_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Tavily отклонил API-ключ. Проверь TAVILY_API_KEY в настройках Render.', 503, 'UNIVERSITY_SEARCH_AUTH_FAILED')
    }
    if (response.status === 402 || response.status === 429) {
      throw new AppError('Лимит или баланс поисковых кредитов Tavily исчерпан. Проверь Usage в кабинете Tavily.', 429, 'UNIVERSITY_SEARCH_RATE_LIMITED')
    }
    throw new AppError('Tavily Search API временно недоступен.', 502, 'UNIVERSITY_SEARCH_PROVIDER_ERROR')
  }

  const payload: unknown = await response.json().catch(() => null)
  const results = parseTavilySearchResponse(payload, input)
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { results?: unknown }).results)) {
    throw new AppError('Tavily вернул ответ в неизвестном формате.', 502, 'UNIVERSITY_SEARCH_INVALID_RESPONSE')
  }

  writeCache(key, results)
  return results
}

export function getTavilySearchStatus(): { enabled: boolean; configured: boolean } {
  return {
    enabled: env.tavilySearchEnabled,
    configured: Boolean(env.tavilyApiKey)
  }
}
