import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  FlaskConical,
  GraduationCap,
  MapPin,
  Plus,
  Save,
  Settings2,
  Target,
  UserRound,
  X
} from 'lucide-react'

import type {
  CreateProfileInput,
  EducationLevel,
  PreparationLevel,
  ProfileSnapshot,
  SubjectPreparation,
  University,
  UserGrade
} from '@trajectory/shared'
import { SUBJECTS, type SubjectId } from '@trajectory/shared'

import { useAuth } from '@/app/providers'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import {
  getGuestProfile,
  getProfileSnapshot,
  saveAuthenticatedProfile,
  saveGuestProfile
} from '@/services/profile.service'
import { universityService } from '@/services/university.service'
import { UniversityAutocomplete } from '@/components/universities/UniversityAutocomplete'

import './profile-settings.css'

interface ProfileFormState {
  grade: string
  region: string
  subjects: SubjectId[]
  targetUniversityId: string
  targetProgramId: string
  weeklyStudyHours: string
  targetAdmissionYear: string
  targetEducationLevel: EducationLevel | ''
  subjectPreparation: Partial<Record<SubjectId, PreparationLevel>>
  alternativeUniversityIds: string[]
  alternativeUniversityToAdd: string
}

type ProfileSource = {
  grade?: number
  region?: string
  subjects?: string[]
  targetUniversityId?: string
  targetProgramId?: string
  weeklyStudyHours?: number
  targetAdmissionYear?: number
  targetEducationLevel?: EducationLevel | null
  subjectPreparation?: SubjectPreparation[]
  alternativeUniversityIds?: string[]
}

const EMPTY_FORM: ProfileFormState = {
  grade: '',
  region: '',
  subjects: [],
  targetUniversityId: '',
  targetProgramId: '',
  weeklyStudyHours: '',
  targetAdmissionYear: '',
  targetEducationLevel: '',
  subjectPreparation: {},
  alternativeUniversityIds: [],
  alternativeUniversityToAdd: ''
}

const PREPARATION_LEVEL_OPTIONS: { value: PreparationLevel; label: string }[] = [
  { value: 'beginner', label: 'Начальный' },
  { value: 'medium', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' }
]

const EDUCATION_LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: 'bachelor', label: 'Бакалавриат' },
  { value: 'specialist', label: 'Специалитет' },
  { value: 'basic_higher', label: 'Базовое высшее образование' }
]

const REGION_OPTIONS = [
  "Амурская область",
  "Архангельская область",
  "Астраханская область",
  "Белгородская область",
  "Брянская область",
  "Владимирская область",
  "Волгоградская область",
  "Вологодская область",
  "Воронежская область",
  "Запорожская область",
  "Ивановская область",
  "Иркутская область",
  "Калининградская область",
  "Калужская область",
  "Кемеровская область — Кузбасс",
  "Кировская область",
  "Костромская область",
  "Курганская область",
  "Курская область",
  "Ленинградская область",
  "Липецкая область",
  "Магаданская область",
  "Московская область",
  "Мурманская область",
  "Нижегородская область",
  "Новгородская область",
  "Новосибирская область",
  "Омская область",
  "Оренбургская область",
  "Орловская область",
  "Пензенская область",
  "Пермский край",
  "Приморский край",
  "Псковская область",
  "Республика Адыгея (Адыгея)",
  "Республика Алтай",
  "Республика Башкортостан",
  "Республика Бурятия",
  "Республика Дагестан",
  "Республика Ингушетия",
  "Республика Калмыкия",
  "Республика Карелия",
  "Республика Коми",
  "Республика Крым",
  "Республика Марий Эл",
  "Республика Мордовия",
  "Республика Саха (Якутия)",
  "Республика Северная Осетия — Алания",
  "Республика Татарстан (Татарстан)",
  "Республика Тыва",
  "Республика Хакасия",
  "Ростовская область",
  "Рязанская область",
  "Самарская область",
  "Санкт-Петербург",
  "Саратовская область",
  "Сахалинская область",
  "Свердловская область",
  "Севастополь",
  "Смоленская область",
  "Ставропольский край",
  "Тамбовская область",
  "Тверская область",
  "Томская область",
  "Тульская область",
  "Тюменская область",
  "Удмуртская Республика",
  "Ульяновская область",
  "Хабаровский край",
  "Ханты-Мансийский автономный округ — Югра",
  "Челябинская область",
  "Чеченская Республика",
  "Чувашская Республика — Чувашия",
  "Чукотский автономный округ",
  "Ямало-Ненецкий автономный округ",
  "Ярославская область",
  "Алтайский край",
  "Забайкальский край",
  "Кабардино-Балкарская Республика",
  "Камчатский край",
  "Карачаево-Черкесская Республика",
  "Краснодарский край",
  "Красноярский край",
  "Луганская Народная Республика",
  "Москва",
  "Ненецкий автономный округ",
  "Донецкая Народная Республика",
  "Еврейская автономная область",
  "Херсонская область"
]
  .slice()
  .sort((a, b) => a.localeCompare(b, 'ru'))

