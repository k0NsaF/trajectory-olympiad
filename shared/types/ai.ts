import type { UserGrade } from './profile.js'

export type AIMessageRole = 'user' | 'assistant'

export type AIPageType =
  | 'catalog'
  | 'olympiad'
  | 'calendar'
  | 'universities'
  | 'university'
  | 'profile'
  | 'general'

export interface AISource {
  title: string
  url: string
  kind?: 'olympiad' | 'university' | 'benefit' | 'calendar' | 'web'
  validYear?: number
  verificationStatus?: 'draft' | 'official' | 'archived'
}

export interface AIMessage {
  id: string
  role: AIMessageRole
  content: string
  createdAt: string
  sources?: AISource[]
  notice?: string
}

export interface AIUserContext {
  grade?: UserGrade
  region?: string
  subjects?: string[]
  targetUniversityId?: string
  targetProgramId?: string
  page?: AIPageType
  entityId?: string
}

export interface AIHistoryMessage {
  role: AIMessageRole
  content: string
}

export interface AIAskInput {
  question: string
  context?: AIUserContext
  history?: AIHistoryMessage[]
}

export interface AIAskResponse {
  answer: string
  provider?: 'groq' | 'cloudflare'
  sources: AISource[]
  knowledgeStatus: 'retrieved' | 'general'
  notice?: string
}


export interface AIServiceStatus {
  modelConfigured: boolean
  provider: 'groq' | 'cloudflare' | 'none'
  fallbackConfigured: boolean
  webSearchEnabled: boolean
  webSearchConfigured: boolean
  model: string
}
