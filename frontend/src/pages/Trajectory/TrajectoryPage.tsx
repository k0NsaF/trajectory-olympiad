import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  RefreshCw,
  Route,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react'

import { useAuth } from '@/app/providers'
import {
  getAuthenticatedProfile,
  hasGuestProfile,
  saveAuthenticatedProfile,
  syncGuestProfile
} from '@/services/profile.service'
import {
  trajectoryService,
  type TrajectoryPlan,
  type TrajectoryStage,
  type TrajectoryTask,
  type TrajectoryTaskStatus
} from '@/services/trajectory.service'

import './trajectory-page.css'

type UserProfile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedProfile>>>
type EducationLevel = 'bachelor' | 'specialist' | 'basic_higher'

const TASK_STATUSES: { value: TrajectoryTaskStatus; label: string }[] = [
  { value: 'todo', label: 'Запланировано' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'completed', label: 'Выполнено' },
  { value: 'skipped', label: 'Пропущено' }
]

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'математика',
  informatics: 'информатика',
  physics: 'физика',
  biology: 'биология',
  chemistry: 'химия',
  economics: 'экономика',
  russian: 'русский язык',
  history: 'история',
  social_studies: 'обществознание',
  foreign_language: 'иностранный язык'
}

const STAGE_LABELS: Record<TrajectoryStage['stageType'], string> = {
  foundation: 'Старт',
  subject_preparation: 'Учебный план',
  olympiads: 'Олимпиады',
  exam_preparation: 'Экзамены',
  admission: 'Поступление',
  portfolio: 'Портфолио',
  other: 'Другое'
}

const TASK_TYPE_LABELS: Record<TrajectoryTask['taskType'], string> = {
  study: 'Подготовка',
  olympiad: 'Олимпиада',
  exam: 'Экзамены',
  research: 'Исследование',
  application: 'Поступление',
  portfolio: 'Портфолио',
  review: 'Проверка',
  other: 'Задача'
}

const PRIORITY_LABELS: Record<TrajectoryTask['priority'], string> = {
  low: 'Можно позже',
  medium: 'Обычный приоритет',
  high: 'Важно'
}

function getMinimumAdmissionYear(): number {
  const now = new Date()
  return now.getFullYear() + (now.getMonth() >= 8 ? 1 : 0)
}

function getExpectedAdmissionYear(grade: number): number {
  const now = new Date()
  const schoolYearOffset = now.getMonth() >= 8 ? 12 - grade : 11 - grade
  return Math.max(getMinimumAdmissionYear(), now.getFullYear() + schoolYearOffset)
}

function formatDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function safeHttpsUrl(value?: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Не удалось выполнить запрос. Проверь соединение и повтори попытку.'
}

function LoadingView() {
  return (
    <div className="trajectory-page">
      <div className="trajectory-state-card" role="status">
        <span className="trajectory-loading-mark"><RefreshCw size={20} /></span>
        <h2>Загружаем твою траекторию</h2>
        <p>Проверяем профиль и сохранённый план.</p>
      </div>
    </div>
  )
}