function isGrade(value: unknown): value is UserGrade {
  return value === 7 || value === 8 || value === 9 || value === 10 || value === 11
}

function isSubjectId(value: unknown): value is SubjectId {
  return SUBJECTS.some((subject) => subject.id === value)
}

function isPreparationLevel(value: unknown): value is PreparationLevel {
  return value === 'beginner' || value === 'medium' || value === 'advanced'
}

function isEducationLevel(value: unknown): value is EducationLevel {
  return value === 'bachelor' || value === 'specialist' || value === 'basic_higher'
}

function toProfileInput(value: ProfileSource | ProfileSnapshot | null): CreateProfileInput | null {
  if (
    !value ||
    !isGrade(value.grade) ||
    typeof value.region !== 'string' ||
    value.region.trim().length < 2 ||
    !Array.isArray(value.subjects) ||
    value.subjects.length === 0
  ) {
    return null
  }

  const validSubjects = [...new Set(value.subjects.filter(isSubjectId))]
  if (validSubjects.length === 0) return null

  const preparationBySubject = new Map<SubjectId, PreparationLevel>()
  for (const item of value.subjectPreparation ?? []) {
    if (isSubjectId(item.subjectId) && isPreparationLevel(item.preparationLevel)) {
      preparationBySubject.set(item.subjectId, item.preparationLevel)
    }
  }

  const alternativeUniversityIds = [...new Set(value.alternativeUniversityIds ?? [])]
    .filter((id) => typeof id === 'string' && id.length > 0 && id !== value.targetUniversityId)
    .slice(0, 3)

  return {
    grade: value.grade,
    region: value.region,
    subjects: validSubjects,
    ...(value.targetUniversityId ? { targetUniversityId: value.targetUniversityId } : {}),
    ...(value.targetProgramId && value.targetUniversityId
      ? { targetProgramId: value.targetProgramId }
      : {}),
    ...(typeof value.weeklyStudyHours === 'number' && Number.isInteger(value.weeklyStudyHours) && value.weeklyStudyHours >= 1 && value.weeklyStudyHours <= 40
      ? { weeklyStudyHours: value.weeklyStudyHours }
      : {}),
    ...(typeof value.targetAdmissionYear === 'number' && Number.isInteger(value.targetAdmissionYear) && value.targetAdmissionYear >= 2026 && value.targetAdmissionYear <= 2100
      ? { targetAdmissionYear: value.targetAdmissionYear }
      : {}),
    ...(value.targetEducationLevel === undefined
      ? {}
      : isEducationLevel(value.targetEducationLevel)
        ? { targetEducationLevel: value.targetEducationLevel }
        : { targetEducationLevel: null }),
    subjectPreparation: validSubjects.map((subjectId) => ({
      subjectId,
      preparationLevel: preparationBySubject.get(subjectId) ?? 'medium'
    })),
    alternativeUniversityIds
  }
}

