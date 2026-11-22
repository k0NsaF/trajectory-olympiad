import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  GitCompareArrows,
  GraduationCap,
  Info,
  MapPin,
  Trophy,
  X
} from 'lucide-react'

import type {
  BenefitRightType,
  BenefitVerificationFilter,
  University,
  UniversityBenefit
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { universityService } from '@/services/university.service'
import { readComparisonUniversityIds, writeComparisonUniversityIds } from '@/services/university-comparison.store'
import {
  getBenefitVerificationClass,
  getBenefitVerificationLabel,
  getTargetAdmissionYear,
  hasCompleteOfficialEvidence,
  matchesBenefitVerificationFilter
} from '@/utils/benefits'

import './university-comparison.css'

type CompareRecord = {
  university: University
  benefits: UniversityBenefit[]
}

const RIGHTS: { value: BenefitRightType; label: string; description: string }[] = [
  { value: 'BVI', label: 'БВИ', description: 'Поступление без вступительных испытаний' },
  { value: '100_points', label: '100 баллов', description: 'Зачёт 100 баллов по профильному предмету' },
  { value: 'extra_points', label: 'Дополнительные баллы', description: 'Баллы к индивидуальным достижениям или ЕГЭ по правилам вуза' }
]

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

function formatDate(value?: string | null): string {
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

function safeUrl(value?: string | null): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function getLevelLabel(level?: number): string {
  return level == null ? 'Уровень не указан' : LEVEL_LABELS[level] ?? `${level} уровень`
}

function getResultClassLabel(resultClass?: number): string {
  return resultClass == null ? 'Класс диплома не указан' : `Диплом за ${resultClass} класс`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось загрузить данные университета.'
}

export function UniversityComparisonPage() {
  const targetAdmissionYear = getTargetAdmissionYear()
  const [selectedIds, setSelectedIds] = useState<string[]>(readComparisonUniversityIds)
  const [records, setRecords] = useState<CompareRecord[]>([])
  const [loadErrors, setLoadErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(targetAdmissionYear)
  const [verificationFilter, setVerificationFilter] = useState<BenefitVerificationFilter>('all')

  useEffect(() => {
    writeComparisonUniversityIds(selectedIds)
  }, [selectedIds])

  useEffect(() => {
    let active = true

    const loadRecords = async () => {
      if (selectedIds.length === 0) {
        setRecords([])
        setLoadErrors([])
        setLoading(false)
        return
      }

      setLoading(true)
      const results = await Promise.all(selectedIds.map(async (id) => {
        try {
          const [university, benefits] = await Promise.all([
            universityService.getById(id),
            universityService.compareBenefits({ universityId: id })
          ])
          return { record: { university, benefits } as CompareRecord, error: null as string | null }
        } catch (error) {
          return { record: null, error: `${id}: ${getErrorMessage(error)}` }
        }
      }))

      if (!active) return
      setRecords(results.flatMap((result) => result.record ? [result.record] : []))
      setLoadErrors(results.flatMap((result) => result.error ? [result.error] : []))
      setLoading(false)
    }

    void loadRecords()
    return () => { active = false }
  }, [selectedIds])

  const allBenefits = useMemo(
    () => records.flatMap((record) => record.benefits),
    [records]
  )

  const availableYears = useMemo(() => {
    const years = allBenefits.map((benefit) => benefit.validYear)
    return [...new Set([targetAdmissionYear, ...years])].sort((first, second) => second - first)
  }, [allBenefits, targetAdmissionYear])

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] ?? targetAdmissionYear)
    }
  }, [availableYears, selectedYear, targetAdmissionYear])

  const visibleBenefits = (record: CompareRecord) => record.benefits.filter((benefit) =>
    benefit.validYear === selectedYear && matchesBenefitVerificationFilter(benefit, verificationFilter)
  )

  const selectedYearBenefits = allBenefits.filter((benefit) => benefit.validYear === selectedYear)
  const officialCount = selectedYearBenefits.filter(hasCompleteOfficialEvidence).length
  const draftCount = selectedYearBenefits.filter((benefit) => matchesBenefitVerificationFilter(benefit, 'draft')).length
  const archivedCount = selectedYearBenefits.filter((benefit) => benefit.verificationStatus === 'archived').length

  const removeUniversity = (id: string) => {
    setSelectedIds((current) => current.filter((item) => item !== id))
  }

  const clearSelection = () => setSelectedIds([])

  return (
    <div className="dashboard-container university-comparison-page">
      <PageHeader
        eyebrow="РАБОЧЕЕ ПРОСТРАНСТВО"
        title="Сравнение университетов"
        description="Сопоставляй олимпиадные льготы и условия поступления в одном удобном представлении."
        action={(
          <Link className="secondary-button university-compare-back" to="/universities">
            <ArrowLeft size={16} /> К списку вузов
          </Link>
        )}
      />

      {selectedIds.length === 0 ? (
        <section className="panel university-compare-empty-panel">
          <EmptyState
            icon={<GitCompareArrows size={27} />}
            title="Пока нет выбранных университетов"
            description="Открой справочник вузов, отметь минимум два университета для сравнения — выбранный список сохранится при переходе между страницами."
            action={(
              <Link className="primary-button" to="/universities">
                <GraduationCap size={17} /> Выбрать университеты
              </Link>
            )}
          />
        </section>
      ) : (
        <>
          <section className="panel university-compare-toolbar">
            <div className="university-compare-toolbar-copy">
              <span className="section-kicker">ВЫБРАНО ДЛЯ СРАВНЕНИЯ</span>
              <strong>{selectedIds.length} из 5 университетов</strong>
              <p>
                {selectedIds.length < 2
                  ? 'Добавь ещё хотя бы один вуз, чтобы сравнить условия.'
                  : 'Данные сгруппированы по каждому вузу. На телефоне карточки располагаются друг под другом.'}
              </p>
            </div>
            <div className="university-compare-toolbar-actions">
              <Link className="secondary-button" to="/universities">
                <GraduationCap size={16} /> Добавить вуз
              </Link>
              <button type="button" className="secondary-button" onClick={clearSelection}>
                Очистить выбор
              </button>
            </div>
            <div className="university-compare-selected-chips">
              {records.map(({ university }) => (
                <span className="university-compare-chip" key={university.id}>
                  {university.shortName}
                  <button type="button" onClick={() => removeUniversity(university.id)} aria-label={`Убрать ${university.shortName}`}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </section>

          {loading ? (
            <LoadingState message="Собираем данные выбранных университетов..." />
          ) : (
            <>
              {loadErrors.map((message) => (
                <div className="university-compare-error" role="alert" key={message}>{message}</div>
              ))}

              {records.length > 0 && (
                <>
                  <section className="panel university-compare-filters">
                    <label>
                      <span>Год поступления</span>
                      <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                        {availableYears.map((year) => (
                          <option value={year} key={year}>
                            {year}{year < targetAdmissionYear ? ' · архивный год' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Статус записей</span>
                      <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as BenefitVerificationFilter)}>
                        <option value="all">Все статусы</option>
                        <option value="official">Официально подтверждённые</option>
                        <option value="draft">Предварительные / требуют проверки</option>
                        <option value="archived">Архивные</option>
                      </select>
                    </label>
                  </section>

                  <section className="university-compare-summary" aria-live="polite">
                    <div className="university-compare-summary-item is-official">
                      <span>Официально подтверждено</span>
                      <strong>{officialCount}</strong>
                    </div>
                    <div className="university-compare-summary-item is-draft">
                      <span>Требуют проверки</span>
                      <strong>{draftCount}</strong>
                    </div>
                    <div className="university-compare-summary-item is-archived">
                      <span>Архивные записи</span>
                      <strong>{archivedCount}</strong>
                    </div>
                  </section>

                  {selectedYear < targetAdmissionYear && (
                    <div className="university-compare-notice is-archive">
                      <Info size={17} />
                      <p>Показаны архивные условия за {selectedYear} год. Они не подтверждают правила приёма на {targetAdmissionYear} год.</p>
                    </div>
                  )}

                  {selectedYear === targetAdmissionYear && selectedYearBenefits.length === 0 && (
                    <div className="university-compare-notice">
                      <Info size={17} />
                      <p>В базе проекта пока нет записей о льготах на {targetAdmissionYear} год. Это не означает, что университеты не предоставляют льготы.</p>
                    </div>
                  )}

                  <div className="university-compare-grid">
                    {records.map((record) => {
                      const benefits = visibleBenefits(record)
                      const selectedYearRecordBenefits = record.benefits.filter((benefit) => benefit.validYear === selectedYear)
                      const universityOfficialCount = selectedYearRecordBenefits.filter(hasCompleteOfficialEvidence).length
                      const universityDraftCount = selectedYearRecordBenefits.filter((benefit) => matchesBenefitVerificationFilter(benefit, 'draft')).length

                      return (
                        <article className="university-compare-card" key={record.university.id}>
                          <header className="university-compare-card-header">
                            <div className="university-compare-card-mark"><GraduationCap size={22} /></div>
                            <div className="university-compare-card-title">
                              <span>{record.university.shortName}</span>
                              <h2>{record.university.name}</h2>
                              <small><MapPin size={13} /> {record.university.city}</small>
                            </div>
                            <button type="button" className="university-compare-remove" onClick={() => removeUniversity(record.university.id)} aria-label={`Удалить ${record.university.shortName} из сравнения`}>
                              <X size={16} />
                            </button>
                          </header>

                          <div className="university-compare-card-stats">
                            <span><strong>{benefits.length}</strong> записей по фильтру</span>
                            <span><i className="status-dot status-dot-official" /> {universityOfficialCount} официальных</span>
                            <span><i className="status-dot status-dot-draft" /> {universityDraftCount} требуют проверки</span>
                          </div>

                          {record.university.website && safeUrl(record.university.website) && (
                            <a className="university-compare-site-link" href={safeUrl(record.university.website) ?? undefined} target="_blank" rel="noopener noreferrer">
                              Официальный сайт <ExternalLink size={14} />
                            </a>
                          )}

                          {RIGHTS.map((right) => {
                            const rightBenefits = benefits.filter((benefit) => benefit.rightType === right.value)
                            return (
                              <section className="university-compare-category" key={right.value}>
                                <div className="university-compare-category-heading">
                                  <h3>{right.label}</h3>
                                  <span>{right.description}</span>
                                </div>

                                {rightBenefits.length === 0 ? (
                                  <p className="university-compare-no-data">Нет записи в базе по выбранным фильтрам</p>
                                ) : (
                                  <div className="university-compare-benefits">
                                    {rightBenefits.map((benefit) => (
                                      <article className="university-compare-benefit" key={benefit.id}>
                                        <div className="university-compare-benefit-top">
                                          <Trophy size={15} />
                                          <strong>{benefit.olympiadName ?? 'Название олимпиады не указано'}</strong>
                                        </div>
                                        <p>
                                          <BookOpen size={14} />
                                          {benefit.programName ?? (benefit.programId ? 'Программа не найдена в справочнике' : 'Все подходящие программы / программа не уточнена')}
                                        </p>
                                        <div className="university-compare-benefit-facts">
                                          <span>{STATUS_LABELS[benefit.forStatus] ?? benefit.forStatus}</span>
                                          <span>{getLevelLabel(benefit.levelRequired)}</span>
                                          <span>{getResultClassLabel(benefit.resultClassRequired)}</span>
                                          {benefit.confirmExamSubject && (
                                            <span>Подтверждение: {benefit.confirmExamSubject}{benefit.confirmExamThreshold != null ? ` от ${benefit.confirmExamThreshold} баллов` : ''}</span>
                                          )}
                                        </div>
                                        <div className="university-compare-benefit-footer">
                                          <span className={`benefit-verification-status ${getBenefitVerificationClass(benefit)}`}>
                                            {getBenefitVerificationLabel(benefit)}
                                          </span>
                                          <span>Проверено: {formatDate(benefit.lastCheckedAt)}</span>
                                        </div>
                                        {safeUrl(benefit.sourceUrl) && (
                                          <a className="university-compare-source-link" href={safeUrl(benefit.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer">
                                            Первоисточник <ExternalLink size={13} />
                                          </a>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                )}
                              </section>
                            )
                          })}

                          <section className="university-compare-category">
                            <div className="university-compare-category-heading">
                              <h3>Сводные требования</h3>
                              <span>Порог подтверждения и класс диплома</span>
                            </div>
                            {benefits.length === 0 ? (
                              <p className="university-compare-no-data">Нет условий за выбранный год и статус.</p>
                            ) : (
                              <ul className="university-compare-requirements">
                                {[...new Set(benefits.map((benefit) => benefit.confirmExamThreshold == null
                                  ? 'Порог подтверждения не указан'
                                  : `${benefit.confirmExamSubject ?? 'Предмет не указан'}: ${benefit.confirmExamThreshold} баллов`))].map((item) => <li key={item}>{item}</li>)}
                                {[...new Set(benefits.map((benefit) => getResultClassLabel(benefit.resultClassRequired)))].map((item) => <li key={item}>{item}</li>)}
                              </ul>
                            )}
                          </section>

                          <footer className="university-compare-card-footer">
                            <Link to={`/universities/${encodeURIComponent(record.university.id)}`}>
                              Открыть карточку вуза <ExternalLink size={13} />
                            </Link>
                          </footer>
                        </article>
                      )
                    })}
                  </div>

                  <div className="university-compare-data-note">
                    <Info size={17} />
                    <p>Отсутствие записи в базе проекта не означает отсутствие льготы. Официально подтверждённой считается запись с корректным статусом, ссылкой на первоисточник и датой проверки. Перед поступлением сверяй условия с актуальными правилами приёма университета.</p>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
