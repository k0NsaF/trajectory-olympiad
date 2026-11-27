import type {
  TrajectoryPlanDraft,
  TrajectoryStageDraft,
  TrajectoryTaskDraft
} from './trajectory.types.js'
import { AppError } from '../../utils/AppError.js'

export interface TrajectoryProfileInput {
  id: string
  updatedAt: string
  grade?: number
  region?: string
  subjects: string[]
  weeklyStudyHours?: number
  targetAdmissionYear?: number
  targetEducationLevel?: 'bachelor' | 'specialist' | 'master' | 'basic_higher' | 'specialized_higher'
  targetUniversityId?: string
  targetProgramId?: string
  subjectPreparation: Array<{
    subjectId: string
    preparationLevel: 'beginner' | 'medium' | 'advanced'
  }>
  alternativeUniversityIds: string[]
}

export interface TrajectoryOlympiadBenefitInput {
  id: string
  universityId: string
  universityName: string
  universityShortName: string
  programId?: string
  programName?: string
  rightType: 'BVI' | '100_points' | 'extra_points'
  forStatus: 'winner' | 'prize' | 'both'
  levelRequired?: number
  confirmExamSubject?: string
  confirmExamThreshold?: number
  resultClassRequired?: number
  validYear: number
  sourceUrl: string
  lastCheckedAt: string
}

export interface TrajectoryOlympiadInput {
  id: string
  name: string
  organizer: string
  listType: 'school_olympiad' | 'intellectual_competition'
  sourceStatus?: 'official' | 'needs_review' | 'archived'
  sourceDocumentUrl?: string
  sourceDocumentTitle?: string
  sourceCheckedAt?: string
  subjects: string[]
  grades: number[]
  website?: string
  status: 'eligible' | 'upcoming' | 'closed' | 'unknown'
  benefits?: TrajectoryOlympiadBenefitInput[]
  season?: {
    academicYear: string
    stages: Array<{
      id: string
      type: 'registration' | 'qualifying' | 'final'
      startDate: string
      endDate: string
      format: 'online' | 'offline' | 'mixed'
      regionScope?: string[]
    }>
  }
}

export interface TrajectoryUniversityInput {
  id: string
  name: string
  website?: string | null
  minobrnauki_admission_url?: string | null
  minobrnauki_rules_url?: string | null
}

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'математика',
  informatics: 'информатика',
  physics: 'физика',
  biology: 'биология',
  chemistry: 'химия',
  economics: 'экономика',
  russian: 'русский язык',
  history: 'история',
  social_studies: 'обществознание',
  foreign_language: 'иностранный язык'
}

const PREPARATION_WEIGHTS = {
  beginner: 1.5,
  medium: 1,
  advanced: 0.7,
  not_set: 1.2
} as const

// Official olympiad schedules are time-sensitive; admissions benefits change
// less frequently but still require a recent check for the target admission year.
const OLYMPIAD_SOURCE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const BENEFIT_SOURCE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
const SOURCE_CLOCK_SKEW_MS = 5 * 60 * 1000

function isRecentSourceVerification(
  value: string | undefined,
  now: Date,
  maximumAgeMs: number
): boolean {
  if (!value) return false
  const checkedAt = new Date(value)
  if (Number.isNaN(checkedAt.getTime())) return false
  const ageMs = now.getTime() - checkedAt.getTime()
  return ageMs >= -SOURCE_CLOCK_SKEW_MS && ageMs <= maximumAgeMs
}

function fail(message: string, code: string): never {
  throw new AppError(message, 422, code)
}