function TaskCard({
  task,
  disabled,
  onStatusChange
}: {
  task: TrajectoryTask
  disabled: boolean
  onStatusChange: (taskId: string, status: TrajectoryTaskStatus) => void
}) {
  const sourceUrl = safeHttpsUrl(task.sourceUrl)
  const startDate = formatDate(task.startDate)
  const dueDate = formatDate(task.dueDate)

  return (
    <article className={`trajectory-task trajectory-task-${task.status}`}>
      <div className="trajectory-task-main">
        <div className="trajectory-task-title-row">
          <h4>{task.title}</h4>
          <span className={`trajectory-priority trajectory-priority-${task.priority}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        {task.description && <p>{task.description}</p>}
        <div className="trajectory-task-meta">
          <span>{TASK_TYPE_LABELS[task.taskType]}</span>
          {startDate && <span><CalendarDays size={13} />{startDate}{dueDate && dueDate !== startDate ? ` — ${dueDate}` : ''}</span>}
          {!startDate && dueDate && <span><CalendarDays size={13} />До {dueDate}</span>}
          {typeof task.estimatedMinutes === 'number' && <span><Clock3 size={13} />{task.estimatedMinutes} мин</span>}
          {typeof task.weeklyMinutes === 'number' && <span><BookOpen size={13} />{task.weeklyMinutes} мин в неделю</span>}
        </div>
        {sourceUrl && (
          <a className="trajectory-source-link" href={sourceUrl} target="_blank" rel="noreferrer noopener">
            {task.sourceLabel ?? 'Официальный источник'} <ExternalLink size={13} />
          </a>
        )}
      </div>
      <label className="trajectory-task-status">
        <span className="trajectory-visually-hidden">Статус задачи: {task.title}</span>
        <select
          value={task.status}
          disabled={disabled}
          onChange={(event) => onStatusChange(task.id, event.target.value as TrajectoryTaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </label>
    </article>
  )
}

function StageCard({
  stage,
  disabled,
  onStatusChange
}: {
  stage: TrajectoryStage
  disabled: boolean
  onStatusChange: (taskId: string, status: TrajectoryTaskStatus) => void
}) {
  const completed = stage.tasks.filter((task) => task.status === 'completed').length
  const stageStart = formatDate(stage.startDate)
  const stageEnd = formatDate(stage.endDate)

  return (
    <section className="trajectory-stage">
      <div className="trajectory-stage-heading">
        <div className="trajectory-stage-index">{String(stage.position + 1).padStart(2, '0')}</div>
        <div className="trajectory-stage-title">
          <span>{STAGE_LABELS[stage.stageType]}</span>
          <h3>{stage.title}</h3>
          {stage.description && <p>{stage.description}</p>}
        </div>
        <div className="trajectory-stage-count">
          {completed} из {stage.tasks.length}
          <small>выполнено</small>
        </div>
      </div>
      {(stageStart || stageEnd) && (
        <div className="trajectory-stage-dates">
          <CalendarDays size={14} />
          {stageStart ?? 'Дата начала не задана'}{stageEnd ? ` — ${stageEnd}` : ''}
        </div>
      )}
      {stage.tasks.length ? (
        <div className="trajectory-task-list">
          {stage.tasks.map((task) => (
            <TaskCard key={task.id} task={task} disabled={disabled} onStatusChange={onStatusChange} />
          ))}
        </div>
      ) : (
        <p className="trajectory-stage-empty">Для этого этапа пока нет задач.</p>
      )}
    </section>
  )
}

export function TrajectoryPage() {
  const { session, loading: authLoading } = useAuth()
  const accessToken = session?.access_token

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [plan, setPlan] = useState<TrajectoryPlan | null>(null)
  const [weeklyStudyHours, setWeeklyStudyHours] = useState('6')
  const [targetAdmissionYear, setTargetAdmissionYear] = useState('')
  const [targetEducationLevel, setTargetEducationLevel] = useState<EducationLevel>('bachelor')
  const [generating, setGenerating] = useState(false)
  const [updatingTask, setUpdatingTask] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (authLoading) return
      if (!accessToken) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Wait for guest onboarding data to reach the account before reading the profile.
        await syncGuestProfile(accessToken)
        const savedProfile = await getAuthenticatedProfile(accessToken)
        let activePlan: TrajectoryPlan | null = null
        try {
          activePlan = await trajectoryService.getActive(accessToken)
        } catch (planLoadError) {
          if (!cancelled) {
            setError(`Профиль загружен, но сохранённую траекторию пока не удалось получить: ${getErrorMessage(planLoadError)}`)
          }
        }

        if (cancelled) return
        setProfile(savedProfile)
        setPlan(activePlan)

        if (savedProfile) {
          const minimumYear = getMinimumAdmissionYear()
          const expectedYear = getExpectedAdmissionYear(savedProfile.grade)
          const savedYear = savedProfile.targetAdmissionYear
          setWeeklyStudyHours(String(savedProfile.weeklyStudyHours ?? 6))
          setTargetAdmissionYear(String(
            typeof savedYear === 'number' && savedYear >= minimumYear
              ? savedYear
              : expectedYear
          ))
          setTargetEducationLevel(
            savedProfile.targetEducationLevel === 'specialist'
      ? 'specialist'
      : savedProfile.targetEducationLevel === 'basic_higher'
        ? 'basic_higher'
        : 'bachelor'
          )
        }
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  const taskStats = useMemo(() => {
    const tasks = plan?.stages.flatMap((stage) => stage.tasks) ?? []
    const completed = tasks.filter((task) => task.status === 'completed').length
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length
    return {
      total: tasks.length,
      completed,
      inProgress,
      progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0
    }
  }, [plan])

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken || !profile) return

    const hours = Number(weeklyStudyHours)
    const admissionYear = Number(targetAdmissionYear)
    const minimumYear = getMinimumAdmissionYear()

    if (!Number.isInteger(hours) || hours < 1 || hours > 40) {
      setError('Укажи от 1 до 40 часов на подготовку в неделю.')
      return
    }
    if (!Number.isInteger(admissionYear) || admissionYear < minimumYear || admissionYear > 2100) {
      setError(`Укажи год поступления не раньше ${minimumYear} года.`)
      return
    }

    const nextProfile: UserProfile = {
      ...profile,
      weeklyStudyHours: hours,
      targetAdmissionYear: admissionYear,
      targetEducationLevel
    }

    setGenerating(true)
    setError(null)
    setNotice(null)

    try {
      await saveAuthenticatedProfile(nextProfile, accessToken)
      setProfile(nextProfile)
      const nextPlan = await trajectoryService.generate(accessToken)
      setPlan(nextPlan)
      setNotice('Новая версия траектории сохранена. Отмечай выполнение задач — прогресс обновится автоматически.')
    } catch (generateError) {
      setError(getErrorMessage(generateError))
    } finally {
      setGenerating(false)
    }
  }

  const handleTaskStatusChange = async (taskId: string, status: TrajectoryTaskStatus) => {
    if (!accessToken) return
    setUpdatingTask(true)
    setError(null)
    try {
      const updatedPlan = await trajectoryService.updateTaskStatus(taskId, status, accessToken)
      setPlan(updatedPlan)
    } catch (updateError) {
      setError(getErrorMessage(updateError))
    } finally {
      setUpdatingTask(false)
    }
  }

  if (authLoading || (accessToken && loading)) return <LoadingView />

  if (!accessToken) {
    return (
      <div className="trajectory-page">
        <header className="trajectory-page-header">
          <span className="trajectory-eyebrow">ТВОЙ ПУТЬ К ПОСТУПЛЕНИЮ</span>
          <h1>Моя траектория</h1>
          <p>Персональный план подготовки, олимпиад и поступления — с возможностью отмечать прогресс.</p>
        </header>
        <section className="trajectory-state-card trajectory-auth-card">
          <span className="trajectory-state-icon"><Route size={24} /></span>
          <h2>Сохраним твой план в личном кабинете</h2>
          <p>
            {hasGuestProfile()
              ? 'Твоя анкета уже сохранена на этом устройстве. Войди или создай аккаунт — мы перенесём ответы в профиль и построим план.'
              : 'Сначала заполни короткую анкету, а затем войди или зарегистрируйся, чтобы сохранить личную траекторию и отслеживать прогресс.'}
          </p>
          <div className="trajectory-state-actions">
            <Link className="trajectory-button trajectory-button-primary" to="/auth?next=%2Ftrajectory">
              Войти <ArrowRight size={16} />
            </Link>
            <Link className="trajectory-button trajectory-button-secondary" to="/auth?mode=register&next=%2Ftrajectory">
              Создать аккаунт
            </Link>
            {!hasGuestProfile() && <Link className="trajectory-text-link" to="/onboarding">Сначала пройти анкету</Link>}
          </div>
        </section>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="trajectory-page">
        <header className="trajectory-page-header">
          <span className="trajectory-eyebrow">ПЕРСОНАЛЬНЫЙ ПЛАН</span>
          <h1>Моя траектория</h1>
          <p>Для построения плана нужны класс, регион и интересующие предметы.</p>
        </header>
        {error && <div className="trajectory-alert trajectory-alert-error" role="alert">{error}</div>}
        <section className="trajectory-state-card">
          <span className="trajectory-state-icon"><GraduationCap size={24} /></span>
          <h2>Заполни анкету</h2>
          <p>Ответы сохранятся в твоём аккаунте и станут основой персонального плана.</p>
          <Link className="trajectory-button trajectory-button-primary" to="/onboarding">Перейти к анкете <ArrowRight size={16} /></Link>
        </section>
      </div>
    )
  }

  return (
    <div className="trajectory-page">
      <header className="trajectory-page-header">
        <div>
          <span className="trajectory-eyebrow">ТВОЙ ПУТЬ К ПОСТУПЛЕНИЮ</span>
          <h1>Моя траектория</h1>
          <p>План подготовки опирается на твой профиль, официально подтверждённые олимпиады и выбранный год поступления.</p>
        </div>
        <Link className="trajectory-header-link" to="/profile">Настроить профиль <ArrowRight size={15} /></Link>
      </header>

      {error && <div className="trajectory-alert trajectory-alert-error" role="alert">{error}</div>}
      {notice && <div className="trajectory-alert trajectory-alert-success" role="status"><CheckCircle2 size={17} />{notice}</div>}

      <section className="trajectory-profile-strip" aria-label="Данные профиля">
        <div><GraduationCap size={17} /><span>{profile.grade} класс</span></div>
        <div><Target size={17} /><span>{profile.region}</span></div>
        <div><BookOpen size={17} /><span>{profile.subjects.map((subject) => SUBJECT_LABELS[subject] ?? subject).join(', ')}</span></div>
      </section>

      <form className="trajectory-settings" onSubmit={handleGenerate}>
        <div className="trajectory-settings-heading">
          <div className="trajectory-settings-icon"><Sparkles size={20} /></div>
          <div>
            <h2>Настройки плана</h2>
            <p>Уточни время, которое реально можешь выделять на подготовку, и ожидаемый год поступления.</p>
          </div>
        </div>
        <div className="trajectory-settings-fields">
          <label>
            <span>Часов на подготовку в неделю</span>
            <input type="number" min="1" max="40" step="1" value={weeklyStudyHours} onChange={(event) => setWeeklyStudyHours(event.target.value)} required />
          </label>
          <label>
            <span>Год поступления</span>
            <input type="number" min={getMinimumAdmissionYear()} max="2100" step="1" value={targetAdmissionYear} onChange={(event) => setTargetAdmissionYear(event.target.value)} required />
          </label>
          <label>
            <span>Уровень образования после школы</span>
            <select value={targetEducationLevel} onChange={(event) => setTargetEducationLevel(event.target.value as EducationLevel)}>
              <option value="bachelor">Бакалавриат</option>
              <option value="specialist">Специалитет</option>
            <option value="basic_higher">Базовое высшее образование</option>
            </select>
          </label>
        </div>
        <div className="trajectory-settings-footer">
          <span>План можно перестроить позже — текущая версия сохранится в истории.</span>
          <button className="trajectory-button trajectory-button-primary" type="submit" disabled={generating}>
            {generating ? <RefreshCw size={16} className="trajectory-spin" /> : <Sparkles size={16} />}
            {generating ? 'Строим план…' : plan ? 'Перестроить траекторию' : 'Построить мою траекторию'}
          </button>
        </div>
      </form>

      {plan ? (
        <>
          <section className="trajectory-progress-panel">
            <div className="trajectory-progress-copy">
              <span className="trajectory-eyebrow">ТЕКУЩИЙ ПЛАН · ВЕРСИЯ {plan.version}</span>
              <h2>{plan.title}</h2>
              <p>{plan.summary}</p>
            </div>
            <div className="trajectory-progress-ring" aria-label={`Выполнено ${taskStats.progress} процентов задач`}>
              <strong>{taskStats.progress}%</strong>
              <span>выполнено</span>
            </div>
            <div className="trajectory-progress-bar"><span style={{ width: `${taskStats.progress}%` }} /></div>
            <div className="trajectory-stat-row">
              <div><strong>{taskStats.total}</strong><span>всего задач</span></div>
              <div><strong>{taskStats.completed}</strong><span>выполнено</span></div>
              <div><strong>{taskStats.inProgress}</strong><span>в процессе</span></div>
              <div><strong>{plan.stages.length}</strong><span>этапов</span></div>
            </div>
          </section>

          <div className="trajectory-section-heading">
            <div>
              <span className="trajectory-eyebrow">ТВОЙ МАРШРУТ</span>
              <h2>Этапы и задачи</h2>
            </div>
            <span className="trajectory-updated-note">Создано {formatDate(plan.createdAt.slice(0, 10)) ?? 'недавно'}</span>
          </div>

          <div className="trajectory-stage-list">
            {plan.stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} disabled={updatingTask} onStatusChange={(taskId, status) => void handleTaskStatusChange(taskId, status)} />
            ))}
          </div>

          <section className="trajectory-disclaimer">
            <Trophy size={18} />
            <p>
              Траектория помогает планировать подготовку, но не прогнозирует победу и не гарантирует поступление. Условия олимпиад, льготы, подтверждающие баллы и правила приёма обязательно сверяй с актуальными официальными документами организатора и университета.
            </p>
          </section>
        </>
      ) : (
        <section className="trajectory-state-card trajectory-first-plan">
          <span className="trajectory-state-icon"><Route size={25} /></span>
          <h2>Пока нет сохранённой траектории</h2>
          <p>Построй первый план. В него попадут учебные задачи, подходящие олимпиады, проверки условий поступления и работа с портфолио.</p>
        </section>
      )}

      <section className="trajectory-next-links">
        <Link to="/olympiads"><Trophy size={16} />Каталог олимпиад <ArrowRight size={14} /></Link>
        <Link to="/calendar"><CalendarDays size={16} />Календарь событий <ArrowRight size={14} /></Link>
        <Link to="/ai" state={{ sourcePath: '/trajectory' }}><Sparkles size={16} />Обсудить план с ИИ <ArrowRight size={14} /></Link>
      </section>
    </div>
  )
}