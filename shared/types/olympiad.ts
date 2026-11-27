
export type OlympiadLevel = 1 | 2 | 3 | 4
export type OlympiadListType = 'school_olympiad' | 'intellectual_competition'
export type OlympiadSourceStatus = 'official' | 'needs_review' | 'archived'

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
  listType: OlympiadListType
  officialListNumber?: number
  officialListKey?: string
  levelLabel?: string
  sourceDirection?: string
  gradeEligibilityStatus?: 'unknown' | 'needs_review' | 'official'
  gradeSourceUrl?: string
  gradeCheckedAt?: string
  sourceDocumentTitle?: string
  sourceDocumentUrl?: string
  sourceCheckedAt?: string
  sourceStatus?: OlympiadSourceStatus
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
  officialListKey?: string
  levelLabel?: string
  gradeEligibilityStatus?: 'unknown' | 'needs_review' | 'official'
  gradeSourceUrl?: string
  gradeCheckedAt?: string
  stages: OlympiadStage[]
}

export type OlympiadScheduleKind = 'registration' | 'stage'
export type OlympiadDateParseStatus = 'exact' | 'range' | 'inferred_year' | 'unknown'
export type OlympiadDateSemantics = 'event' | 'period' | 'deadline' | 'mixed' | 'unknown'

export interface OlympiadProfileSummary {
  id: string
  profileName: string
  level: OlympiadLevel | null
  levelLabel?: string
  sourceDirection?: string
  subjects: string[]
  sourceSubjects: string
  eligibleGrades: number[]
  gradeEligibilityStatus: 'unknown' | 'needs_review' | 'official'
  gradeSourceUrl?: string
  gradeCheckedAt?: string
}

export interface OlympiadScheduleItem {
  id: string
  kind: OlympiadScheduleKind
  stageName: string
  whenText: string
  isConfirmed: boolean
  checkedOn?: string
  organizerUrl: string
  startDate?: string
  endDate?: string
  dateParseStatus: OlympiadDateParseStatus
  dateSemantics: OlympiadDateSemantics
  startTime?: string
  endTime?: string
  timeZone?: string
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
  diplomaDegreeRequired?: number
  pointsAwarded?: number
  sourceExcerpt?: string
  verificationNotes?: string
  validYear: number
  sourceUrl: string
  lastCheckedAt: string
}

export interface OlympiadWithStatus extends Olympiad {
  status: OlympiadStatus
  season?: OlympiadSeason
  benefitYear: number
  benefits: OlympiadBenefitSummary[]
  profiles: OlympiadProfileSummary[]
  scheduleItems: OlympiadScheduleItem[]
}
