import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Bot, ExternalLink, MessageSquarePlus, Send, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import type {
  AIMessage,
  AIPageType,
  AIUserContext,
  AIServiceStatus,
  CreateProfileInput
} from '@trajectory/shared'

import { useAuth } from '@/app/providers'
import { PageHeader } from '@/components/common/PageHeader'
import { getAuthenticatedProfile, getGuestProfile } from '@/services/profile.service'
import { aiService } from '@/services/ai.service'
import { AIMessageContent } from './AIMessageContent'
import './ai-enhancements.css'

interface NavigationState {
  sourcePath?: string
  initialQuestion?: string
}
interface AIConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AIMessage[]
}

interface AIChatState {
  conversations: AIConversation[]
  activeConversationId: string
}

function getAIConversationsKey(scope: string): string {
  return `trajectory:ai-conversations:v1:${scope}`
}

function getAIConversationTitle(messages: AIMessage[]): string {
  const firstQuestion = messages.find((message) => message.role === 'user')?.content
  const title = (firstQuestion ?? '').replace(/\s+/g, ' ').trim()
  if (!title) return 'Новый диалог'
  return title.length > 52 ? `${title.slice(0, 49)}…` : title
}

function createAIConversation(messages: AIMessage[] = []): AIConversation {
  const now = new Date().toISOString()
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: getAIConversationTitle(messages),
    createdAt: messages[0]?.createdAt ?? now,
    updatedAt: messages[messages.length - 1]?.createdAt ?? now,
    messages: messages.slice(-40)
  }
}

function isStoredAIMessage(value: unknown): value is AIMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' &&
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' &&
    typeof item.createdAt === 'string'
}

function isStoredAIConversation(value: unknown): value is AIConversation {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    Array.isArray(item.messages) &&
    item.messages.every(isStoredAIMessage)
}

function readAIConversations(scope: string): AIConversation[] {
  try {
    const raw = window.localStorage.getItem(getAIConversationsKey(scope))
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const stored = parsed
          .filter(isStoredAIConversation)
          .map((conversation) => ({ ...conversation, messages: conversation.messages.slice(-40) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 10)
        if (stored.length > 0) return stored
      }
    }
  } catch {
    // Fall back to the previous single-chat history format.
  }
  return [createAIConversation(readAIHistory(scope))]
}

function getAIHistoryKey(scope: string): string {
  return `trajectory:ai-history:v1:${scope}`
}

function readAIHistory(scope: string): AIMessage[] {
  try {
    const raw = window.localStorage.getItem(getAIHistoryKey(scope))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is AIMessage => Boolean(
      item && typeof item === 'object' &&
      'id' in item && typeof item.id === 'string' &&
      'role' in item && (item.role === 'user' || item.role === 'assistant') &&
      'content' in item && typeof item.content === 'string' &&
      'createdAt' in item && typeof item.createdAt === 'string'
    )).slice(-40)
  } catch {
    return []
  }
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

interface AIPageContext {
  page: AIPageType
  entityId?: string
}

const QUICK_QUESTIONS = [
  'Какие олимпиады мне подойдут?',
  'Что даёт диплом победителя?',
  'Как подготовиться к олимпиаде?',
  'Какие регистрации скоро закроются?'
]

function getPageContext(path: string): AIPageContext {
  const olympiadMatch = path.match(/^\/olympiads\/([0-9a-f-]{36})$/i)
  if (olympiadMatch) return { page: 'olympiad', entityId: olympiadMatch[1] }

  const universityMatch = path.match(/^\/universities\/([0-9a-f-]{36})$/i)
  if (universityMatch) return { page: 'university', entityId: universityMatch[1] }

  if (path.startsWith('/trajectory')) return { page: 'trajectory' }
  if (path.startsWith('/olympiads')) return { page: 'catalog' }
  if (path.startsWith('/calendar')) return { page: 'calendar' }
  if (path.startsWith('/universities')) return { page: 'universities' }
  if (path.startsWith('/profile') || path.startsWith('/settings')) return { page: 'profile' }
  return { page: 'general' }
}