export function validateTrajectoryProfile(profile: TrajectoryProfileInput): asserts profile is TrajectoryProfileInput & {
  grade: number
  region: string
  weeklyStudyHours: number
  targetAdmissionYear: number
  targetEducationLevel: 'bachelor' | 'specialist'
} {
  if (!Number.isInteger(profile.grade) || profile.grade === undefined || profile.grade < 7 || profile.grade > 11) {
    fail('Укажи класс обучения от 7 до 11 в профиле.', 'TRAJECTORY_PROFILE_GRADE_REQUIRED')
  }

  if (!profile.region?.trim()) {
    fail('Укажи регион проживания в профиле.', 'TRAJECTORY_PROFILE_REGION_REQUIRED')
  }

  if (!profile.updatedAt || Number.isNaN(new Date(profile.updatedAt).getTime())) {
    fail('Не удалось проверить актуальность профиля. Обнови страницу и повтори попытку.', 'TRAJECTORY_PROFILE_TIMESTAMP_INVALID')
  }

  if (!Array.isArray(profile.subjects) || profile.subjects.length < 1 || profile.subjects.length > 10) {
    fail('Выбери от одного до десяти учебных предметов в профиле.', 'TRAJECTORY_PROFILE_SUBJECTS_REQUIRED')
  }

  const validSubjectIds = new Set(Object.keys(SUBJECT_LABELS))
  if (
    profile.subjects.some((subjectId) => !validSubjectIds.has(subjectId)) ||
    new Set(profile.subjects).size !== profile.subjects.length
  ) {
    fail('В профиле обнаружены неизвестные или повторяющиеся предметы. Обнови список предметов.', 'TRAJECTORY_PROFILE_SUBJECTS_INVALID')
  }

  const preparedSubjects = profile.subjectPreparation.map((item) => item.subjectId)
  if (
    new Set(preparedSubjects).size !== preparedSubjects.length ||
    profile.subjectPreparation.some((item) =>
      !profile.subjects.includes(item.subjectId) ||
      !['beginner', 'medium', 'advanced'].includes(item.preparationLevel)
    )
  ) {
    fail('Настройки уровня подготовки не соответствуют выбранным предметам. Проверь профиль.', 'TRAJECTORY_PROFILE_PREPARATION_INVALID')
  }

  if (profile.alternativeUniversityIds.length > 3 ||
      new Set(profile.alternativeUniversityIds).size !== profile.alternativeUniversityIds.length ||
      (profile.targetUniversityId && profile.alternativeUniversityIds.includes(profile.targetUniversityId))) {
    fail('Проверь основной и альтернативные университеты в профиле.', 'TRAJECTORY_PROFILE_UNIVERSITIES_INVALID')
  }

  if (!Number.isInteger(profile.weeklyStudyHours) || profile.weeklyStudyHours === undefined || profile.weeklyStudyHours < 1 || profile.weeklyStudyHours > 40) {
    fail('Укажи доступное время для занятий: от 1 до 40 часов в неделю.', 'TRAJECTORY_PROFILE_WEEKLY_HOURS_REQUIRED')
  }

  if (!Number.isInteger(profile.targetAdmissionYear) || profile.targetAdmissionYear === undefined || profile.targetAdmissionYear < 2026 || profile.targetAdmissionYear > 2100) {
    fail('Укажи год предполагаемого поступления в профиле.', 'TRAJECTORY_PROFILE_ADMISSION_YEAR_REQUIRED')
  }

  if (profile.targetProgramId && !profile.targetUniversityId) {
    fail('Для выбранной образовательной программы необходимо указать основной университет.', 'TRAJECTORY_PROFILE_PROGRAM_WITHOUT_UNIVERSITY')
  }

  if (
    profile.targetEducationLevel === 'master' ||
    profile.targetEducationLevel === 'specialized_higher'
  ) {
    fail(
      'Магистратура является следующим этапом после получения высшего образования. Специализированное высшее образование также не является уровнем поступления после школы.',
      'TRAJECTORY_MASTER_NOT_FOR_SCHOOL_STUDENT'
    )
  }

  if (
    profile.targetEducationLevel !== 'bachelor' &&
    profile.targetEducationLevel !== 'specialist' &&
    profile.targetEducationLevel !== 'basic_higher'
  ) {
    fail(
      '\u0412\u044b\u0431\u0435\u0440\u0438 \u0431\u0430\u043a\u0430\u043b\u0430\u0432\u0440\u0438\u0430\u0442, \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0442\u0435\u0442 \u0438\u043b\u0438 \u0431\u0430\u0437\u043e\u0432\u043e\u0435 \u0432\u044b\u0441\u0448\u0435\u0435 \u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435.',
      'TRAJECTORY_PROFILE_EDUCATION_LEVEL_REQUIRED'
    )
  }
}


