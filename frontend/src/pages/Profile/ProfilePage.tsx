import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  FlaskConical,
  GraduationCap,
  MapPin,
  Save,
  Settings2,
  UserRound,
  X
} from 'lucide-react'

import type {
  CreateProfileInput,
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

import './profile-settings.css'

interface ProfileFormState {
  grade: string
  region: string
  subjects: SubjectId[]
  targetUniversityId: string
  targetProgramId: string
}

const EMPTY_FORM: ProfileFormState = {
  grade: '',
  region: '',
  subjects: [],
  targetUniversityId: '',
  targetProgramId: ''
}

function isGrade(value: unknown): value is UserGrade {
  return value === 7 || value === 8 || value === 9 || value === 10 || value === 11
}

function toProfileInput(value: {
  grade?: number
  region?: string
  subjects?: string[]
  targetUniversityId?: string
  targetProgramId?: string
} | null): CreateProfileInput | null {
  if (
    !value ||
    !isGrade(value.grade) ||
    !value.region ||
    value.region.trim().length < 2 ||
    !Array.isArray(value.subjects) ||
    value.subjects.length === 0
  ) {
    return null
  }

  const validSubjects = value.subjects.filter((subject): subject is SubjectId =>
    SUBJECTS.some((item) => item.id === subject)
  )

  if (validSubjects.length === 0) return null

  return {
    grade: value.grade,
    region: value.region,
    subjects: validSubjects,
    ...(value.targetUniversityId ? { targetUniversityId: value.targetUniversityId } : {}),
    ...(value.targetProgramId ? { targetProgramId: value.targetProgramId } : {})
  }
}

function toForm(profile: CreateProfileInput | null): ProfileFormState {
  if (!profile) return EMPTY_FORM

  return {
    grade: String(profile.grade),
    region: profile.region,
    subjects: profile.subjects.filter((subject): subject is SubjectId =>
      SUBJECTS.some((item) => item.id === subject)
    ),
    targetUniversityId: profile.targetUniversityId ?? '',
    targetProgramId: profile.targetProgramId ?? ''
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'У'
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('ru-RU') ?? '').join('')
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
  const selectedProgram = selectedUniversity?.programs?.find(
    (program) => program.id === form.targetProgramId
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

      const universityRequest = universityService.getAll()
      const profileRequest = session?.access_token
        ? getProfileSnapshot(session.access_token)
        : Promise.resolve(null)

      const [universityResult, profileResult] = await Promise.allSettled([
        universityRequest,
        profileRequest
      ])

      if (cancelled) return

      if (universityResult.status === 'fulfilled') {
        setUniversities(universityResult.value)
      } else {
        setLoadWarning('Не удалось загрузить список вузов. Остальные данные профиля доступны для просмотра.')
      }

      if (profileResult.status === 'rejected') {
        setLoadWarning('Не удалось загрузить сохранённый профиль с сервера. Проверь соединение и повтори попытку.')
      }

      const remoteProfile = profileResult.status === 'fulfilled'
        ? toProfileInput(profileResult.value)
        : null
      const resolvedProfile = remoteProfile ?? getGuestProfile()

      setProfile(resolvedProfile)
      setForm(toForm(resolvedProfile))
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
    setForm((current) => ({
      ...current,
      subjects: current.subjects.includes(subjectId)
        ? current.subjects.filter((item) => item !== subjectId)
        : [...current.subjects, subjectId]
    }))
    setError(null)
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

    const nextProfile: CreateProfileInput = {
      grade: numericGrade,
      region: form.region.trim(),
      subjects: form.subjects,
      ...(form.targetUniversityId ? { targetUniversityId: form.targetUniversityId } : {}),
      ...(form.targetUniversityId && form.targetProgramId
        ? { targetProgramId: form.targetProgramId }
        : {})
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

  const selectedUniversityName = universities.find(
    (university) => university.id === profile?.targetUniversityId
  )?.name

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
              <span><GraduationCap size={16} />Целевой вуз</span>
              <strong>{selectedUniversityName ?? 'Пока не выбран'}</strong>
            </div>
            <div className="profile-overview-item">
              <span><ChevronDown size={16} />Направление</span>
              <strong>{selectedProgram?.name ?? 'Пока не выбрано'}</strong>
            </div>
          </div>
        </section>
      )}

      {editing && (
        <form className="panel profile-editor" onSubmit={handleSave}>
          <div className="profile-editor-title">
            <div>
              <h2>{profile ? 'Редактирование профиля' : 'Заполни профиль'}</h2>
              <p>Эти данные используются для персонального подбора олимпиад.</p>
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
                placeholder="Например, Москва"
                maxLength={120}
                required
              />
            </label>

            <label className="profile-form-field">
              <span>Целевой вуз <small>Необязательно</small></span>
              <select
                value={form.targetUniversityId}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  targetUniversityId: event.target.value,
                  targetProgramId: ''
                }))}
              >
                <option value="">Пока не выбрал</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.shortName} — {university.name}
                  </option>
                ))}
              </select>
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

          <div className="profile-subject-section">
            <div className="profile-section-heading">
              <div>
                <h3>Интересующие предметы</h3>
                <p>Выбери один или несколько предметов.</p>
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
          </div>

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
