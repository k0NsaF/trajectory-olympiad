import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { OlympiadFiltersInput } from './olympiads.schema.js'

type OlympiadStageType = 'registration' | 'qualifying' | 'final'
type OlympiadFormat = 'online' | 'offline' | 'mixed'
type OlympiadStatus = 'eligible' | 'upcoming' | 'closed' | 'unknown'
type BenefitRightType = 'BVI' | '100_points' | 'extra_points'
type BenefitForStatus = 'winner' | 'prize' | 'both'

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

interface OlympiadRow {
  id: string
  name: string
  organizer: string
  level: number | null
  subjects: string[]
  grades: number[]
  website: string | null
  description: string | null
}

interface SeasonRow {
  id: string
  olympiad_id: string
  academic_year: string
  grades: number[]
}

interface StageRow {
  id: string
  season_id: string
  type: OlympiadStageType
  start_date: string
  end_date: string
  format: OlympiadFormat
  region_scope: string[] | null
}

interface BenefitRow {
  id: string
  university_id: string
  program_id: string | null
  olympiad_id: string
  right_type: BenefitRightType
  for_status: BenefitForStatus
  level_required: number | null
  confirm_exam_subject: string | null
  confirm_exam_threshold: number | null
  result_class_required: number | null
  source_url: string
  valid_year: number
  last_checked_at: string | null
}

interface UniversityRow {
  id: string
  name: string
  short_name: string
}

interface ProgramRow {
  id: string
  name: string
}

interface OlympiadStage {
  id: string
  olympiadId: string
  type: OlympiadStageType
  startDate: string
  endDate: string
  format: OlympiadFormat
  regionScope?: string[]
}

interface OlympiadSeason {
  id: string
  olympiadId: string
  academicYear: string
  grades: number[]
  stages: OlympiadStage[]
}

interface OlympiadBenefitSummary {
  id: string
  universityId: string
  universityName: string
  universityShortName: string
  programId?: string
  programName?: string
  rightType: BenefitRightType
  forStatus: BenefitForStatus
  levelRequired?: number
  confirmExamSubject?: string
  confirmExamThreshold?: number
  resultClassRequired?: number
  validYear: number
  sourceUrl: string
  lastCheckedAt: string
}

interface OlympiadResult {
  id: string
  name: string
  organizer: string
  level: number | null
  subjects: string[]
  grades: number[]
  website?: string
  description?: string
  status: OlympiadStatus
  season?: OlympiadSeason
  benefitYear: number
  benefits: OlympiadBenefitSummary[]
}

function getCurrentAcademicYear(date = new Date()): string {
  const year = date.getFullYear()
  const startYear = date.getMonth() >= 8 ? year : year - 1

  return `${startYear}-${startYear + 1}`
}

function getNextAdmissionYear(date = new Date()): number {
  const year = date.getFullYear()
  return date.getMonth() >= 8 ? year + 1 : year
}

function parseStageDate(value: string, endOfDay = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    )
  }

  return new Date(value)
}

function getOlympiadStatus(
  stages: OlympiadStage[],
  now = new Date()
): OlympiadStatus {
  const registrationStages = stages.filter(
    (stage) => stage.type === 'registration'
  )

  if (registrationStages.length === 0) return 'unknown'

  const validStages = registrationStages
    .map((stage) => ({
      start: parseStageDate(stage.startDate),
      end: parseStageDate(stage.endDate, true)
    }))
    .filter(
      (stage) =>
        !Number.isNaN(stage.start.getTime()) &&
        !Number.isNaN(stage.end.getTime()) &&
        stage.end >= stage.start
    )

  if (validStages.length === 0) return 'unknown'

  if (validStages.some((stage) => stage.start <= now && stage.end >= now)) {
    return 'eligible'
  }

  return validStages.some((stage) => stage.start > now)
    ? 'upcoming'
    : 'closed'
}

function normalizeRegion(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/[ё]/g, 'е')
    .replace(/\\s+/g, ' ')
}

function isAvailableInRegion(
  stages: OlympiadStage[],
  region: string
): boolean {
  const restrictedScopes = stages
    .map((stage) => stage.regionScope)
    .filter((scope): scope is string[] => Boolean(scope && scope.length > 0))

  if (restrictedScopes.length === 0) return true

  const normalizedRegion = normalizeRegion(region)
  const universalScopes = new Set([
    'all',
    'все',
    'все регионы',
    'россия',
    'вся россия',
    'любой регион',
    'российская федерация'
  ])

  return restrictedScopes.some((scope) =>
    scope.some((item) => {
      const normalizedScope = normalizeRegion(item)
      return universalScopes.has(normalizedScope) || normalizedScope === normalizedRegion
    })
  )
}

function mapStage(stage: StageRow, olympiadId: string): OlympiadStage {
  return {
    id: stage.id,
    olympiadId,
    type: stage.type,
    startDate: stage.start_date,
    endDate: stage.end_date,
    format: stage.format,
    ...(stage.region_scope ? { regionScope: stage.region_scope } : {})
  }
}

