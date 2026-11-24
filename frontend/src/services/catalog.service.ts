import type {
  CatalogPage,
  DirectionDetails,
  DirectionSummary,
  EducationLevel,
  ProfessionDetails,
  ProfessionSummary
} from '@trajectory/shared'

import { api } from '@/services/api'

export interface CatalogFilters {
  search?: string
  category?: string
  level?: EducationLevel
  page?: number
  pageSize?: number
}

function createQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value).trim())
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const catalogService = {
  getProfessions(filters: CatalogFilters = {}): Promise<CatalogPage<ProfessionSummary>> {
    return api.get<CatalogPage<ProfessionSummary>>(`/api/catalog/professions${createQuery(filters)}`)
  },

  getProfession(slug: string): Promise<ProfessionDetails> {
    return api.get<ProfessionDetails>(`/api/catalog/professions/${encodeURIComponent(slug)}`)
  },

  getDirections(filters: CatalogFilters = {}): Promise<CatalogPage<DirectionSummary>> {
    return api.get<CatalogPage<DirectionSummary>>(`/api/catalog/directions${createQuery(filters)}`)
  },

  getDirection(slug: string): Promise<DirectionDetails> {
    return api.get<DirectionDetails>(`/api/catalog/directions/${encodeURIComponent(slug)}`)
  }
}
