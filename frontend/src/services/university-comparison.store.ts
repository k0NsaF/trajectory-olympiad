const STORAGE_KEY = 'trajectory:university-comparison:v1'
const MAX_COMPARE_COUNT = 5

export function readComparisonUniversityIds(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return [...new Set(
      parsed.filter((value): value is string =>
        typeof value === 'string' && value.length > 0 && value.length <= 80
      )
    )].slice(0, MAX_COMPARE_COUNT)
  } catch {
    return []
  }
}

export function writeComparisonUniversityIds(ids: string[]): void {
  if (typeof window === 'undefined') return

  try {
    const safeIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
      .slice(0, MAX_COMPARE_COUNT)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeIds))
  } catch {
    // The comparison still works in memory when browser storage is unavailable.
  }
}
