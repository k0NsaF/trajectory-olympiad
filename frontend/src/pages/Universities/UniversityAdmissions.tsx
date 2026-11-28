import { useCallback, useState } from 'react'
import { CalendarDays, ExternalLink, Info, ShieldCheck } from 'lucide-react'

import { useAsyncData } from '@/hooks/useAsyncData'
import { admissionsService } from '@/services/admissions.service'
import { MIPT_DEMO_ADMISSION_PROGRAMS, MIPT_DEMO_CAMPAIGN, MIPT_DEMO_CAMPAIGN_ID, MIPT_UNIVERSITY_ID } from '@/data/mipt-demo-data'
import type {
  AdmissionCampaign,
  AdmissionProgramsResponse,
  AdmissionOption
} from '@/services/admissions.service'

import './university-admissions.css'

function safeOfficialUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function label(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value.replace(/[_-]+/g, ' ')
}

const LEVELS: Record<string, string> = {
  bachelor: 'Бакалавриат',
  specialist: 'Специалитет',
  master: 'Магистратура',
  basic_higher: 'Базовое высшее образование',
  specialized_higher: 'Специализированное высшее образование'
}

const BASIS: Record<string, string> = {
  budget: 'Бюджет',
  paid: 'Платное',
  contract: 'По договору',
  target_quota: 'Целевая квота',
  special_quota: 'Особая квота',
  separate_quota: 'Отдельная квота'
}

const FORMS: Record<string, string> = {
  full_time: 'Очная',
  part_time: 'Очно-заочная',
  correspondence: 'Заочная',
  distance: 'Дистанционная'
}

const EXAM_TYPES: Record<string, string> = {
  ege: 'ЕГЭ',
  internal: 'Внутреннее испытание',
  creative: 'Творческое испытание',
  portfolio: 'Портфолио',
  other: 'Другое'
}

