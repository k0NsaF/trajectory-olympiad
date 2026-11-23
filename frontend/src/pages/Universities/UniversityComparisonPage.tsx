import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ExternalLink,
  GitCompareArrows,
  GraduationCap,
  Info,
  MapPin,
  Search,
  Trophy,
  X
} from 'lucide-react'

import type {
  BenefitRightType,
  BenefitVerificationFilter,
  University,
  UniversityBenefit,
  UniversityDiscoveryResult
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { universityService } from '@/services/university.service'
import {
  readComparisonSelections,
  subscribeToComparisonChanges,
  writeComparisonSelections,
  type ComparisonUniversitySelection
} from '@/services/university-comparison.store'
import {
  getBenefitVerificationClass,
  getBenefitVerificationLabel,
  getTargetAdmissionYear,
  hasCompleteOfficialEvidence,
  matchesBenefitVerificationFilter
} from '@/utils/benefits'

import './university-comparison.css'
import './university-comparison-layout.css'

type CompareRecord = {
  selectionId: string
  university: University
  benefits: UniversityBenefit[]
  discovery?: UniversityDiscoveryResult
  catalogUniversityId?: string
}

const RIGHTS: { value: BenefitRightType; label: string; description: string }[] = [
  { value: 'BVI', label: 'БВИ', description: 'Поступление без вступительных испытаний' },
  { value: '100_points', label: '100 баллов', description: 'Зачёт 100 баллов по профильному предмету' },
  { value: 'extra_points', label: 'Дополнительные баллы', description: 'Баллы за индивидуальные достижения или ЕГЭ по правилам вуза' }
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

function getHost(value?: string | null): string | null {
  const url = value ? safeUrl(value) : null
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : null
}

function domainsMatch(first?: string | null, second?: string | null): boolean {
  const a = getHost(first)
  const b = getHost(second)
  if (!a || !b) return false
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase('ru')
    .replace(/\b(федеральное государственное бюджетное образовательное учреждение|фгбоу|фгбу|государственный|государственное|национальный исследовательский|национальный|университет|институт|имени|им\.)\b/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function getRootDomain(value: string): string {
  const parts = value.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const secondLevel = parts[parts.length - 2] ?? ''
  const topLevel = parts[parts.length - 1] ?? ''
  return topLevel.length === 2 && secondLevel.length <= 3
    ? parts.slice(-3).join('.')
    : parts.slice(-2).join('.')
}

const DISCOVERED_UNIVERSITIES: Record<string, { name: string; shortName: string }> = {
  'surgu.ru': { name: 'Сургутский государственный университет', shortName: 'СурГУ' },
  'msu.ru': { name: 'Московский государственный университет имени М. В. Ломоносова', shortName: 'МГУ' },
  'spbu.ru': { name: 'Санкт-Петербургский государственный университет', shortName: 'СПбГУ' },
  'hse.ru': { name: 'Национальный исследовательский университет «Высшая школа экономики»', shortName: 'ВШЭ' },
  'mipt.ru': { name: 'Московский физико-технический институт', shortName: 'МФТИ' },
  'itmo.ru': { name: 'Университет ИТМО', shortName: 'ИТМО' }
}

function getDiscoveredUniversityIdentity(selection: Extract<ComparisonUniversitySelection, { kind: 'discovered' }>): { name: string; shortName: string } {
  const rootDomain = getRootDomain(selection.domain)
  const known = DISCOVERED_UNIVERSITIES[rootDomain]
  if (known) return known

  const title = selection.title.split(/\s(?:—|\||•)\s/u)[0].trim() || selection.title.trim()
  const cleaned = title.replace(/^(приёмная комиссия|приемная комиссия|абитуриент|официальный сайт)\s*/iu, '').trim()
  const looksLikeGenericPage = /^(бакалавриат|специалитет|магистратура|приёмная комиссия|приемная комиссия|абитуриент|поступление|главная)$/iu.test(cleaned)
  const name = looksLikeGenericPage ? `Университет · ${rootDomain}` : cleaned
  const rootLabel = rootDomain.split('.')[0]?.toUpperCase() || 'ВУЗ'
  return { name, shortName: name.length <= 34 ? name : rootLabel }
}

function findCatalogMatch(
  discovery: UniversityDiscoveryResult,
  catalog: University[]
): University | undefined {
  const byDomain = catalog.find((university) => domainsMatch(discovery.domain, university.website))
  if (byDomain) return byDomain

  const discoveredDomain = getRootDomain(discovery.domain)
  const discoveredName = normalizeName(DISCOVERED_UNIVERSITIES[discoveredDomain]?.name ?? discovery.title.split(/\s(?:—|\||•)\s/u)[0].trim())
  if (discoveredName.length < 7) return undefined

  return catalog.find((university) => {
    const name = normalizeName(university.name)
    const shortName = normalizeName(university.shortName)
    return name === discoveredName || shortName === discoveredName ||
      (name.length >= 9 && discoveredName.includes(name)) ||
      (discoveredName.length >= 9 && name.includes(discoveredName))
  })
}

function makeExternalUniversity(selection: Extract<ComparisonUniversitySelection, { kind: 'discovered' }>): University {
  const identity = getDiscoveredUniversityIdentity(selection)
  return {
    id: selection.id,
    name: identity.name,
    shortName: identity.shortName,
    city: 'Город не указан',
    website: selection.url,
    description: selection.snippet
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

function getSelectionTitle(selection: ComparisonUniversitySelection, records: CompareRecord[]): string {
  if (selection.kind === 'discovered') return getDiscoveredUniversityIdentity(selection).name
  return records.find((record) => record.selectionId === selection.id)?.university.shortName ?? 'Университет'
}

export function UniversityComparisonPage() {
  const targetAdmissionYear = getTargetAdmissionYear()
  const [selections, setSelections] = useState<ComparisonUniversitySelection[]>(readComparisonSelections)
  const [records, setRecords] = useState<CompareRecord[]>([])
  const [loadErrors, setLoadErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(targetAdmissionYear)
  const [verificationFilter, setVerificationFilter] = useState<BenefitVerificationFilter>('all')
  const [openSections, setOpenSections] = useState<Record<string, string | null>>({})

  useEffect(() => {
    writeComparisonSelections(selections)
  }, [selections])

  useEffect(() => subscribeToComparisonChanges(() => {
    setSelections(readComparisonSelections())
  }), [])

  useEffect(() => {
    let active = true

    const loadRecords = async () => {
      if (selections.length === 0) {
        setRecords([])
        setLoadErrors([])
        setLoading(false)
        return
      }

      setLoading(true)
      const discoveredSelections = selections.filter(
        (item): item is Extract<ComparisonUniversitySelection, { kind: 'discovered' }> => item.kind === 'discovered'
      )
      const catalog = discoveredSelections.length > 0
        ? await universityService.getAll().catch(() => [])
        : []

      const results = await Promise.all(selections.map(async (selection) => {
        try {
          if (selection.kind === 'catalog') {
            const [university, benefits] = await Promise.all([
              universityService.getById(selection.id),
              universityService.compareBenefits({ universityId: selection.id })
            ])
            return { record: { selectionId: selection.id, university, benefits } as CompareRecord, error: null as string | null }
          }

          const matchedUniversity = findCatalogMatch(selection, catalog)
          if (matchedUniversity) {
            const benefits = await universityService.compareBenefits({ universityId: matchedUniversity.id })
            return {
              record: {
                selectionId: selection.id,
                university: matchedUniversity,
                benefits,
                discovery: selection,
                catalogUniversityId: matchedUniversity.id
              } as CompareRecord,
              error: null as string | null
            }
          }

          return {
            record: {
              selectionId: selection.id,
              university: makeExternalUniversity(selection),
              benefits: [],
              discovery: selection
            } as CompareRecord,
            error: null as string | null
          }
        } catch (error) {
          return { record: null, error: `${selection.id}: ${getErrorMessage(error)}` }
        }
      }))

      if (!active) return
      setRecords(results.flatMap((result) => result.record ? [result.record] : []))
      setLoadErrors(results.flatMap((result) => result.error ? [result.error] : []))
      setLoading(false)
    }

    void loadRecords()
    return () => { active = false }
  }, [selections])

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
    setSelections((current) => current.filter((item) => item.id !== id))
    setOpenSections((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const clearSelection = () => {
    setSelections([])
    setOpenSections({})
  }

  const toggleSection = (universityId: string, sectionId: string) => {
    setOpenSections((current) => ({
      ...current,
      [universityId]: current[universityId] === sectionId ? null : sectionId
    }))
  }

  return (
    <div className="dashboard-container university-comparison-page">
      <PageHeader
        eyebrow="РАБОЧЕЕ ПРОСТРАНСТВО"
        title="Сравнение университетов"
        description="Выбирай нужный раздел льгот отдельно — так карточки остаются компактными и удобными для просмотра."
        action={(
          <Link className="secondary-button university-compare-back" to="/universities">
            <ArrowLeft size={16} /> К списку вузов
          </Link>
        )}
      />

      {selections.length === 0 ? (
        <section className="panel university-compare-empty-panel">
          <EmptyState
            icon={<GitCompareArrows size={27} />}
            title="Пока нет выбранных университетов"
            description="Найди вуз в каталоге или во внешнем поиске и нажми «Добавить в сравнение». Можно выбрать до пяти университетов."
            action={(
              <Link className="primary-button" to="/universities">
                <GraduationCap size={17} /> Найти университеты
              </Link>
            )}
          />
        </section>
      ) : (
        <>
          <section className="panel university-compare-toolbar">
            <div className="university-compare-toolbar-copy">
              <span className="section-kicker">ВЫБРАНО ДЛЯ СРАВНЕНИЯ</span>
              <strong>{selections.length} из 5 университетов</strong>
              <p>
                {selections.length < 2
                  ? 'Добавь ещё хотя бы один вуз, чтобы сравнить условия.'
                  : 'Открой нужную категорию внутри карточки каждого вуза. Одновременно раскрывается только один раздел в карточке.'}
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
              {selections.map((selection) => (
                <span className="university-compare-chip" key={selection.id}>
                  {getSelectionTitle(selection, records)}
                  <button type="button" onClick={() => removeUniversity(selection.id)} aria-label={`Убрать ${getSelectionTitle(selection, records)}`}>
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
                      <p>В базе проекта пока нет записей о льготах на {targetAdmissionYear} год. Это не означает, что университеты не предоставляют льготы. Для вузов, добавленных через внешний поиск, сведения о льготах появятся после проверки и добавления официальных правил приёма.</p>
                    </div>
                  )}

                  <div className="university-compare-grid">
                    {records.map((record) => {
                      const benefits = visibleBenefits(record)
                      const selectedYearRecordBenefits = record.benefits.filter((benefit) => benefit.validYear === selectedYear)
                      const universityOfficialCount = selectedYearRecordBenefits.filter(hasCompleteOfficialEvidence).length
                      const universityDraftCount = selectedYearRecordBenefits.filter((benefit) => matchesBenefitVerificationFilter(benefit, 'draft')).length
                      const noBenefitDescription = record.discovery && !record.catalogUniversityId
                        ? 'Вуз добавлен из внешнего поиска, но его льготы ещё не загружены в справочник. Это не означает, что льгот нет — проверь правила на официальном сайте.'
                        : 'Нет записи в базе по выбранным фильтрам. Отсутствие записи не означает отсутствие льготы.'

                      return (
                        <article className="university-compare-card" key={record.selectionId}>
                          <header className="university-compare-card-header">
                            <div className="university-compare-card-mark"><GraduationCap size={22} /></div>
                            <div className="university-compare-card-title">
                              <span>{record.university.shortName}</span>
                              <h2>{record.university.name}</h2>
                              <small><MapPin size={13} /> {record.university.city}</small>
                              {record.discovery && <em className="university-compare-discovered-label"><Search size={11} /> Добавлен из поиска</em>}
                            </div>
                            <button type="button" className="university-compare-remove" onClick={() => removeUniversity(record.selectionId)} aria-label={`Удалить ${record.university.shortName} из сравнения`}>
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
                              {record.discovery ? 'Официальная страница из поиска' : 'Официальный сайт'} <ExternalLink size={14} />
                            </a>
                          )}

                          {record.discovery && (
                            <div className="university-compare-discovery-excerpt">
                              <span>Фрагмент найденного источника</span>
                              <p>{record.discovery.snippet || 'Описание источника не предоставлено.'}</p>
                            </div>
                          )}

                          {RIGHTS.map((right) => {
                            const rightBenefits = benefits.filter((benefit) => benefit.rightType === right.value)
                            const isOpen = openSections[record.selectionId] === right.value
                            const panelId = `compare-${record.selectionId.replace(/[^a-zA-Z0-9_-]/gu, '-')}-${right.value}`
                            return (
                              <section className={`university-compare-accordion${isOpen ? ' is-open' : ''}`} key={right.value}>
                                <button
                                  type="button"
                                  className="university-compare-accordion-trigger"
                                  aria-expanded={isOpen}
                                  aria-controls={panelId}
                                  onClick={() => toggleSection(record.selectionId, right.value)}
                                >
                                  <span className="university-compare-accordion-copy">
                                    <strong>{right.label}</strong>
                                    <small>{right.description}</small>
                                  </span>
                                  <span className="university-compare-accordion-count">{rightBenefits.length}</span>
                                  <ChevronDown size={17} className="university-compare-accordion-chevron" />
                                </button>
                                {isOpen && (
                                  <div className="university-compare-accordion-panel" id={panelId}>
                                    {rightBenefits.length === 0 ? (
                                      <p className="university-compare-no-data">{noBenefitDescription}</p>
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
                                  </div>
                                )}
                              </section>
                            )
                          })}

                          {(() => {
                            const isOpen = openSections[record.selectionId] === 'summary'
                            const panelId = `compare-${record.selectionId.replace(/[^a-zA-Z0-9_-]/gu, '-')}-summary`
                            const requirements = [...new Set(benefits.map((benefit) => benefit.confirmExamThreshold == null
                              ? 'Порог подтверждения не указан'
                              : `${benefit.confirmExamSubject ?? 'Предмет не указан'}: ${benefit.confirmExamThreshold} баллов`))]
                            const classes = [...new Set(benefits.map((benefit) => getResultClassLabel(benefit.resultClassRequired)))]
                            return (
                              <section className={`university-compare-accordion${isOpen ? ' is-open' : ''}`}>
                                <button
                                  type="button"
                                  className="university-compare-accordion-trigger"
                                  aria-expanded={isOpen}
                                  aria-controls={panelId}
                                  onClick={() => toggleSection(record.selectionId, 'summary')}
                                >
                                  <span className="university-compare-accordion-copy">
                                    <strong>Сводные требования</strong>
                                    <small>Порог подтверждения и класс диплома</small>
                                  </span>
                                  <span className="university-compare-accordion-count">{requirements.length + classes.length}</span>
                                  <ChevronDown size={17} className="university-compare-accordion-chevron" />
                                </button>
                                {isOpen && (
                                  <div className="university-compare-accordion-panel" id={panelId}>
                                    {benefits.length === 0 ? (
                                      <p className="university-compare-no-data">{noBenefitDescription}</p>
                                    ) : (
                                      <ul className="university-compare-requirements">
                                        {requirements.map((item) => <li key={item}>{item}</li>)}
                                        {classes.map((item) => <li key={item}>{item}</li>)}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </section>
                            )
                          })()}

                          <footer className="university-compare-card-footer">
                            {record.catalogUniversityId ? (
                              <Link to={`/universities/${encodeURIComponent(record.catalogUniversityId)}`}>
                                Открыть карточку вуза <ExternalLink size={13} />
                              </Link>
                            ) : record.university.website && safeUrl(record.university.website) ? (
                              <a href={safeUrl(record.university.website) ?? undefined} target="_blank" rel="noopener noreferrer">
                                Перейти на сайт университета <ExternalLink size={13} />
                              </a>
                            ) : null}
                          </footer>
                        </article>
                      )
                    })}
                  </div>

                  <div className="university-compare-data-note">
                    <Info size={17} />
                    <p>Отсутствие записи в базе проекта не означает отсутствие льготы. Официально подтверждённой считается запись с корректным статусом, ссылкой на первоисточник и датой проверки. Университеты из внешнего поиска пока не имеют проверенных записей о льготах, пока их условия не добавлены в справочник.</p>
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
