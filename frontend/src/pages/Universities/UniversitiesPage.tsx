import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  ExternalLink,
  GraduationCap,
  GitCompareArrows,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  X
} from 'lucide-react'

import type {
  BenefitVerificationFilter,
  UniversityBenefit
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { UniversityDiscoveryPanel } from '@/components/universities/UniversityDiscoveryPanel'
import { useAsyncData } from '@/hooks/useAsyncData'
import { universityService } from '@/services/university.service'
import {
  clearComparisonSelections,
  readComparisonUniversityIds,
  readDiscoveredComparisonUniversities,
  removeComparisonSelection,
  subscribeToComparisonChanges,
  writeComparisonUniversityIds
} from '@/services/university-comparison.store'
import {
  getBenefitVerificationClass,
  getBenefitVerificationLabel,
  getTargetAdmissionYear,
  hasCompleteOfficialEvidence,
  matchesBenefitVerificationFilter
} from '@/utils/benefits'

import './benefits-enhancements.css'

type UniversitySortMode = 'name' | 'city'

const RIGHT_LABELS: Record<string, string> = {
  BVI: 'Поступление без вступительных испытаний',
  '100_points': '100 баллов по предмету',
  extra_points: 'Дополнительные баллы'
}

const STATUS_LABELS: Record<string, string> = {
  winner: 'Победитель',
  prize: 'Призёр',
  both: 'Победитель или призёр'
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'I уровень',
  2: 'II уровень',
  3: 'III уровень',
  4: 'IV уровень'
}

const SORT_LABELS: Record<UniversitySortMode, string> = {
  name: 'По названию',
  city: 'По городу'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Дата проверки не указана'

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)

  if (Number.isNaN(date.getTime())) return 'Дата проверки не указана'

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function getSafeUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null

  try {
    const normalized = /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`
    const url = new URL(normalized)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    return url.toString()
  } catch {
    return null
  }
}

function getLevelLabel(level?: number): string {
  if (level == null) return 'Не применяется или не указан'
  return LEVEL_LABELS[level] ?? `${level} уровень`
}

function getResultClassLabel(resultClass?: number): string {
  return resultClass == null
    ? 'Не указан в документе'
    : `Диплом за ${resultClass} класс`
}

function BenefitList({ universityId }: { universityId: string }) {
  const targetAdmissionYear = getTargetAdmissionYear()
  const [selectedYear, setSelectedYear] = useState(targetAdmissionYear)
  const [verificationFilter, setVerificationFilter] =
    useState<BenefitVerificationFilter>('all')

  const loadBenefits = useCallback(
    () => universityService.compareBenefits({ universityId }),
    [universityId]
  )

  const {
    data: benefits,
    loading,
    error,
    reload
  } = useAsyncData<UniversityBenefit[]>(loadBenefits, [])

  const availableYears = useMemo(() => {
    const years = (benefits ?? []).map((benefit) => benefit.validYear)
    return [...new Set([targetAdmissionYear, ...years])].sort(
      (first, second) => second - first
    )
  }, [benefits, targetAdmissionYear])

  const visibleBenefits = useMemo(
    () =>
      (benefits ?? []).filter(
        (benefit) =>
          benefit.validYear === selectedYear &&
          matchesBenefitVerificationFilter(benefit, verificationFilter)
      ),
    [benefits, selectedYear, verificationFilter]
  )

  const yearBenefits = (benefits ?? []).filter(
    (benefit) => benefit.validYear === selectedYear
  )

  const officialCount = yearBenefits.filter(
    hasCompleteOfficialEvidence
  ).length
  const draftCount = yearBenefits.filter((benefit) =>
    matchesBenefitVerificationFilter(benefit, 'draft')
  ).length
  const archivedCount = yearBenefits.filter(
    (benefit) => benefit.verificationStatus === 'archived'
  ).length

  if (loading) {
    return <LoadingState message="Проверяем условия поступления..." />
  }

  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="benefit-explorer">
      <div className="benefit-filter-toolbar">
        <label>
          <span>Год поступления</span>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((year) => (
              <option value={year} key={year}>
                {year}
                {year < targetAdmissionYear ? ' · архивный год' : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Статус условий</span>
          <select
            value={verificationFilter}
            onChange={(event) =>
              setVerificationFilter(
                event.target.value as BenefitVerificationFilter
              )
            }
          >
            <option value="all">Все статусы</option>
            <option value="official">Официально подтверждённые</option>
            <option value="draft">Предварительные / требуют проверки</option>
            <option value="archived">Архивные</option>
          </select>
        </label>
      </div>

      <div className="benefit-status-summary" aria-live="polite">
        <span className="benefit-status-summary-item">
          <i className="status-dot status-dot-official" />
          Официально подтверждено: <strong>{officialCount}</strong>
        </span>
        <span className="benefit-status-summary-item">
          <i className="status-dot status-dot-draft" />
          Требуют проверки: <strong>{draftCount}</strong>
        </span>
        <span className="benefit-status-summary-item">
          <i className="status-dot status-dot-archived" />
          Архив: <strong>{archivedCount}</strong>
        </span>
      </div>

      {selectedYear < targetAdmissionYear && (
        <div className="benefit-admission-notice benefit-admission-notice-archive">
          <Info size={17} />
          <p>
            Отображаются условия за {selectedYear} год. Это исторические
            сведения: они не подтверждают правила приёма на {targetAdmissionYear}
            {' '}год и не должны переноситься на новый набор.
          </p>
        </div>
      )}

      {selectedYear === targetAdmissionYear && yearBenefits.length === 0 && (
        <div className="benefit-admission-notice">
          <Info size={17} />
          <p>
            В базе проекта пока нет записей об олимпиадных льготах на
            {` ${targetAdmissionYear} `}год для этого университета. Это не означает,
            что вуз не предоставляет льготы. Проверяй официальный документ
            приёмной комиссии.
          </p>
        </div>
      )}

      {visibleBenefits.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={25} />}
          title={
            yearBenefits.length === 0
              ? 'Условия за этот год пока не добавлены'
              : 'По выбранному статусу записей нет'
          }
          description={
            yearBenefits.length === 0
              ? 'Можно выбрать другой год, чтобы посмотреть историю условий. Отсутствие данных не означает отсутствие льгот.'
              : 'Измени фильтр статуса, чтобы посмотреть другие записи. Отсутствие записи в справочнике не означает отсутствие льготы.'
          }
        />
      ) : (
        <div className="benefit-list">
          {visibleBenefits.map((benefit) => {
            const sourceUrl = getSafeUrl(benefit.sourceUrl)
            const completeEvidence = hasCompleteOfficialEvidence(benefit)

            return (
              <article className="benefit-card" key={benefit.id}>
                <div className="benefit-card-icon">
                  <ShieldCheck size={21} />
                </div>

                <div className="benefit-card-content">
                  <div className="benefit-card-top">
                    <span className="benefit-year">
                      Правила приёма на {benefit.validYear} год
                    </span>
                    <span
                      className={`benefit-verification-status ${getBenefitVerificationClass(benefit)}`}
                    >
                      {getBenefitVerificationLabel(benefit)}
                    </span>
                  </div>

                  <h3>
                    {RIGHT_LABELS[benefit.rightType] ?? benefit.rightType}
                  </h3>

                  <div className="university-benefit-context">
                    <div className="university-benefit-context-item">
                      <span>Олимпиада</span>
                      <div>
                        <Trophy size={15} />
                        <strong>
                          {benefit.olympiadName ?? 'Название не указано'}
                        </strong>
                      </div>
                      {benefit.olympiadOrganizer && (
                        <small>Организатор: {benefit.olympiadOrganizer}</small>
                      )}
                    </div>

                    <div className="university-benefit-context-item">
                      <span>Образовательная программа</span>
                      <div>
                        <BookOpen size={15} />
                        <strong>
                          {benefit.programName ??
                            (benefit.programId
                              ? 'Программа отсутствует в справочнике'
                              : 'Все подходящие программы')}
                        </strong>
                      </div>
                      {benefit.programDirection && (
                        <small>Код направления: {benefit.programDirection}</small>
                      )}
                    </div>
                  </div>

                  <div className="benefit-details">
                    <div className="benefit-detail-row">
                      <span>Категория участника</span>
                      <strong>
                        {STATUS_LABELS[benefit.forStatus] ?? benefit.forStatus}
                      </strong>
                    </div>
                    <div className="benefit-detail-row benefit-result-class-row">
                      <span>Класс диплома</span>
                      <strong>{getResultClassLabel(benefit.resultClassRequired)}</strong>
                    </div>
                    <div className="benefit-detail-row">
                      <span>Уровень олимпиады</span>
                      <strong>{getLevelLabel(benefit.levelRequired)}</strong>
                    </div>
                    <div className="benefit-detail-row">
                      <span>Тип преимущества</span>
                      <strong>{RIGHT_LABELS[benefit.rightType] ?? benefit.rightType}</strong>
                    </div>
                    <div className="benefit-detail-row">
                      <span>Предмет подтверждения</span>
                      <strong>{benefit.confirmExamSubject ?? 'Не указан'}</strong>
                    </div>
                    <div className="benefit-detail-row">
                      <span>Порог подтверждения</span>
                      <strong>
                        {benefit.confirmExamThreshold != null
                          ? `${benefit.confirmExamThreshold} баллов`
                          : 'Не указан'}
                      </strong>
                    </div>
                  </div>

                  {!completeEvidence && benefit.verificationStatus !== 'archived' && (
                    <div className="benefit-evidence-warning">
                      <Info size={15} />
                      <span>
                        Запись нельзя считать полностью подтверждённой: проверь
                        первоисточник и дату проверки.
                      </span>
                    </div>
                  )}

                  <div className="benefit-card-footer">
                    <span className="benefit-checked">
                      {benefit.lastCheckedAt
                        ? `Проверено: ${formatDate(benefit.lastCheckedAt)}`
                        : 'Дата проверки не указана'}
                    </span>
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        className="catalog-details-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть первоисточник <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span className="benefit-source-missing">
                        Источник не указан
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function UniversitiesPage() {
  const [selectedUniversityId, setSelectedUniversityId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [sortBy, setSortBy] = useState<UniversitySortMode>('name')

  const navigate = useNavigate()
  const [comparisonIds, setComparisonIds] = useState<string[]>(readComparisonUniversityIds)
  const [discoveredComparison, setDiscoveredComparison] = useState(readDiscoveredComparisonUniversities)
  const [comparisonNotice, setComparisonNotice] = useState('')
  const comparisonCount = comparisonIds.length + discoveredComparison.length

  useEffect(() => {
    writeComparisonUniversityIds(comparisonIds)
  }, [comparisonIds])

  useEffect(() => subscribeToComparisonChanges(() => {
    setComparisonIds(readComparisonUniversityIds())
    setDiscoveredComparison(readDiscoveredComparisonUniversities())
  }), [])

  const loadUniversities = useCallback(
    () => universityService.getAll(),
    []
  )

  const {
    data: universities,
    loading,
    error,
    reload
  } = useAsyncData(loadUniversities, [])

  const cities = useMemo(() => {
    const values = (universities ?? [])
      .map((university) => university.city)
      .filter((city): city is string => Boolean(city?.trim()))

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b, 'ru')
    )
  }, [universities])

  const filteredUniversities = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ru')

    const result = (universities ?? []).filter((university) => {
      const matchesCity =
        !selectedCity || university.city === selectedCity

      const searchableText = [
        university.name,
        university.shortName,
        university.city,
        university.description,
        ...(university.programs ?? []).map((program) => program.name),
        ...(university.programs ?? []).map(
          (program) => program.direction ?? ''
        )
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ru')

      return matchesCity && (!query || searchableText.includes(query))
    })

    result.sort((first, second) => {
      if (sortBy === 'city') {
        const comparison = first.city.localeCompare(
          second.city,
          'ru'
        )

        if (comparison !== 0) return comparison
      }

      return first.name.localeCompare(second.name, 'ru')
    })

    return result
  }, [universities, searchQuery, selectedCity, sortBy])

  const selectedUniversity = universities?.find(
    (item) => item.id === selectedUniversityId
  )

  const comparisonUniversities = useMemo(
    () =>
      (universities ?? []).filter((university) =>
        comparisonIds.includes(university.id)
      ),
    [universities, comparisonIds]
  )

  const hasFilters = Boolean(searchQuery.trim() || selectedCity)

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCity('')
    setSortBy('name')
  }

  const toggleBenefits = (universityId: string) => {
    setSelectedUniversityId((current) =>
      current === universityId ? '' : universityId
    )
  }

  const toggleComparison = (universityId: string) => {
    setComparisonNotice('')

    if (comparisonIds.includes(universityId)) {
      const nextIds = comparisonIds.filter(
        (id) => id !== universityId
      )

      setComparisonIds(nextIds)


      return
    }

    if (comparisonCount >= 5) {
      setComparisonNotice('Можно сравнить не более 5 вузов.')
      return
    }

    setComparisonIds((current) => [...current, universityId])
  }

  const removeFromComparison = (universityId: string) => {
    const nextIds = comparisonIds.filter(
      (id) => id !== universityId
    )

    setComparisonIds(nextIds)
    setComparisonNotice('')

  }

  const clearComparison = () => {
    clearComparisonSelections()
    setComparisonIds([])
    setDiscoveredComparison([])
    setComparisonNotice('')
  }

  return (
    <div className="dashboard-container universities-page">
      <PageHeader
        eyebrow="ТВОЁ БУДУЩЕЕ ОБРАЗОВАНИЕ"
        title="Университеты"
        description="Находи университеты через интернет, изучай программы и сравнивай условия поступления по олимпиадам."
      />

      <UniversityDiscoveryPanel />

      <section className="panel universities-catalog-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">СПРАВОЧНИК ВУЗОВ</div>
            <h2>Университеты России</h2>
            <p>
              Выбирай университет, изучай направления и проверяй
              условия поступления.
            </p>
          </div>

          <GraduationCap size={23} className="muted-icon" />
        </div>

        {loading ? (
          <LoadingState message="Загружаем университеты..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !universities || universities.length === 0 ? (
          <EmptyState
            icon={<Building2 size={25} />}
            title="Список университетов пока пуст"
            description="Университеты появятся после загрузки справочника в базу данных."
          />
        ) : (
          <>
            <div className="university-toolbar">
              <div className="university-toolbar-title">
                <SlidersHorizontal size={17} />
                <strong>Поиск и фильтры</strong>
              </div>

              <div className="university-filter-controls">
                <label className="university-search-field">
                  <Search size={17} />

                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Название, город или программа..."
                    aria-label="Поиск университетов"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Очистить поиск"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>

                <label className="university-select-field">
                  <span className="visually-hidden">Город</span>

                  <select
                    value={selectedCity}
                    onChange={(event) =>
                      setSelectedCity(event.target.value)
                    }
                  >
                    <option value="">Все города</option>

                    {cities.map((city) => (
                      <option value={city} key={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="university-select-field">
                  <span className="visually-hidden">Сортировка</span>

                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as UniversitySortMode)
                    }
                  >
                    {Object.entries(SORT_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="university-results-bar">
              <span>
                Найдено университетов:{' '}
                <strong>{filteredUniversities.length}</strong>
              </span>

              {hasFilters && (
                <button
                  type="button"
                  className="university-reset-button"
                  onClick={clearFilters}
                >
                  <X size={14} />
                  Сбросить фильтры
                </button>
              )}
            </div>

            {filteredUniversities.length === 0 ? (
              <EmptyState
                icon={<Search size={25} />}
                title="Университеты не найдены"
                description="Попробуй изменить поисковый запрос или выбрать другой город."
              />
            ) : (
              <div className="university-list">
                {filteredUniversities.map((university) => {
                  const websiteUrl = getSafeUrl(university.website)

                  const isSelected =
                    selectedUniversityId === university.id

                  const isInComparison =
                    comparisonIds.includes(university.id)

                  return (
                    <article
                      className={`university-card${isSelected ? ' university-card-selected' : ''}`}
                      key={university.id}
                    >
                      <div className="university-emblem">
                        <GraduationCap size={27} />
                      </div>

                      <div className="university-card-content">
                        <div className="university-card-heading">
                          <div>
                            <span className="university-short-name">
                              {university.shortName}
                            </span>

                            <h3>{university.name}</h3>
                          </div>

                          <span className="university-location">
                            <MapPin size={14} />
                            {university.city}
                          </span>
                        </div>

                        {university.description && (
                          <p className="university-description">
                            {university.description}
                          </p>
                        )}

                        {university.programs &&
                          university.programs.length > 0 && (
                            <div className="university-programs">
                              <div className="university-programs-heading">
                                <BookOpen size={15} />

                                <strong>
                                  Образовательные программы
                                </strong>

                                <span>
                                  {university.programs.length}
                                </span>
                              </div>

                              <div className="tag-list">
                                {university.programs.map((program) => (
                                  <span
                                    className="university-program-tag"
                                    key={program.id}
                                  >
                                    <span>{program.name}</span>

                                    {program.direction && (
                                      <small>{program.direction}</small>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <div className="university-card-actions">
                          <Link
                            className="catalog-details-link"
                            to={`/universities/${encodeURIComponent(university.id)}`}
                          >
                            Подробнее о вузе
                            <ArrowUpRight size={15} />
                          </Link>

                          <button
                            type="button"
                            className={`university-compare-button${isInComparison ? ' university-compare-button-active' : ''}`}
                            onClick={() =>
                              toggleComparison(university.id)
                            }
                            aria-pressed={isInComparison}
                          >
                            {isInComparison ? (
                              <>
                                <Check size={15} />
                                В сравнении
                              </>
                            ) : (
                              <>
                                <GitCompareArrows size={15} />
                                В сравнение
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className={`catalog-details-link${isSelected ? ' university-benefits-active' : ''}`}
                            onClick={() =>
                              toggleBenefits(university.id)
                            }
                            aria-expanded={isSelected}
                          >
                            {isSelected
                              ? 'Скрыть льготы'
                              : 'Сравнить льготы'}

                            <ShieldCheck size={15} />
                          </button>

                          {websiteUrl ? (
                            <a
                              className="catalog-details-link"
                              href={websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Официальный сайт
                              <ExternalLink size={15} />
                            </a>
                          ) : (
                            <span className="university-no-website">
                              Сайт не указан
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      {comparisonNotice && (
        <div
          className="university-comparison-notice"
          role="status"
        >
          {comparisonNotice}
        </div>
      )}


      {selectedUniversity && (
        <section className="panel benefits-panel">
          <div className="panel-heading university-benefits-heading">
            <div>
              <div className="section-kicker">
                СРАВНЕНИЕ УСЛОВИЙ
              </div>

              <h2>
                {selectedUniversity.shortName}: олимпиадные льготы
              </h2>

              <p>
                Условия, сведения об олимпиадах и образовательных
                программах, а также статус проверки.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedUniversityId('')}
            >
              Закрыть
            </button>
          </div>

          <BenefitList universityId={selectedUniversity.id} />
        </section>
      )}

      <div className="university-data-note">
        <Info size={16} />

        <p>
          Условия поступления могут меняться каждый год. Перед подачей
          документов обязательно сверяй льготы с официальными правилами
          приёма университета.
        </p>
      </div>

      {comparisonCount > 0 && (
        <aside className="university-comparison-bar">
          <div className="university-comparison-bar-content">
            <div className="university-comparison-bar-heading">
              <GitCompareArrows size={19} />

              <strong>
                Выбрано вузов: {comparisonCount}/5
              </strong>
            </div>

            <div className="university-comparison-chips">
              {comparisonUniversities.map((university) => (
                <span
                  className="university-comparison-chip"
                  key={university.id}
                >
                  {university.shortName}

                  <button
                    type="button"
                    onClick={() => removeFromComparison(university.id)}
                    aria-label={`Удалить ${university.shortName} из сравнения`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              {discoveredComparison.map((university) => (
                <span className="university-comparison-chip is-discovered" key={university.id}>
                  <span className="university-comparison-chip-label">{university.title}</span>
                  <button
                    type="button"
                    onClick={() => removeComparisonSelection(university.id)}
                    aria-label={`Удалить ${university.title} из сравнения`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="university-comparison-bar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={clearComparison}
            >
              Очистить
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={comparisonCount < 2}
              onClick={() => navigate('/universities/compare')}
            >
              Открыть сравнение
              <GitCompareArrows size={16} />
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}