const CHANGE_EVENT = 'trajectory:calendar-selection-change'
const STORAGE_PREFIX = 'trajectory:calendar-selection:v1:'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope || 'guest'}`
}

export function readCalendarOlympiadIds(scope = 'guest'): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(scope)) ?? '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : []
  } catch {
    return []
  }
}

export function toggleCalendarOlympiad(scope: string, id: string): boolean {
  const current = readCalendarOlympiadIds(scope)
  const exists = current.includes(id)
  const next = exists ? current.filter((item) => item !== id) : [...current, id]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope } }))
  }
  return !exists
}

export function migrateGuestCalendarSelectionToUser(userId: string): void {
  if (!userId || typeof window === 'undefined') return
  try {
    const guest = readCalendarOlympiadIds('guest')
    if (guest.length === 0) return
    const scope = `user:${userId}`
    const merged = [...new Set([...readCalendarOlympiadIds(scope), ...guest])]
    window.localStorage.setItem(storageKey(scope), JSON.stringify(merged))
    window.localStorage.removeItem(storageKey('guest'))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope } }))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope: 'guest' } }))
  } catch {
    // Keep guest data in place if browser storage is unavailable.
  }
}

export function subscribeToCalendarSelection(scope: string, callback: () => void): () => void {
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
