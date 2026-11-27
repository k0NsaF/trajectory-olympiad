export type EducationLevel = 'bachelor' | 'specialist' | 'master' | 'basic_higher' | 'specialized_higher'
export type CatalogContentStatus = 'editorial' | 'official' | 'needs_review'
export type CatalogRelationship = 'primary' | 'related'

export interface CatalogPage<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ProfessionSummary {
  id: string
  slug: string
  name: string
  category: string
  summary: string
  content_status: CatalogContentStatus
}

export interface DirectionSummary {
  id: string
  slug: string
  code: string
  name: string
  education_level: EducationLevel
  category: string
  summary: string
  content_status: CatalogContentStatus
}

export interface ProfessionDirection extends DirectionSummary {
  relationship: CatalogRelationship
  rationale: string
}

export interface ProfessionDetails extends ProfessionSummary {
  description: string
  typical_tasks: string[]
  skills: string[]
  school_subjects: string[]
  interests: string[]
  source_url?: string | null
  directions: ProfessionDirection[]
}

export interface DirectionProfession extends ProfessionSummary {
  relationship: CatalogRelationship
  rationale: string
}

export interface DirectionProgram {
  id: string
  name: string
  legacyDirection?: string | null
  university: {
    id: string
    name: string
    shortName: string
    city: string
    region?: string | null
  }
  sourceUrl: string
  verifiedAt?: string | null
}

export interface DirectionDetails extends DirectionSummary {
  description: string
  source_url?: string | null
  professions: DirectionProfession[]
  programs: DirectionProgram[]
}