const ADMISSION_LEVEL_LABELS = {
  bachelor: '\u0411\u0430\u043a\u0430\u043b\u0430\u0432\u0440\u0438\u0430\u0442',
  specialist: '\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0442\u0435\u0442',
  master: '\u041c\u0430\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u0443\u0440\u0430',
  basic_higher: '\u0411\u0430\u0437\u043e\u0432\u043e\u0435 \u0432\u044b\u0441\u0448\u0435\u0435 \u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435',
  specialized_higher: '\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435 \u0432\u044b\u0441\u0448\u0435\u0435 \u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435'
} as const
function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ')
}

function matchesRegion(regionScopes: string[] | undefined, region: string): boolean {
  if (!regionScopes?.length) return true

  const normalizedRegion = normalizeText(region)
  const allRegions = new Set([
    'all',
    'все',
    'все регионы',
    'россия',
    'вся россия',
    'любой регион',
    'российская федерация'
  ])

  return regionScopes.some((scope) => {
    const normalizedScope = normalizeText(scope)
    return allRegions.has(normalizedScope) || normalizedScope === normalizedRegion
  })
}

function parseDateOnly(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return undefined
  }

  return value
}

function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password
  } catch {
    return false
  }
}

function fitText(value: string, maximumLength: number): string {
  const characters = Array.from(value)
  if (characters.length <= maximumLength) return value
  return `${characters.slice(0, maximumLength - 1).join('').trimEnd()}…`
}

function benefitRightLabel(rightType: TrajectoryOlympiadBenefitInput['rightType']): string {
  switch (rightType) {
    case 'BVI': return 'право на приём без вступительных испытаний (БВИ)'
    case '100_points': return 'зачёт результата олимпиады как 100 баллов по подтверждающему предмету'
    case 'extra_points': return 'дополнительные баллы при поступлении'
  }
}

function benefitResultLabel(forStatus: TrajectoryOlympiadBenefitInput['forStatus']): string {
  switch (forStatus) {
    case 'winner': return 'победителя'
    case 'prize': return 'призёра'
    case 'both': return 'победителя или призёра'
  }
}

function isOfficialCurrentOlympiad(
  olympiad: TrajectoryOlympiadInput,
  region: string,
  academicYear: string,
  now: Date
): boolean {
  const hasValidVerificationDate = isRecentSourceVerification(
    olympiad.sourceCheckedAt,
    now,
    OLYMPIAD_SOURCE_MAX_AGE_MS
  )
  const restrictedScopes = (olympiad.season?.stages ?? [])
    .map((stage) => stage.regionScope)
    .filter((scope): scope is string[] => Boolean(scope && scope.length > 0))
  const regionMatches = restrictedScopes.length === 0 ||
    restrictedScopes.some((scope) => matchesRegion(scope, region))

  return olympiad.listType === 'school_olympiad' &&
    olympiad.sourceStatus === 'official' &&
    Boolean(hasValidVerificationDate) &&
    (isHttpsUrl(olympiad.website) || isHttpsUrl(olympiad.sourceDocumentUrl)) &&
    Boolean(olympiad.season && olympiad.season.academicYear === academicYear) &&
    regionMatches
}

