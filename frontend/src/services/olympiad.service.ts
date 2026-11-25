import type {
  OlympiadFormat,
  OlympiadListType,
  OlympiadStatus,
  OlympiadWithStatus
} from '@trajectory/shared'

import { api } from '@/services/api'

export interface OlympiadFilters {
  search?: string
  subject?: string
  subjects?: string[]
  grade?: number
  level?: number
  listType?: OlympiadListType
  status?: OlympiadStatus
  format?: OlympiadFormat
  region?: string
  hasBenefits?: boolean
  universityId?: string
  programId?: string
  benefitYear?: number
}

function createQuery(filters: OlympiadFilters): string {
  const params = new URLSearchParams()

  if (filters.search?.trim()) {
    params.set('search', filters.search.trim())
  }

  if (filters.subjects?.length) {
    params.set('subjects', filters.subjects.join(','))
  } else if (filters.subject) {
    params.set('subject', filters.subject)
  }

  if (filters.grade !== undefined) {
    params.set('grade', String(filters.grade))
  }

  if (filters.level !== undefined) {
    params.set('level', String(filters.level))
  }

  if (filters.listType) {
    params.set('listType', filters.listType)
  }

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.format) {
    params.set('format', filters.format)
  }

  if (filters.region?.trim()) {
    params.set('region', filters.region.trim())
  }

  if (filters.hasBenefits !== undefined) {
    params.set('hasBenefits', String(filters.hasBenefits))
  }

  if (filters.universityId) {
    params.set('universityId', filters.universityId)
  }

  if (filters.programId) {
    params.set('programId', filters.programId)
  }

  if (filters.benefitYear !== undefined) {
    params.set('benefitYear', String(filters.benefitYear))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export const olympiadService = {
  getAll(filters: OlympiadFilters = {}): Promise<OlympiadWithStatus[]> {
    return api.get<OlympiadWithStatus[]>(
      `/api/olympiads${createQuery(filters)}`
    )
  },

  getById(id: string): Promise<OlympiadWithStatus> {
    return api.get<OlympiadWithStatus>(
      `/api/olympiads/${encodeURIComponent(id)}`
    )
  }
}
