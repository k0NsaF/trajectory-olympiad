import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Info,
  MapPin,
  ShieldCheck,
  Trophy
} from 'lucide-react'

import type {
  BenefitVerificationFilter,
  UniversityBenefit,
  UniversityProgram
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { universityService } from '@/services/university.service'
import {
  getBenefitVerificationClass,
  getBenefitVerificationLabel,
  getTargetAdmissionYear,
  hasCompleteOfficialEvidence,
  matchesBenefitVerificationFilter
} from '@/utils/benefits'

import './benefits-enhancements.css'

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

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Дата проверки не указана'

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  const date = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Дата проверки не указана'
  }

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

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function getLevelLabel(level?: number): string {
  if (level == null) {
    return 'Не применяется или не указан'
  }

  return LEVEL_LABELS[level] ?? `${level} уровень`
}

function getResultClassLabel(resultClass?: number): string {
  return resultClass == null
    ? 'Не указан в документе'
    : `Диплом за ${resultClass} класс`
}

function UniversityBenefits({
  universityId,
  programs
}: {
  universityId: string
  programs: UniversityProgram[]
}) {
  const targetAdmissionYear = getTargetAdmissionYear()
  const [selectedYear, setSelectedYear] = useState(targetAdmissionYear)
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [verificationFilter, setVerificationFilter] =
    useState<BenefitVerificationFilter>('all')

  const loadBenefits = useCallback(
    () =>
      universityService.compareBenefits({
        universityId,
        ...(selectedProgramId ? { programId: selectedProgramId } : {})
      }),
    [universityId, selectedProgramId]
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

  const yearBenefits = (benefits ?? []).filter(
    (benefit) => benefit.validYear === selectedYear
  )

  const visibleBenefits = yearBenefits.filter((benefit) =>
    matchesBenefitVerificationFilter(benefit, verificationFilter)
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
    return <LoadingState message="Загружаем условия поступления..." />
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} />
  }

  return (
    <div className="benefit-explorer">
      <div className="benefit-filter-toolbar benefit-filter-toolbar-detail">
        <label>
          <span>Год поступления</span>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((year) => (
              <option value={year} key={year}>
                {year}{year < targetAdmissionYear ? ' · архивный год' : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Программа</span>
          <select
            value={selectedProgramId}
            onChange={(event) => setSelectedProgramId(event.target.value)}
          >
            <option value="">Все программы</option>
            {programs.map((program) => (
              <option value={program.id} key={program.id}>
                {program.name}
                {program.direction ? ` · ${program.direction}` : ''}
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
            Это архивные условия за {selectedYear} год. Они полезны для
            ознакомления, но не подтверждают правила приёма на
            {` ${targetAdmissionYear} `}год.
          </p>
        </div>
      )}

      {selectedYear === targetAdmissionYear && yearBenefits.length === 0 && (
        <div className="benefit-admission-notice">
          <Info size={17} />
          <p>
            В базе проекта пока нет записей об олимпиадных льготах на
            {` ${targetAdmissionYear} `}год для выбранного университета и программы.
            Это не доказывает отсутствие льгот у вуза.
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
              ? 'Выбери архивный год, чтобы посмотреть ранее опубликованные условия, или проверь официальный сайт приёмной комиссии.'
              : 'Измени фильтр статуса. Предварительные и архивные сведения не следует считать действующими правилами приёма.'
          }
        />
      ) : (
        <div className="university-detail-benefits">
          {visibleBenefits.map((benefit) => {
            const sourceUrl = getSafeUrl(benefit.sourceUrl)
            const completeEvidence = hasCompleteOfficialEvidence(benefit)

            return (
              <article
                className="university-detail-benefit"
                key={benefit.id}
              >
                <div className="university-detail-benefit-icon">
                  <ShieldCheck size={21} />
                </div>

                <div className="university-detail-benefit-content">
                  <div className="university-detail-benefit-top">
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

                  <div className="university-detail-benefit-context">
                    <div className="university-detail-benefit-context-item">
                      <span className="university-detail-benefit-label">Олимпиада</span>
                      <div className="university-detail-benefit-name">
                        <Trophy size={16} />
                        <strong>
                          {benefit.olympiadName ??
                            'Название олимпиады не добавлено в справочник'}
                        </strong>
                      </div>
                      {benefit.olympiadOrganizer && (
                        <span className="university-detail-context-description">
                          Организатор: {benefit.olympiadOrganizer}
                        </span>
                      )}
                    </div>

                    <div className="university-detail-benefit-context-item">
                      <span className="university-detail-benefit-label">
                        Образовательная программа
                      </span>
                      <div className="university-detail-benefit-name">
                        <BookOpen size={16} />
                        <strong>
                          {benefit.programName ??
                            (benefit.programId
                              ? 'Программа отсутствует в справочнике'
                              : 'Все подходящие программы')}
                        </strong>
                      </div>
                      {benefit.programDirection && (
                        <span className="university-detail-context-description">
                          Код направления: {benefit.programDirection}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="university-detail-benefit-info">
                    <div>
                      <span>Категория участника</span>
                      <strong>{STATUS_LABELS[benefit.forStatus] ?? benefit.forStatus}</strong>
                    </div>
                    <div>
                      <span>Класс диплома</span>
                      <strong>{getResultClassLabel(benefit.resultClassRequired)}</strong>
                    </div>
                    <div>
                      <span>Уровень олимпиады</span>
                      <strong>{getLevelLabel(benefit.levelRequired)}</strong>
                    </div>
                    <div>
                      <span>Тип преимущества</span>
                      <strong>{RIGHT_LABELS[benefit.rightType] ?? benefit.rightType}</strong>
                    </div>
                    <div>
                      <span>Предмет подтверждения</span>
                      <strong>{benefit.confirmExamSubject ?? 'Не указан'}</strong>
                    </div>
                    <div>
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
                        Не хватает подтверждающих данных. Не используй эту запись
                        как окончательное условие поступления без сверки с документом.
                      </span>
                    </div>
                  )}

                  <div className="university-detail-benefit-footer">
                    <span>
                      <CalendarDays size={14} />
                      {benefit.lastCheckedAt
                        ? `Дата проверки: ${formatDate(benefit.lastCheckedAt)}`
                        : 'Дата проверки не указана'}
                    </span>
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="catalog-details-link"
                      >
                        Открыть первоисточник <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span className="university-detail-source-missing">
                        Ссылка на источник не указана
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

export function UniversityDetailsPage() {
  const { id = '' } = useParams()

  const loadUniversity = useCallback(
    () => universityService.getById(id),
    [id]
  )

  const {
    data: university,
    loading,
    error,
    reload
  } = useAsyncData(loadUniversity)

  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingState message="Загружаем информацию об университете..." />
      </div>
    )
  }

  if (error || !university) {
    return (
      <div className="dashboard-container">
        <PageHeader title="Информация об университете" />

        <ErrorState
          message={error ?? 'Университет не найден.'}
          onRetry={reload}
        />

        <Link className="back-link" to="/universities">
          <ArrowLeft size={16} />
          Вернуться к университетам
        </Link>
      </div>
    )
  }

  const websiteUrl = getSafeUrl(university.website)
  const programs = university.programs ?? []

  return (
    <div className="dashboard-container university-details-page">
      <Link className="back-link" to="/universities">
        <ArrowLeft size={16} />
        Все университеты
      </Link>

      <PageHeader
        eyebrow="КАРТОЧКА УНИВЕРСИТЕТА"
        title={university.name}
        description={
          university.description ??
          'Информация об университете и возможностях поступления.'
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

      <section className="panel university-detail-summary">
        <div className="university-detail-identity">
          <div className="university-detail-emblem">
            <GraduationCap size={34} />
          </div>

          <div>
            <span className="section-kicker">УНИВЕРСИТЕТ</span>

            <h2>{university.shortName}</h2>

            <span className="university-detail-city">
              <MapPin size={15} />
              {university.city}
            </span>
          </div>
        </div>

        <div className="university-detail-facts">
          <div className="university-detail-fact">
            <Building2 size={19} />

            <div>
              <span>Город</span>
              <strong>{university.city}</strong>
            </div>
          </div>

          <div className="university-detail-fact">
            <BookOpen size={19} />

            <div>
              <span>Программы в справочнике</span>
              <strong>{programs.length}</strong>
            </div>
          </div>
        </div>

        {websiteUrl && (
          <a
            className="university-detail-website"
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            {websiteUrl}
          </a>
        )}
      </section>

      <section className="panel university-detail-programs">
        <div className="university-detail-section-heading">
          <div>
            <span className="section-kicker">ОБРАЗОВАНИЕ</span>

            <h2>Образовательные программы</h2>

            <p>
              Направления подготовки, которые есть в справочнике проекта.
            </p>
          </div>

          <BookOpen size={22} className="muted-icon" />
        </div>

        {programs.length === 0 ? (
          <div className="university-detail-empty">
            <Info size={22} />

            <div>
              <strong>Программы пока не добавлены</strong>

              <p>
                Информация о направлениях подготовки этого университета
                пока отсутствует в базе проекта.
              </p>
            </div>
          </div>
        ) : (
          <div className="university-detail-program-list">
            {programs.map((program) => (
              <article
                className="university-detail-program"
                key={program.id}
              >
                <div className="university-detail-program-icon">
                  <GraduationCap size={19} />
                </div>

                <div className="university-detail-program-info">
                  <strong>{program.name}</strong>

                  {program.direction ? (
                    <span className="university-detail-program-direction">
                      Код направления: {program.direction}
                    </span>
                  ) : (
                    <span>Код направления не указан</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel university-detail-benefits-panel">
        <div className="university-detail-section-heading">
          <div>
            <span className="section-kicker">
              ОЛИМПИАДЫ И ПОСТУПЛЕНИЕ
            </span>

            <h2>Олимпиадные льготы</h2>

            <p>
              Условия приёма, названия олимпиад, образовательные
              программы и статус проверки.
            </p>
          </div>

          <ShieldCheck size={22} className="muted-icon" />
        </div>

        <UniversityBenefits universityId={university.id} programs={programs} />
      </section>

      <div className="university-detail-warning">
        <Info size={17} />

        <p>
          Сведения в справочнике не заменяют официальные правила приёма.
          Перед поступлением проверяй условия на сайте университета:
          они могут меняться каждый год и различаться по направлениям.
        </p>
      </div>

      <Link className="back-link" to="/universities">
        <ArrowLeft size={16} />
        Вернуться к списку университетов
      </Link>
    </div>
  )
}