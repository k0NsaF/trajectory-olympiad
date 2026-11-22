export type BenefitRightType =
  | 'BVI'
  | '100_points'
  | 'extra_points'

export type BenefitRecipientStatus =
  | 'winner'
  | 'prize'
  | 'both'

export type BenefitVerificationStatus =
  | 'draft'
  | 'official'
  | 'archived'

export type BenefitVerificationFilter =
  | BenefitVerificationStatus
  | 'all'

export interface UniversityProgram {
  id: string
  universityId: string
  name: string
  direction?: string
}

export interface University {
  id: string
  name: string
  shortName: string
  city: string
  website?: string
  description?: string
  programs?: UniversityProgram[]
}

export interface UniversityBenefit {
  id: string
  universityId: string
  universityName?: string
  universityShortName?: string
  programId?: string
  programName?: string
  programDirection?: string
  olympiadId: string
  olympiadName?: string
  olympiadOrganizer?: string
  rightType: BenefitRightType
  forStatus: BenefitRecipientStatus
  levelRequired?: number
  confirmExamThreshold?: number
  confirmExamSubject?: string
  resultClassRequired?: number
  sourceUrl: string
  validYear: number
  lastCheckedAt?: string
  verificationStatus: BenefitVerificationStatus
}

export type UniversityDiscoveryMode = 'universities' | 'programs'

export interface UniversityDiscoveryInput {
  query: string
  mode?: UniversityDiscoveryMode
  domain?: string
}

export interface UniversityDiscoveryResult {
  title: string
  url: string
  domain: string
  snippet: string
}

export interface UniversityDiscoveryResponse {
  query: string
  mode: UniversityDiscoveryMode
  results: UniversityDiscoveryResult[]
  note: string
}

export interface UniversityDiscoveryStatus {
  enabled: boolean
  configured: boolean
}
