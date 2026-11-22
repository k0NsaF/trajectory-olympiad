
import type {
  Achievement,
  CreateAchievementInput
} from '@trajectory/shared'

import { api } from '@/services/api'

export const achievementService = {
  getAll(): Promise<Achievement[]> {
    return api.get<Achievement[]>('/api/achievements')
  },

  create(input: CreateAchievementInput): Promise<Achievement> {
    return api.post<Achievement, CreateAchievementInput>(
      '/api/achievements',
      input
    )
  }
}