function mapBenefit(
  row: BenefitRow,
  universities: Map<string, UniversityRow>,
  programs: Map<string, ProgramRow>
): OlympiadBenefitSummary | null {
  const university = universities.get(row.university_id)
  if (!university || !row.last_checked_at) return null

  const program = row.program_id ? programs.get(row.program_id) : undefined

  return {
    id: row.id,
    universityId: row.university_id,
    universityName: university.name,
    universityShortName: university.short_name,
    ...(row.program_id ? { programId: row.program_id } : {}),
    ...(program ? { programName: program.name } : {}),
    rightType: row.right_type,
    forStatus: row.for_status,
    ...(row.level_required !== null ? { levelRequired: row.level_required } : {}),
    ...(row.confirm_exam_subject ? { confirmExamSubject: row.confirm_exam_subject } : {}),
    ...(row.confirm_exam_threshold !== null
      ? { confirmExamThreshold: row.confirm_exam_threshold }
      : {}),
    ...(row.result_class_required !== null
      ? { resultClassRequired: row.result_class_required }
      : {}),
    validYear: row.valid_year,
    sourceUrl: row.source_url,
    lastCheckedAt: row.last_checked_at
  }
}

async function getOfficialBenefits(
  supabase: SupabaseClient,
  olympiadIds: string[],
  filters: OlympiadFiltersInput,
  benefitYear: number
): Promise<Map<string, OlympiadBenefitSummary[]>> {
  let query = supabase
    .from('benefits')
    .select(
      'id, university_id, program_id, olympiad_id, right_type, for_status, level_required, confirm_exam_subject, confirm_exam_threshold, result_class_required, source_url, valid_year, last_checked_at'
    )
    .in('olympiad_id', olympiadIds)
    .eq('verification_status', 'official')
    .eq('valid_year', benefitYear)
    .not('last_checked_at', 'is', null)

  if (filters.universityId) {
    query = query.eq('university_id', filters.universityId)
  }

  if (filters.programId) {
    query = query.or(`program_id.eq.${filters.programId},program_id.is.null`)
  } else if (filters.universityId) {
    // Без выбранного направления не приписываем пользователю льготы,
    // которые действуют только на другие программы этого вуза.
    query = query.is('program_id', null)
  }

  const { data, error } = await query

  if (error) {
    throw new AppError(
      'Не удалось загрузить подтверждённые льготы для каталога.',
      500,
      'OLYMPIAD_BENEFITS_LOAD_FAILED'
    )
  }

  const rows = (data ?? []) as unknown as BenefitRow[]
  const benefitsByOlympiad = new Map<string, OlympiadBenefitSummary[]>()

  if (rows.length === 0) return benefitsByOlympiad

  const universityIds = [...new Set(rows.map((row) => row.university_id))]
  const programIds = [...new Set(rows
    .map((row) => row.program_id)
    .filter((id): id is string => Boolean(id)))]

  const universityResult = await supabase
    .from('universities')
    .select('id, name, short_name')
    .in('id', universityIds)

  if (universityResult.error) {
    throw new AppError(
      'Не удалось загрузить названия вузов для льгот.',
      500,
      'OLYMPIAD_BENEFIT_UNIVERSITIES_LOAD_FAILED'
    )
  }

  let programRows: ProgramRow[] = []

  if (programIds.length > 0) {
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('id, name')
      .in('id', programIds)

    if (programError) {
      throw new AppError(
        'Не удалось загрузить названия образовательных программ для льгот.',
        500,
        'OLYMPIAD_BENEFIT_PROGRAMS_LOAD_FAILED'
      )
    }

    programRows = (programData ?? []) as unknown as ProgramRow[]
  }

  const universities = new Map(
    ((universityResult.data ?? []) as unknown as UniversityRow[])
      .map((item) => [item.id, item] as const)
  )
  const programs = new Map(
    programRows.map((item) => [item.id, item] as const)
  )

  for (const row of rows) {
    const benefit = mapBenefit(row, universities, programs)
    if (!benefit) continue

    const current = benefitsByOlympiad.get(row.olympiad_id) ?? []
    current.push(benefit)
    benefitsByOlympiad.set(row.olympiad_id, current)
  }

  return benefitsByOlympiad
}

