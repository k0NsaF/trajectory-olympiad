
import type { OlympiadWithStatus } from './olympiad.js'

export interface TrajectoryStats {
  totalOlympiads: number
  eligibleOlympiads: number
  upcomingOlympiads: number
  availableBenefits: number
}

export interface TrajectoryRecommendation {
  olympiadId: string
  title: string
  reason: string
  priority: number
}

export interface UserTrajectory {
  userId?: string
  grade: number
  region: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
  olympiads: OlympiadWithStatus[]
  stats: TrajectoryStats
  recommendations: TrajectoryRecommendation[]
  generatedAt: string
}
