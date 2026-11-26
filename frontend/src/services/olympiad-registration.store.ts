const CHANGE_EVENT = 'trajectory:olympiad-registration-change'
const STORAGE_PREFIX = 'trajectory:olympiad-registration:v1:'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope || 'guest'}`
}

export function readRegisteredOlympiadIds(scope = 'guest'): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : []
  } catch {
    return []
  }
}

export function toggleOlympiadRegistration(scope: string, olympiadId: string): boolean {
  const ids = readRegisteredOlympiadIds(scope)
  const alreadyRegistered = ids.includes(olympiadId)
  const next = alreadyRegistered ? ids.filter((id) => id !== olympiadId) : [...ids, olympiadId]
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scope } }))
  } catch {
    // Keep the current UI responsive even when storage is unavailable.
  }
  return !alreadyRegistered
}

export function subscribeToOlympiadRegistration(scope: string, callback: () => void): () => void {
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<{ scope?: string }>).detail
    if (detail?.scope === scope) callback()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(scope) || event.key === null) callback()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}