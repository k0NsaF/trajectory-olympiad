import { api } from '@/services/api'

export type TrajectoryPlanStatus = 'draft' | 'active' | 'superseded' | 'archived'
export type TrajectoryStageStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'
export type TrajectoryTaskStatus = 'todo' | 'in_progress' | 'completed' | 'skipped'
export type TrajectoryTaskType = 'study' | 'olympiad' | 'exam' | 'research' | 'application' | 'portfolio' | 'review' | 'other'
export type TrajectoryTaskPriority = 'low' | 'medium' | 'high'

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
  stageType: 'foundation' | 'subject_preparation' | 'olympiads' | 'exam_preparation' | 'admission' | 'portfolio' | 'other'
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
  profileSnapshot: {
    grade: number
    region: string
    subjects: string[]
    weeklyStudyHours: number
    targetAdmissionYear: number
    targetEducationLevel: 'bachelor' | 'specialist' | 'basic_higher'
    targetUniversityId?: string
    targetProgramId?: string
    alternativeUniversityIds: string[]
    subjectPreparation: Array<{
      subjectId: string
      preparationLevel: 'beginner' | 'medium' | 'advanced'
    }>
  }
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

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

export const trajectoryService = {
  async getActive(accessToken: string): Promise<TrajectoryPlan | null> {
    const response = await api.get<{ plan: TrajectoryPlan | null }>('/api/trajectory', {
      token: accessToken
    })
    return response.plan
  },

  async getHistory(accessToken: string): Promise<TrajectoryPlanHistoryItem[]> {
    const response = await api.get<{ items: TrajectoryPlanHistoryItem[] }>('/api/trajectory/history', {
      token: accessToken
    })
    return response.items
  },

  async getById(planId: string, accessToken: string): Promise<TrajectoryPlan> {
    const response = await api.get<{ plan: TrajectoryPlan }>(`/api/trajectory/${encodeURIComponent(planId)}`, {
      token: accessToken
    })
    return response.plan
  },

  async generate(accessToken: string): Promise<TrajectoryPlan> {
    const response = await api.post<{ plan: TrajectoryPlan }, { requestId: string }>(
      '/api/trajectory/generate',
      { requestId: createRequestId() },
      { token: accessToken }
    )
    return response.plan
  },

  async updateTaskStatus(
    taskId: string,
    status: TrajectoryTaskStatus,
    accessToken: string
  ): Promise<TrajectoryPlan> {
    const response = await api.patch<
      { plan: TrajectoryPlan },
      { status: TrajectoryTaskStatus }
    >(`/api/trajectory/tasks/${encodeURIComponent(taskId)}`, { status }, { token: accessToken })
    return response.plan
  }
}