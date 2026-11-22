
export type OlympiadLevel = 1 | 2 | 3 | 4

export type OlympiadStatus =
  | 'eligible'
  | 'upcoming'
  | 'closed'
  | 'unknown'

export type OlympiadStageType =
  | 'registration'
  | 'qualifying'
  | 'final'

export type OlympiadFormat =
  | 'online'
  | 'offline'
  | 'mixed'

export interface Olympiad {
  id: string
  name: string
  organizer: string
  level: OlympiadLevel | null
  subjects: string[]
  grades: number[]
  website?: string
  description?: string
}

export interface OlympiadStage {
  id: string
  olympiadId: string
  type: OlympiadStageType
  startDate: string
  endDate: string
  format: OlympiadFormat
  regionScope?: string[]
}

export interface OlympiadSeason {
  id: string
  olympiadId: string
  academicYear: string
  grades: number[]
  stages: OlympiadStage[]
}

export interface OlympiadBenefitSummary {
  id: string
  universityId: string
  universityName: string
  universityShortName: string
  programId?: string
  programName?: string
  rightType: 'BVI' | '100_points' | 'extra_points'
  forStatus: 'winner' | 'prize' | 'both'
  levelRequired?: number
  confirmExamSubject?: string
  confirmExamThreshold?: number
  resultClassRequired?: number
  validYear: number
  sourceUrl: string
  lastCheckedAt: string
}

export interface OlympiadWithStatus extends Olympiad {
  status: OlympiadStatus
  season?: OlympiadSeason
  benefitYear: number
  benefits: OlympiadBenefitSummary[]
}
