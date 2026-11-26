import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Bookmark,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Info,
  MapPin,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react'

import {
  SUBJECTS,
  type OlympiadFormat,
  type OlympiadListType,
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
import { readFavorites, subscribeToFavorites, toggleFavorite } from '@/services/favorites.store'
import { readCalendarOlympiadIds, subscribeToCalendarSelection, toggleCalendarOlympiad } from '@/services/calendar-selection.store'
import { readRegisteredOlympiadIds, subscribeToOlympiadRegistration, toggleOlympiadRegistration } from '@/services/olympiad-registration.store'
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

  const scheduleDates = (olympiad.scheduleItems ?? [])
    .filter((item) => item.isConfirmed && (item.dateParseStatus === 'exact' || item.dateParseStatus === 'range') && item.startDate)
    .map((item) => parseLocalDate(item.startDate as string))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime())
  const legacyDates = (olympiad.season?.stages ?? [])
    .map((stage) => parseLocalDate(stage.startDate))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime())
  const timestamps = [...scheduleDates, ...legacyDates]
    .filter((timestamp) => timestamp >= today.getTime())

  return timestamps.length > 0 ? Math.min(...timestamps) : null
}

function formatDateCompact(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short'
  }).format(new Date(timestamp))
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

function safeHttpUrl(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
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
  const { session, user } = useAuth()
  const storageScope = user?.id ? `user:${user.id}` : 'guest'
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavorites(storageScope).filter((entry) => entry.kind === 'olympiad').map((entry) => entry.id))
  const [calendarIds, setCalendarIds] = useState<string[]>(() => readCalendarOlympiadIds(storageScope))
  const [registeredIds, setRegisteredIds] = useState<string[]>(() => readRegisteredOlympiadIds(storageScope))

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
  const [listType, setListType] = useState<OlympiadListType>('school_olympiad')
  const [onlyWithBenefits, setOnlyWithBenefits] = useState(false)
  const [onlyTargetUniversity, setOnlyTargetUniversity] = useState(false)
  const [onlyMyRegion, setOnlyMyRegion] = useState(false)
  const [sortBy, setSortBy] = useState<SortMode>('level')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    setFavoriteIds(readFavorites(storageScope).filter((entry) => entry.kind === 'olympiad').map((entry) => entry.id))
    return subscribeToFavorites(storageScope, () => setFavoriteIds(readFavorites(storageScope).filter((entry) => entry.kind === 'olympiad').map((entry) => entry.id)))
  }, [storageScope])

  useEffect(() => {
    setCalendarIds(readCalendarOlympiadIds(storageScope))
    return subscribeToCalendarSelection(storageScope, () => setCalendarIds(readCalendarOlympiadIds(storageScope)))
  }, [storageScope])
  useEffect(() => {
    setRegisteredIds(readRegisteredOlympiadIds(storageScope))
    return subscribeToOlympiadRegistration(storageScope, () => setRegisteredIds(readRegisteredOlympiadIds(storageScope)))
  }, [storageScope])

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
      listType,
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
    listType,
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
        const firstOfficial = first.sourceStatus === 'official' ? 0 : 1
        const secondOfficial = second.sourceStatus === 'official' ? 0 : 1
        if (firstOfficial !== secondOfficial) return firstOfficial - secondOfficial
        if (firstOfficial === 0) {
          const firstLevel = first.profiles.length > 0 ? Math.min(...first.profiles.map((profile) => profile.level)) : first.level ?? Number.MAX_SAFE_INTEGER
          const secondLevel = second.profiles.length > 0 ? Math.min(...second.profiles.map((profile) => profile.level)) : second.level ?? Number.MAX_SAFE_INTEGER
          if (firstLevel !== secondLevel) return firstLevel - secondLevel
        }
        return first.name.localeCompare(second.name, 'ru')
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

  const hasFilters = Boolean(searchQuery.trim() || activeFiltersCount > 0 || sortBy !== 'level')

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
    setSortBy('level')
  }

  const closeFilters = () => setFiltersOpen(false)

  const handleFavorite = (id: string) => {
    toggleFavorite(storageScope, 'olympiad', id)
    setFavoriteIds(readFavorites(storageScope).filter((entry) => entry.kind === 'olympiad').map((entry) => entry.id))
  }

  const handleCalendarSelection = (id: string) => {
    toggleCalendarOlympiad(storageScope, id)
    setCalendarIds(readCalendarOlympiadIds(storageScope))
  }
  const handleRegistrationToggle = (id: string) => {
    toggleOlympiadRegistration(storageScope, id)
    setRegisteredIds(readRegisteredOlympiadIds(storageScope))
  }

  return (
    <div className="dashboard-container catalog-page">
      <PageHeader
        eyebrow="ВОЗМОЖНОСТИ ДЛЯ ТВОЕГО РОСТА"
        title={listType === 'school_olympiad' ? 'Каталог олимпиад школьников' : 'Иные интеллектуальные и творческие конкурсы'}
        description={listType === 'school_olympiad' ? 'Подбирай олимпиады по предметам и классу, следи за этапами и проверяй условия поступления по документам выбранного вуза.' : 'Отдельный каталог интеллектуальных и творческих конкурсов из перечня Минпросвещения. Он помогает находить мероприятия, но сам по себе не подтверждает особые права при поступлении.'}
      />

      <nav className="olympiad-list-tabs" aria-label="Официальные перечни мероприятий">
        <button type="button" className={listType === 'school_olympiad' ? 'is-active' : ''} onClick={() => { setListType('school_olympiad'); setOnlyWithBenefits(false); setOnlyTargetUniversity(false); setLevel('') }} aria-pressed={listType === 'school_olympiad'}>Олимпиады школьников</button>
        <button type="button" className={listType === 'intellectual_competition' ? 'is-active' : ''} onClick={() => { setListType('intellectual_competition'); setOnlyWithBenefits(false); setOnlyTargetUniversity(false); setLevel('') }} aria-pressed={listType === 'intellectual_competition'}>Иные интеллектуальные и творческие конкурсы</button>
      </nav>
      {listType === 'intellectual_competition' ? (
        <div className="olympiad-list-legal-note"><Info size={16} />Это отдельный перечень Минпросвещения. Сам факт включения конкурса в него не предоставляет особых прав при поступлении в вуз.</div>
      ) : (
        <div className="olympiad-list-legal-note"><Info size={16} />Официальный перечень олимпиад школьников утверждается Минобрнауки. Уровень и включение каждой записи должны быть подтверждены документом; особые права устанавливает вуз в локальном акте для года и программы.</div>
      )}

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
            {listType === 'school_olympiad' ? 'Все олимпиады' : 'Все конкурсы'} <span>{collectionCounts.all}</span>
          </button>
          <button type="button" className={collection === 'closed' ? 'is-active' : ''} onClick={() => { setCollection('closed'); setStatus('') }} aria-pressed={collection === 'closed'}>
            Регистрация завершена <span>{collectionCounts.closed}</span>
          </button>
        </div>
        <p className="catalog-collection-note">В завершённом разделе собраны олимпиады, на которые регистрация уже закрыта, даже если отдельные этапы ещё впереди.</p>

        <div className="catalog-results-bar catalog-results-bar-enhanced">
          <div className="catalog-results-count">
            Найдено {listType === 'school_olympiad' ? 'олимпиад' : 'конкурсов'}: <strong>{visibleOlympiads.length}</strong>
            {profile?.region && <span className="catalog-profile-context"><MapPin size={13} /> {profile.region}</span>}
            {profileLoading && <span className="catalog-profile-loading">Загружаем профиль…</span>}
          </div>

          <div className="catalog-results-actions">
            <label className="catalog-sort-select">
              <span>Сортировка</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}>
                <option value="date">По ближайшим датам</option>
                <option value="name">По названию</option>
                <option value="level">Сначала проверенные записи, затем уровень</option>
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

                {listType === 'school_olympiad' && <div className="catalog-filter-group">
                  <div className="catalog-filter-heading"><strong>Уровень олимпиады</strong></div>
                  <div className="catalog-chip-row">
                    <button type="button" className={`catalog-chip${!level ? ' is-selected' : ''}`} onClick={() => setLevel('')} aria-pressed={!level}>Любой</button>
                    {LEVELS.map((item) => (
                      <button key={item} type="button" className={`catalog-chip${level === String(item) ? ' is-selected' : ''}`} onClick={() => setLevel(String(item))} aria-pressed={level === String(item)}>{LEVEL_LABELS[item]}</button>
                    ))}
                  </div>
                </div>}

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

                {listType === 'school_olympiad' && <div className="catalog-filter-toggles">
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
                </div>}
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
            description={listType === 'intellectual_competition' ? 'Записи второго перечня ещё не импортированы в базу. Мы не будем заполнять каталог вымышленными конкурсами: после загрузки официального реестра они появятся здесь отдельно.' : 'Попробуй изменить предметы, период или фильтры. Часть существующих записей ещё проходит сверку с официальными документами; это отмечено в карточках.'}
          />
        ) : (
          <div className="catalog-list catalog-list-enhanced">
            {visibleOlympiads.map((olympiad) => {
              const nextDate = getNextStageDate(olympiad)

              return (
                <article className="catalog-card catalog-card-enhanced olympiad-compact-card" key={olympiad.id}>
                  <div className="catalog-card-content">
                    <p className="catalog-organizer">{olympiad.organizer || 'Организатор уточняется'}</p>
                    <h2><Link to={`/olympiads/${encodeURIComponent(olympiad.id)}`}>{olympiad.name}</Link></h2>
                    <div className="olympiad-compact-meta">
                      <span className={`status-pill status-${olympiad.status}`}>{STATUS_LABELS[olympiad.status]}</span>
                      {olympiad.listType === 'school_olympiad' ? (
                        <span className="catalog-level">{olympiad.profiles.length > 0
                          ? 'Уровни по профилям: ' + [...new Set(olympiad.profiles.map((profile) => profile.level))].sort().map((value) => LEVEL_LABELS[value]).join(', ')
                          : olympiad.level !== null ? 'Уровень ' + LEVEL_LABELS[olympiad.level] : 'Уровень уточняется'}</span>
                      ) : <span className="catalog-level">Уровень не применяется</span>}
                      {olympiad.officialListNumber != null && olympiad.sourceStatus === 'official' && <span>№ {olympiad.officialListNumber} в перечне</span>}
                      <span className={`olympiad-source-status${olympiad.sourceStatus === 'official' ? ' is-official' : ''}`}>{olympiad.sourceStatus === 'official' ? 'Источник проверен' : 'Требует проверки'}</span>
                      {olympiad.grades.length > 0
                        ? <span>Классы: {olympiad.grades.join(', ')}</span>
                        : <span>Классы участия: уточняйте у организатора</span>}
                      {nextDate !== null && <span><CalendarDays size={14} /> Ближайший этап: {formatDateCompact(nextDate)}</span>}
                    </div>
                    <div className="tag-list olympiad-compact-subjects">
                      {olympiad.subjects.slice(0, 4).map((id) => <span className="subject-tag" key={id}>{SUBJECTS.find((item) => item.id === id)?.label ?? id}</span>)}
                      {olympiad.subjects.length > 4 && <span className="subject-tag">+{olympiad.subjects.length - 4}</span>}
                    </div>
                    {olympiad.profiles.length > 0 && (
                      <div className="tag-list olympiad-compact-profiles" aria-label="Профили и уровни олимпиады">
                        {olympiad.profiles.slice(0, 4).map((profile) => (
                          <span className="subject-tag" key={profile.id}>{profile.profileName} · {LEVEL_LABELS[profile.level]}</span>
                        ))}
                        {olympiad.profiles.length > 4 && <span className="subject-tag">Ещё {olympiad.profiles.length - 4} проф.</span>}
                      </div>
                    )}
                    {safeHttpUrl(olympiad.sourceDocumentUrl) && <a className="olympiad-source-link" href={safeHttpUrl(olympiad.sourceDocumentUrl) ?? undefined} target="_blank" rel="noopener noreferrer">{olympiad.sourceDocumentTitle || 'Официальный документ перечня'} <ExternalLink size={12} /></a>}
                    <div className="catalog-card-footer olympiad-compact-actions">
              {olympiad.listType === 'school_olympiad' && (
                <button type="button" className={`olympiad-save-action${registeredIds.includes(olympiad.id) ? ' is-active' : ''}`} onClick={() => handleRegistrationToggle(olympiad.id)} aria-pressed={registeredIds.includes(olympiad.id)}>
                  {registeredIds.includes(olympiad.id) ? 'Зарегистрирован' : 'Отметить регистрацию'}
                  <span role="img" aria-label="Справка о личной отметке" title="Это твоя личная отметка. Trajectory не регистрирует тебя на сайте организатора и не проверяет факт регистрации."><Info size={13} /></span>
                </button>
              )}
                      <Link className="catalog-details-link" to={`/olympiads/${encodeURIComponent(olympiad.id)}`}>Подробности <ChevronRight size={16} /></Link>
                      <button type="button" className={`olympiad-save-action${favoriteIds.includes(olympiad.id) ? ' is-active' : ''}`} onClick={() => handleFavorite(olympiad.id)} aria-pressed={favoriteIds.includes(olympiad.id)}><Bookmark size={15} />{favoriteIds.includes(olympiad.id) ? 'В избранном' : 'В избранное'}</button>
                      <button type="button" className={`olympiad-save-action${calendarIds.includes(olympiad.id) ? ' is-active' : ''}`} onClick={() => handleCalendarSelection(olympiad.id)} aria-pressed={calendarIds.includes(olympiad.id)}><CalendarPlus size={15} />{calendarIds.includes(olympiad.id) ? 'В календаре' : 'В календарь'}</button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <p className="catalog-legal-note">
        Сортировка выполняется по уровню официального перечня, а не по пользовательскому рейтингу: подтверждённого рейтинга в базе пока нет. Включение в перечень само по себе не гарантирует льготу. Особые права устанавливаются каждым вузом в локальном акте для конкретной программы и года.
      </p>
    </div>
  )
}
