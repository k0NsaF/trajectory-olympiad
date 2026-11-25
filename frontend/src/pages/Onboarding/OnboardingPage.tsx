import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Dna,
  FlaskConical,
  GraduationCap,
  Landmark,
  Languages,
  MapPin,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  SUBJECTS,
  type CreateProfileInput,
  type SubjectId,
  type University,
  type UniversityProgram,
  type UserGrade
} from '@trajectory/shared'

import { useAuth } from '@/app/providers'
import { PageHeader } from '@/components/common/PageHeader'
import {
  getAuthenticatedProfile,
  getGuestProfile,
  saveAuthenticatedProfile,
  saveGuestProfile
} from '@/services/profile.service'
import { universityService } from '@/services/university.service'

const GRADES: UserGrade[] = [7, 8, 9, 10, 11]

const REGIONS = [
  'Республика Адыгея',
  'Республика Алтай',
  'Республика Башкортостан',
  'Республика Бурятия',
  'Республика Дагестан',
  'Республика Ингушетия',
  'Кабардино-Балкарская Республика',
  'Республика Калмыкия',
  'Карачаево-Черкесская Республика',
  'Республика Карелия',
  'Республика Коми',
  'Республика Крым',
  'Республика Марий Эл',
  'Республика Мордовия',
  'Республика Саха (Якутия)',
  'Республика Северная Осетия — Алания',
  'Республика Татарстан',
  'Республика Тыва',
  'Удмуртская Республика',
  'Республика Хакасия',
  'Чеченская Республика',
  'Чувашская Республика',
  'Алтайский край',
  'Забайкальский край',
  'Камчатский край',
  'Краснодарский край',
  'Красноярский край',
  'Пермский край',
  'Приморский край',
  'Ставропольский край',
  'Хабаровский край',
  'Амурская область',
  'Архангельская область',
  'Астраханская область',
  'Белгородская область',
  'Брянская область',
  'Владимирская область',
  'Волгоградская область',
  'Вологодская область',
  'Воронежская область',
  'Ивановская область',
  'Иркутская область',
  'Калининградская область',
  'Калужская область',
  'Кемеровская область — Кузбасс',
  'Кировская область',
  'Костромская область',
  'Курганская область',
  'Курская область',
  'Ленинградская область',
  'Липецкая область',
  'Магаданская область',
  'Московская область',
  'Мурманская область',
  'Нижегородская область',
  'Новгородская область',
  'Новосибирская область',
  'Омская область',
  'Оренбургская область',
  'Орловская область',
  'Пензенская область',
  'Псковская область',
  'Ростовская область',
  'Рязанская область',
  'Самарская область',
  'Саратовская область',
  'Сахалинская область',
  'Свердловская область',
  'Смоленская область',
  'Тамбовская область',
  'Тверская область',
  'Томская область',
  'Тульская область',
  'Тюменская область',
  'Ульяновская область',
  'Челябинская область',
  'Ярославская область',
  'Москва',
  'Санкт-Петербург',
  'Севастополь',
  'Еврейская автономная область',
  'Ненецкий автономный округ',
  'Ханты-Мансийский автономный округ — Югра',
  'Чукотский автономный округ',
  'Ямало-Ненецкий автономный округ'
]

const POPULAR_REGIONS = [
  'Москва',
  'Московская область',
  'Санкт-Петербург',
  'Республика Татарстан',
  'Свердловская область',
  'Новосибирская область',
  'Краснодарский край',
  'Нижегородская область'
]

const SUBJECT_ICONS: Record<SubjectId, LucideIcon> = {
  mathematics: Landmark,
  informatics: Code2,
  physics: Atom,
  biology: Dna,
  chemistry: FlaskConical,
  economics: Landmark,
  russian: BookOpen,
  history: BookOpen,
  social_studies: GraduationCap,
  foreign_language: Languages
}

const SUBJECT_DESCRIPTIONS: Record<SubjectId, string> = {
  mathematics: 'Задачи, логика и доказательства',
  informatics: 'Алгоритмы, код и технологии',
  physics: 'Законы природы и эксперименты',
  biology: 'Живые системы и исследования',
  chemistry: 'Вещества, реакции и опыты',
  economics: 'Рынки, модели и аналитика',
  russian: 'Язык, литература и культура речи',
  history: 'События, эпохи и источники',
  social_studies: 'Общество, право и политика',
  foreign_language: 'Языки и межкультурная коммуникация'
}

