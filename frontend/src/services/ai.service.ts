
import type {
  AIAskInput,
  AIAskResponse
} from '@trajectory/shared'

import { api } from '@/services/api'

export const aiService = {
  ask(input: AIAskInput): Promise<AIAskResponse> {
    return api.post<AIAskResponse, AIAskInput>(
      '/api/ai/ask',
      input,
      { timeoutMs: 45_000 }
    )
  }
}