export async function getOlympiads(
  supabase: SupabaseClient,
  filters: OlympiadFiltersInput = {}

): Promise<OlympiadResult[]> {
  const { data: olympiadData, error: olympiadError } = await supabase
    .from('olympiads')
    .select('id, name, organizer, level, subjects, grades, website, description')
    .order('name', { ascending: true })

  if (olympiadError) {
    throw new AppError(
      'Не удалось загрузить каталог олимпиад.',
      500,
      'OLYMPIADS_LOAD_FAILED'
    )
  }

  const olympiadRows = (olympiadData ?? []) as OlympiadRow[]
  if (olympiadRows.length === 0) return []

  const olympiadIds = olympiadRows.map((item) => item.id)
  const benefitYear = filters.benefitYear ?? getNextAdmissionYear()
  const academicYear = getCurrentAcademicYear()

  const [seasonResult, benefitsByOlympiad] = await Promise.all([
    supabase
      .from('olympiad_seasons')
      .select('id, olympiad_id, academic_year, grades')
      .in('olympiad_id', olympiadIds)
      .eq('academic_year', academicYear),
    getOfficialBenefits(supabase, olympiadIds, filters, benefitYear)
  ])

  if (seasonResult.error) {
    throw new AppError(
      'Не удалось загрузить сезоны олимпиад.',
      500,
      'OLYMPIAD_SEASONS_LOAD_FAILED'
    )
  }

  const seasons = (seasonResult.data ?? []) as SeasonRow[]
  const seasonIds = seasons.map((item) => item.id)
  let stages: StageRow[] = []

  if (seasonIds.length > 0) {
    const { data: stageData, error: stageError } = await supabase
      .from('stages')
      .select('id, season_id, type, start_date, end_date, format, region_scope')
      .in('season_id', seasonIds)
      .order('start_date', { ascending: true })

    if (stageError) {
      throw new AppError(
        'Не удалось загрузить этапы олимпиад.',
        500,
        'OLYMPIAD_STAGES_LOAD_FAILED'
      )
    }

    stages = (stageData ?? []) as StageRow[]
  }

  const seasonByOlympiad = new Map(
    seasons.map((season) => [season.olympiad_id, season])
  )
  const stagesBySeason = new Map<string, StageRow[]>()

  for (const stage of stages) {
    const current = stagesBySeason.get(stage.season_id) ?? []
    current.push(stage)
    stagesBySeason.set(stage.season_id, current)
  }

  const result: OlympiadResult[] = olympiadRows.map((olympiad) => {
    const season = seasonByOlympiad.get(olympiad.id)
    const mappedStages = season
      ? (stagesBySeason.get(season.id) ?? []).map((stage) => mapStage(stage, olympiad.id))
      : []
    const mappedSeason = season
      ? {
          id: season.id,
          olympiadId: olympiad.id,
          academicYear: season.academic_year,
          grades: season.grades ?? olympiad.grades,
          stages: mappedStages
        }
      : undefined

    return {
      id: olympiad.id,
      name: olympiad.name,
      organizer: olympiad.organizer,
      level: olympiad.level,
      subjects: olympiad.subjects ?? [],
      grades: mappedSeason?.grades ?? olympiad.grades ?? [],
      status: getOlympiadStatus(mappedStages),
      benefitYear,
      benefits: benefitsByOlympiad.get(olympiad.id) ?? [],
      ...(olympiad.website ? { website: olympiad.website } : {}),
      ...(olympiad.description ? { description: olympiad.description } : {}),
      ...(mappedSeason ? { season: mappedSeason } : {})
    }
  })

  const requestedSubjects = filters.subjects?.length
    ? filters.subjects
    : filters.subject
      ? [filters.subject]
      : []

  return result.filter((olympiad) => {
    if (
      requestedSubjects.length > 0 &&
      !requestedSubjects.some((subject) => olympiad.subjects.includes(subject))
    ) return false

    if (filters.grade !== undefined && !olympiad.grades.includes(filters.grade)) {
      return false
    }

    if (filters.level !== undefined && olympiad.level !== filters.level) {
      return false
    }

    if (filters.status && olympiad.status !== filters.status) {
      return false
    }

    if (filters.format) {
      const stagesForFormat = olympiad.season?.stages ?? []
      if (!stagesForFormat.some((stage) => stage.format === filters.format)) {
        return false
      }
    }

    if (filters.region) {
      const stagesForRegion = olympiad.season?.stages ?? []
      if (!isAvailableInRegion(stagesForRegion, filters.region)) {
        return false
      }
    }

    if (filters.hasBenefits && olympiad.benefits.length === 0) {
      return false
    }

    if (filters.search) {
      const query = filters.search.toLocaleLowerCase('ru').trim()
      const searchableText = [
        olympiad.name,
        olympiad.organizer,
        olympiad.description ?? '',
        ...olympiad.subjects.map((subject) => SUBJECT_LABELS[subject] ?? subject)
      ].join(' ').toLocaleLowerCase('ru')

      if (!searchableText.includes(query)) return false
    }

    return true
  })
}

export async function getOlympiadById(
  supabase: SupabaseClient,
  id: string
): Promise<OlympiadResult> {
  const olympiads = await getOlympiads(supabase)
  const olympiad = olympiads.find((item) => item.id === id)

  if (!olympiad) {
    throw new AppError(
      'Олимпиада не найдена.',
      404,
      'OLYMPIAD_NOT_FOUND'
    )
  }

  return olympiad
}
