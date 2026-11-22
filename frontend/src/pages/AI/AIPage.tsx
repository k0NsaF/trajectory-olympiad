import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Bot, ExternalLink, Send, Sparkles, UserRound } from 'lucide-react'
import { useLocation } from 'react-router-dom'

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
    trajectory: 'Моя траектория',
    catalog: 'Каталог олимпиад',
    olympiad: 'Карточка олимпиады',
    calendar: 'Календарь',
    universities: 'Список вузов',
    university: 'Страница вуза',
    profile: 'Профиль',
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
  const { session } = useAuth()
  const navigationState = location.state as NavigationState | null
  const sourcePath = navigationState?.sourcePath ?? '/ai'
  const pageContext = useMemo(() => getPageContext(sourcePath), [sourcePath])

  const [profile, setProfile] = useState<CreateProfileInput | null>(getGuestProfile)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<AIServiceStatus | null>(null)

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
      content: message.content
    }))

    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setError(null)
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
                  <div className="ai-sources">
                    <span className="ai-sources-title">Источники</span>
                    {message.sources?.map((source) => (
                      <a
                        className="ai-source-link"
                        href={source.url}
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
                    ))}
                  </div>
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