function toForm(profile: CreateProfileInput | null): ProfileFormState {
  if (!profile) return EMPTY_FORM

  const subjectPreparation: Partial<Record<SubjectId, PreparationLevel>> = {}
  for (const subjectId of profile.subjects) {
    if (isSubjectId(subjectId)) {
      const saved = profile.subjectPreparation?.find((item) => item.subjectId === subjectId)
      subjectPreparation[subjectId] = saved?.preparationLevel ?? 'medium'
    }
  }

  return {
    grade: String(profile.grade),
    region: profile.region,
    subjects: profile.subjects.filter(isSubjectId),
    targetUniversityId: profile.targetUniversityId ?? '',
    targetProgramId: profile.targetProgramId ?? '',
    weeklyStudyHours: profile.weeklyStudyHours?.toString() ?? '',
    targetAdmissionYear: profile.targetAdmissionYear?.toString() ?? '',
    targetEducationLevel:
      profile.targetEducationLevel === 'bachelor' ||
      profile.targetEducationLevel === 'specialist' ||
      profile.targetEducationLevel === 'basic_higher'
        ? profile.targetEducationLevel
        : '',
    subjectPreparation,
    alternativeUniversityIds: (profile.alternativeUniversityIds ?? [])
      .filter((id) => id !== profile.targetUniversityId)
      .slice(0, 3),
    alternativeUniversityToAdd: ''
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'У'
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('ru-RU') ?? '').join('')
}

function getUniversityLabel(university: University | undefined, fallbackId: string): string {
  if (!university) return `Вуз (${fallbackId.slice(0, 8)}…)`
  return university.shortName || university.name
}

