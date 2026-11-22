import type { SupabaseClient } from '@supabase/supabase-js'

type OlympiadStatus = 'eligible' | 'upcoming' | 'closed' | 'unknown'

import { AppError } from '../../utils/AppError.js'
import { getOlympiads } from '../olympiads/olympiads.service.js'
import type { CreateTrajectoryInput } from './trajectory.schema.js'

type OlympiadItem = Awaited<
  ReturnType<typeof getOlympiads>
>[number]

interface BenefitRow {
  id: string
  olympiad_id: string
  right_type: 'BVI' | '100_points' | 'extra_points'
  for_status: 'winner' | 'prize' | 'both'
  level_required: number | null
  valid_year: number
  verification_status: 'official'
}

interface TrajectoryStats {
  totalOlympiads: number
  eligibleOlympiads: number
  upcomingOlympiads: number
  availableBenefits: number
}

interface TrajectoryRecommendation {
  olympiadId: string
  title: string
  reason: string
  priority: number
}

interface GeneratedTrajectory {
  grade: number
  region: string
  subjects: string[]
  targetUniversityId?: string
  targetProgramId?: string
  olympiads: OlympiadItem[]
  stats: TrajectoryStats
  recommendations: TrajectoryRecommendation[]
  generatedAt: string
}

const GLOBAL_REGION_NAMES = new Set([
  'all',
  'россия',
  'вся россия',
  'все регионы',
  'любой регион'
])

function getTargetAdmissionYear(
  grade: number,
  date: Date
): number {
  const currentAcademicEndYear =
    date.getMonth() >= 8
      ? date.getFullYear() + 1
      : date.getFullYear()

  return currentAcademicEndYear + Math.max(0, 11 - grade)
}

function normalizeRegion(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/^(г\.?|город)\s*/u, '')
    .replace(/\s+/g, ' ')
}

function stageMatchesRegion(
  regionScope: string[] | undefined,
  region: string
): boolean {
  if (!regionScope || regionScope.length === 0) {
    return true
  }

  const normalizedRegion = normalizeRegion(region)

  return regionScope.some((scope) => {
    const normalizedScope = normalizeRegion(scope)

    return GLOBAL_REGION_NAMES.has(normalizedScope) ||
      normalizedScope === normalizedRegion
  })
}

function isOlympiadAvailableInRegion(
  olympiad: OlympiadItem,
  region: string
): boolean {
  const stages = olympiad.season?.stages ?? []
  const regionRestrictedStages = stages.filter(
    (stage) => (stage.regionScope?.length ?? 0) > 0
  )

  if (regionRestrictedStages.length === 0) {
    return true
  }

  return regionRestrictedStages.some((stage) =>
    stageMatchesRegion(stage.regionScope, region)
  )
}

function parseStageDate(
  value: string,
  endOfDay = false
): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    )
  }

  return new Date(value)
}

function getRegionAwareStatus(
  olympiad: OlympiadItem,
  region: string,
  now: Date
): OlympiadStatus {
  const registrationStages = (olympiad.season?.stages ?? [])
    .filter((stage) =>
      stage.type === 'registration' &&
      stageMatchesRegion(stage.regionScope, region)
    )
    .map((stage) => ({
      start: parseStageDate(stage.startDate),
      end: parseStageDate(stage.endDate, true)
    }))
    .filter((stage) =>
      !Number.isNaN(stage.start.getTime()) &&
      !Number.isNaN(stage.end.getTime()) &&
      stage.end >= stage.start
    )

  if (registrationStages.length === 0) {
    return 'unknown'
  }

  if (registrationStages.some((stage) =>
    stage.start <= now && stage.end >= now
  )) {
    return 'eligible'
  }

  if (registrationStages.some((stage) => stage.start > now)) {
    return 'upcoming'
  }

  return 'closed'
}

function getRegistrationSortDate(
  olympiad: OlympiadItem,
  region: string
): number {
  const dates = (olympiad.season?.stages ?? [])
    .filter((stage) =>
      stage.type === 'registration' &&
      stageMatchesRegion(stage.regionScope, region)
    )
    .map((stage) => parseStageDate(stage.endDate, true).getTime())
    .filter((value) => Number.isFinite(value))

  return dates.length > 0
    ? Math.min(...dates)
    : Number.POSITIVE_INFINITY
}

function getRecommendationReason(
  olympiad: OlympiadItem,
  hasOfficialBenefit: boolean,
  targetAdmissionYear?: number
): string {
  if (hasOfficialBenefit) {
    return `Для этой олимпиады найдена официально подтверждённая льгота на ${targetAdmissionYear} год. Её применение зависит от статуса диплома, уровня олимпиады и выполнения условий вуза.`
  }

  if (olympiad.status === 'eligible') {
    return 'Регистрация открыта. Проверь требования организатора и запланируй участие.'
  }

  if (olympiad.status === 'upcoming') {
    return 'Регистрация ещё не началась. Можно заранее подготовиться и проверить дату открытия.'
  }

  return 'Сезон найден, но сроки регистрации пока не подтверждены. Проверь официальный сайт организатора.'
}

function isBenefitApplicableToOlympiad(
  benefit: BenefitRow,
  olympiad: OlympiadItem
): boolean {
  if (benefit.level_required === null) {
    return true
  }

  return olympiad.level !== null &&
    benefit.level_required === olympiad.level
}

