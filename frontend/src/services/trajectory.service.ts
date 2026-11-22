
import type {
  CreateProfileInput,
  UserTrajectory
} from '@trajectory/shared'

import { api } from '@/services/api'

export const trajectoryService = {
  generate(input: CreateProfileInput): Promise<UserTrajectory> {
    return api.post<UserTrajectory, CreateProfileInput>(
      '/api/trajectory',
      input
    )
  }
}