export function ProfilePage() {
  const { session, user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<CreateProfileInput | null>(null)
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [universities, setUniversities] = useState<University[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)

  const selectedUniversity = universities.find(
    (university) => university.id === form.targetUniversityId
  )

  const profileUniversity = universities.find(
    (university) => university.id === profile?.targetUniversityId
  )
  const profileProgram = profileUniversity?.programs?.find(
    (program) => program.id === profile?.targetProgramId
  )
  const profileName =
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    'Мой профиль'

  const subjectNames = useMemo(() => {
    const ids = new Set(profile?.subjects ?? [])
    return SUBJECTS.filter((subject) => ids.has(subject.id))
  }, [profile])

  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setLoadWarning(null)

      const profileRequest = session?.access_token
        ? getProfileSnapshot(session.access_token)
        : Promise.resolve(null)
      const [profileResult] = await Promise.allSettled([profileRequest])

      if (cancelled) return

      if (profileResult.status === 'rejected') {
        setLoadWarning('Не удалось загрузить сохранённый профиль с сервера. Проверь соединение и повтори попытку.')
      }

      const remoteProfile = profileResult.status === 'fulfilled'
        ? toProfileInput(profileResult.value)
        : null
      const resolvedProfile = remoteProfile ?? getGuestProfile()
      setProfile(resolvedProfile)
      setForm(toForm(resolvedProfile))

      const selectedIds = [...new Set([
        resolvedProfile?.targetUniversityId,
        ...(resolvedProfile?.alternativeUniversityIds ?? [])
      ].filter((id): id is string => Boolean(id)))]

      if (selectedIds.length > 0) {
        const universityResults = await Promise.allSettled(
          selectedIds.map((id) => universityService.getById(id))
        )
        if (cancelled) return
        const loadedUniversities = universityResults
          .filter((result): result is PromiseFulfilledResult<University> => result.status === 'fulfilled')
          .map((result) => result.value)
        setUniversities(loadedUniversities)
        if (loadedUniversities.length !== selectedIds.length) {
          setLoadWarning('Не удалось загрузить часть выбранных вузов. Проверь их наличие в справочнике.')
        }
      } else {
        setUniversities([])
      }

      setEditing(!resolvedProfile)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token])

  const updateForm = <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
    setMessage(null)
  }

  const toggleSubject = (subjectId: SubjectId) => {
    setForm((current) => {
      const selected = current.subjects.includes(subjectId)
      const nextPreparation = { ...current.subjectPreparation }

      if (selected) {
        delete nextPreparation[subjectId]
      } else {
        nextPreparation[subjectId] = 'medium'
      }

      return {
        ...current,
        subjects: selected
          ? current.subjects.filter((item) => item !== subjectId)
          : [...current.subjects, subjectId],
        subjectPreparation: nextPreparation
      }
    })
    setError(null)
    setMessage(null)
  }

  const addAlternativeUniversity = () => {
    const universityId = form.alternativeUniversityToAdd
    if (!universityId) return

    if (form.alternativeUniversityIds.length >= 3) {
      setError('Можно добавить не более трёх альтернативных вузов.')
      return
    }
    if (universityId === form.targetUniversityId || form.alternativeUniversityIds.includes(universityId)) {
      setError('Этот вуз уже выбран как основной или альтернативный.')
      return
    }

    setForm((current) => ({
      ...current,
      alternativeUniversityIds: [...current.alternativeUniversityIds, universityId],
      alternativeUniversityToAdd: ''
    }))
    setError(null)
    setMessage(null)
  }

  const removeAlternativeUniversity = (universityId: string) => {
    updateForm(
      'alternativeUniversityIds',
      form.alternativeUniversityIds.filter((id) => id !== universityId)
    )
  }

  const moveAlternativeUniversity = (index: number, direction: -1 | 1) => {
    const next = [...form.alternativeUniversityIds]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    updateForm('alternativeUniversityIds', next)
  }

  const handleCancel = () => {
    setForm(toForm(profile))
    setEditing(false)
    setError(null)
    setMessage(null)
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const numericGrade = Number(form.grade)
    if (!isGrade(numericGrade)) {
      setError('Выбери класс с 7-го по 11-й.')
      return
    }
    if (form.region.trim().length < 2) {
      setError('Укажи регион обучения.')
      return
    }
    if (form.subjects.length === 0) {
      setError('Выбери хотя бы один интересующий предмет.')
      return
    }

    const weeklyStudyHours = form.weeklyStudyHours.trim() === ''
      ? undefined
      : Number(form.weeklyStudyHours)
    if (
      weeklyStudyHours !== undefined &&
      (!Number.isInteger(weeklyStudyHours) || weeklyStudyHours < 1 || weeklyStudyHours > 40)
    ) {
      setError('Недельная нагрузка должна быть целым числом от 1 до 40 часов.')
      return
    }

    const targetAdmissionYear = form.targetAdmissionYear.trim() === ''
      ? undefined
      : Number(form.targetAdmissionYear)
    if (
      targetAdmissionYear !== undefined &&
      (!Number.isInteger(targetAdmissionYear) || targetAdmissionYear < 2026 || targetAdmissionYear > 2100)
    ) {
      setError('Укажи год поступления от 2026 до 2100.')
      return
    }

    if (form.targetProgramId && !form.targetUniversityId) {
      setError('Сначала выбери основной университет для направления.')
      return
    }
    if (form.alternativeUniversityIds.length > 3) {
      setError('Можно выбрать не более трёх альтернативных вузов.')
      return
    }
    if (form.alternativeUniversityIds.includes(form.targetUniversityId)) {
      setError('Основной вуз не может одновременно быть альтернативным.')
      return
    }

    const nextProfile: CreateProfileInput = {
      grade: numericGrade,
      region: form.region.trim(),
      subjects: form.subjects,
      ...(form.targetUniversityId ? { targetUniversityId: form.targetUniversityId } : {}),
      ...(form.targetUniversityId && form.targetProgramId
        ? { targetProgramId: form.targetProgramId }
        : {}),
      ...(weeklyStudyHours !== undefined ? { weeklyStudyHours } : {}),
      ...(targetAdmissionYear !== undefined ? { targetAdmissionYear } : {}),
      targetEducationLevel: form.targetEducationLevel || null,
      subjectPreparation: form.subjects.map((subjectId) => ({
        subjectId,
        preparationLevel: form.subjectPreparation[subjectId] ?? 'medium'
      })),
      alternativeUniversityIds: form.alternativeUniversityIds
    }

    setSaving(true)

    try {
      if (session?.access_token) {
        await saveAuthenticatedProfile(nextProfile, session.access_token)
      } else {
        saveGuestProfile(nextProfile)
      }

      setProfile(nextProfile)
      setForm(toForm(nextProfile))
      setEditing(false)
      setMessage('Профиль успешно сохранён.')
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : 'Не удалось сохранить профиль. Попробуй ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return <div className="dashboard-container"><LoadingState message="Загружаем профиль..." /></div>
  }

  const subjectPreparationForProfile = (profile?.subjectPreparation ?? [])
    .filter((item) => subjectNames.some((subject) => subject.id === item.subjectId))

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title="Мой профиль"
        description="Управляй информацией о себе и своей образовательной целью."
        action={(
          <div className="profile-header-actions">
            <Link to="/settings" className="secondary-button">
              <Settings2 size={16} />
              Настройки
            </Link>
            {!editing && (
              <button type="button" className="primary-button" onClick={() => setEditing(true)}>
                Редактировать
              </button>
            )}
          </div>
        )}
      />

      {loadWarning && <div className="profile-inline-warning" role="status">{loadWarning}</div>}
      {error && <div className="profile-inline-error" role="alert">{error}</div>}
      {message && <div className="profile-inline-success" role="status"><Check size={16} />{message}</div>}

      {!editing && profile && (
        <section className="panel profile-overview-card">
          <div className="profile-overview-heading">
            <div className="profile-avatar">{getInitials(profileName)}</div>
            <div className="profile-overview-identity">
              <h2>{profileName}</h2>
              <p>{user?.email ?? 'Гостевой профиль на этом устройстве'}</p>
              <span className={`profile-account-badge ${session ? 'is-account' : 'is-guest'}`}>
                {session ? 'Аккаунт' : 'Гостевой профиль'}
              </span>
            </div>
          </div>

          <div className="profile-overview-grid">
            <div className="profile-overview-item">
              <span><GraduationCap size={16} />Класс</span>
              <strong>{profile.grade}</strong>
            </div>
            <div className="profile-overview-item">
              <span><MapPin size={16} />Регион обучения</span>
              <strong>{profile.region}</strong>
            </div>
            <div className="profile-overview-item profile-overview-wide">
              <span><BookOpen size={16} />Интересующие предметы</span>
              <div className="profile-subject-tags">
                {subjectNames.map((subject) => <span key={subject.id}>{subject.label}</span>)}
              </div>
            </div>
            <div className="profile-overview-item">
              <span><GraduationCap size={16} />Основной вуз</span>
              <strong>{profile.targetUniversityId ? getUniversityLabel(profileUniversity, profile.targetUniversityId) : 'Пока не выбран'}</strong>
            </div>
            <div className="profile-overview-item">
              <span><ChevronDown size={16} />Направление / программа</span>
              <strong>{profileProgram?.name ?? (profile.targetProgramId ? 'Программа выбрана' : 'Пока не выбрано')}</strong>
            </div>
            <div className="profile-overview-item">
              <span><Clock3 size={16} />Нагрузка в неделю</span>
              <strong>{profile.weeklyStudyHours ? `${profile.weeklyStudyHours} ч` : 'Не указана'}</strong>
            </div>
            <div className="profile-overview-item">
              <span><CalendarDays size={16} />Год поступления</span>
              <strong>{profile.targetAdmissionYear ?? 'Не указан'}</strong>
            </div>
            <div className="profile-overview-item">
              <span><Target size={16} />Уровень образования</span>
              <strong>{EDUCATION_LEVEL_OPTIONS.find((item) => item.value === profile.targetEducationLevel)?.label ?? 'Не выбран'}</strong>
            </div>
            <div className="profile-overview-item profile-overview-wide">
              <span><GraduationCap size={16} />Альтернативные вузы</span>
              {profile.alternativeUniversityIds?.length ? (
                <div className="profile-subject-tags">
                  {profile.alternativeUniversityIds.map((id) => (
                    <span key={id}>{getUniversityLabel(universities.find((item) => item.id === id), id)}</span>
                  ))}
                </div>
              ) : <strong>Пока не выбраны</strong>}
            </div>
            <div className="profile-overview-item profile-overview-wide">
              <span><BookOpen size={16} />Уровень подготовки по предметам</span>
              {subjectPreparationForProfile.length ? (
                <div className="profile-preparation-tags">
                  {subjectPreparationForProfile.map((item) => (
                    <span key={item.subjectId}>
                      {SUBJECTS.find((subject) => subject.id === item.subjectId)?.label ?? item.subjectId}
                      <strong>{PREPARATION_LEVEL_OPTIONS.find((option) => option.value === item.preparationLevel)?.label}</strong>
                    </span>
                  ))}
                </div>
              ) : <strong>Средний уровень будет использован по умолчанию</strong>}
            </div>
          </div>
        </section>
      )}

      {editing && (
        <form className="panel profile-editor" onSubmit={handleSave}>
          <div className="profile-editor-title">
            <div>
              <h2>{profile ? 'Редактирование профиля' : 'Заполни профиль'}</h2>
              <p>Эти данные помогут построить персональный план подготовки и поступления.</p>
            </div>
            <div className="profile-editor-icon"><UserRound size={21} /></div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-form-field">
              <span>Класс обучения</span>
              <select value={form.grade} onChange={(event) => updateForm('grade', event.target.value)} required>
                <option value="">Выбери класс</option>
                {[7, 8, 9, 10, 11].map((grade) => <option key={grade} value={grade}>{grade} класс</option>)}
              </select>
            </label>

            <label className="profile-form-field">
              <span>Регион обучения</span>
              <input
                value={form.region}
                onChange={(event) => updateForm('region', event.target.value)}
                placeholder="Начни вводить регион"
                list="trajectory-region-options"
                autoComplete="off"
                maxLength={120}
                required
              />
              <datalist id="trajectory-region-options">
                {REGION_OPTIONS.map((region) => <option key={region} value={region} />)}
              </datalist>
            </label>

            <label className="profile-form-field">
              <span>Целевой вуз <small>Необязательно</small></span>
              <UniversityAutocomplete
                selected={selectedUniversity ?? null}
                placeholder="Найди вуз по названию или аббревиатуре"
                onSelect={(university) => {
                  if (university) {
                    setUniversities((current) => [
                      ...current.filter((item) => item.id !== university.id),
                      university
                    ])
                  }
                  setForm((current) => ({
                    ...current,
                    targetUniversityId: university?.id ?? '',
                    targetProgramId: '',
                    alternativeUniversityIds: current.alternativeUniversityIds.filter((id) => id !== university?.id)
                  }))
                  setError(null)
                  setMessage(null)
                }}
              />
            </label>

            <label className="profile-form-field">
              <span>Направление / программа <small>Необязательно</small></span>
              <select
                value={form.targetProgramId}
                onChange={(event) => updateForm('targetProgramId', event.target.value)}
                disabled={!selectedUniversity}
              >
                <option value="">Не выбрано</option>
                {(selectedUniversity?.programs ?? []).map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}{program.direction ? ` · ${program.direction}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="profile-planning-section">
            <div className="profile-section-heading">
              <div>
                <h3>Цель поступления</h3>
                <p>Задай ориентиры, чтобы план учитывал сроки и выбранный формат обучения.</p>
              </div>
            </div>
            <div className="profile-planning-grid">
              <label className="profile-form-field">
                <span>Год поступления <small>Необязательно</small></span>
                <input
                  type="number"
                  min={2026}
                  max={2100}
                  step={1}
                  inputMode="numeric"
                  placeholder="Например, 2029"
                  value={form.targetAdmissionYear}
                  onChange={(event) => updateForm('targetAdmissionYear', event.target.value)}
                />
              </label>
              <label className="profile-form-field">
                <span>Уровень образования <small>Необязательно</small></span>
                <select
                  value={form.targetEducationLevel}
                  onChange={(event) => updateForm('targetEducationLevel', event.target.value as EducationLevel | '')}
                >
                  <option value="">Пока не определился</option>
                  {EDUCATION_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="profile-form-field">
                <span>Часов на подготовку в неделю <small>От 1 до 40</small></span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  step={1}
                  inputMode="numeric"
                  placeholder="Например, 8"
                  value={form.weeklyStudyHours}
                  onChange={(event) => updateForm('weeklyStudyHours', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="profile-subject-section">
            <div className="profile-section-heading">
              <div>
                <h3>Интересующие предметы</h3>
                <p>Выбери один или несколько предметов для подбора олимпиад и подготовки.</p>
              </div>
              <span>{form.subjects.length} выбрано</span>
            </div>
            <div className="profile-subject-picker">
              {SUBJECTS.map((subject) => {
                const selected = form.subjects.includes(subject.id)
                return (
                  <button
                    key={subject.id}
                    type="button"
                    className={`profile-subject-option ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleSubject(subject.id)}
                  >
                    <span className="profile-subject-option-icon">
                      {subject.id === 'informatics' ? <Code2 size={18} /> :
                        subject.id === 'chemistry' ? <FlaskConical size={18} /> :
                          subject.id === 'mathematics' ? <GraduationCap size={18} /> :
                            <BookOpen size={18} />}
                    </span>
                    <span>{subject.label}</span>
                    {selected && <Check size={16} />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="profile-planning-section">
            <div className="profile-section-heading">
              <div>
                <h3>Уровень подготовки</h3>
                <p>Укажи текущий уровень по каждому выбранному предмету. По умолчанию — средний.</p>
              </div>
            </div>
            {form.subjects.length ? (
              <div className="profile-preparation-list">
                {form.subjects.map((subjectId) => (
                  <label className="profile-preparation-row" key={subjectId}>
                    <span>{SUBJECTS.find((subject) => subject.id === subjectId)?.label ?? subjectId}</span>
                    <select
                      value={form.subjectPreparation[subjectId] ?? 'medium'}
                      onChange={(event) => updateForm('subjectPreparation', {
                        ...form.subjectPreparation,
                        [subjectId]: event.target.value as PreparationLevel
                      })}
                    >
                      {PREPARATION_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <p className="profile-section-empty">Сначала выбери предметы в предыдущем блоке.</p>
            )}
          </section>

          <section className="profile-planning-section">
            <div className="profile-section-heading">
              <div>
                <h3>Альтернативные вузы</h3>
                <p>Добавь до трёх запасных вариантов. Порядок в списке задаёт приоритет.</p>
              </div>
              <span>{form.alternativeUniversityIds.length} / 3</span>
            </div>

            <div className="profile-alternative-add">
              <label className="profile-form-field">
                <span>Добавить университет</span>
                <UniversityAutocomplete
                  selected={universities.find((item) => item.id === form.alternativeUniversityToAdd) ?? null}
                  placeholder="Найди запасной вуз"
                  excludedIds={[form.targetUniversityId, ...form.alternativeUniversityIds]}
                  disabled={form.alternativeUniversityIds.length >= 3}
                  onSelect={(university) => {
                    if (university) {
                      setUniversities((current) => [
                        ...current.filter((item) => item.id !== university.id),
                        university
                      ])
                    }
                    updateForm('alternativeUniversityToAdd', university?.id ?? '')
                  }}
                />
              </label>
              <button
                type="button"
                className="secondary-button profile-alternative-add-button"
                onClick={addAlternativeUniversity}
                disabled={!form.alternativeUniversityToAdd || form.alternativeUniversityIds.length >= 3}
              >
                <Plus size={16} /> Добавить
              </button>
            </div>

            {form.alternativeUniversityIds.length ? (
              <ol className="profile-alternative-list">
                {form.alternativeUniversityIds.map((id, index) => (
                  <li key={id}>
                    <span className="profile-alternative-priority">{index + 1}</span>
                    <strong>{getUniversityLabel(universities.find((item) => item.id === id), id)}</strong>
                    <div className="profile-alternative-actions">
                      <button
                        type="button"
                        className="profile-icon-button"
                        aria-label={`Поднять ${getUniversityLabel(universities.find((item) => item.id === id), id)} выше`}
                        onClick={() => moveAlternativeUniversity(index, -1)}
                        disabled={index === 0}
                      ><ArrowUp size={15} /></button>
                      <button
                        type="button"
                        className="profile-icon-button"
                        aria-label={`Опустить ${getUniversityLabel(universities.find((item) => item.id === id), id)} ниже`}
                        onClick={() => moveAlternativeUniversity(index, 1)}
                        disabled={index === form.alternativeUniversityIds.length - 1}
                      ><ArrowDown size={15} /></button>
                      <button
                        type="button"
                        className="profile-icon-button is-remove"
                        aria-label={`Удалить ${getUniversityLabel(universities.find((item) => item.id === id), id)}`}
                        onClick={() => removeAlternativeUniversity(id)}
                      ><X size={15} /></button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="profile-section-empty">Запасные вузы пока не выбраны.</p>
            )}
          </section>

          <div className="profile-editor-actions">
            {profile && (
              <button type="button" className="secondary-button" onClick={handleCancel} disabled={saving}>
                <X size={16} />Отмена
              </button>
            )}
            <button type="submit" className="primary-button" disabled={saving}>
              <Save size={16} />{saving ? 'Сохраняем...' : 'Сохранить профиль'}
            </button>
          </div>
        </form>
      )}

      {!editing && !profile && (
        <ErrorState
          message="Профиль не заполнен. Открой редактирование, укажи класс, регион и интересующие предметы."
          onRetry={() => setEditing(true)}
        />
      )}
    </div>
  )
}
