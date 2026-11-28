
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Bookmark,
  CalendarPlus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  GraduationCap,
  Info,
  MapPin,
  Trophy
} from 'lucide-react'

import { SUBJECTS } from '@trajectory/shared'
import type { OlympiadWithStatus } from '@trajectory/shared'

import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuth } from '@/app/providers'
import { readFavorites, subscribeToFavorites, toggleFavorite } from '@/services/favorites.store'
import { readCalendarOlympiadIds, subscribeToCalendarSelection, toggleCalendarOlympiad } from '@/services/calendar-selection.store'
import { olympiadService } from '@/services/olympiad.service'
import { reminderService } from '@/services/reminder.service'
import { readRegisteredOlympiadIds, subscribeToOlympiadRegistration, toggleOlympiadRegistration } from '@/services/olympiad-registration.store'
import './olympiad-participation.css'

type StageDateInput = {
  startDate: string
  endDate: string
}

type StageState = 'upcoming' | 'active' | 'completed' | 'unknown'

const STATUS_LABELS = {
  eligible: 'Регистрация открыта',
  upcoming: 'Скоро начнётся',
  closed: 'Регистрация завершена',
  unknown: 'Даты уточняются'
} as const

const STAGE_LABELS = {
  registration: 'Регистрация',
  qualifying: 'Отборочный этап',
  final: 'Заключительный этап'
} as const

const STAGE_STATE_LABELS: Record<StageState, string> = {
  upcoming: 'Предстоит',
  active: 'Идёт сейчас',
  completed: 'Завершён',
  unknown: 'Сроки уточняются'
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'I уровень',
  2: 'II уровень',
  3: 'III уровень',
  4: 'IV уровень'
}

