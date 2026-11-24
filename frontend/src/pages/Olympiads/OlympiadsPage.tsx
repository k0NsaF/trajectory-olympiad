import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  GraduationCap,
  MapPin,
  Monitor,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react'

import {
  SUBJECTS,
  type OlympiadFormat,
  type OlympiadStatus,
  type OlympiadWithStatus
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAppLayout } from '@/hooks/useAppLayout'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuth } from '@/app/providers'
import {
  olympiadService,
  type OlympiadFilters
} from '@/services/olympiad.service'
import {
  getAuthenticatedProfile,
  getGuestProfile
} from '@/services/profile.service'
import type { CreateProfileInput } from '@trajectory/shared'
import './catalog.css'

const LEVELS = [1, 2, 3, 4] as const
const GRADES = [7, 8, 9, 10, 11] as const

const LEVEL_LABELS: Record<number, string> = {
  1: 'I уровень',
  2: 'II уровень',
  3: 'III уровень',
  4: 'IV уровень'
}

const STATUS_LABELS: Record<OlympiadStatus, string> = {
  eligible: 'Регистрация открыта',
  upcoming: 'Скоро начнётся',
  closed: 'Регистрация завершена',
  unknown: 'Даты уточняются'
}

const FORMAT_LABELS: Record<OlympiadFormat, string> = {
  online: 'Онлайн',
  offline: 'Очно',
  mixed: 'Смешанный'
}

type SortMode = 'date' | 'name' | 'level'
type FilterStatus = OlympiadStatus | ''
type FilterFormat = OlympiadFormat | ''
type PeriodFilter = 'week' | 'month' | 'threeMonths' | 'all'
type CollectionFilter = 'upcoming' | 'all' | 'closed'

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  week: 'На этой неделе',
  month: 'В этом месяце',
  threeMonths: 'В ближайшие 3 месяца',
  all: 'Без ограничения'
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function getNextStageDate(olympiad: OlympiadWithStatus): number | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const timestamps = (olympiad.season?.stages ?? [])
    .map((stage) => parseLocalDate(stage.startDate))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime())
    .filter((timestamp) => timestamp >= today.getTime())

  return timestamps.length > 0 ? Math.min(...timestamps) : null
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(timestamp))
}

function formatDateCompact(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(timestamp))
}

function formatDateValue(value?: string): string {
  if (!value) return 'Уточняется'
  const date = parseLocalDate(value)
  return date
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : 'Уточняется'
}

function getFormats(olympiad: OlympiadWithStatus): OlympiadFormat[] {
  return [...new Set((olympiad.season?.stages ?? []).map((stage) => stage.format))]
}

function getNextRegistration(olympiad: OlympiadWithStatus): string | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const future = (olympiad.season?.stages ?? [])
    .filter((stage) => stage.type === 'registration')
    .map((stage) => parseLocalDate(stage.startDate))
    .filter((date): date is Date => date !== null && date.getTime() >= today.getTime())
    .sort((first, second) => first.getTime() - second.getTime())[0]

  return future ? formatDateCompact(future.getTime()) : null
}

function getTimeline(olympiad: OlympiadWithStatus) {
  const stages = [...(olympiad.season?.stages ?? [])].sort(
    (first, second) => first.startDate.localeCompare(second.startDate)
  )
  const registration = stages.filter((stage) => stage.type === 'registration')
  const competition = stages.filter((stage) => stage.type !== 'registration')

  const registrationStart = registration[0]?.startDate
  const registrationEnd = registration.reduce<string | undefined>(
    (latest, stage) => !latest || stage.endDate > latest ? stage.endDate : latest,
    undefined
  )
  const competitionStart = competition[0]?.startDate
  const competitionEnd = competition.reduce<string | undefined>(
    (latest, stage) => !latest || stage.endDate > latest ? stage.endDate : latest,
    undefined
  )

  return {
    registration: registrationStart
      ? `${formatDateValue(registrationStart)} — ${formatDateValue(registrationEnd)}`
      : 'Сроки уточняются',
    start: formatDateValue(competitionStart),
    end: formatDateValue(competitionEnd)
  }
}

