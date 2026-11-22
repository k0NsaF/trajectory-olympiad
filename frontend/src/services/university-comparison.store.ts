import type { UniversityDiscoveryResult } from '@trajectory/shared'

const STORAGE_KEY = 'trajectory:university-comparison:v2'
const LEGACY_STORAGE_KEY = 'trajectory:university-comparison:v1'
const CHANGE_EVENT = 'trajectory:university-comparison-change'
const MAX_COMPARE_COUNT = 5

export type ComparisonUniversitySelection =
  | { kind: 'catalog'; id: string }
  | ({ kind: 'discovered'; id: string } & UniversityDiscoveryResult)

export type AddDiscoveredUniversityResult =
  | { status: 'added'; id: string }
  | { status: 'already-added'; id: string }
  | { status: 'limit-reached'; id: string }

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeSelection(value: unknown): ComparisonUniversitySelection | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>

  if (item.kind === 'catalog' && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 100) {
    return { kind: 'catalog', id: item.id }
  }

  if (
    item.kind === 'discovered' &&
    typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 180 &&
    typeof item.title === 'string' && item.title.trim().length > 0 &&
    typeof item.url === 'string' && typeof item.domain === 'string' &&
    typeof item.snippet === 'string'
  ) {
    const url = normalizeUrl(item.url)
    if (!url) return null
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const domain = item.domain.toLowerCase().replace(/^www\./, '').trim()
    if (!domain || !(host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))) return null

    return {
      kind: 'discovered',
      id: item.id,
      title: item.title.trim().slice(0, 240),
      url,
      domain,
      snippet: item.snippet.slice(0, 1200)
    }
  }

  return null
}

function readRawSelections(): ComparisonUniversitySelection[] {
  if (typeof window === 'undefined') return []

  try {
    const current = window.localStorage.getItem(STORAGE_KEY)
    if (current) {
      const parsed: unknown = JSON.parse(current)
      if (!Array.isArray(parsed)) return []
      return [...new Map(
        parsed
          .map(normalizeSelection)
          .filter((item): item is ComparisonUniversitySelection => item !== null)
          .map((item) => [item.id, item] as const)
      ).values()].slice(0, MAX_COMPARE_COUNT)
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return []
    const parsedLegacy: unknown = JSON.parse(legacy)
    if (!Array.isArray(parsedLegacy)) return []

    return [...new Set(
      parsedLegacy.filter((value): value is string =>
        typeof value === 'string' && value.length > 0 && value.length <= 100
      )
    )].slice(0, MAX_COMPARE_COUNT).map((id) => ({ kind: 'catalog', id }))
  } catch {
    return []
  }
}

export function readComparisonSelections(): ComparisonUniversitySelection[] {
  return readRawSelections()
}

export function writeComparisonSelections(selections: ComparisonUniversitySelection[]): void {
  if (typeof window === 'undefined') return

  try {
    const normalized = selections
      .map(normalizeSelection)
      .filter((item): item is ComparisonUniversitySelection => item !== null)
    const unique = [...new Map(normalized.map((item) => [item.id, item] as const)).values()]
      .slice(0, MAX_COMPARE_COUNT)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
  } catch {
    // Comparison remains available in memory if browser storage is unavailable.
  }
}

export function readComparisonUniversityIds(): string[] {
  return readRawSelections()
    .filter((item): item is Extract<ComparisonUniversitySelection, { kind: 'catalog' }> => item.kind === 'catalog')
    .map((item) => item.id)
}

export function readDiscoveredComparisonUniversities(): Extract<ComparisonUniversitySelection, { kind: 'discovered' }>[] {
  return readRawSelections().filter(
    (item): item is Extract<ComparisonUniversitySelection, { kind: 'discovered' }> => item.kind === 'discovered'
  )
}

/** Updates catalog selections without dropping externally discovered universities. */
export function writeComparisonUniversityIds(ids: string[]): void {
  const discovered = readDiscoveredComparisonUniversities()
  const catalog = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
    .map((id) => ({ kind: 'catalog' as const, id }))
  writeComparisonSelections([...catalog, ...discovered])
}

function getRootDomain(value: string): string {
  const host = value.toLowerCase().replace(/^www\./, '').split(':')[0]
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return host

  const secondLevel = parts[parts.length - 2] ?? ''
  const topLevel = parts[parts.length - 1] ?? ''
  const usesShortCountrySuffix = topLevel.length === 2 && secondLevel.length <= 3
  return usesShortCountrySuffix ? parts.slice(-3).join('.') : parts.slice(-2).join('.')
}

export function getDiscoveredComparisonId(result: UniversityDiscoveryResult): string {
  const host = result.domain || new URL(result.url).hostname
  return `discovered:${getRootDomain(host)}`
}

export function addDiscoveredUniversityToComparison(
  result: UniversityDiscoveryResult
): AddDiscoveredUniversityResult {
  const id = getDiscoveredComparisonId(result)
  const current = readRawSelections()
  const existing = current.find((item) => item.id === id)
  if (existing) return { status: 'already-added', id }
  if (current.length >= MAX_COMPARE_COUNT) return { status: 'limit-reached', id }

  const nextItem = normalizeSelection({ kind: 'discovered', id, ...result })
  if (!nextItem || nextItem.kind !== 'discovered') return { status: 'limit-reached', id }

  writeComparisonSelections([...current, nextItem])
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return { status: 'added', id }
}

export function removeComparisonSelection(id: string): void {
  writeComparisonSelections(readRawSelections().filter((item) => item.id !== id))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearComparisonSelections(): void {
  writeComparisonSelections([])
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToComparisonChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