function parseDate(
  value: string | null | undefined,
  endOfDay = false
): Date | null {
  if (!value) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  let date: Date

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch

    date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    )
  } else {
    date = new Date(value)
  }

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null | undefined): string {
  const date = parseDate(value)

  if (!date) {
    return 'Дата уточняется'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function formatDateRange(stage: StageDateInput): string {
  const start = parseDate(stage.startDate)
  const end = parseDate(stage.endDate)

  if (start && end) {
    const startText = formatDate(stage.startDate)
    const endText = formatDate(stage.endDate)

    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate()
    ) {
      return startText
    }

    return `${startText} — ${endText}`
  }

  if (start) {
    return `С ${formatDate(stage.startDate)}`
  }

  if (end) {
    return `До ${formatDate(stage.endDate)}`
  }

  return 'Сроки уточняются'
}

function getStageState(stage: StageDateInput): StageState {
  const start = parseDate(stage.startDate)
  const end = parseDate(stage.endDate, true)

  if (!start || !end) {
    return 'unknown'
  }

  const now = new Date()

  if (now < start) {
    return 'upcoming'
  }

  if (now > end) {
    return 'completed'
  }

  return 'active'
}

function formatStageFormat(value: string): string {
  const labels: Record<string, string> = {
    online: 'Онлайн',
    offline: 'Очно',
    mixed: 'Смешанный формат'
  }

  return labels[value] ?? 'Формат уточняется'
}

function getSafeWebsiteUrl(value?: string): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function getStageIcon(type: string) {
  if (type === 'final') {
    return <Trophy size={19} />
  }

  if (type === 'registration') {
    return <GraduationCap size={19} />
  }

  return <CalendarDays size={19} />
}

function ScheduleItemsTimeline({ items }: { items: OlympiadWithStatus['scheduleItems'] }) {
  return (
    <div className="olympiad-timeline">
      {items.map((item, index) => {
        const state: StageState = !item.isConfirmed || !item.startDate || !item.endDate || item.dateParseStatus === 'unknown'
          ? 'unknown' : getStageState({ startDate: item.startDate, endDate: item.endDate })
        const title = item.stageName || (item.kind === 'registration' ? 'Регистрация' : 'Этап олимпиады')
        const dateText = item.whenText || (item.startDate || item.endDate
          ? formatDateRange({ startDate: item.startDate ?? '', endDate: item.endDate ?? '' })
          : 'Сроки уточняются')
        const sourceUrl = getSafeWebsiteUrl(item.organizerUrl)
        return (
          <article className={'olympiad-stage-item stage-' + state} key={item.id}>
            <div className="olympiad-stage-track">
              <div className="olympiad-stage-icon">
                {state === 'completed' ? <CheckCircle2 size={19} /> : getStageIcon(item.kind === 'registration' ? 'registration' : title.toLowerCase().includes('заключительный') ? 'final' : 'qualifying')}
              </div>
              {index !== items.length - 1 && <div className="olympiad-stage-connector" />}
            </div>
            <div className="olympiad-stage-card">
              <div className="olympiad-stage-card-header">
                <div><span className="olympiad-stage-number">СОБЫТИЕ {index + 1}</span><h3>{title}</h3></div>
                <span className={'olympiad-stage-state state-' + state}>{STAGE_STATE_LABELS[state]}</span>
              </div>
              <div className="olympiad-stage-information">
                <div className="olympiad-stage-detail"><CalendarDays size={15} /><span>{dateText}</span></div>
                {item.startTime && (
                  <div className="olympiad-stage-detail">
                    <Clock3 size={15} />
                    <span>{item.startTime.slice(0, 5)}{item.timeZone ? ' · ' + item.timeZone : ''}</span>
                  </div>
                )}
                {item.dateParseStatus === 'inferred_year' && <div className="olympiad-stage-detail"><Info size={15} /><span>Год определён по контексту сезона; проверь у организатора</span></div>}
                {item.checkedOn && <div className="olympiad-stage-detail"><CheckCircle2 size={15} /><span>Проверено {formatDate(item.checkedOn)}</span></div>}
                {sourceUrl && <div className="olympiad-stage-detail"><ExternalLink size={15} /><a className="olympiad-inline-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">Источник организатора</a></div>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

const PROFILE_SOURCE_PATHS: Record<string, string> = {
  mathematics: '/sections/maths/',
  informatics: '/sections/informatics/',
  biology: '/sections/biology/',
  physics: '/sections/physics/',
  chemistry: '/sections/chemistry/'
}

export function OlympiadDetailsPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const academicYear = searchParams.get('academicYear') || undefined
  const calendarYearParam = searchParams.get('calendarYear')
  const calendarYear = calendarYearParam && /^\d{4}$/.test(calendarYearParam)
    ? Number(calendarYearParam)
    : undefined
  const catalogQuery = calendarYear !== undefined
    ? 'calendarYear=' + String(calendarYear)
    : academicYear
      ? 'academicYear=' + encodeURIComponent(academicYear)
      : ''
  const catalogUrl = catalogQuery ? '/olympiads?' + catalogQuery : '/olympiads'
  const { user, session } = useAuth()
  const storageScope = user?.id ? `user:${user.id}` : 'guest'
  const [isFavorite, setIsFavorite] = useState(() => readFavorites(storageScope).some((entry) => entry.kind === 'olympiad' && entry.id === id))
  const [isInCalendar, setIsInCalendar] = useState(() => readCalendarOlympiadIds(storageScope).includes(id))
  const [isRegistered, setIsRegistered] = useState(() => readRegisteredOlympiadIds(storageScope).includes(id))
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('10')
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderFeedback, setReminderFeedback] = useState('')

  useEffect(() => {
    const sync = () => {
      setIsFavorite(readFavorites(storageScope).some((entry) => entry.kind === 'olympiad' && entry.id === id))
      setIsInCalendar(readCalendarOlympiadIds(storageScope).includes(id))
    }
    sync()
    const unsubscribeFavorites = subscribeToFavorites(storageScope, sync)
    const unsubscribeCalendar = subscribeToCalendarSelection(storageScope, sync)
    return () => {
      unsubscribeFavorites()
      unsubscribeCalendar()
    }
  }, [id, storageScope])

  const handleFavorite = () => {
    toggleFavorite(storageScope, 'olympiad', id)
    setIsFavorite(readFavorites(storageScope).some((entry) => entry.kind === 'olympiad' && entry.id === id))
  }

  const handleCalendar = () => {
    toggleCalendarOlympiad(storageScope, id)
    setIsInCalendar(readCalendarOlympiadIds(storageScope).includes(id))
  }

  useEffect(() => {
    const syncRegistration = () => setIsRegistered(readRegisteredOlympiadIds(storageScope).includes(id))
    syncRegistration()
    return subscribeToOlympiadRegistration(storageScope, syncRegistration)
  }, [id, storageScope])

  const loadOlympiad = useCallback(
    () => olympiadService.getById(id, { academicYear, calendarYear }),
    [id, academicYear, calendarYear]
  )

  const {
    data: olympiad,
    loading,
    error,
    reload
  } = useAsyncData(loadOlympiad)

  useEffect(() => {
    const profiles = olympiad?.profiles ?? []
    if (profiles.length === 0) {
      setSelectedProfileId('')
      return
    }
    const preferred = profiles.find((profile) => profile.subjects.includes('mathematics')) ?? profiles[0]
    setSelectedProfileId((current) => profiles.some((profile) => profile.id === current) ? current : preferred.id)
  }, [olympiad?.id, olympiad?.profiles])

  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingState message="Загружаем информацию об олимпиаде..." />
      </div>
    )
  }

  if (error || !olympiad) {
    return (
      <div className="dashboard-container">
        <PageHeader title="Информация об олимпиаде" />

        <ErrorState
          message={error ?? 'Олимпиада не найдена.'}
          onRetry={reload}
        />

        <Link className="back-link" to={catalogUrl}>
          <ArrowLeft size={16} />
          Вернуться в каталог
        </Link>
      </div>
    )
  }

  const websiteUrl = getSafeWebsiteUrl(olympiad.website)
  const season = olympiad.season

  const sortedStages = [...(season?.stages ?? [])].sort((first, second) => {
    const firstDate = parseDate(first.startDate)?.getTime()
    const secondDate = parseDate(second.startDate)?.getTime()

    if (firstDate === undefined && secondDate === undefined) {
      return 0
    }

    if (firstDate === undefined) {
      return 1
    }

    if (secondDate === undefined) {
      return -1
    }

    return firstDate - secondDate
  })

  const activeStages = sortedStages.filter(
    (stage) => getStageState(stage) === 'active'
  ).length
  const sortedScheduleItems = [...(olympiad.scheduleItems ?? [])].sort((first, second) => {
    const firstDate = first.startDate ?? '9999-12-31'
    const secondDate = second.startDate ?? '9999-12-31'
    return firstDate.localeCompare(secondDate)
      || (first.endDate ?? '').localeCompare(second.endDate ?? '')
      || first.stageName.localeCompare(second.stageName)
  })

  const selectedProfile = olympiad.profiles.find((profile) => profile.id === selectedProfileId) ?? olympiad.profiles[0] ?? null
  const gradeEvidenceVerified = Boolean(
    selectedProfile && selectedProfile.gradeEligibilityStatus === 'official' &&
    selectedProfile.gradeSourceUrl?.startsWith('https://') &&
    selectedProfile.gradeCheckedAt
  )
  const selectedGradeIsListed = selectedProfile?.eligibleGrades.includes(Number(selectedGrade)) ?? false
  const gradeEligibilityText = !selectedProfile
    ? 'Предметный профиль не добавлен в справочник.'
    : gradeEvidenceVerified
      ? selectedGradeIsListed
        ? `Для ${selectedGrade} класса допуск указан в проверенном источнике.`
        : `В проверенном источнике профиль не указывает ${selectedGrade} класс. Уточни правила у организатора.`
      : 'Допуск по выбранному профилю и классу пока не подтверждён официальным источником. Это не означает запрет на участие.'

  const profileSourcePaths = selectedProfile?.subjects.map((subject) => PROFILE_SOURCE_PATHS[subject]).filter((path): path is string => Boolean(path)) ?? []
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nextReminderTarget = sortedScheduleItems
    .map((item) => {
      const targetDate = item.dateSemantics === 'deadline' || (item.kind === 'registration' && item.dateSemantics === 'period')
        ? item.endDate ?? item.startDate
        : item.startDate ?? item.endDate
      return { item, targetDate }
    })
    .filter(({ item, targetDate }) => Boolean(
      item.isConfirmed &&
      (!isRegistered || item.kind !== 'registration') &&
      (profileSourcePaths.length === 0 || profileSourcePaths.some((path) => item.organizerUrl.includes(path)) || item.organizerUrl.includes('/stages/')) &&
      ['exact', 'range'].includes(item.dateParseStatus) &&
      ['event', 'period', 'deadline'].includes(item.dateSemantics) &&
      targetDate && targetDate >= todayKey
    ))
    .sort((first, second) => (first.targetDate ?? '').localeCompare(second.targetDate ?? ''))[0] ?? null

  const handleRegistrationToggle = () => {
    toggleOlympiadRegistration(storageScope, id)
    setIsRegistered(readRegisteredOlympiadIds(storageScope).includes(id))
  }

  const handleCreateScheduleReminder = async () => {
    if (!session?.access_token) {
      setReminderFeedback('Войди в аккаунт, чтобы сохранить напоминание в календаре.')
      return
    }
    if (!nextReminderTarget?.targetDate) {
      setReminderFeedback('Нет ближайшей подтверждённой даты, для которой можно создать напоминание.')
      return
    }

    const dueDate = parseDate(nextReminderTarget.targetDate)
    if (!dueDate) {
      setReminderFeedback('Не удалось разобрать дату из расписания.')
      return
    }
    dueDate.setHours(9, 0, 0, 0)
    const notifyDate = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)
    const item = nextReminderTarget.item
    const reminderType = item.kind === 'registration' ? 'registration_deadline' as const : item.dateSemantics === 'deadline' ? 'stage_end' as const : 'stage_start' as const
    const source = getSafeWebsiteUrl(item.organizerUrl)

    setReminderBusy(true)
    setReminderFeedback('')
    try {
      await reminderService.create({
        title: `Всесибирская олимпиада: ${item.stageName || (item.kind === 'registration' ? 'регистрация' : 'этап')}`,
        description: `Профиль: ${selectedProfile?.profileName ?? 'общий'}; класс: ${selectedGrade}. Дата взята из подтверждённого расписания.${source ? ` Источник: ${source}` : ''}`,
        type: reminderType,
        dueAt: dueDate.toISOString(),
        ...(notifyDate.getTime() > Date.now() ? { notifyAt: notifyDate.toISOString() } : {})
      })
      setReminderFeedback('Напоминание сохранено в твоём календаре.')
    } catch (error) {
      setReminderFeedback(error instanceof Error ? error.message : 'Не удалось создать напоминание. Попробуй ещё раз.')
    } finally {
      setReminderBusy(false)
    }
  }


  return (
    <div className="dashboard-container olympiad-details-page">
      <Link className="back-link" to={catalogUrl}>
        <ArrowLeft size={16} />
        Каталог олимпиад
      </Link>

      <PageHeader
        eyebrow="КАРТОЧКА ОЛИМПИАДЫ"
        title={olympiad.name}
        description={
          olympiad.description ??
          'Подробная информация об олимпиаде, её этапах и условиях участия.'
        }
        action={
          websiteUrl ? (
            <a
              className="primary-button"
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Официальный сайт
              <ExternalLink size={16} />
            </a>
          ) : undefined
        }
      />

      <div className="olympiad-details-actions" aria-label="Действия с олимпиадой">
        <button type="button" className={`olympiad-save-action${isFavorite ? ' is-active' : ''}`} onClick={handleFavorite} aria-pressed={isFavorite}>
          <Bookmark size={16} />{isFavorite ? 'В избранном' : 'В избранное'}
        </button>
        <button type="button" className={`olympiad-save-action${isInCalendar ? ' is-active' : ''}`} onClick={handleCalendar} aria-pressed={isInCalendar}>
          <CalendarPlus size={16} />{isInCalendar ? 'Убрать из календаря' : 'Добавить в календарь'}
        </button>
      </div>

      <section className="panel olympiad-summary-panel">
        <div className="olympiad-summary-header">
          <div>
            <span className="section-kicker">ТЕКУЩИЙ СТАТУС</span>
            <div className={`olympiad-status status-${olympiad.status}`}>
              <span className="olympiad-status-dot" />
              {STATUS_LABELS[olympiad.status]}
            </div>
          </div>

          {olympiad.listType === 'school_olympiad' && olympiad.level !== null && (
            <div className="olympiad-level-badge">
              <Trophy size={17} />
              {LEVEL_LABELS[olympiad.level] ?? `${olympiad.level} уровень`}
            </div>
          )}
        </div>

        <div className={`olympiad-list-detail-note${olympiad.listType === 'intellectual_competition' ? ' is-competition' : ''}`}>
          <Info size={17} />
          <div>
            <strong>{olympiad.listType === 'school_olympiad' ? 'Перечень олимпиад школьников Минобрнауки' : 'Перечень иных интеллектуальных и творческих конкурсов Минпросвещения'}</strong>
            <p>{olympiad.listType === 'school_olympiad'
              ? 'Уровень относится к официальному перечню олимпиад школьников. Конкретные особые права определяет каждый вуз своим локальным актом на соответствующий год и образовательную программу.'
              : 'Включение в этот перечень само по себе не предоставляет особых прав при поступлении. Условия участия и возможные преимущества нужно проверять отдельно.'}</p>
            {getSafeWebsiteUrl(olympiad.sourceDocumentUrl) && <a href={getSafeWebsiteUrl(olympiad.sourceDocumentUrl) ?? undefined} target="_blank" rel="noopener noreferrer">{olympiad.sourceDocumentTitle || 'Официальный документ перечня'} <ExternalLink size={13} /></a>}
            {olympiad.sourceCheckedAt && <small>Последняя проверка записи: {formatDate(olympiad.sourceCheckedAt)}</small>}
          </div>
        </div>

        <div className="olympiad-details-grid">
          <div className="olympiad-info-item">
            <div className="olympiad-info-icon">
              <GraduationCap size={19} />
            </div>
            <div>
              <span>Организатор</span>
              <strong>{olympiad.organizer}</strong>
            </div>
          </div>

          <div className="olympiad-info-item">
            <div className="olympiad-info-icon">
              <UsersIcon />
            </div>
            <div>
              <span>Классы участников</span>
              <strong>
                {olympiad.grades.length > 0
                  ? olympiad.grades.map((grade) => `${grade}`).join(', ')
                  : 'Информация уточняется'}
              </strong>
            </div>
          </div>

          <div className="olympiad-info-item">
            <div className="olympiad-info-icon">
              <BookIcon />
            </div>
            <div>
              <span>Предметы</span>
              <div className="tag-list olympiad-subject-tags">
                {olympiad.subjects.length > 0 ? (
                  olympiad.subjects.map((subjectId) => (
                    <span className="subject-tag" key={subjectId}>
                      {SUBJECTS.find(
                        (item) => item.id === subjectId
                      )?.label ?? subjectId}
                    </span>
                  ))
                ) : (
                  <strong>Не указаны</strong>
                )}
              </div>
            </div>
          </div>

          <div className="olympiad-info-item">
            <div className="olympiad-info-icon">
              <CalendarDays size={19} />
            </div>
            <div>
              <span>Учебный сезон</span>
              <strong>
                {season?.academicYear ?? 'Сезон не указан'}
              </strong>
            </div>
          </div>
        </div>

        {!websiteUrl && (
          <div className="olympiad-info-notice">
            <Info size={16} />
            <span>
              Официальная ссылка пока не добавлена. Проверь информацию
              об олимпиаде у организатора.
            </span>
          </div>
        )}
      </section>

      <section className="panel olympiad-stages-panel">
        <div className="olympiad-section-heading">
          <div>
            <span className="section-kicker">РАСПИСАНИЕ И СРОКИ</span>
            <h2>Этапы олимпиады</h2>
            <p>
              Последовательность этапов и сроки проведения текущего сезона.
            </p>
          </div>

          <div className="olympiad-heading-icon">
            <CalendarDays size={21} />
          </div>
        </div>

        {sortedStages.length === 0 && sortedScheduleItems.length === 0 ? (
          <div className="olympiad-empty-stages">
            <div className="olympiad-empty-icon">
              <CalendarDays size={25} />
            </div>
            <strong>Расписание пока не опубликовано</strong>
            <p>
              Информация об этапах этого сезона ещё не добавлена.
              Проверь официальный сайт организатора.
            </p>

            {websiteUrl && (
              <a
                className="olympiad-inline-link"
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Проверить расписание
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ) : sortedStages.length === 0 ? (
          <ScheduleItemsTimeline items={sortedScheduleItems} />
        ) : (
          <>
            <div className="olympiad-stage-summary">
              <span>
                <CalendarDays size={15} />
                Этапов: <strong>{sortedStages.length}</strong>
              </span>

              <span>
                <Clock3 size={15} />
                Сейчас проходят: <strong>{activeStages}</strong>
              </span>
            </div>

            <div className="olympiad-timeline">
              {sortedStages.map((stage, index) => {
                const stageState = getStageState(stage)

                const stageTitle =
                  STAGE_LABELS[stage.type as keyof typeof STAGE_LABELS] ??
                  'Этап олимпиады'

                return (
                  <article
                    className={`olympiad-stage-item stage-${stageState}`}
                    key={stage.id}
                  >
                    <div className="olympiad-stage-track">
                      <div className="olympiad-stage-icon">
                        {stageState === 'completed' ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          getStageIcon(stage.type)
                        )}
                      </div>

                      {index !== sortedStages.length - 1 && (
                        <div className="olympiad-stage-connector" />
                      )}
                    </div>

                    <div className="olympiad-stage-card">
                      <div className="olympiad-stage-card-header">
                        <div>
                          <span className="olympiad-stage-number">
                            ЭТАП {index + 1}
                          </span>
                          <h3>{stageTitle}</h3>
                        </div>

                        <span className={`olympiad-stage-state state-${stageState}`}>
                          {STAGE_STATE_LABELS[stageState]}
                        </span>
                      </div>

                      <div className="olympiad-stage-information">
                        <div className="olympiad-stage-detail">
                          <CalendarDays size={15} />
                          <span>{formatDateRange(stage)}</span>
                        </div>

                        <div className="olympiad-stage-detail">
                          {stage.format === 'online' ? (
                            <Globe2 size={15} />
                          ) : (
                            <MapPin size={15} />
                          )}
                          <span>{formatStageFormat(stage.format)}</span>
                        </div>

                        {stage.regionScope && (
                          <div className="olympiad-stage-detail">
                            <MapPin size={15} />
                            <span>{stage.regionScope}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      {olympiad.listType === 'school_olympiad' && <section className="panel olympiad-benefits-panel">
        <div className="olympiad-section-heading">
          <div>
            <span className="section-kicker">ПОСТУПЛЕНИЕ</span>
            <h2>Подтверждённые льготы</h2>
            <p>
              Показываем только официальные условия с указанным годом действия
              и датой проверки.
            </p>
          </div>
          <div className="olympiad-heading-icon">
            <Award size={21} />
          </div>
        </div>

        {olympiad.benefits.length === 0 ? (
          <div className="olympiad-benefits-empty">
            <Info size={18} />
            <div>
              <strong>Нет подтверждённых льгот на {olympiad.benefitYear} год</strong>
              <p>
                Это не означает, что олимпиада не даёт преимуществ. Данные на
                этот год пока не подтверждены в нашей базе. Проверь локальные
                акты выбранного вуза.
              </p>
            </div>
          </div>
        ) : (
          <div className="olympiad-benefits-list">
            {olympiad.benefits.map((benefit) => {
              const rightLabel = benefit.rightType === 'BVI'
                ? 'БВИ'
                : benefit.rightType === '100_points'
                  ? '100 баллов'
                  : 'Дополнительные баллы'
              const statusLabel = benefit.forStatus === 'winner'
                ? 'Победитель'
                : benefit.forStatus === 'prize'
                  ? 'Призёр'
                  : 'Победитель или призёр'
              const sourceUrl = getSafeWebsiteUrl(benefit.sourceUrl)

              return (
                <article className="olympiad-benefit-card" key={benefit.id}>
                  <div className="olympiad-benefit-card-header">
                    <strong>{rightLabel}</strong>
                    <span>Официально проверено</span>
                  </div>
                  <h3>{benefit.universityName}</h3>
                  <p>{benefit.programName ?? 'Все программы, если иное не установлено правилами'}</p>
                  <div className="olympiad-benefit-facts">
                    <span>Статус диплома: <strong>{statusLabel}</strong></span>
                    {benefit.levelRequired !== undefined && (
                      <span>Уровень олимпиады: <strong>{LEVEL_LABELS[benefit.levelRequired] ?? benefit.levelRequired}</strong></span>
                    )}
                    {benefit.resultClassRequired !== undefined && (
                      <span>Класс получения диплома: <strong>{benefit.resultClassRequired}</strong></span>
                    )}
                    {benefit.diplomaDegreeRequired !== undefined && (
                      <span>Степень диплома: <strong>{['', 'I', 'II', 'III'][benefit.diplomaDegreeRequired] ?? benefit.diplomaDegreeRequired}</strong></span>
                    )}
                    {benefit.pointsAwarded !== undefined && (
                      <span>Дополнительные баллы: <strong>{benefit.pointsAwarded}</strong></span>
                    )}
                    {benefit.confirmExamSubject && (
                      <span>Подтверждающий предмет: <strong>{benefit.confirmExamSubject}</strong></span>
                    )}
                    {benefit.confirmExamThreshold !== undefined && (
                      <span>Порог: <strong>{benefit.confirmExamThreshold} баллов</strong></span>
                    )}
                  </div>
                  <div className="olympiad-benefit-card-footer">
                    <span>Год действия: {benefit.validYear} · Проверено: {formatDate(benefit.lastCheckedAt)}</span>
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                        Источник <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="olympiad-benefits-disclaimer">
          Даже подтверждённые данные необходимо перепроверять по актуальным
          локальным актам вуза перед подачей документов.
        </p>
      </section>}

      <section className="panel olympiad-participation-panel">
        <div className="olympiad-section-heading">
          <div>
            <span className="section-kicker">УЧАСТИЕ</span>
            <h2>Что нужно знать участнику</h2>
            <p>
              Основная информация перед регистрацией на олимпиаду.
            </p>
          </div>
          <div className="olympiad-heading-icon">
            <GraduationCap size={21} />
          </div>
        </div>

        <div className="olympiad-participation-grid">
          <div className="olympiad-participation-item">
            <span className="olympiad-participation-number">01</span>
            <div>
              <strong>Проверь класс</strong>
              <p>
                Убедись, что твой класс входит в список доступных
                для участия в олимпиаде.
              </p>
            </div>
          </div>

          <div className="olympiad-participation-item">
            <span className="olympiad-participation-number">02</span>
            <div>
              <strong>Изучи сроки</strong>
              <p>
                Проверь даты регистрации и этапов, чтобы не пропустить
                необходимые действия.
              </p>
            </div>
          </div>

          <div className="olympiad-participation-item">
            <span className="olympiad-participation-number">03</span>
            <div>
              <strong>Проверь условия</strong>
              <p>
                Уточни требования к участникам и порядок регистрации
                на официальном сайте организатора.
              </p>
            </div>
          </div>
        </div>

        <div className="olympiad-participation-controls">
          <div className="olympiad-participation-control-grid">
            <label>
              <span>Предметный профиль</span>
              <select value={selectedProfile?.id ?? ''} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={olympiad.profiles.length === 0}>
                {olympiad.profiles.length === 0 ? <option value="">Профили не добавлены</option> : olympiad.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.profileName}</option>)}
              </select>
            </label>
            <label>
              <span>Твой класс</span>
              <select value={selectedGrade} onChange={(event) => setSelectedGrade(event.target.value)}>
                {[7, 8, 9, 10, 11].map((grade) => <option value={String(grade)} key={grade}>{grade} класс</option>)}
              </select>
            </label>
          </div>
          <div className={`olympiad-participation-eligibility${gradeEvidenceVerified && selectedGradeIsListed ? ' is-confirmed' : ' is-unconfirmed'}`} role="status">
            <Info size={17} />
            <div>
              <strong>{gradeEligibilityText}</strong>
              {selectedProfile?.gradeSourceUrl && getSafeWebsiteUrl(selectedProfile.gradeSourceUrl) && (
                <a href={getSafeWebsiteUrl(selectedProfile.gradeSourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer">Источник допуска по классам <ExternalLink size={13} /></a>
              )}
              {selectedProfile?.gradeCheckedAt && <small>Дата проверки: {formatDate(selectedProfile.gradeCheckedAt)}</small>}
            </div>
          </div>
          <p className="olympiad-participation-note">Отметка регистрации сохраняется в Trajectory. Она не регистрирует тебя на сайте организатора; если олимпиада добавлена в календарь, там будет показан этот статус.</p>
          <div className="olympiad-participation-actions">
            <button type="button" className={isRegistered ? 'secondary-button' : 'primary-button'} onClick={handleRegistrationToggle} aria-pressed={isRegistered}>
              {isRegistered ? 'Снять отметку о регистрации' : 'Отметить, что я зарегистрировался'}
            </button>
            <button type="button" className="secondary-button" onClick={() => void handleCreateScheduleReminder()} disabled={reminderBusy || !nextReminderTarget || !session?.access_token}>
              {reminderBusy ? 'Сохраняем…' : 'Напомнить о ближайшей дате'}
            </button>
          </div>
          {reminderFeedback && <p className="olympiad-participation-feedback" role="status">{reminderFeedback}</p>}
          <p className="olympiad-participation-note">Сохранённое напоминание появится в календаре Trajectory. Фактическая отправка уведомления зависит от настроек серверного планировщика.</p>
          {!session?.access_token && <p className="olympiad-participation-note">Для сохранения напоминания в аккаунте войди в Trajectory.</p>}
          {nextReminderTarget?.targetDate && <p className="olympiad-participation-note">Ближайшая подтверждённая дата: {formatDate(nextReminderTarget.targetDate)} · {nextReminderTarget.item.stageName || (nextReminderTarget.item.kind === 'registration' ? 'регистрация' : 'этап')}</p>}
          <Link className="olympiad-inline-link" to="/universities/55d657a4-a6d5-46c1-8ca6-93adf3f4da80">Открыть заполненную карточку МФТИ <ExternalLink size={14} /></Link>
        </div>

        {websiteUrl && (
          <a
            className="primary-button olympiad-participation-button"
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Перейти к организатору
            <ExternalLink size={16} />
          </a>
        )}
      </section>

      <Link className="back-link olympiad-bottom-back" to={catalogUrl}>
        <ArrowLeft size={16} />
        Вернуться к каталогу олимпиад
      </Link>
    </div>
  )
}

function UsersIcon() {
  return <GraduationCap size={19} />
}

function BookIcon() {
  return <Trophy size={19} />
}
