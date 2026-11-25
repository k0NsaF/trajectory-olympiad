export type FavoriteKind = 'university' | 'olympiad'

export interface FavoriteEntry {
  kind: FavoriteKind
  id: string
  savedAt: string
}

const CHANGE_EVENT = 'trajectory:favorites-change'
const STORAGE_PREFIX = 'trajectory:favorites:v1:'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope || 'guest'}`
}

export function readFavorites(scope = 'guest'): FavoriteEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is FavoriteEntry =>
      Boolean(item) &&
      typeof item === 'object' &&
      ((item as FavoriteEntry).kind === 'university' || (item as FavoriteEntry).kind === 'olympiad') &&
      typeof (item as FavoriteEntry).id === 'string' &&
      typeof (item as FavoriteEntry).savedAt === 'string'
    )
  } catch {
    return []
  }
}

function writeFavorites(scope: string, entries: FavoriteEntry[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(scope), JSON.stringify(entries))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope } }))
}

export function isFavorite(scope: string, kind: FavoriteKind, id: string): boolean {
  return readFavorites(scope).some((item) => item.kind === kind && item.id === id)
}

export function toggleFavorite(scope: string, kind: FavoriteKind, id: string): boolean {
  const current = readFavorites(scope)
  const exists = current.some((item) => item.kind === kind && item.id === id)
  const next = exists
    ? current.filter((item) => !(item.kind === kind && item.id === id))
    : [...current, { kind, id, savedAt: new Date().toISOString() }]
  writeFavorites(scope, next)
  return !exists
}

export function removeFavorite(scope: string, kind: FavoriteKind, id: string): void {
  writeFavorites(scope, readFavorites(scope).filter((item) => !(item.kind === kind && item.id === id)))
}

export function migrateGuestFavoritesToUser(userId: string): void {
  if (!userId) return
  try {
    const guest = readFavorites('guest')
    if (guest.length === 0) return
    const scope = `user:${userId}`
    const merged = new Map<string, FavoriteEntry>()
    for (const entry of [...readFavorites(scope), ...guest]) {
      merged.set(`${entry.kind}:${entry.id}`, entry)
    }
    writeFavorites(scope, [...merged.values()])
    window.localStorage.removeItem(storageKey('guest'))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope: 'guest' } }))
  } catch {
    // Keep guest data in place if browser storage is unavailable.
  }
}

export function subscribeToFavorites(scope: string, callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onChange = (event: Event) => {
    const custom = event as CustomEvent<{ scope?: string }>
    if (!custom.detail?.scope || custom.detail.scope === scope) callback()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(scope)) callback()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
