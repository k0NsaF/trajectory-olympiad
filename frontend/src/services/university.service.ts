import type {
  BenefitVerificationFilter,
  University,
  UniversityBenefit,
  UniversityDiscoveryInput,
  UniversityDiscoveryResponse,
  UniversityDiscoveryStatus
} from '@trajectory/shared'

import { api } from '@/services/api'

export interface UniversityFilters {
  search?: string
  city?: string
}

export interface BenefitCompareFilters {
  universityId?: string
  programId?: string
  olympiadId?: string
  validYear?: number
  verificationStatus?: BenefitVerificationFilter
}

function createQuery(filters: object): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() !== '') {
      params.set(key, value.trim())
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      params.set(key, String(value))
    }
  }

  const query = params.toString()

  return query ? `?${query}` : ''
}

export const universityService = {
  getAll(
    filters: UniversityFilters = {}
  ): Promise<University[]> {
    return api.get<University[]>(
      `/api/universities${createQuery(filters)}`
    )
  },

  getById(id: string): Promise<University> {
    return api.get<University>(
      `/api/universities/${encodeURIComponent(id)}`
    )
  },

  discover(
    input: UniversityDiscoveryInput
  ): Promise<UniversityDiscoveryResponse> {
    return api.get<UniversityDiscoveryResponse>(
      `/api/universities/discover${createQuery(input)}`,
      { timeoutMs: 85_000 }
    )
  },

  getDiscoveryStatus(): Promise<UniversityDiscoveryStatus> {
    return api.get<UniversityDiscoveryStatus>('/api/universities/discover/status')
  },

  compareBenefits(
    filters: BenefitCompareFilters = {}
  ): Promise<UniversityBenefit[]> {
    return api.get<UniversityBenefit[]>(
      `/api/benefits/compare${createQuery(filters)}`
    )
  }
}