function CampaignPrograms({
  universityId,
  campaign
}: {
  universityId: string
  campaign: AdmissionCampaign
}) {
  const load = useCallback(
    () => campaign.id === MIPT_DEMO_CAMPAIGN_ID ? Promise.resolve(MIPT_DEMO_ADMISSION_PROGRAMS) : admissionsService.getPrograms(universityId, campaign.id),
    [universityId, campaign.id]
  )
  const { data, loading, error, reload } =
    useAsyncData<AdmissionProgramsResponse>(load)

  if (loading) return <p className="admission-state">Загружаем программы и условия поступления…</p>

  if (error) {
    return (
      <div className="admission-state" role="alert">
        <p>Не удалось загрузить условия: {error}</p>
        <button type="button" onClick={reload}>Повторить</button>
      </div>
    )
  }

  if (!data || data.programs.length === 0) {
    return (
      <div className="admission-state">
        <Info size={18} />
        <span>Программы этой кампании пока не внесены в справочник.</span>
      </div>
    )
  }

  return (
    <div className="admission-program-list">
      {campaign.id === MIPT_DEMO_CAMPAIGN_ID && <div className="admission-demo-note" role="note"><Info size={16} /><span>Демонстрационный набор Trajectory: места, баллы, стоимость, экзамены и достижения придуманы для показа интерфейса и не являются условиями приёма МФТИ.</span></div>}
      {data.programs.map((program) => (
        <article className="admission-program" key={program.id}>
          <h3>{program.name}</h3>
          {program.direction && <p className="admission-muted">Направление: {program.direction}</p>}
          {program.description && <p>{program.description}</p>}

          {program.admissionOptions.map((option: AdmissionOption) => (
            <div className="admission-option" key={option.id}>
              <div className="admission-tags">
                <span>{label(option.educationLevel, LEVELS)}</span>
                <span>{label(option.admissionBasis, BASIS)}</span>
                <span>{label(option.studyForm, FORMS)}</span>
                {option.verificationStatus === 'archived' ? <span>Архивные данные</span> : option.verificationStatus === 'needs_review' ? <span>{option.id.startsWith('demo-mipt-') ? 'ДЕМО · условные значения' : 'Требует проверки'}</span> : null}
              </div>

              <div className="admission-facts">
                {option.budgetPlaces != null && <span>Бюджетных мест: <b>{option.budgetPlaces}</b></span>}
                {option.paidPlaces != null && <span>Платных мест: <b>{option.paidPlaces}</b></span>}
                {option.tuitionRubPerYear != null && (
                  <span>Стоимость: <b>{new Intl.NumberFormat('ru-RU').format(option.tuitionRubPerYear)} ₽/год</b></span>
                )}
                {option.studyDurationYears != null && <span>Срок обучения: <b>{option.studyDurationYears} лет</b></span>}
              </div>

              <h4>Вступительные испытания</h4>
              {option.exams.length ? (
                <ul>
                  {option.exams.map((exam) => (
                    <li key={exam.id}>
                      Экзамен {exam.slotNumber}: {exam.subjectName}
                      {' · '}{label(exam.examType, EXAM_TYPES)}
                      {exam.minimumScore != null && ` · минимум ${exam.minimumScore} из ${exam.maximumScore}`}
                      {safeOfficialUrl(exam.evidenceUrl) && (
                        <> · <a href={safeOfficialUrl(exam.evidenceUrl)!} target="_blank" rel="noopener noreferrer">Источник</a></>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admission-muted">Сведения об испытаниях пока не внесены в справочник.</p>
              )}

              <h4>Индивидуальные достижения</h4>
              {option.achievements.length ? (
                <ul>
                  {option.achievements.map((item) => (
                    <li key={item.id}>
                      {item.title}: <b>+{item.pointsAwarded} баллов</b>
                      {item.pointsCap != null && ` (максимум ${item.pointsCap})`}
                      {item.description && ` — ${item.description}`}
                      {safeOfficialUrl(item.sourceUrl) && (
                        <> · <a href={safeOfficialUrl(item.sourceUrl)!} target="_blank" rel="noopener noreferrer">Источник</a></>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admission-muted">Сведения об индивидуальных достижениях пока не внесены.</p>
              )}

              <div className="admission-sources">
                {[
                  { title: 'Официальная программа', url: option.officialProgramUrl ?? program.officialUrl },
                  { title: 'Источник данных', url: option.sourceUrl }
                ].map((source) => {
                  const href = safeOfficialUrl(source.url)
                  return href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" key={source.title}>
                      {source.title} <ExternalLink size={13} />
                    </a>
                  ) : null
                })}
                {option.sourceCheckedAt && (
                  <span>Проверено: {formatDate(option.sourceCheckedAt)}</span>
                )}
              </div>
            </div>
          ))}
        </article>
      ))}
    </div>
  )
}

export function UniversityAdmissions({ universityId }: { universityId: string }) {
  const load = useCallback(
    () => admissionsService.getCampaigns(universityId),
    [universityId]
  )
  const { data: loadedCampaigns, loading, error, reload } =
    useAsyncData<AdmissionCampaign[]>(load, [])
  const campaigns = universityId === MIPT_UNIVERSITY_ID ? [MIPT_DEMO_CAMPAIGN, ...(loadedCampaigns ?? [])] : (loadedCampaigns ?? [])
  const [selectedId, setSelectedId] = useState('')

  const selected = campaigns?.find((item) => item.id === selectedId)
    ?? campaigns?.[0]
    ?? null

  return (
    <section className="panel university-admissions-panel">
      <div className="university-detail-section-heading">
        <div>
          <span className="section-kicker">ПОСТУПЛЕНИЕ</span>
          <h2>Приёмные кампании и условия</h2>
          <p>Опубликованные сведения, прошедшие проверку официальных источников.</p>
        </div>
        <CalendarDays size={22} className="muted-icon" />
      </div>

      {loading && <p className="admission-state">Загружаем приёмные кампании…</p>}

      {error && (
        <div className="admission-state" role="alert">
          <p>Не удалось загрузить кампании: {error}</p>
          <button type="button" onClick={reload}>Повторить</button>
        </div>
      )}

      {!loading && !error && campaigns?.length === 0 && (
        <div className="admission-state">
          <Info size={18} />
          <span>Пока нет опубликованных приёмных кампаний с подтверждёнными официальными источниками. Это не означает, что университет не ведёт набор.</span>
        </div>
      )}

      {!loading && !error && selected && (
        <>
          {campaigns && campaigns.length > 1 && (
            <label className="admission-campaign-select">
              <span>Год поступления</span>
              <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
                {campaigns.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.admissionYear}{item.status === 'archived' ? ' · архив' : item.id === MIPT_DEMO_CAMPAIGN_ID ? ' · ДЕМО' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="admission-campaign-meta">
            <ShieldCheck size={16} />
            <span>Кампания {selected.admissionYear}</span>
            {selected.id === MIPT_DEMO_CAMPAIGN_ID && <span className="admission-demo-badge">ДЕМО · неофициальные примеры</span>}
            {selected.status === 'archived' && <span>Архив</span>}
            {selected.sourceCheckedAt && <span>Проверено: {formatDate(selected.sourceCheckedAt)}</span>}
          </div>

          <div className="admission-campaign-links">
            {[
              { title: 'Страница приёма', url: selected.admissionPageUrl },
              { title: 'Правила приёма', url: selected.rulesUrl },
              { title: 'Перечень экзаменов', url: selected.examListUrl },
              { title: 'Количество мест', url: selected.placesUrl },
              { title: 'Стоимость обучения', url: selected.tuitionUrl }
            ].map((link) => {
              const href = safeOfficialUrl(link.url)
              return href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" key={link.title}>
                  {link.title} <ExternalLink size={13} />
                </a>
              ) : null
            })}
          </div>

          <CampaignPrograms
            key={selected.id}
            universityId={universityId}
            campaign={selected}
          />
        </>
      )}
    </section>
  )
}