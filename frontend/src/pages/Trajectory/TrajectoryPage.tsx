import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  CalendarDays,
  GraduationCap,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react'

import {
  SUBJECTS,
  type CreateProfileInput,
  type OlympiadStage,
  type OlympiadWithStatus,
  type UserTrajectory
} from '@trajectory/shared'

import { useAuth } from '@/app/providers'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import {
  getAuthenticatedProfile,
  getGuestProfile
} from '@/services/profile.service'
import { trajectoryService } from '@/services/trajectory.service'

const STATUS_LABELS: Record<OlympiadWithStatus['status'], string> = {
  eligible: 'Регистрация открыта',
  upcoming: 'Скоро регистрация',
  closed: 'Регистрация завершена',
  unknown: 'Даты уточняются'
}

const STAGE_LABELS: Record<OlympiadStage['type'], string> = {
  registration: 'Регистрация',
  qualifying: 'Отборочный этап',
  final: 'Заключительный этап'
}

function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`)
  }

  return new Date(value)
}

function formatDate(value: string): string {
  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function getNextStage(
  olympiad: OlympiadWithStatus
): OlympiadStage | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stages = olympiad.season?.stages ?? []

  return stages
    .filter((stage) => {
      const endDate = parseDate(stage.endDate)
      return !Number.isNaN(endDate.getTime()) && endDate >= today
    })
    .sort((first, second) =>
      parseDate(first.startDate).getTime() -
      parseDate(second.startDate).getTime()
    )[0] ?? null
}

export function TrajectoryPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  const [profile, setProfile] = useState<CreateProfileInput | null>(null)
  const [trajectory, setTrajectory] = useState<UserTrajectory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (authLoading) {
      return
    }

    let active = true

    async function loadTrajectory() {
      setLoading(true)
      setError(null)

      try {
        let currentProfile: CreateProfileInput | null

        if (session?.access_token) {
          currentProfile = await getAuthenticatedProfile(
            session.access_token
          )

          if (!currentProfile) {
            currentProfile = getGuestProfile()
          }
        } else {
          currentProfile = getGuestProfile()
        }

        if (!active) {
          return
        }

        setProfile(currentProfile)

        if (!currentProfile) {
          setTrajectory(null)
          return
        }

        const result = await trajectoryService.generate(currentProfile)

        if (active) {
          setTrajectory(result)
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Не удалось построить персональную траекторию.'
          )
          setTrajectory(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadTrajectory()

    return () => {
      active = false
    }
  }, [authLoading, session?.access_token, reloadKey])

  const subjectNames = useMemo(() => {
    if (!profile) {
      return []
    }

    return profile.subjects.map((id) =>
      SUBJECTS.find((subject) => subject.id === id)?.label ?? id
    )
  }, [profile])

  const olympiadsById = useMemo(
    () => new Map<string, OlympiadWithStatus>(
      (trajectory?.olympiads ?? []).map((olympiad) => [
        olympiad.id,
        olympiad
      ])
    ),
    [trajectory]
  )

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ТВОЁ ОБРАЗОВАТЕЛЬНОЕ БУДУЩЕЕ"
        title="Моя траектория"
        description={
          profile
            ? `Подборка олимпиад для ${profile.grade} класса с учётом твоих предметов и региона.`
            : 'Создай персональный план участия в олимпиадах и подготовки к поступлению в вуз.'
        }
        action={
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/onboarding')}
          >
            {profile ? 'Изменить анкету' : 'Заполнить анкету'}
            <ArrowRight size={16} />
          </button>
        }
      />

      {authLoading || loading ? (
        <LoadingState message="Подбираем олимпиады и проверяем сроки..." />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : !profile ? (
        <section className="welcome-card">
          <div className="welcome-card-content">
            <div className="welcome-card-icon">
              <Sparkles size={24} />
            </div>

            <div className="section-kicker">ТВОЙ ПЕРВЫЙ ШАГ</div>
            <h2>Начни строить свою образовательную траекторию</h2>
            <p>
              Укажи класс, регион и интересующие предметы. Мы проверим
              олимпиады текущего сезона и составим план с учётом сроков.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/onboarding')}
            >
              Начать настройку
              <ArrowRight size={17} />
            </button>
          </div>

          <div className="welcome-card-decoration">
            <GraduationCap size={120} strokeWidth={1} />
          </div>
        </section>
      ) : trajectory ? (
        <div className="trajectory-results">
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-blue">
                <Target size={20} />
              </div>
              <span className="stat-label">Подходящие олимпиады</span>
              <strong className="stat-value">
                {trajectory.stats.totalOlympiads}
              </strong>
              <span className="stat-detail">Текущий учебный сезон</span>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-green">
                <CalendarDays size={20} />
              </div>
              <span className="stat-label">Регистрация открыта</span>
              <strong className="stat-value">
                {trajectory.stats.eligibleOlympiads}
              </strong>
              <span className="stat-detail">Можно подать заявку сейчас</span>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-purple">
                <Sparkles size={20} />
              </div>
              <span className="stat-label">Скоро регистрация</span>
              <strong className="stat-value">
                {trajectory.stats.upcomingOlympiads}
              </strong>
              <span className="stat-detail">Можно подготовиться заранее</span>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-orange">
                <Award size={20} />
              </div>
              <span className="stat-label">Официальные льготы</span>
              <strong className="stat-value">
                {trajectory.stats.availableBenefits}
              </strong>
              <span className="stat-detail">На ожидаемый год поступления</span>
            </div>
          </section>

          <section className="panel profile-summary-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">ТВОЙ ПРОФИЛЬ</div>
                <h2>Исходные данные</h2>
                <p>Рекомендации строятся на основе этих параметров.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Перестроить траекторию"
                title="Перестроить траекторию"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                <RefreshCw size={17} />
              </button>
            </div>

            <div className="profile-summary-grid">
              <div className="profile-summary-item">
                <span>Класс</span>
                <strong>{profile.grade}</strong>
              </div>

              <div className="profile-summary-item">
                <span>Регион</span>
                <strong className="trajectory-profile-value">
                  <MapPin size={14} />
                  {profile.region}
                </strong>
              </div>

              <div className="profile-summary-item profile-summary-subjects">
                <span>Предметы</span>
                <div className="tag-list">
                  {subjectNames.map((name) => (
                    <span className="subject-tag" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="panel trajectory-recommendations-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">ПЕРСОНАЛЬНЫЙ ПОДБОР</div>
                <h2>Твои рекомендации</h2>
                <p>
                  Сначала показываем олимпиады с открытой регистрацией,
                  затем предстоящие и возможности с ещё не опубликованными сроками.
                </p>
              </div>
              <Trophy size={22} className="muted-icon" />
            </div>

            {trajectory.recommendations.length === 0 ? (
              <EmptyState
                icon={<Target size={25} />}
                title="Пока нет подходящих олимпиад"
                description="В текущем сезоне не найдено олимпиад по выбранным предметам и классу. Измени анкету или проверь каталог."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate('/olympiads')}
                  >
                    Открыть каталог
                    <ArrowRight size={15} />
                  </button>
                }
              />
            ) : (
              <div className="trajectory-recommendations-list">
                {trajectory.recommendations.map((recommendation) => {
                  const olympiad = olympiadsById.get(recommendation.olympiadId)
                  const nextStage = olympiad
                    ? getNextStage(olympiad)
                    : null

                  return (
                    <article
                      className="trajectory-recommendation-card"
                      key={recommendation.olympiadId}
                    >
                      <div className="trajectory-recommendation-main">
                        <div className="trajectory-recommendation-topline">
                          <span className={`trajectory-status-badge trajectory-status-${olympiad?.status ?? 'unknown'}`}>
                            {STATUS_LABELS[olympiad?.status ?? 'unknown']}
                          </span>
                          <span className="trajectory-priority">
                            Приоритет {recommendation.priority}
                          </span>
                        </div>

                        <h3>{recommendation.title}</h3>

                        {olympiad && (
                          <div className="trajectory-recommendation-meta">
                            <span>
                              {olympiad.level !== null
                                ? `Уровень ${olympiad.level}`
                                : 'Уровень уточняется'}
                            </span>
                            <span>{olympiad.organizer}</span>
                          </div>
                        )}

                        <p className="trajectory-recommendation-reason">
                          {recommendation.reason}
                        </p>

                        {nextStage ? (
                          <div className="trajectory-next-stage">
                            <CalendarDays size={15} />
                            <span>
                              {STAGE_LABELS[nextStage.type]}: {formatDate(nextStage.startDate)}
                              {nextStage.endDate !== nextStage.startDate
                                ? ` — ${formatDate(nextStage.endDate)}`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="trajectory-next-stage trajectory-next-stage-muted">
                            <CalendarDays size={15} />
                            <span>Даты этапов пока не опубликованы</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="trajectory-recommendation-action"
                        aria-label={`Подробнее: ${recommendation.title}`}
                        onClick={() => navigate(`/olympiads/${recommendation.olympiadId}`)}
                      >
                        <ArrowRight size={18} />
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {profile.targetUniversityId ? (
            trajectory.stats.availableBenefits > 0 ? (
              <div className="trajectory-benefit-note">
                <GraduationCap size={18} />
                <p>
                  Найдены официальные записи о льготах для выбранного вуза.
                  Фактическое право зависит от программы, статуса диплома,
                  уровня олимпиады и подтверждающего экзамена. Проверяй
                  локальные акты вуза.
                </p>
              </div>
            ) : (
              <div className="trajectory-benefit-note trajectory-benefit-note-muted">
                <GraduationCap size={18} />
                <p>
                  Для ожидаемого года поступления пока нет подтверждённых
                  официальных льгот по выбранному вузу в нашей базе. Это не
                  означает, что льгот нет: проверь актуальные локальные акты.
                </p>
              </div>
            )
          ) : (
            <div className="trajectory-benefit-note trajectory-benefit-note-muted">
              <GraduationCap size={18} />
              <p>
                Выбери целевой вуз в анкете, чтобы мы могли учитывать
                подтверждённые льготы при сортировке рекомендаций.
              </p>
            </div>
          )}

          <section className="trajectory-next-grid">
            <button
              type="button"
              className="next-action-card"
              onClick={() => navigate('/olympiads')}
            >
              <div className="stat-icon stat-blue">
                <Target size={20} />
              </div>
              <strong>Каталог олимпиад</strong>
              <span>Посмотри все соревнования и их профили.</span>
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              className="next-action-card"
              onClick={() => navigate('/calendar')}
            >
              <div className="stat-icon stat-purple">
                <CalendarDays size={20} />
              </div>
              <strong>Календарь</strong>
              <span>Открой свои напоминания и важные сроки.</span>
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              className="next-action-card"
              onClick={() => navigate('/universities')}
            >
              <div className="stat-icon stat-green">
                <GraduationCap size={20} />
              </div>
              <strong>Вузы и льготы</strong>
              <span>Изучи условия поступления и сравни университеты.</span>
              <ArrowRight size={18} />
            </button>
          </section>
        </div>
      ) : (
        <EmptyState
          icon={<Target size={25} />}
          title="Не удалось построить траекторию"
          description="Попробуй перестроить план или изменить параметры анкеты."
          action={
            <button
              type="button"
              className="secondary-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              <RefreshCw size={15} />
              Повторить
            </button>
          }
        />
      )}
    </div>
  )
}