function isInPeriod(olympiad: OlympiadWithStatus, period: PeriodFilter): boolean {
  if (period === 'all') return true

  const nextDate = getNextStageDate(olympiad)
  if (nextDate === null) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(nextDate)

  if (period === 'week') {
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return target >= today && target < weekEnd
  }

  if (period === 'month') {
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return target >= today && target < monthEnd
  }

  const threeMonthEnd = new Date(today)
  threeMonthEnd.setMonth(threeMonthEnd.getMonth() + 3)
  return target >= today && target < threeMonthEnd
}

function getBenefitLabel(rightType: string): string {
  if (rightType === 'BVI') return 'БВИ'
  if (rightType === '100_points') return '100 баллов'
  return 'Доп. баллы'
}

function getAdmissionYearForGrade(grade: number): number {
  const now = new Date()
  const academicEndYear = now.getMonth() >= 8
    ? now.getFullYear() + 1
    : now.getFullYear()

  return academicEndYear + Math.max(0, 11 - grade)
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export function OlympiadsPage() {
  const { searchQuery, setSearchQuery } = useAppLayout()
  const { session } = useAuth()

  const guestProfile = useMemo(() => getGuestProfile(), [])
  const [profile, setProfile] = useState<CreateProfileInput | null>(() => guestProfile)
  const [profileLoading, setProfileLoading] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [subjects, setSubjects] = useState<string[]>(() => guestProfile?.subjects ?? [])
  const [grade, setGrade] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState<FilterStatus>('')
  const [format, setFormat] = useState<FilterFormat>('')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [collection, setCollection] = useState<CollectionFilter>('upcoming')
  const [onlyWithBenefits, setOnlyWithBenefits] = useState(false)
  const [onlyTargetUniversity, setOnlyTargetUniversity] = useState(false)
  const [onlyMyRegion, setOnlyMyRegion] = useState(false)
  const [sortBy, setSortBy] = useState<SortMode>('date')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let active = true

    if (!session?.access_token) {
      setProfile(guestProfile)
      setSubjects(guestProfile?.subjects ?? [])
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    void getAuthenticatedProfile(session.access_token)
      .then((savedProfile) => {
        if (!active) return
        const nextProfile = savedProfile ?? guestProfile
        setProfile(nextProfile)
        setSubjects(nextProfile?.subjects ?? [])
      })
      .catch(() => {
        if (active) {
          setProfile(guestProfile)
          setSubjects(guestProfile?.subjects ?? [])
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [session?.access_token, guestProfile])

  useEffect(() => {
    if (profile?.grade) setGrade(String(profile.grade))
  }, [profile?.grade])

  const subjectKey = subjects.join(',')
  const targetUniversityId = onlyTargetUniversity ? profile?.targetUniversityId : undefined
  const targetProgramId = onlyTargetUniversity ? profile?.targetProgramId : undefined
  const targetRegion = onlyMyRegion ? profile?.region : undefined
  const admissionGrade = grade ? Number(grade) : profile?.grade ?? 11
  const benefitYear = getAdmissionYearForGrade(admissionGrade)

  const loadOlympiads = useCallback(() => {
    const filters: OlympiadFilters = {
      search: debouncedSearch.trim() || undefined,
      subjects: subjectKey ? subjectKey.split(',') : undefined,
      grade: grade ? Number(grade) : undefined,
      level: level ? Number(level) : undefined,
      status: status || undefined,
      format: format || undefined,
      region: targetRegion,
      hasBenefits: onlyWithBenefits || onlyTargetUniversity,
      universityId: targetUniversityId,
      programId: targetProgramId,
      benefitYear
    }

    return olympiadService.getAll(filters)
  }, [
    debouncedSearch,
    subjectKey,
    grade,
    level,
    status,
    format,
    targetRegion,
    onlyWithBenefits,
    onlyTargetUniversity,
    targetUniversityId,
    targetProgramId,
    benefitYear
  ])

  const {
    data: olympiads,
    loading,
    error,
    reload
  } = useAsyncData(loadOlympiads, [])

  const collectionCounts = useMemo(() => ({
    upcoming: (olympiads ?? []).filter((item) => item.status !== 'closed').length,
    all: olympiads?.length ?? 0,
    closed: (olympiads ?? []).filter((item) => item.status === 'closed').length
  }), [olympiads])

  const visibleOlympiads = useMemo(() => {
    const result = (olympiads ?? []).filter((olympiad) => {
      if (collection === 'upcoming' && olympiad.status === 'closed') return false
      if (collection === 'closed' && olympiad.status !== 'closed') return false
      return isInPeriod(olympiad, period)
    })

    result.sort((first, second) => {
      if (sortBy === 'name') return first.name.localeCompare(second.name, 'ru')
      if (sortBy === 'level') {
        const firstLevel = first.level ?? Number.MAX_SAFE_INTEGER
        const secondLevel = second.level ?? Number.MAX_SAFE_INTEGER
        return firstLevel - secondLevel
      }

      const firstDate = getNextStageDate(first)
      const secondDate = getNextStageDate(second)
      if (firstDate === null && secondDate === null) return first.name.localeCompare(second.name, 'ru')
      if (firstDate === null) return 1
      if (secondDate === null) return -1
      return firstDate - secondDate
    })

    return result
  }, [olympiads, sortBy, collection, period])

  const activeFiltersCount = [
    subjects.length > 0,
    Boolean(grade),
    Boolean(level),
    Boolean(status),
    Boolean(format),
    period !== 'all',
    collection !== 'upcoming',
    onlyWithBenefits,
    onlyTargetUniversity,
    onlyMyRegion
  ].filter(Boolean).length

  const hasFilters = Boolean(searchQuery.trim() || activeFiltersCount > 0 || sortBy !== 'date')

  const clearFilters = () => {
    setSearchQuery('')
    setSubjects(profile?.subjects ?? [])
    setGrade(profile?.grade ? String(profile.grade) : '')
    setLevel('')
    setStatus('')
    setFormat('')
    setPeriod('all')
    setCollection('upcoming')
    setOnlyWithBenefits(false)
    setOnlyTargetUniversity(false)
    setOnlyMyRegion(false)
    setSortBy('date')
  }

  const closeFilters = () => setFiltersOpen(false)

  return (
    <div className="dashboard-container catalog-page">
      <PageHeader
        eyebrow="ВОЗМОЖНОСТИ ДЛЯ ТВОЕГО РОСТА"
        title="Каталог олимпиад"
        description="Подбирай соревнования по предметам из профиля, следи за регистрацией и находи олимпиады с преимуществами при поступлении."
      />

      <section className="panel catalog-panel catalog-panel-enhanced">
        <div className="catalog-search-row">
          <label className="catalog-search-input">
            <Search size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Найти олимпиаду, организатора или предмет…"
              aria-label="Поиск олимпиад"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Очистить поиск">
                <X size={16} />
              </button>
            )}
          </label>

          <button
            type="button"
            className={`catalog-filter-trigger${filtersOpen ? ' is-active' : ''}`}
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-controls="catalog-filter-panel"
          >
            <SlidersHorizontal size={17} />
            Фильтры
            {activeFiltersCount > 0 && <span className="catalog-filter-count">{activeFiltersCount}</span>}
            <ChevronDown size={15} />
          </button>
        </div>

        <div className="catalog-subject-filter">
          <div className="catalog-filter-heading">
            <strong>Предметы</strong>
            <span>{subjects.length ? 'Выбраны предметы из твоего профиля — можно изменить подбор' : 'Можно выбрать несколько'}</span>
          </div>
          <div className="catalog-chip-row">
            <button
              type="button"
              className={`catalog-chip${subjects.length === 0 ? ' is-selected' : ''}`}
              aria-pressed={subjects.length === 0}
              onClick={() => setSubjects([])}
            >
              Все предметы
            </button>
            {SUBJECTS.map((item) => {
              const selected = subjects.includes(item.id)
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`catalog-chip${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setSubjects((current) => toggleValue(current, item.id))}
                >
                  {selected && <Check size={13} />}
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="catalog-period-filter">
          <div className="catalog-filter-heading">
            <strong>Период проведения</strong>
            <span>Выбери, насколько далеко смотреть</span>
          </div>
          <div className="catalog-chip-row catalog-period-chips">
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((value) => (
              <button
                type="button"
                key={value}
                className={`catalog-chip${period === value ? ' is-selected' : ''}`}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {PERIOD_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-collection-tabs" role="group" aria-label="Разделы каталога">
          <button type="button" className={collection === 'upcoming' ? 'is-active' : ''} onClick={() => { setCollection('upcoming'); setStatus('') }} aria-pressed={collection === 'upcoming'}>
            Ближайшие <span>{collectionCounts.upcoming}</span>
          </button>
          <button type="button" className={collection === 'all' ? 'is-active' : ''} onClick={() => { setCollection('all'); setStatus('') }} aria-pressed={collection === 'all'}>
            Все олимпиады <span>{collectionCounts.all}</span>
          </button>
          <button type="button" className={collection === 'closed' ? 'is-active' : ''} onClick={() => { setCollection('closed'); setStatus('') }} aria-pressed={collection === 'closed'}>
            Регистрация завершена <span>{collectionCounts.closed}</span>
          </button>
        </div>
        <p className="catalog-collection-note">В завершённом разделе собраны олимпиады, на которые регистрация уже закрыта, даже если отдельные этапы ещё впереди.</p>

        <div className="catalog-results-bar catalog-results-bar-enhanced">
          <div className="catalog-results-count">
            Найдено олимпиад: <strong>{visibleOlympiads.length}</strong>
            {profile?.region && <span className="catalog-profile-context"><MapPin size={13} /> {profile.region}</span>}
            {profileLoading && <span className="catalog-profile-loading">Загружаем профиль…</span>}
          </div>

          <div className="catalog-results-actions">
            <label className="catalog-sort-select">
              <span>Сортировка</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}>
                <option value="date">По ближайшим датам</option>
                <option value="name">По названию</option>
                <option value="level">По уровню</option>
              </select>
            </label>
            {hasFilters && (
              <button type="button" className="catalog-reset-button" onClick={clearFilters}>
                <X size={14} /> Сбросить
              </button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="catalog-filter-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFilters()
          }}>
            <section
              className="catalog-filter-sheet"
              id="catalog-filter-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="catalog-filter-title"
            >
              <div className="catalog-filter-sheet-header">
                <div>
                  <span className="section-kicker">ТОЧНЫЙ ПОДБОР</span>
                  <h2 id="catalog-filter-title">Фильтры каталога</h2>
                </div>
                <button type="button" className="catalog-filter-close" onClick={closeFilters} aria-label="Закрыть фильтры">
                  <X size={19} />
                </button>
              </div>

              <div className="catalog-filter-sheet-content">
                <div className="catalog-filter-group">
                  <div className="catalog-filter-heading"><strong>Класс</strong><span>Твой класс можно оставить выбранным</span></div>
                  <div className="catalog-chip-row">
                    <button type="button" className={`catalog-chip${!grade ? ' is-selected' : ''}`} onClick={() => setGrade('')} aria-pressed={!grade}>Все</button>
                    {GRADES.map((item) => (
                      <button key={item} type="button" className={`catalog-chip${grade === String(item) ? ' is-selected' : ''}`} onClick={() => setGrade(String(item))} aria-pressed={grade === String(item)}>{item}</button>
                    ))}
                  </div>
                </div>

                <div className="catalog-filter-group">
                  <div className="catalog-filter-heading"><strong>Уровень олимпиады</strong></div>
                  <div className="catalog-chip-row">
                    <button type="button" className={`catalog-chip${!level ? ' is-selected' : ''}`} onClick={() => setLevel('')} aria-pressed={!level}>Любой</button>
                    {LEVELS.map((item) => (
                      <button key={item} type="button" className={`catalog-chip${level === String(item) ? ' is-selected' : ''}`} onClick={() => setLevel(String(item))} aria-pressed={level === String(item)}>{LEVEL_LABELS[item]}</button>
                    ))}
                  </div>
                </div>

                <div className="catalog-filter-grid">
                  <label className="catalog-filter-select">
                    <span>Статус регистрации</span>
                    <select value={status} onChange={(event) => {
                      const nextStatus = event.target.value as FilterStatus
                      setStatus(nextStatus)
                      if (nextStatus === 'closed') setCollection('closed')
                      else if (nextStatus) setCollection('all')
                    }}>
                      <option value="">Любой статус</option>
                      <option value="eligible">Открыта</option>
                      <option value="upcoming">Скоро</option>
                      <option value="closed">Завершена</option>
                      <option value="unknown">Даты уточняются</option>
                    </select>
                  </label>

                  <label className="catalog-filter-select">
                    <span>Формат участия</span>
                    <select value={format} onChange={(event) => setFormat(event.target.value as FilterFormat)}>
                      <option value="">Любой формат</option>
                      <option value="online">Онлайн</option>
                      <option value="offline">Очно</option>
                      <option value="mixed">Смешанный</option>
                    </select>
                  </label>
                </div>

                <div className="catalog-filter-toggles">
                  <label className="catalog-filter-toggle">
                    <span className="catalog-filter-toggle-icon"><Award size={17} /></span>
                    <span><strong>Только с подтверждёнными льготами</strong><small>Учитываются только официальные условия на {benefitYear} год для {admissionGrade} класса</small></span>
                    <input type="checkbox" checked={onlyWithBenefits} onChange={(event) => setOnlyWithBenefits(event.target.checked)} />
                  </label>

                  <label className={`catalog-filter-toggle${!profile?.targetUniversityId ? ' is-disabled' : ''}`}>
                    <span className="catalog-filter-toggle-icon"><GraduationCap size={17} /></span>
                    <span><strong>Подходит для моего вуза</strong><small>{profile?.targetUniversityId ? 'Учитываем выбранный вуз и программу' : 'Сначала выбери целевой вуз в профиле'}</small></span>
                    <input type="checkbox" checked={onlyTargetUniversity} disabled={!profile?.targetUniversityId} onChange={(event) => setOnlyTargetUniversity(event.target.checked)} />
                  </label>

                  <label className={`catalog-filter-toggle${!profile?.region ? ' is-disabled' : ''}`}>
                    <span className="catalog-filter-toggle-icon"><MapPin size={17} /></span>
                    <span><strong>Учитывать мой регион</strong><small>{profile?.region ?? 'Регион не указан в профиле'}</small></span>
                    <input type="checkbox" checked={onlyMyRegion} disabled={!profile?.region} onChange={(event) => setOnlyMyRegion(event.target.checked)} />
                  </label>
                </div>
              </div>

              <div className="catalog-filter-sheet-footer">
                <button type="button" className="secondary-button" onClick={() => {
                  setGrade(profile?.grade ? String(profile.grade) : '')
                  setLevel('')
                  setStatus('')
                  setFormat('')
                  setOnlyWithBenefits(false)
                  setOnlyTargetUniversity(false)
                  setOnlyMyRegion(false)
                }}>
                  Сбросить фильтры
                </button>
                <button type="button" className="primary-button" onClick={closeFilters}>
                  Показать результаты <ChevronRight size={16} />
                </button>
              </div>
            </section>
          </div>
        )}

        {loading ? (
          <LoadingState message="Загружаем каталог олимпиад..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visibleOlympiads.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={25} />}
            title="Пока ничего не нашли"
            description="Попробуй изменить предметы, период или фильтры. В разделе «Регистрация завершена» можно посмотреть олимпиады, на которые уже нельзя записаться."
          />
        ) : (
          <div className="catalog-list catalog-list-enhanced">
            {visibleOlympiads.map((olympiad) => {
              const nextDate = getNextStageDate(olympiad)
              const formats = getFormats(olympiad)
              const nextRegistration = getNextRegistration(olympiad)
              const timeline = getTimeline(olympiad)

              return (
                <article className="catalog-card catalog-card-enhanced" key={olympiad.id}>
                  <div className="catalog-card-icon"><BookOpen size={22} /></div>

                  <div className="catalog-card-content">
                    <div className="catalog-card-topline">
                      <span className={`status-pill status-${olympiad.status}`}>{STATUS_LABELS[olympiad.status]}</span>
                      <span className="catalog-level">{olympiad.level !== null ? LEVEL_LABELS[olympiad.level] : 'Уровень уточняется'}</span>
                    </div>

                    <h2>{olympiad.name}</h2>
                    <p className="catalog-organizer">
                      Организатор: {olympiad.organizer}
                      {olympiad.website && (
                        <a href={olympiad.website} target="_blank" rel="noreferrer noopener" className="catalog-organizer-link">
                          Перейти к организатору <ExternalLink size={12} />
                        </a>
                      )}
                    </p>
                    {olympiad.description && <p className="catalog-description">{olympiad.description}</p>}

                    <div className="tag-list">
                      {olympiad.subjects.map((id) => {
                        const item = SUBJECTS.find((subjectItem) => subjectItem.id === id)
                        return <span className="subject-tag" key={id}>{item?.label ?? id}</span>
                      })}
                    </div>

                    <div className="catalog-timeline" aria-label="Сроки олимпиады">
                      <div className="catalog-timeline-step">
                        <span>Регистрация</span>
                        <strong>{timeline.registration}</strong>
                      </div>
                      <span className="catalog-timeline-connector" aria-hidden="true" />
                      <div className="catalog-timeline-step">
                        <span>Начало</span>
                        <strong>{timeline.start}</strong>
                      </div>
                      <span className="catalog-timeline-connector" aria-hidden="true" />
                      <div className="catalog-timeline-step">
                        <span>Завершение</span>
                        <strong>{timeline.end}</strong>
                      </div>
                    </div>

                    <div className="catalog-card-facts">
                      <span><GraduationCap size={14} /> Классы: {olympiad.grades.length ? olympiad.grades.join(', ') : 'уточняются'}</span>
                      <span><Monitor size={14} /> {formats.length ? formats.map((item) => FORMAT_LABELS[item]).join(' / ') : 'Формат уточняется'}</span>
                      {nextDate !== null && <span><CalendarDays size={14} /> Ближайший этап: {formatDate(nextDate)}</span>}
                      {nextRegistration && <span><Clock3 size={14} /> Начало регистрации: {nextRegistration}</span>}
                    </div>

                    {olympiad.benefits.length > 0 ? (
                      <div className="catalog-benefit-preview">
                        <div className="catalog-benefit-preview-title"><Award size={15} /> Подтверждённые льготы на {olympiad.benefitYear} год</div>
                        <div className="catalog-benefit-tags">
                          {[...new Set(olympiad.benefits.map((benefit) => getBenefitLabel(benefit.rightType)))].map((label) => (
                            <span className="catalog-benefit-tag" key={label}>{label}</span>
                          ))}
                          <span className="catalog-benefit-universities">{[...new Set(olympiad.benefits.map((benefit) => benefit.universityShortName))].join(', ')}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="catalog-benefit-empty">Подтверждённые льготы на {olympiad.benefitYear} год пока не найдены</div>
                    )}

                    <div className="catalog-card-footer">
                      <span className="catalog-card-season">{olympiad.season?.academicYear ?? 'Сезон не опубликован'}</span>
                      <Link className="catalog-details-link" to={`/olympiads/${encodeURIComponent(olympiad.id)}`}>
                        Подробнее об олимпиаде <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <p className="catalog-legal-note">
        Информация о льготах носит справочный характер. Перед поступлением проверяй локальные акты выбранного вуза и официальные документы организаторов.
      </p>
    </div>
  )
}
