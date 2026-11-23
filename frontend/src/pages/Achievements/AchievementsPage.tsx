import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Link2,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  X
} from 'lucide-react'

import type {
  Achievement,
  AchievementResultStatus,
  AchievementVerificationStatus,
  CreateAchievementInput,
  OlympiadWithStatus
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { achievementService } from '@/services/achievement.service'
import { olympiadService } from '@/services/olympiad.service'

import './achievements.css'

const VERIFICATION_LABELS: Record<AchievementVerificationStatus, string> = {
  pending: 'На проверке',
  verified: 'Подтверждено',
  rejected: 'Отклонено'
}

const RESULT_OPTIONS: Array<{
  value: AchievementResultStatus
  label: string
  description: string
}> = [
  {
    value: 'winner',
    label: 'Победитель',
    description: 'Диплом I степени или статус победителя'
  },
  {
    value: 'prize',
    label: 'Призёр',
    description: 'Диплом призёра или призовое место'
  },
  {
    value: 'participant',
    label: 'Участник',
    description: 'Участие без призового места'
  }
]

const CURRENT_YEAR = new Date().getFullYear()

function formatAchievementYear(achievement: Achievement): string {
  if (achievement.achievementYear) {
    return `${achievement.achievementYear} год`
  }

  if (achievement.achievedAt) {
    const date = new Date(`${achievement.achievedAt}T00:00:00`)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric'
      }).format(date)
    }
  }

  return 'Год не указан'
}

function getResultLabel(status?: AchievementResultStatus): string {
  if (status === 'winner') return 'Победитель'
  if (status === 'prize') return 'Призёр'
  if (status === 'participant') return 'Участник'
  return 'Результат'
}

interface AchievementFormProps {
  onClose: () => void
  onCreated: () => void
}