export async function generateTrajectory(
  supabase: SupabaseClient,
  input: CreateTrajectoryInput
): Promise<GeneratedTrajectory> {
  const now = new Date()
  const allOlympiads = await getOlympiads(supabase)

  const matchedOlympiads = allOlympiads
    .filter((olympiad) => {
      if (!olympiad.season) {
        return false
      }

      const gradeMatches = olympiad.season.grades.includes(input.grade)
      const subjectMatches = olympiad.subjects.some((subject) =>
        input.subjects.includes(
          subject as CreateTrajectoryInput['subjects'][number]
        )
      )
      const regionMatches = isOlympiadAvailableInRegion(
        olympiad,
        input.region
      )

      return gradeMatches && subjectMatches && regionMatches
    })
    .map((olympiad) => ({
      ...olympiad,
      status: getRegionAwareStatus(olympiad, input.region, now)
    }))
    .filter((olympiad) => olympiad.status !== 'closed')

  let benefits: BenefitRow[] = []
  let targetAdmissionYear: number | undefined

  if (input.targetUniversityId) {
    targetAdmissionYear = getTargetAdmissionYear(input.grade, now)

    if (input.targetProgramId) {
      const { data: targetProgram, error: targetProgramError } = await supabase
        .from('programs')
        .select('id')
        .eq('id', input.targetProgramId)
        .eq('university_id', input.targetUniversityId)
        .maybeSingle()

      if (targetProgramError) {
        throw new AppError(
          'Не удалось проверить выбранную образовательную программу.',
          500,
          'TARGET_PROGRAM_CHECK_FAILED'
        )
      }

      if (!targetProgram) {
        throw new AppError(
          'Выбранная программа не относится к указанному университету.',
          422,
          'TARGET_PROGRAM_UNIVERSITY_MISMATCH'
        )
      }
    }

    let benefitQuery = supabase
      .from('benefits')
      .select(
        'id, olympiad_id, right_type, for_status, level_required, valid_year, verification_status'
      )
      .eq('university_id', input.targetUniversityId)
      .eq('valid_year', targetAdmissionYear)
      .eq('verification_status', 'official')
      .not('last_checked_at', 'is', null)

    if (input.targetProgramId) {
      benefitQuery = benefitQuery.or(
        `program_id.eq.${input.targetProgramId},program_id.is.null`
      )
    }

    const { data, error } = await benefitQuery

    if (error) {
      throw new AppError(
        'Не удалось проверить официальные льготы выбранного университета.',
        500,
        'BENEFITS_LOAD_FAILED'
      )
    }

    benefits = (data ?? []) as BenefitRow[]
  }

  const matchedOlympiadIds = new Set(
    matchedOlympiads.map((olympiad) => olympiad.id)
  )

  const applicableBenefits = benefits.filter((benefit) => {
    if (!matchedOlympiadIds.has(benefit.olympiad_id)) {
      return false
    }

    const olympiad = matchedOlympiads.find(
      (item) => item.id === benefit.olympiad_id
    )

    return olympiad
      ? isBenefitApplicableToOlympiad(benefit, olympiad)
      : false
  })

  const benefitOlympiadIds = new Set(
    applicableBenefits.map((benefit) => benefit.olympiad_id)
  )

  const statusOrder: Record<OlympiadStatus, number> = {
    eligible: 0,
    upcoming: 1,
    unknown: 2,
    closed: 3
  }

  const sortedOlympiads = [...matchedOlympiads].sort((first, second) => {
    const statusDifference =
      statusOrder[first.status] - statusOrder[second.status]

    if (statusDifference !== 0) {
      return statusDifference
    }

    const benefitDifference =
      Number(benefitOlympiadIds.has(second.id)) -
      Number(benefitOlympiadIds.has(first.id))

    if (benefitDifference !== 0) {
      return benefitDifference
    }

    if (first.level !== second.level) {
      if (first.level === null) return 1
      if (second.level === null) return -1
      return first.level - second.level
    }

    const firstDeadline = getRegistrationSortDate(first, input.region)
    const secondDeadline = getRegistrationSortDate(second, input.region)

    if (firstDeadline !== secondDeadline) {
      return firstDeadline - secondDeadline
    }

    return first.name.localeCompare(second.name, 'ru')
  })

  const recommendations = sortedOlympiads
    .slice(0, 5)
    .map((olympiad, index) => ({
      olympiadId: olympiad.id,
      title: olympiad.name,
      reason: getRecommendationReason(
        olympiad,
        benefitOlympiadIds.has(olympiad.id),
        targetAdmissionYear
      ),
      priority: index + 1
    }))

  return {
    grade: input.grade,
    region: input.region,
    subjects: input.subjects,
    ...(input.targetUniversityId
      ? { targetUniversityId: input.targetUniversityId }
      : {}),
    ...(input.targetProgramId
      ? { targetProgramId: input.targetProgramId }
      : {}),
    olympiads: sortedOlympiads,
    stats: {
      totalOlympiads: sortedOlympiads.length,
      eligibleOlympiads: sortedOlympiads.filter(
        (item) => item.status === 'eligible'
      ).length,
      upcomingOlympiads: sortedOlympiads.filter(
        (item) => item.status === 'upcoming'
      ).length,
      availableBenefits: applicableBenefits.length
    },
    recommendations,
    generatedAt: now.toISOString()
  }
}
