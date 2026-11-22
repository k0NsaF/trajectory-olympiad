
import type {
  AIAskInput,
  AIAskResponse,
  AIServiceStatus
} from '@trajectory/shared'

import { api } from '@/services/api'

export const aiService = {
  getStatus(): Promise<AIServiceStatus> {
    return api.get<AIServiceStatus>('/api/ai/status')
  },

  ask(input: AIAskInput): Promise<AIAskResponse> {
    return api.post<AIAskResponse, AIAskInput>(
      '/api/ai/ask',
      input,
      { timeoutMs: 150_000 }
    )
  }
}
