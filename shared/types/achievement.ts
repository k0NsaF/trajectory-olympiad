export type AchievementVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'

export type AchievementResultStatus =
  | 'participant'
  | 'prize'
  | 'winner'

export interface Achievement {
  id: string
  userId: string
  olympiadId?: string
  olympiadName: string
  title: string
  result: string
  resultStatus?: AchievementResultStatus
  grade?: number
  achievementYear?: number
  achievedAt?: string
  proofUrl?: string
  verificationStatus: AchievementVerificationStatus
  createdAt: string
  updatedAt: string
}

export interface CreateAchievementInput {
  olympiadId?: string
  olympiadName: string
  resultStatus: AchievementResultStatus
  grade: number
  achievementYear: number
  proofUrl?: string
}
