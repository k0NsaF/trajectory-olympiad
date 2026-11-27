import type { EducationLevel } from './catalog.js'

export type TrajectoryPlanStatus = 'draft' | 'active' | 'superseded' | 'archived'

export type TrajectoryStageType =
  | 'foundation'
  | 'subject_preparation'
  | 'olympiads'
  | 'exam_preparation'
  | 'admission'
  | 'portfolio'
  | 'other'

export type TrajectoryStageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped'

export type TrajectoryTaskType =
  | 'study'
  | 'olympiad'
  | 'exam'
  | 'research'
  | 'application'
  | 'portfolio'
  | 'review'
  | 'other'

export type TrajectoryTaskPriority = 'low' | 'medium' | 'high'

export type TrajectoryTaskStatus =
  | 'todo'
  | 'in_progress'
  | 'completed'
  | 'skipped'

export interface TrajectoryProfileSnapshot {
  grade: number
  region: string
  subjects: string[]
  weeklyStudyHours: number
  targetAdmissionYear: number
  targetEducationLevel: EducationLevel
  targetUniversityId?: string
  targetProgramId?: string
  alternativeUniversityIds: string[]
  subjectPreparation: Array<{
    subjectId: string
    preparationLevel: 'beginner' | 'medium' | 'advanced'
  }>
}

export interface TrajectoryTaskDraft {
  stableKey: string
  title: string
  description?: string
  taskType: TrajectoryTaskType
  priority: TrajectoryTaskPriority
  startDate?: string
  dueDate?: string
  estimatedMinutes?: number
  weeklyMinutes?: number
  relatedOlympiadId?: string
  relatedUniversityId?: string
  relatedProgramId?: string
  sourceUrl?: string
  sourceLabel?: string
}

export interface TrajectoryStageDraft {
  stableKey: string
  stageType: TrajectoryStageType
  title: string
  description?: string
  startDate?: string
  endDate?: string
  tasks: TrajectoryTaskDraft[]
}

export interface TrajectoryPlanDraft {
  requestId: string
  profileUpdatedAt: string
  title: string
  summary: string
  academicYear: string
  ruleVersion: string
  profileSnapshot: TrajectoryProfileSnapshot
  stages: TrajectoryStageDraft[]
}

export interface GenerateTrajectoryRequest {
  requestId: string
}

export interface UpdateTrajectoryTaskStatusRequest {
  status: TrajectoryTaskStatus
}

export interface TrajectoryTask {
  id: string
  stableKey: string
  position: number
  title: string
  description?: string
  taskType: TrajectoryTaskType
  priority: TrajectoryTaskPriority
  status: TrajectoryTaskStatus
  startDate?: string
  dueDate?: string
  estimatedMinutes?: number
  weeklyMinutes?: number
  relatedOlympiadId?: string
  relatedUniversityId?: string
  relatedProgramId?: string
  sourceUrl?: string
  sourceLabel?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TrajectoryStage {
  id: string
  stableKey: string
  position: number
  stageType: TrajectoryStageType
  title: string
  description?: string
  status: TrajectoryStageStatus
  startDate?: string
  endDate?: string
  tasks: TrajectoryTask[]
  createdAt: string
  updatedAt: string
}

export interface TrajectoryPlan {
  id: string
  version: number
  status: TrajectoryPlanStatus
  title: string
  summary?: string
  academicYear?: string
  ruleVersion: string
  profileSnapshot: TrajectoryProfileSnapshot
  stages: TrajectoryStage[]
  createdAt: string
  activatedAt?: string
  supersededAt?: string
}

export interface TrajectoryPlanHistoryItem {
  id: string
  version: number
  status: TrajectoryPlanStatus
  title: string
  summary?: string
  academicYear?: string
  ruleVersion: string
  createdAt: string
  activatedAt?: string
  supersededAt?: string
}

export interface TrajectoryPlanResponse {
  plan: TrajectoryPlan | null
}

export interface TrajectoryHistoryResponse {
  items: TrajectoryPlanHistoryItem[]
}