function AchievementForm({ onClose, onCreated }: AchievementFormProps) {
  const [olympiads, setOlympiads] = useState<OlympiadWithStatus[]>([])
  const [olympiadsLoading, setOlympiadsLoading] = useState(true)
  const [olympiadsError, setOlympiadsError] = useState<string | null>(null)
  const [olympiadSearch, setOlympiadSearch] = useState('')
  const [selectedOlympiad, setSelectedOlympiad] = useState<OlympiadWithStatus | null>(null)
  const [showOlympiadOptions, setShowOlympiadOptions] = useState(false)
  const [customOlympiad, setCustomOlympiad] = useState(false)
  const [resultStatus, setResultStatus] = useState<AchievementResultStatus>('prize')
  const [grade, setGrade] = useState('11')
  const [achievementYear, setAchievementYear] = useState(String(CURRENT_YEAR))
  const [proofUrl, setProofUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadOlympiads() {
      setOlympiadsLoading(true)
      setOlympiadsError(null)

      try {
        const data = await olympiadService.getAll()
        if (active) setOlympiads(data)
      } catch (error) {
        if (active) {
          setOlympiadsError(
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить каталог олимпиад.'
          )
        }
      } finally {
        if (active) setOlympiadsLoading(false)
      }
    }

    void loadOlympiads()
    return () => { active = false }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const filteredOlympiads = useMemo(() => {
    const query = olympiadSearch.trim().toLocaleLowerCase('ru')
    if (!query) return olympiads.slice(0, 8)

    return olympiads
      .filter((item) =>
        `${item.name} ${item.organizer}`.toLocaleLowerCase('ru').includes(query)
      )
      .slice(0, 8)
  }, [olympiads, olympiadSearch])

  function selectOlympiad(olympiad: OlympiadWithStatus) {
    setSelectedOlympiad(olympiad)
    setOlympiadSearch(olympiad.name)
    setCustomOlympiad(false)
    setShowOlympiadOptions(false)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const olympiadName = (selectedOlympiad?.name ?? olympiadSearch).trim()
    const parsedGrade = Number(grade)
    const parsedYear = Number(achievementYear)

    if (olympiadName.length < 2) {
      setFormError('Укажи название олимпиады.')
      return
    }

    if (!Number.isInteger(parsedGrade) || parsedGrade < 7 || parsedGrade > 11) {
      setFormError('Выбери класс с 7-го по 11-й.')
      return
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > CURRENT_YEAR + 1) {
      setFormError(`Укажи год от 2000 до ${CURRENT_YEAR + 1}.`)
      return
    }

    const trimmedProofUrl = proofUrl.trim()
    if (trimmedProofUrl) {
      try {
        const url = new URL(trimmedProofUrl)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error('invalid protocol')
        }
      } catch {
        setFormError('Ссылка на диплом должна начинаться с http:// или https://.')
        return
      }
    }

    const input: CreateAchievementInput = {
      ...(selectedOlympiad ? { olympiadId: selectedOlympiad.id } : {}),
      olympiadName,
      resultStatus,
      grade: parsedGrade,
      achievementYear: parsedYear,
      ...(trimmedProofUrl ? { proofUrl: trimmedProofUrl } : {})
    }

    setSaving(true)

    try {
      await achievementService.create(input)
      onCreated()
      onClose()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить достижение. Попробуй ещё раз.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="achievement-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section
        className="achievement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-form-title"
      >
        <div className="achievement-modal-header">
          <div>
            <span className="section-kicker">ЛИЧНОЕ ПОРТФОЛИО</span>
            <h2 id="achievement-form-title">Добавить достижение</h2>
            <p>Сохрани результат олимпиады — он появится в твоей истории.</p>
          </div>
          <button
            type="button"
            className="achievement-icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Закрыть форму"
          >
            <X size={19} />
          </button>
        </div>

        <form className="achievement-form" onSubmit={handleSubmit}>
          <div className="achievement-form-field achievement-olympiad-field">
            <label htmlFor="achievement-olympiad">Олимпиада</label>
            <div className="achievement-search-wrap">
              <Search size={17} aria-hidden="true" />
              <input
                id="achievement-olympiad"
                type="text"
                value={olympiadSearch}
                onChange={(event) => {
                  setOlympiadSearch(event.target.value)
                  setSelectedOlympiad(null)
                  setCustomOlympiad(false)
                  setShowOlympiadOptions(true)
                }}
                onFocus={() => setShowOlympiadOptions(true)}
                placeholder="Найти олимпиаду или ввести название"
                autoComplete="off"
                required
              />
            </div>

            {showOlympiadOptions && (
              <div className="achievement-olympiad-options">
                {olympiadsLoading ? (
                  <div className="achievement-options-message">Загружаем каталог олимпиад...</div>
                ) : filteredOlympiads.length > 0 ? (
                  filteredOlympiads.map((olympiad) => (
                    <button
                      type="button"
                      key={olympiad.id}
                      className="achievement-olympiad-option"
                      onClick={() => selectOlympiad(olympiad)}
                    >
                      <span className="achievement-option-icon"><Trophy size={16} /></span>
                      <span>
                        <strong>{olympiad.name}</strong>
                        <small>{olympiad.organizer}</small>
                      </span>
                      {selectedOlympiad?.id === olympiad.id && <CheckCircle2 size={16} />}
                    </button>
                  ))
                ) : (
                  <div className="achievement-options-message">
                    Олимпиаду не нашли в каталоге. Её можно сохранить по введённому названию.
                  </div>
                )}

                {olympiadsError && (
                  <div className="achievement-options-error">{olympiadsError}</div>
                )}
                {!olympiadsLoading && olympiadSearch.trim().length >= 2 && (
                  <button
                    type="button"
                    className="achievement-custom-option"
                    onClick={() => {
                      setSelectedOlympiad(null)
                      setCustomOlympiad(true)
                      setShowOlympiadOptions(false)
                      setFormError(null)
                    }}
                  >
                    Добавить свою олимпиаду: «{olympiadSearch.trim()}»
                  </button>
                )}
              </div>
            )}
            <span className="achievement-field-hint">
              Выбери олимпиаду из списка или добавь собственное название вручную.
            </span>
            {customOlympiad && (
              <div className="achievement-manual-selected" role="status">
                <CheckCircle2 size={15} />
                <span>«{olympiadSearch.trim()}» будет сохранена вручную, без привязки к каталогу.</span>
              </div>
            )}
          </div>

          <fieldset className="achievement-form-field achievement-result-field">
            <legend>Результат участия</legend>
            <div className="achievement-result-options">
              {RESULT_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`achievement-result-option ${resultStatus === option.value ? 'is-selected' : ''}`}
                  onClick={() => setResultStatus(option.value)}
                  aria-pressed={resultStatus === option.value}
                >
                  <span className="achievement-result-radio" />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="achievement-form-grid">
            <div className="achievement-form-field">
              <label htmlFor="achievement-grade">Класс</label>
              <select
                id="achievement-grade"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              >
                {[7, 8, 9, 10, 11].map((value) => (
                  <option value={value} key={value}>{value} класс</option>
                ))}
              </select>
            </div>

            <div className="achievement-form-field">
              <label htmlFor="achievement-year">Год получения результата</label>
              <input
                id="achievement-year"
                type="number"
                min="2000"
                max={CURRENT_YEAR + 1}
                value={achievementYear}
                onChange={(event) => setAchievementYear(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="achievement-form-field">
            <label htmlFor="achievement-proof">Ссылка на диплом <span>(необязательно)</span></label>
            <div className="achievement-search-wrap">
              <Link2 size={17} aria-hidden="true" />
              <input
                id="achievement-proof"
                type="url"
                value={proofUrl}
                onChange={(event) => setProofUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <span className="achievement-field-hint">
              Добавь ссылку на электронный диплом или подтверждающий документ.
            </span>
          </div>

          {formError && (
            <div className="achievement-form-error" role="alert">{formError}</div>
          )}

          <div className="achievement-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? <span className="achievement-button-spinner" /> : <Plus size={16} />}
              {saving ? 'Сохраняем...' : 'Сохранить достижение'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function AchievementsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadAchievements = useCallback(
    () => achievementService.getAll(),
    []
  )

  const {
    data: achievements,
    loading,
    error,
    reload
  } = useAsyncData(loadAchievements, [])

  const items = achievements ?? []
  const diplomaCount = items.filter(
    (item) => item.resultStatus === 'winner' || item.resultStatus === 'prize'
  ).length
  const verifiedCount = items.filter(
    (item) => item.verificationStatus === 'verified'
  ).length

  const handleCreated = useCallback(() => reload(), [reload])
  const handleCloseForm = useCallback(() => setIsFormOpen(false), [])

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ТВОИ РЕЗУЛЬТАТЫ"
        title="Мои достижения"
        description="Сохраняй результаты олимпиад и формируй портфолио для поступления."
      />

      <section className="achievement-stats-grid" aria-label="Статистика достижений">
        <article className="achievement-stat-card">
          <span className="achievement-stat-icon"><Award size={19} /></span>
          <strong>{items.length}</strong>
          <span>Всего достижений</span>
        </article>
        <article className="achievement-stat-card">
          <span className="achievement-stat-icon is-purple"><Medal size={19} /></span>
          <strong>{diplomaCount}</strong>
          <span>Дипломов</span>
        </article>
        <article className="achievement-stat-card">
          <span className="achievement-stat-icon is-green"><ShieldCheck size={19} /></span>
          <strong>{verifiedCount}</strong>
          <span>Подтверждено</span>
        </article>
      </section>

      <section className="panel achievement-portfolio-panel">
        <div className="panel-heading achievement-panel-heading">
          <div>
            <div className="section-kicker">ПОРТФОЛИО</div>
            <h2>История достижений</h2>
            <p>Твои дипломы, победы и призовые места.</p>
          </div>
          <button
            type="button"
            className="primary-button achievement-add-button"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={17} />
            Добавить достижение
          </button>
        </div>

        {loading ? (
          <LoadingState message="Загружаем достижения..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Award size={25} />}
            title="Пока нет достижений"
            description="Добавь первый результат олимпиады — он появится здесь и будет собран в твоём портфолио."
            action={(
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus size={16} />
                Добавить достижение
              </button>
            )}
          />
        ) : (
          <div className="achievement-list">
            {items.map((achievement) => (
              <article className="achievement-card" key={achievement.id}>
                <div className="achievement-icon"><Award size={22} /></div>

                <div className="achievement-content">
                  <span className="achievement-olympiad">{achievement.olympiadName}</span>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.result}</p>
                  <div className="achievement-meta-row">
                    {achievement.grade && (
                      <span><CalendarDays size={13} /> {achievement.grade} класс</span>
                    )}
                    <span><CalendarDays size={13} /> {formatAchievementYear(achievement)}</span>
                    {achievement.resultStatus && (
                      <span className={`achievement-result-label is-${achievement.resultStatus}`}>
                        {getResultLabel(achievement.resultStatus)}
                      </span>
                    )}
                  </div>
                  {achievement.proofUrl && (
                    <a
                      className="achievement-proof-link"
                      href={achievement.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={13} /> Открыть диплом
                    </a>
                  )}
                </div>

                <span className={`status-pill status-${achievement.verificationStatus}`}>
                  {achievement.verificationStatus === 'verified' && <ShieldCheck size={13} />}
                  {VERIFICATION_LABELS[achievement.verificationStatus]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="achievement-verification-note">
        <ShieldCheck size={14} /> Новый результат сохраняется со статусом «На проверке». Подтверждение диплома не происходит автоматически.
      </p>

      {isFormOpen && (
        <AchievementForm
          onClose={handleCloseForm}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