const STEP_META = [
  {
    title: 'В каком ты классе?',
    description: 'Мы учтём твой класс и не будем предлагать олимпиады, в которых ты пока не можешь участвовать.',
    hint: 'Класс влияет на список доступных олимпиад и требования к участникам.'
  },
  {
    title: 'В каком регионе ты учишься?',
    description: 'Укажи регион обучения. Это поможет учитывать площадки и региональные ограничения этапов.',
    hint: 'Некоторые этапы проходят очно или доступны только в отдельных регионах.'
  },
  {
    title: 'Какие предметы тебе интересны?',
    description: 'Выбери все направления, в которых хочешь развиваться или попробовать свои силы.',
    hint: 'Мы подберём олимпиады, профили которых пересекаются с твоими интересами.'
  },
  {
    title: 'Какой вуз рассматриваешь?',
    description: 'Выбери университет, если уже присматриваешься к поступлению. Этот шаг можно пропустить.',
    hint: 'С выбранным вузом мы сможем выделить олимпиады, по которым есть подтверждённые льготы.'
  },
  {
    title: 'Какое направление тебе интересно?',
    description: 'Уточни образовательную программу выбранного вуза. Это необязательно — направление можно выбрать позже.',
    hint: 'Так мы сможем точнее сопоставлять олимпиады с условиями конкретной программы.'
  }
]

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  const [step, setStep] = useState(1)
  const [grade, setGrade] = useState<UserGrade | null>(null)
  const [region, setRegion] = useState('')
  const [subjects, setSubjects] = useState<SubjectId[]>([])
  const [targetUniversityId, setTargetUniversityId] = useState<string | undefined>()
  const [targetProgramId, setTargetProgramId] = useState<string | undefined>()
  const [regionSearch, setRegionSearch] = useState('')
  const [universitySearch, setUniversitySearch] = useState('')
  const [programSearch, setProgramSearch] = useState('')
  const [universities, setUniversities] = useState<University[]>([])
  const [universitiesLoading, setUniversitiesLoading] = useState(false)
  const [universitiesError, setUniversitiesError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stepMeta = STEP_META[step - 1]
  const selectedUniversity = universities.find(
    (university) => university.id === targetUniversityId
  )
  const programs = selectedUniversity?.programs ?? []
  const selectedProgram = programs.find(
    (program) => program.id === targetProgramId
  )

  const filteredRegions = useMemo(() => {
    const query = normalizeSearch(regionSearch)
    const source = query ? REGIONS : POPULAR_REGIONS

    return source
      .filter((item) => normalizeSearch(item).includes(query))
      .slice(0, 9)
  }, [regionSearch])

  const filteredUniversities = useMemo(() => {
    const query = normalizeSearch(universitySearch)

    return universities.filter((university) => {
      const label = `${university.name} ${university.shortName} ${university.city}`
      return normalizeSearch(label).includes(query)
    })
  }, [universities, universitySearch])

  const filteredPrograms = useMemo(() => {
    const query = normalizeSearch(programSearch)

    return programs.filter((program) => {
      const label = `${program.name} ${program.direction ?? ''}`
      return normalizeSearch(label).includes(query)
    })
  }, [programs, programSearch])

  useEffect(() => {
    const guestProfile = getGuestProfile()

    if (guestProfile) {
      setGrade(guestProfile.grade)
      setRegion(guestProfile.region)
      setRegionSearch(guestProfile.region)
      setSubjects(guestProfile.subjects as SubjectId[])
      setTargetUniversityId(guestProfile.targetUniversityId)
      setTargetProgramId(guestProfile.targetProgramId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadUniversities() {
      setUniversitiesLoading(true)
      setUniversitiesError(null)

      try {
        const result = await universityService.getAll()

        if (!cancelled) {
          setUniversities(result)
        }
      } catch {
        if (!cancelled) {
          setUniversitiesError('Не удалось загрузить список вузов. Можно повторить загрузку или пропустить этот шаг.')
        }
      } finally {
        if (!cancelled) {
          setUniversitiesLoading(false)
        }
      }
    }

    void loadUniversities()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (authLoading || !session?.access_token || getGuestProfile()) {
        return
      }

      try {
        const profile = await getAuthenticatedProfile(session.access_token)

        if (!cancelled && profile) {
          setGrade(profile.grade)
          setRegion(profile.region)
          setRegionSearch(profile.region)
          setSubjects(profile.subjects as SubjectId[])
          setTargetUniversityId(profile.targetUniversityId)
          setTargetProgramId(profile.targetProgramId)
        }
      } catch {
        // Existing answers remain editable even when the profile endpoint is unavailable.
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token])

  const toggleSubject = (subjectId: SubjectId) => {
    setSubjects((current) => current.includes(subjectId)
      ? current.filter((item) => item !== subjectId)
      : [...current, subjectId]
    )
    setError(null)
  }

  const handleBack = () => {
    setError(null)
    setStep((current) => Math.max(1, current - 1))
  }

  const handleContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (step === 1) {
      if (grade === null) {
        setError('Выбери свой класс, чтобы продолжить.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      const cleanRegion = region.trim()
      if (cleanRegion.length < 2) {
        setError('Укажи регион обучения или выбери его из списка.')
        return
      }
      setRegion(cleanRegion)
      setRegionSearch(cleanRegion)
      setStep(3)
      return
    }

    if (step === 3) {
      if (subjects.length === 0) {
        setError('Выбери хотя бы один предмет.')
        return
      }
      setStep(4)
      return
    }

    if (step === 4) {
      if (!targetUniversityId) {
        setTargetProgramId(undefined)
      }
      setStep(5)
      return
    }

    if (grade === null || region.trim().length < 2 || subjects.length === 0) {
      setError('Проверь класс, регион и выбранные предметы.')
      return
    }

    if (targetProgramId && !targetUniversityId) {
      setError('Сначала выбери вуз или сбрось выбранное направление.')
      return
    }

    const profile: CreateProfileInput = {
      grade,
      region: region.trim(),
      subjects,
      ...(targetUniversityId ? { targetUniversityId } : {}),
      ...(targetUniversityId && targetProgramId ? { targetProgramId } : {})
    }

    setSaving(true)

    try {
      saveGuestProfile(profile)

      if (session?.access_token) {
        await saveAuthenticatedProfile(profile, session.access_token)
      }

      navigate('/profile', { replace: true })
    } catch {
      setError(session?.access_token
        ? 'Анкета сохранена на этом устройстве, но не удалось обновить профиль. Проверь соединение и попробуй ещё раз.'
        : 'Не удалось сохранить анкету. Проверь настройки браузера и доступ к локальному хранилищу.'
      )
      setSaving(false)
    }
  }

  const selectUniversity = (university: University) => {
    setTargetUniversityId(university.id)
    setTargetProgramId(undefined)
    setUniversitySearch(university.name)
    setProgramSearch('')
    setError(null)
  }

  const clearUniversity = () => {
    setTargetUniversityId(undefined)
    setTargetProgramId(undefined)
    setUniversitySearch('')
    setProgramSearch('')
    setError(null)
  }

  const selectProgram = (program: UniversityProgram) => {
    setTargetProgramId(program.id)
    setProgramSearch(program.name)
    setError(null)
  }

  return (
    <div className="dashboard-container onboarding-page">
      <PageHeader
        eyebrow="ПЕРСОНАЛЬНАЯ НАСТРОЙКА"
        title="Построим твою траекторию"
        description="Ответь на пять коротких вопросов — подберём олимпиады под твои интересы и цель поступления."
      />

      <section className="onboarding-wizard" aria-label="Анкета для построения траектории">
        <div className="onboarding-progress-panel">
          <div className="onboarding-progress-top">
            <div>
              <span className="onboarding-progress-caption">ТВОЙ ПРОГРЕСС</span>
              <strong>Шаг {step} из 5</strong>
            </div>
            <span className="onboarding-progress-percent">{step * 20}%</span>
          </div>
          <div className="onboarding-progress-segments" aria-label={`Пройдено ${step} из 5 шагов`}>
            {GRADES.map((item, index) => (
              <span
                key={item}
                className={index < step ? 'is-complete' : ''}
              />
            ))}
          </div>
        </div>

        <form className="onboarding-step-card panel" onSubmit={handleContinue}>
          <div className="onboarding-step-heading">
            <div className="onboarding-step-icon">
              {step === 1 && <GraduationCap size={23} />}
              {step === 2 && <MapPin size={23} />}
              {step === 3 && <Sparkles size={23} />}
              {step === 4 && <Landmark size={23} />}
              {step === 5 && <GraduationCap size={23} />}
            </div>
            <div className="onboarding-step-title-wrap">
              <div className="onboarding-step-kicker">
                ВОПРОС {step}
                {step >= 4 && <span className="onboarding-optional-tag">Можно пропустить</span>}
              </div>
              <h2>{stepMeta.title}</h2>
              <p>{stepMeta.description}</p>
            </div>
          </div>

          <div className="onboarding-step-content" key={step}>
            {step === 1 && (
              <div className="onboarding-grade-grid">
                {GRADES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`onboarding-grade-card${grade === item ? ' is-selected' : ''}`}
                    onClick={() => {
                      setGrade(item)
                      setError(null)
                    }}
                    aria-pressed={grade === item}
                  >
                    <strong>{item}</strong>
                    <span>класс</span>
                    {grade === item && <Check className="onboarding-selected-check" size={17} />}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="onboarding-field-block">
                <label className="onboarding-label" htmlFor="onboarding-region-search">
                  Регион обучения
                </label>
                <div className="onboarding-search-field">
                  <Search size={18} />
                  <input
                    id="onboarding-region-search"
                    type="search"
                    value={regionSearch}
                    onChange={(event) => {
                      setRegionSearch(event.target.value)
                      setRegion(event.target.value)
                      setError(null)
                    }}
                    placeholder="Начни вводить название региона"
                    autoComplete="off"
                    maxLength={120}
                  />
                  {regionSearch && (
                    <button
                      type="button"
                      className="onboarding-clear-search"
                      onClick={() => {
                        setRegionSearch('')
                        setRegion('')
                      }}
                      aria-label="Очистить поиск региона"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="onboarding-option-list onboarding-region-list">
                  {filteredRegions.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`onboarding-list-option${region === item ? ' is-selected' : ''}`}
                      onClick={() => {
                        setRegion(item)
                        setRegionSearch(item)
                        setError(null)
                      }}
                    >
                      <span>{item}</span>
                      {region === item ? <Check size={17} /> : <ChevronRight size={16} />}
                    </button>
                  ))}
                  {filteredRegions.length === 0 && regionSearch.trim().length >= 2 && (
                    <button
                      type="button"
                      className="onboarding-custom-region"
                      onClick={() => {
                        setRegion(regionSearch.trim())
                        setError(null)
                      }}
                    >
                      Использовать «{regionSearch.trim()}»
                      <Check size={16} />
                    </button>
                  )}
                </div>
                <p className="onboarding-field-note">
                  Не нашёл свой регион? Введи название полностью — можно указать его вручную.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="onboarding-subject-grid">
                {SUBJECTS.map((subject) => {
                  const id = subject.id as SubjectId
                  const Icon = SUBJECT_ICONS[id]
                  const selected = subjects.includes(id)

                  return (
                    <button
                      key={subject.id}
                      type="button"
                      className={`onboarding-subject-card${selected ? ' is-selected' : ''}`}
                      onClick={() => toggleSubject(id)}
                      aria-pressed={selected}
                    >
                      <span className="onboarding-subject-icon"><Icon size={21} /></span>
                      <span className="onboarding-subject-copy">
                        <strong>{subject.label}</strong>
                        <small>{SUBJECT_DESCRIPTIONS[id]}</small>
                      </span>
                      <span className="onboarding-subject-check">
                        {selected && <Check size={14} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 4 && (
              <div className="onboarding-field-block">
                <label className="onboarding-label" htmlFor="onboarding-university-search">
                  Поиск университета
                </label>
                <div className="onboarding-search-field">
                  <Search size={18} />
                  <input
                    id="onboarding-university-search"
                    type="search"
                    value={universitySearch}
                    onChange={(event) => setUniversitySearch(event.target.value)}
                    placeholder="Название вуза или город"
                    autoComplete="off"
                  />
                  {universitySearch && (
                    <button
                      type="button"
                      className="onboarding-clear-search"
                      onClick={() => setUniversitySearch('')}
                      aria-label="Очистить поиск вуза"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {universitiesLoading && (
                  <div className="onboarding-inline-state">Загружаем список университетов…</div>
                )}

                {universitiesError && (
                  <div className="onboarding-inline-error" role="alert">
                    <span>{universitiesError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUniversitiesError(null)
                        setUniversitiesLoading(true)
                        void universityService.getAll()
                          .then(setUniversities)
                          .catch(() => setUniversitiesError('Список вузов пока недоступен. Попробуй позже.'))
                          .finally(() => setUniversitiesLoading(false))
                      }}
                    >
                      Повторить
                    </button>
                  </div>
                )}

                <div className="onboarding-university-grid">
                  {filteredUniversities.map((university) => {
                    const selected = targetUniversityId === university.id

                    return (
                      <button
                        type="button"
                        key={university.id}
                        className={`onboarding-university-card${selected ? ' is-selected' : ''}`}
                        onClick={() => selectUniversity(university)}
                        aria-pressed={selected}
                      >
                        <span className="onboarding-university-icon"><GraduationCap size={21} /></span>
                        <span className="onboarding-university-copy">
                          <strong>{university.shortName}</strong>
                          <small>{university.name}</small>
                          <small>{university.city}</small>
                        </span>
                        <span className="onboarding-subject-check">
                          {selected && <Check size={14} />}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {!universitiesLoading && !universitiesError && filteredUniversities.length === 0 && (
                  <div className="onboarding-empty-state">
                    {universities.length === 0
                      ? 'Список вузов пока пуст. Можно продолжить без выбора университета.'
                      : 'По такому запросу ничего не найдено. Попробуй другое название.'}
                  </div>
                )}

                {selectedUniversity && (
                  <div className="onboarding-selected-summary">
                    <span>Выбран вуз: <strong>{selectedUniversity.shortName}</strong></span>
                    <button type="button" onClick={clearUniversity}>
                      Убрать выбор
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="onboarding-field-block">
                {!selectedUniversity ? (
                  <div className="onboarding-no-university">
                    <div className="onboarding-no-university-icon"><GraduationCap size={25} /></div>
                    <div>
                      <strong>Сначала можно выбрать вуз</strong>
                      <p>Ты пропустил предыдущий шаг. Направление можно будет добавить позже в профиле.</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setStep(4)}
                    >
                      Выбрать вуз
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="onboarding-selected-university-banner">
                      <span className="onboarding-university-icon"><GraduationCap size={20} /></span>
                      <span>
                        <small>ВЫБРАННЫЙ ВУЗ</small>
                        <strong>{selectedUniversity.shortName}</strong>
                      </span>
                      <button type="button" onClick={clearUniversity} aria-label="Сбросить выбранный вуз">
                        <X size={17} />
                      </button>
                    </div>
                    <label className="onboarding-label" htmlFor="onboarding-program-search">
                      Поиск образовательной программы
                    </label>
                    <div className="onboarding-search-field">
                      <Search size={18} />
                      <input
                        id="onboarding-program-search"
                        type="search"
                        value={programSearch}
                        onChange={(event) => setProgramSearch(event.target.value)}
                        placeholder="Название программы или код направления"
                        autoComplete="off"
                      />
                      {programSearch && (
                        <button
                          type="button"
                          className="onboarding-clear-search"
                          onClick={() => setProgramSearch('')}
                          aria-label="Очистить поиск программы"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="onboarding-option-list onboarding-program-list">
                      {filteredPrograms.map((program) => {
                        const selected = targetProgramId === program.id

                        return (
                          <button
                            type="button"
                            key={program.id}
                            className={`onboarding-list-option${selected ? ' is-selected' : ''}`}
                            onClick={() => selectProgram(program)}
                          >
                            <span>
                              <strong>{program.name}</strong>
                              {program.direction && <small>Направление {program.direction}</small>}
                            </span>
                            {selected ? <Check size={17} /> : <ChevronRight size={16} />}
                          </button>
                        )
                      })}
                      {filteredPrograms.length === 0 && (
                        <div className="onboarding-empty-state">
                          {programs.length === 0
                            ? 'У выбранного вуза пока нет списка программ. Можно продолжить без выбора.'
                            : 'Программы по такому запросу не найдены.'}
                        </div>
                      )}
                    </div>
                    {selectedProgram && (
                      <div className="onboarding-selected-summary">
                        <span>Выбрано: <strong>{selectedProgram.name}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetProgramId(undefined)
                            setProgramSearch('')
                          }}
                        >
                          Убрать
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="onboarding-why-note">
            <Sparkles size={16} />
            <span><strong>Зачем это нужно:</strong> {stepMeta.hint}</span>
          </div>

          {error && <div className="onboarding-error" role="alert">{error}</div>}

          <div className="onboarding-actions">
            <div className="onboarding-actions-left">
              {step > 1 ? (
                <button type="button" className="secondary-button onboarding-back-button" onClick={handleBack}>
                  <ArrowLeft size={16} />
                  Назад
                </button>
              ) : (
                <span className="onboarding-required-note">Поля с выбором обязательны на шагах 1–3</span>
              )}
            </div>
            <button type="submit" className="primary-button onboarding-next-button" disabled={saving}>
              {saving
                ? 'Сохраняем…'
                : step === 5
                  ? 'Построить мою траекторию'
                  : step >= 4 && !targetUniversityId
                    ? 'Пропустить'
                    : 'Продолжить'}
              {saving ? null : <ArrowRight size={17} />}
            </button>
          </div>
        </form>

        <div className="onboarding-footnote">
          <span>Твои ответы можно будет изменить в профиле в любое время.</span>
          {step === 5 && targetUniversityId && (
            <span>{selectedProgram ? 'Программа выбрана' : 'Выбор программы необязателен'}</span>
          )}
        </div>
      </section>
    </div>
  )
}
