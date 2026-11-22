
import { useOutletContext } from 'react-router-dom'

import type { AppLayoutContext } from '@/app/AppLayout'

export function useAppLayout(): AppLayoutContext {
  return useOutletContext<AppLayoutContext>()
}
