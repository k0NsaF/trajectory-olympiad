import { useOutletContext } from 'react-router-dom'

export interface AppLayoutContext {
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function useAppLayout(): AppLayoutContext {
  return useOutletContext<AppLayoutContext>()
}