function getRegistrationWindow(
  olympiad: TrajectoryOlympiadInput,
  region: string,
  today: string,
  academicYear: string,
  now: Date
): { startDate: string; endDate: string } | null {
  if (
    !isOfficialCurrentOlympiad(olympiad, region, academicYear, now) ||
    !olympiad.season ||
    !['eligible', 'upcoming'].includes(olympiad.status)
  ) return null

  const registrations = olympiad.season.stages
    .filter((stage) => stage.type === 'registration' && matchesRegion(stage.regionScope, region))
    .flatMap((stage) => {
      const startDate = parseDateOnly(stage.startDate)
      const endDate = parseDateOnly(stage.endDate)
      if (!startDate || !endDate || endDate < startDate || endDate < today) return []
      return [{ startDate, endDate }]
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  return registrations[0] ?? null
}

export function allocateWeeklyMinutes(
  subjects: string[],
  weeklyStudyHours: number,
  preparation: TrajectoryProfileInput['subjectPreparation']
): Record<string, number> {
  if (subjects.length === 0 || !Number.isInteger(weeklyStudyHours) || weeklyStudyHours < 1) {
    return {}
  }

  const preparationBySubject = new Map(
    preparation.map((item) => [item.subjectId, item.preparationLevel] as const)
  )
  const totalMinutes = weeklyStudyHours * 60
  const baseMinutes = 5
  const distributableMinutes = totalMinutes - subjects.length * baseMinutes
  const totalWeight = subjects.reduce((sum, subjectId) => {
    const level = preparationBySubject.get(subjectId) ?? 'not_set'
    return sum + PREPARATION_WEIGHTS[level]
  }, 0)

  const weighted = subjects.map((subjectId, index) => {
    const level = preparationBySubject.get(subjectId) ?? 'not_set'
    const exactShare = distributableMinutes * PREPARATION_WEIGHTS[level] / totalWeight
    const roundedDownShare = Math.floor(exactShare)

    return {
      subjectId,
      index,
      minutes: baseMinutes + roundedDownShare,
      remainder: exactShare - roundedDownShare
    }
  })

  let remaining = totalMinutes - weighted.reduce((sum, item) => sum + item.minutes, 0)
  const distributionOrder = [...weighted].sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  let cursor = 0
  while (remaining > 0 && distributionOrder.length > 0) {
    const recipient = distributionOrder[cursor % distributionOrder.length]
    if (!recipient) break
    recipient.minutes += 1
    remaining -= 1
    cursor += 1
  }

  // Five minutes per selected subject is reserved first; every remaining minute
  // is apportioned by preparation weight. This guarantees the exact weekly total.
  return Object.fromEntries(weighted.map((item) => [item.subjectId, item.minutes]))
}

function currentAcademicYear(now: Date): string {
  const year = now.getUTCFullYear()
  const start = now.getUTCMonth() >= 8 ? year : year - 1
  return `${start}-${start + 1}`
}

function profileFingerprint(profile: TrajectoryProfileInput): string {
  const canonical = JSON.stringify({
    grade: profile.grade,
    region: normalizeText(profile.region ?? ''),
    subjects: [...profile.subjects].sort(),
    weeklyStudyHours: profile.weeklyStudyHours,
    targetAdmissionYear: profile.targetAdmissionYear,
    targetEducationLevel: profile.targetEducationLevel,
    targetUniversityId: profile.targetUniversityId ?? null,
    targetProgramId: profile.targetProgramId ?? null,
    alternativeUniversityIds: profile.alternativeUniversityIds,
    subjectPreparation: [...profile.subjectPreparation]
      .sort((a, b) => a.subjectId.localeCompare(b.subjectId))
  })

  // A deterministic 64-bit fingerprint keeps stable keys short while changing
  // whenever any planning-relevant profile setting changes.
  let hash = 14695981039346656037n
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}

function task(
  stableKey: string,
  title: string,
  taskType: TrajectoryTaskDraft['taskType'],
  priority: TrajectoryTaskDraft['priority'],
  description: string,
  extra: Partial<TrajectoryTaskDraft> = {}
): TrajectoryTaskDraft {
  return {
    stableKey,
    title: fitText(title, 240),
    description: fitText(description, 2_400),
    taskType,
    priority,
    estimatedMinutes: taskType === 'study' ? 45 : 30,
    ...extra
  }
}

export function buildTrajectoryPlanDraft(
  profile: TrajectoryProfileInput,
  olympiads: TrajectoryOlympiadInput[],
  universities: TrajectoryUniversityInput[],
  requestId: string,
  now = new Date()
): TrajectoryPlanDraft {
  validateTrajectoryProfile(profile)

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    fail('Не удалось подготовить идентификатор запроса. Обнови страницу и повтори попытку.', 'TRAJECTORY_INVALID_REQUEST_ID')
  }

  const preparationBySubject = new Map(
    profile.subjectPreparation.map((item) => [item.subjectId, item.preparationLevel] as const)
  )
  const currentYear = now.getUTCFullYear()
  const minimumAdmissionYear = now.getUTCMonth() >= 8
    ? currentYear + 1
    : currentYear
  if (profile.targetAdmissionYear < minimumAdmissionYear) {
    fail(`Год поступления уже недоступен для нового плана. Выбери ${minimumAdmissionYear} год или позднее.`, 'TRAJECTORY_ADMISSION_YEAR_IN_PAST')
  }

  const weeklyAllocation = allocateWeeklyMinutes(
    profile.subjects,
    profile.weeklyStudyHours,
    profile.subjectPreparation
  )
  const snapshot = {
    grade: profile.grade,
    region: profile.region.trim(),
    subjects: [...profile.subjects],
    weeklyStudyHours: profile.weeklyStudyHours,
    targetAdmissionYear: profile.targetAdmissionYear,
    targetEducationLevel: profile.targetEducationLevel,
    ...(profile.targetUniversityId ? { targetUniversityId: profile.targetUniversityId } : {}),
    ...(profile.targetProgramId ? { targetProgramId: profile.targetProgramId } : {}),
    alternativeUniversityIds: [...profile.alternativeUniversityIds],
    subjectPreparation: profile.subjectPreparation.map((item) => ({ ...item }))
  }

  const stages: TrajectoryStageDraft[] = []
  const primaryUniversity = universities.find((item) => item.id === profile.targetUniversityId)
  const selectedUniversities = [
    ...(profile.targetUniversityId ? [profile.targetUniversityId] : []),
    ...profile.alternativeUniversityIds.filter((id) => id !== profile.targetUniversityId)
  ]
    .map((id) => universities.find((item) => item.id === id))
    .filter((item): item is TrajectoryUniversityInput => Boolean(item))

  const foundationTasks: TrajectoryTaskDraft[] = []
  if (profile.targetUniversityId && profile.targetProgramId) {
    foundationTasks.push(task(
      `goal:confirm-program:${profile.targetUniversityId}:${profile.targetProgramId}`,
      'Проверить выбранную образовательную программу',
      'research',
      'high',
      `Сверь название, уровень образования и содержание программы${primaryUniversity ? ` в ${primaryUniversity.name}` : ''}. Условия поступления проверяй по официальным правилам выбранного года.`,
      {
        relatedUniversityId: profile.targetUniversityId,
        relatedProgramId: profile.targetProgramId
      }
    ))
  } else if (profile.targetUniversityId) {
    foundationTasks.push(task(
      `goal:choose-program:${profile.targetUniversityId}`,
      'Выбрать конкретную образовательную программу',
      'research',
      'high',
      `Изучи программы ${primaryUniversity?.name ?? 'выбранного университета'} и выбери те, которые соответствуют интересам и предметам.` ,
      { relatedUniversityId: profile.targetUniversityId }
    ))
  } else {
    foundationTasks.push(task(
      'goal:shortlist-universities',
      'Сформировать список приоритетных университетов',
      'research',
      'high',
      'Сравни несколько вузов по образовательным программам, городу, условиям обучения и официальным требованиям приёма.'
    ))
  }
  foundationTasks.push(task(
    `goal:review-profile:${profileFingerprint(profile)}`,
    'Перепроверить исходные настройки траектории',
    'review',
    'medium',
    `Проверь класс, регион, выбранные предметы и недельную нагрузку (${profile.weeklyStudyHours} ч). При изменении цели обнови профиль перед следующим пересчётом.`
  ))
  stages.push({
    stableKey: 'foundation',
    stageType: 'foundation',
    title: 'Цель и стартовые условия',
    description: 'Проверка направления движения и исходных настроек.',
    tasks: foundationTasks
  })

  const subjectTasks = profile.subjects.map((subjectId) => {
    const level = preparationBySubject.get(subjectId)
    const subjectName = SUBJECT_LABELS[subjectId] ?? subjectId
    const levelText = level === 'beginner'
      ? 'Начни с базовых тем и постепенно переходи к заданиям повышенной сложности.'
      : level === 'advanced'
        ? 'Сосредоточься на сложных задачах, разборе ошибок и поддержании стабильного уровня.'
        : level === 'medium'
          ? 'Чередуй повторение теории и решение практических заданий.'
          : 'Сначала оцени текущий уровень, затем выбери подходящую сложность материалов.'

    return task(
      `subject:${subjectId}:weekly-focus:${level ?? 'not_set'}:${weeklyAllocation[subjectId]}`,
      `Выделить время на ${subjectName}`,
      'study',
      level === 'beginner' ? 'high' : 'medium',
      `${levelText} Рекомендуемое распределение нагрузки — ${weeklyAllocation[subjectId]} минут в неделю. Это ориентир по времени, а не утверждение о требованиях конкретной программы.`,
      {
        weeklyMinutes: weeklyAllocation[subjectId],
        estimatedMinutes: Math.min(45, weeklyAllocation[subjectId])
      }
    )
  })
  stages.push({
    stableKey: 'subject-preparation',
    stageType: 'subject_preparation',
    title: 'Подготовка по предметам',
    description: 'Распределение доступного учебного времени с приоритетом предметов, требующих большего внимания.',
    tasks: subjectTasks
  })

  const today = now.toISOString().slice(0, 10)
  const academicYear = currentAcademicYear(now)
  const suitableOlympiads = olympiads
    .filter((item) => item.grades.includes(profile.grade as number))
    .filter((item) => item.subjects.some((subject) => profile.subjects.includes(subject)))
    .map((item) => ({
      olympiad: item,
      registration: getRegistrationWindow(item, profile.region as string, today, academicYear, now)
    }))
    .filter((item): item is { olympiad: TrajectoryOlympiadInput; registration: { startDate: string; endDate: string } } => Boolean(item.registration))
    .sort((a, b) => a.registration.startDate.localeCompare(b.registration.startDate))
    .slice(0, 12)

  const olympiadTasks = suitableOlympiads.map(({ olympiad, registration }) => {
    const sourceUrl = isHttpsUrl(olympiad.website)
      ? olympiad.website
      : isHttpsUrl(olympiad.sourceDocumentUrl)
        ? olympiad.sourceDocumentUrl
        : undefined
    const isOpen = registration.startDate <= today && registration.endDate >= today

    return task(
      `olympiad:${olympiad.id}:registration:${registration.startDate}:${registration.endDate}`,
      `Проверить регистрацию: ${olympiad.name}`,
      'olympiad',
      isOpen ? 'high' : 'medium',
      `Подходит по указанным предметам и классу. Проверь актуальные условия участия, формат и регион на странице организатора. В каталоге указан подтверждённый период регистрации: ${registration.startDate} — ${registration.endDate}. Данные помечены как официально проверенные${olympiad.sourceCheckedAt ? ` (${olympiad.sourceCheckedAt.slice(0, 10)})` : ''}.`,
      {
        startDate: registration.startDate,
        dueDate: registration.endDate,
        relatedOlympiadId: olympiad.id,
        ...(sourceUrl ? {
          sourceUrl,
          sourceLabel: isHttpsUrl(olympiad.website) ? 'Сайт олимпиады' : 'Официальный документ перечня'
        } : {})
      }
    )
  })

  const selectedUniversityIds = new Set(selectedUniversities.map((university) => university.id))
  const benefitEligibleOlympiads = olympiads
    .filter((item) => item.grades.includes(profile.grade as number))
    .filter((item) => item.subjects.some((subject) => profile.subjects.includes(subject)))
    .filter((item) => isOfficialCurrentOlympiad(item, profile.region as string, academicYear, now))
  const benefitTasks: TrajectoryTaskDraft[] = benefitEligibleOlympiads.flatMap((olympiad) =>
    (olympiad.benefits ?? []).flatMap((benefit) => {
      const isPrimaryUniversity = benefit.universityId === profile.targetUniversityId
      const isSelectedUniversity = selectedUniversityIds.has(benefit.universityId)
      const matchesProgram = benefit.programId
        ? isPrimaryUniversity && Boolean(profile.targetProgramId) && benefit.programId === profile.targetProgramId
        : true
      const isCurrentBenefit = benefit.validYear === profile.targetAdmissionYear
      const hasVerifiedSource = isHttpsUrl(benefit.sourceUrl) &&
        isRecentSourceVerification(benefit.lastCheckedAt, now, BENEFIT_SOURCE_MAX_AGE_MS)

      if (!isSelectedUniversity || !matchesProgram || !isCurrentBenefit || !hasVerifiedSource) {
        return []
      }

      const conditionDetails = [
        `Запись в базе за ${benefit.validYear} год помечена как официально проверенная ${benefit.lastCheckedAt.slice(0, 10)}.`,
        `Вид права: ${benefitRightLabel(benefit.rightType)}.`,
        `Категория результата: ${benefitResultLabel(benefit.forStatus)}.`,
        benefit.levelRequired !== undefined ? `Требуемый уровень олимпиады: ${benefit.levelRequired}.` : undefined,
        benefit.resultClassRequired !== undefined ? `Класс получения результата: ${benefit.resultClassRequired}.` : undefined,
        benefit.confirmExamSubject ? `Подтверждающий предмет: ${SUBJECT_LABELS[benefit.confirmExamSubject] ?? benefit.confirmExamSubject}.` : undefined,
        benefit.confirmExamThreshold !== undefined ? `Порог подтверждения: ${benefit.confirmExamThreshold}.` : undefined,
        'Эта запись сама по себе не подтверждает право именно в твоём случае: сверь диплом, класс, предмет, программу и локальный акт университета.'
      ].filter((line): line is string => Boolean(line))

      return [task(
        `olympiad-benefit:${benefit.id}:${benefit.validYear}`,
        `Проверить условия олимпиады «${olympiad.name}» в ${benefit.universityShortName}`,
        'research',
        'high',
        conditionDetails.join(' '),
        {
          relatedOlympiadId: olympiad.id,
          relatedUniversityId: benefit.universityId,
          ...(benefit.programId ? { relatedProgramId: benefit.programId } : {}),
          sourceUrl: benefit.sourceUrl,
          sourceLabel: `Официальные условия приёма · ${benefit.validYear} год`
        }
      )]
    })
  )
  olympiadTasks.push(...benefitTasks)

  if (selectedUniversityIds.size > 0 && benefitTasks.length === 0) {
    olympiadTasks.push(task(
      `olympiad-benefit:check-selected-universities:${profile.targetAdmissionYear}:${profileFingerprint(profile)}`,
      'Проверить льготы за олимпиады в выбранных университетах',
      'research',
      'medium',
      `В базе пока нет подходящих официально проверенных условий льгот для выбранных университетов и ${profile.targetAdmissionYear} года. Это не означает, что льгот нет: проверь локальные акты приёмных комиссий по конкретной программе и не переноси автоматически прошлогодние правила.`
    ))
  }

  if (suitableOlympiads.length === 0) {
    olympiadTasks.push(task(
      `olympiads:check-official-calendar:${academicYear}`,
      'Проверять публикацию подходящих олимпиад',
      'review',
      'medium',
      'Сейчас в данных текущего сезона нет мероприятий, одновременно подходящих по классу и предметам и имеющих подтверждённый статус и даты регистрации. Новые даты появятся в плане только после проверки источника.'
    ))
  }
  stages.push({
    stableKey: 'olympiads',
    stageType: 'olympiads',
    title: 'Школьные олимпиады',
    description: 'В план включаются только школьные олимпиады из подтверждённого перечня Минобрнауки с подходящими классом, предметами и периодом регистрации. Иные конкурсы не трактуются как олимпиады и не дают автоматически права на льготы при поступлении.',
    tasks: olympiadTasks
  })

  stages.push({
    stableKey: 'portfolio',
    stageType: 'portfolio',
    title: 'Достижения и портфолио',
    description: 'Постепенное формирование подтверждённой истории учебных и проектных результатов.',
    tasks: [task(
      'portfolio:collect-evidence',
      'Сохранять подтверждения достижений',
      'portfolio',
      'low',
      'Сохраняй дипломы, сертификаты, ссылки на проекты и сведения об участии. Не указывай неподтверждённые результаты как достижения.'
    )]
  })

  if (profile.grade >= 9) {
    stages.push({
      stableKey: 'exam-preparation',
      stageType: 'exam_preparation',
      title: 'Вступительные испытания и экзамены',
      description: 'Подготовка к проверке официальных требований по выбранным программам без предположений о составе ЕГЭ.',
      tasks: profile.subjects.map((subjectId) => {
        const subjectName = SUBJECT_LABELS[subjectId] ?? subjectId
        return task(
          `exam:verify-subject:${subjectId}:${profile.targetProgramId ?? profile.targetUniversityId ?? 'general'}:${profile.targetAdmissionYear}`,
          `Уточнить роль предмета «${subjectName}» при поступлении`,
          'exam',
          'medium',
          `Проверь по официальным правилам приёма на ${profile.targetAdmissionYear} год, требуется ли этот предмет для выбранных программ и как учитываются результаты.`
        )
      })
    })
  }

  const admissionTasks: TrajectoryTaskDraft[] = selectedUniversities.map((university) => {
    const url = [
      university.minobrnauki_admission_url,
      university.minobrnauki_rules_url,
      university.website
    ].find(isHttpsUrl)
    const isPrimary = university.id === profile.targetUniversityId

    return task(
      `admission:university:${university.id}${isPrimary && profile.targetProgramId ? `:program:${profile.targetProgramId}` : ''}:rules:${profile.targetAdmissionYear}`,
      `Проверить правила приёма ${profile.targetAdmissionYear} года: ${university.name}`,
      'application',
      isPrimary ? 'high' : 'medium',
      `Найди официальные правила приёма именно на ${profile.targetAdmissionYear} год и проверь требования выбранного уровня образования. Если документ за этот год ещё не опубликован, не используй прошлогодние значения как актуальные.`,
      {
        relatedUniversityId: university.id,
        ...(isPrimary && profile.targetProgramId ? { relatedProgramId: profile.targetProgramId } : {}),
        ...(isHttpsUrl(url) ? { sourceUrl: url, sourceLabel: 'Официальный ресурс университета' } : {})
      }
    )
  })

  if (admissionTasks.length === 0) {
    admissionTasks.push(task(
      'admission:choose-targets',
      'Выбрать приоритетные университеты и программы',
      'research',
      'high',
      `Сравни программы бакалавриата и специалитета. После выбора добавь основной вуз и до трёх альтернатив в профиль, чтобы следующий пересчёт включил конкретные проверки правил приёма на ${profile.targetAdmissionYear} год.`
    ))
  }
  admissionTasks.push(task(
    `admission:verify-year:${profile.targetAdmissionYear}`,
    `Проверить публикацию правил приёма на ${profile.targetAdmissionYear} год`,
    'review',
    'high',
    'Используй только актуальные официальные документы университета и помечай сведения прошлых лет как исторические. Не переноси автоматически прошлогодние проходные баллы, количество мест и вступительные испытания.'
  ))
  stages.push({
    stableKey: 'admission',
    stageType: 'admission',
    title: 'Подготовка к поступлению',
    description: 'Проверка программ и официальных правил приёма на выбранный год.',
    tasks: admissionTasks
  })

  const totalTaskCount = stages.reduce((total, stage) => total + stage.tasks.length, 0)
  if (stages.some((stage) => stage.tasks.length > 100) || totalTaskCount > 500) {
    fail('Для текущего набора справочных данных получилось слишком много задач. Уточни выбор предметов или университетов и повтори генерацию.', 'TRAJECTORY_TOO_MANY_TASKS')
  }

  return {
    requestId,
    profileUpdatedAt: profile.updatedAt,
    title: `Персональная траектория — поступление в ${profile.targetAdmissionYear} году`,
    summary: `План для ученика ${profile.grade} класса из региона ${profile.region.trim()}. Учебная нагрузка — ${profile.weeklyStudyHours} ч в неделю; уровень поступления — ${ADMISSION_LEVEL_LABELS[profile.targetEducationLevel ?? 'bachelor']}. Включены только подтверждённые мероприятия, подходящие по классу и предметам.`,
    academicYear,
    ruleVersion: 'rules-v1',
    profileSnapshot: snapshot,
    stages
  }
}