function buildUserContext(
  profile: CreateProfileInput | null,
  pageContext: AIPageContext
): AIUserContext {
  return {
    ...pageContext,
    ...(profile ? {
      grade: profile.grade,
      region: profile.region,
      subjects: profile.subjects,
      ...(profile.targetUniversityId ? { targetUniversityId: profile.targetUniversityId } : {}),
      ...(profile.targetProgramId ? { targetProgramId: profile.targetProgramId } : {})
    } : {})
  }
}

function getPageContextLabel(context: Pick<AIPageContext, 'page'>): string {
  const labels: Record<AIPageType, string> = {
    catalog: 'Каталог олимпиад',
    olympiad: 'Карточка олимпиады',
    calendar: 'Календарь',
    universities: 'Список вузов',
    university: 'Страница вуза',
    profile: 'Профиль',
    trajectory: 'Моя траектория',
    general: 'Общие вопросы'
  }
  return labels[context.page ?? 'general']
}

function getSourceStatusLabel(status?: string): string | null {
  if (status === 'official') return 'Официально проверено'
  if (status === 'archived') return 'Архив'
  if (status === 'draft') return 'Черновик'
  return null
}

export function AIPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const navigationState = location.state as NavigationState | null
  const sourcePath = navigationState?.sourcePath ?? '/ai'
  const historyScope = session?.user?.id ? `user:${session.user.id}` : 'guest'
  const pageContext = useMemo(() => getPageContext(sourcePath), [sourcePath])

  const [profile, setProfile] = useState<CreateProfileInput | null>(getGuestProfile)
  const [chatState, setChatState] = useState<AIChatState>(() => {
    const conversations = readAIConversations(historyScope)
    return { conversations, activeConversationId: conversations[0].id }
  })
  const [loadedHistoryScope, setLoadedHistoryScope] = useState(historyScope)
  const activeConversation = chatState.conversations.find((conversation) => conversation.id === chatState.activeConversationId)
    ?? chatState.conversations[0]
  const messages = activeConversation?.messages ?? []
  const setMessages = (update: AIMessage[] | ((current: AIMessage[]) => AIMessage[])) => {
    setChatState((current) => {
      const conversation = current.conversations.find((item) => item.id === current.activeConversationId)
        ?? createAIConversation()
      const nextMessages = typeof update === 'function' ? update(conversation.messages) : update
      const updatedConversation: AIConversation = {
        ...conversation,
        title: conversation.title === 'Новый диалог' ? getAIConversationTitle(nextMessages) : conversation.title,
        updatedAt: nextMessages[nextMessages.length - 1]?.createdAt ?? conversation.updatedAt,
        messages: nextMessages.slice(-40)
      }
      return {
        conversations: [updatedConversation, ...current.conversations.filter((item) => item.id !== conversation.id)].slice(0, 10),
        activeConversationId: updatedConversation.id
      }
    })
  }
  const [question, setQuestion] = useState(() => navigationState?.initialQuestion ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<AIServiceStatus | null>(null)

  useEffect(() => {
    const conversations = readAIConversations(historyScope)
    setChatState({ conversations, activeConversationId: conversations[0].id })
    setLoadedHistoryScope(historyScope)
  }, [historyScope])

  useEffect(() => {
    if (loadedHistoryScope !== historyScope) return
    try {
      window.localStorage.setItem(getAIConversationsKey(historyScope), JSON.stringify(chatState.conversations.slice(0, 10)))
    } catch {
      // Conversations remain available in memory when browser storage is unavailable.
    }
  }, [historyScope, loadedHistoryScope, chatState.conversations])

  const handleNewConversation = () => {
    if (sending) return
    const conversation = createAIConversation()
    setChatState((current) => ({
      conversations: [conversation, ...current.conversations].slice(0, 10),
      activeConversationId: conversation.id
    }))
    setQuestion('')
    setError(null)
  }

  const handleDeleteConversation = () => {
    if (sending) return
    setChatState((current) => {
      const remaining = current.conversations.filter((conversation) => conversation.id !== current.activeConversationId)
      const next = remaining[0] ?? createAIConversation()
      return {
        conversations: remaining.length > 0 ? remaining : [next],
        activeConversationId: next.id
      }
    })
    setError(null)
  }

  useEffect(() => {
    if (navigationState?.initialQuestion) setQuestion(navigationState.initialQuestion)
  }, [navigationState?.initialQuestion])

  useEffect(() => {
    let active = true
    void aiService.getStatus()
      .then((status) => {
        if (active) setServiceStatus(status)
      })
      .catch(() => {
        if (active) setServiceStatus(null)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true

    if (!session?.access_token) {
      setProfile(getGuestProfile())
      return () => { active = false }
    }

    void getAuthenticatedProfile(session.access_token)
      .then((savedProfile) => {
        if (active) setProfile(savedProfile)
      })
      .catch(() => {
        if (active) setProfile(getGuestProfile())
      })

    return () => { active = false }
  }, [session?.access_token])

  const userContext = useMemo(
    () => buildUserContext(profile, pageContext),
    [profile, pageContext]
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = question.trim()

    if (text.length < 3 || sending) return

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }
    const history = messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1800)
    }))

    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setError(null)

    const explicitNavigation = /(?:^|[^а-яё])(?:открой|открыть|перейди|перейти|покажи|показать|направь|перенаправь)[а-яё]*(?=$|[^а-яё])/i.test(text)
    const navigationTargets: Array<{ route: string; pattern: RegExp; title: string }> = [
      { route: '/universities/compare', pattern: /(?:сравн[а-яё]*[\s\S]{0,80}(?:вуз[а-яё]*|университет[а-яё]*)|(?:вуз[а-яё]*|университет[а-яё]*)[\s\S]{0,80}сравн[а-яё]*)/i, title: 'Сравнение университетов' },
      { route: '/trajectory', pattern: /(?:траектор[а-яё]*|план\s+поступлен[а-яё]*|персональн[а-яё]*\s+план)/i, title: 'Моя траектория' },
      { route: '/universities', pattern: /(?:вуз[а-яё]*|университет[а-яё]*|колледж[а-яё]*)/i, title: 'Каталог университетов' },
      { route: '/olympiads', pattern: /(?:олимпиад[а-яё]*|конкурс[а-яё]*|соревнован[а-яё]*)/i, title: 'Каталог олимпиад' },
      { route: '/calendar', pattern: /(?:календар[а-яё]*|расписан[а-яё]*|напоминан[а-яё]*)/i, title: 'Календарь' },
      { route: '/professions', pattern: /професси[а-яё]*/i, title: 'Каталог профессий' },
      { route: '/directions', pattern: /(?:направлен[а-яё]*|специальност[а-яё]*)/i, title: 'Направления обучения' },
      { route: '/favorites', pattern: /(?:избранн[а-яё]*|сохраненн[а-яё]*)/i, title: 'Избранное' },
      { route: '/profile', pattern: /(?:профил[а-яё]*|анкета)/i, title: 'Профиль' }
    ]
    const target = explicitNavigation ? navigationTargets.find((item) => item.pattern.test(text)) : undefined
    if (target) {
      const assistantMessage: AIMessage = {
        id: `assistant-nav-${Date.now()}`,
        role: 'assistant',
        content: `Открываю раздел «${target.title}».`,
        createdAt: new Date().toISOString()
      }
      setMessages((current) => [...current, assistantMessage])
      navigate(target.route, { replace: false })
      return
    }

    setSending(true)
    try {
      const response = await aiService.ask({
        question: text,
        context: userContext,
        history
      })

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        createdAt: new Date().toISOString(),
        sources: response.sources ?? [],
        ...(response.notice ? { notice: response.notice } : {})
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось получить ответ от консультанта. Попробуй ещё раз.'
      )
    } finally {
      setSending(false)
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setQuestion(suggestion)
  }

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ТВОЙ ОБРАЗОВАТЕЛЬНЫЙ ПОМОЩНИК"
        title="ИИ-консультант"
        description="Задавай вопросы об олимпиадах, подготовке и поступлении в университет."
      />

      <section className="panel ai-panel">
        <div className="ai-chat-toolbar">
          <label className="ai-chat-history">
            <span>История диалогов</span>
            <select
              value={chatState.activeConversationId}
              onChange={(event) => setChatState((current) => ({ ...current, activeConversationId: event.target.value }))}
              disabled={sending}
              aria-label="Выбрать диалог"
            >
              {chatState.conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
              ))}
            </select>
          </label>
          <div className="ai-chat-actions">
            <button type="button" onClick={handleNewConversation} disabled={sending}>
              <MessageSquarePlus size={16} /> Новый чат
            </button>
            <button type="button" onClick={handleDeleteConversation} disabled={sending || messages.length === 0}>
              <Trash2 size={16} /> Удалить чат
            </button>
          </div>
        </div>
        <div className="ai-intro">
          <div className="ai-avatar">
            <Bot size={25} />
          </div>
          <div>
            <strong>Траектория AI</strong>
            <span className="ai-service-status-line">
              <span className={`ai-online-dot${serviceStatus?.modelConfigured ? '' : ' is-disabled'}`} />
              {serviceStatus?.modelConfigured
                ? `${serviceStatus.provider === 'groq' ? 'Groq подключён' : 'Cloudflare Workers AI подключён'}${serviceStatus.fallbackConfigured ? ' · Cloudflare — резерв' : ''}${serviceStatus.webSearchEnabled && serviceStatus.webSearchConfigured ? ' · поиск Tavily включён' : ' · поиск Tavily выключен'}`
                : 'Ожидает настройки Groq или Cloudflare Workers AI'}
            </span>
          </div>
          <div className="ai-context-pill">Контекст: {getPageContextLabel(pageContext)}</div>
        </div>

        <div className="ai-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="ai-welcome">
              <div className="ai-welcome-icon"><Sparkles size={24} /></div>
              <h2>Привет! Чем помочь? 👋</h2>
              <p>
                Я помогу разобраться в олимпиадах, подобрать подходящие соревнования
                и узнать, какие льготы они могут дать при поступлении.
              </p>
              <div className="ai-suggestions">
                {QUICK_QUESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => handleSuggestion(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <article className={`ai-message ai-message-${message.role}`} key={message.id}>
              <div className="ai-message-avatar">
                {message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}
              </div>
              <div className="ai-message-body">
                <strong>{message.role === 'assistant' ? 'Консультант' : 'Ты'}</strong>
                <AIMessageContent content={message.content} />
                {message.role === 'assistant' && message.notice && (
                  <div className="ai-knowledge-notice">{message.notice}</div>
                )}
                {message.role === 'assistant' && Boolean(message.sources?.length) && (
                  <details className="ai-sources">
                    <summary className="ai-sources-title">Источники ({message.sources?.length ?? 0})</summary>
                    {message.sources?.map((source) => {
                      const sourceUrl = safeExternalUrl(source.url)
                      return sourceUrl ? (
                      <a
                        className="ai-source-link"
                        href={sourceUrl}
                        key={`${source.url}-${source.title}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>{source.title}</span>
                        {source.validYear ? <small>{source.validYear}</small> : null}
                        {getSourceStatusLabel(source.verificationStatus) ? (
                          <small>{getSourceStatusLabel(source.verificationStatus)}</small>
                        ) : null}
                        {source.kind === 'web' ? <small className="ai-source-external-label">Внешний поиск · проверь источник</small> : null}
                        <ExternalLink size={13} />
                      </a>
                      ) : null
                    })}
                  </details>
                )}
              </div>
            </article>
          ))}

          {sending && (
            <div className="ai-typing" role="status">
              <span /><span /><span />Консультант изучает данные и готовит ответ...
            </div>
          )}
        </div>

        {error && <div className="form-error ai-error" role="alert">{error}</div>}

        <form className="ai-input-form" onSubmit={handleSubmit}>
          <label className="ai-input-wrapper">
            <span className="visually-hidden">Твой вопрос</span>
            <textarea
              value={question}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setQuestion(event.target.value)}
              placeholder="Напиши свой вопрос..."
              rows={2}
              maxLength={2000}
              disabled={sending}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={sending || question.trim().length < 3}
            aria-label="Отправить сообщение"
          >
            <Send size={17} />
            Отправить
          </button>
        </form>

        <p className="ai-disclaimer">
          ИИ может ошибаться. Для условий поступления сверяй ответ с официальными документами
          вуза и организатора олимпиады.
        </p>
      </section>
    </div>
  )
}
