import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { BenefitCompareFilters } from './benefits.schema.js'

type VerificationStatus = 'draft' | 'official' | 'archived'

interface BenefitRow {
  id: string
  university_id: string
  program_id: string | null
  olympiad_id: string
  right_type: 'BVI' | '100_points' | 'extra_points'
  for_status: 'winner' | 'prize' | 'both'
  level_required: number | null
  confirm_exam_threshold: number | null
  confirm_exam_subject: string | null
  result_class_required: number | null
  source_url: string
  valid_year: number
  last_checked_at: string | null
  verification_status: VerificationStatus
}

interface UniversityRow {
  id: string
  name: string
  short_name: string
}

interface ProgramRow {
  id: string
  name: string
  direction: string | null
}

interface OlympiadRow {
  id: string
  name: string
  organizer: string
}

export interface BenefitResult {
  id: string
  universityId: string
  universityName?: string
  universityShortName?: string
  programId?: string
  programName?: string
  programDirection?: string
  olympiadId: string
  olympiadName?: string
  olympiadOrganizer?: string
  rightType: 'BVI' | '100_points' | 'extra_points'
  forStatus: 'winner' | 'prize' | 'both'
  levelRequired?: number
  confirmExamThreshold?: number
  confirmExamSubject?: string
  resultClassRequired?: number
  sourceUrl: string
  validYear: number
  lastCheckedAt?: string
  verificationStatus: VerificationStatus
}

function mapBenefit(
  row: BenefitRow,
  universities: Map<string, UniversityRow>,
  programs: Map<string, ProgramRow>,
  olympiads: Map<string, OlympiadRow>
): BenefitResult {
  const university = universities.get(row.university_id)

  const program = row.program_id
    ? programs.get(row.program_id)
    : undefined

  const olympiad = olympiads.get(row.olympiad_id)

  return {
    id: row.id,
    universityId: row.university_id,

    ...(university
      ? {
          universityName: university.name,
          universityShortName: university.short_name
        }
      : {}),

    ...(row.program_id
      ? { programId: row.program_id }
      : {}),

    ...(program
      ? {
          programName: program.name,
          ...(program.direction
            ? { programDirection: program.direction }
            : {})
        }
      : {}),

    olympiadId: row.olympiad_id,

    ...(olympiad
      ? {
          olympiadName: olympiad.name,
          olympiadOrganizer: olympiad.organizer
        }
      : {}),

    rightType: row.right_type,
    forStatus: row.for_status,

    ...(row.level_required !== null
      ? { levelRequired: row.level_required }
      : {}),

    ...(row.confirm_exam_threshold !== null
      ? { confirmExamThreshold: row.confirm_exam_threshold }
      : {}),

    ...(row.confirm_exam_subject
      ? { confirmExamSubject: row.confirm_exam_subject }
      : {}),

    ...(row.result_class_required !== null
      ? { resultClassRequired: row.result_class_required }
      : {}),

    sourceUrl: row.source_url,
    validYear: row.valid_year,
    ...(row.last_checked_at
      ? { lastCheckedAt: row.last_checked_at }
      : {}),
    verificationStatus: row.verification_status
  }
}

export async function compareBenefits(
  supabase: SupabaseClient,
  filters: BenefitCompareFilters = {}
): Promise<BenefitResult[]> {
  let query = supabase
    .from('benefits')
    .select(
      'id, university_id, program_id, olympiad_id, right_type, for_status, level_required, confirm_exam_threshold, confirm_exam_subject, result_class_required, source_url, valid_year, last_checked_at, verification_status'
    )
    .order('valid_year', { ascending: false })
    .order('last_checked_at', { ascending: false })

  if (filters.universityId) {
    query = query.eq('university_id', filters.universityId)
  }

  if (filters.programId) {
    query = query.or(
      `program_id.eq.${filters.programId},program_id.is.null`
    )
  }

  if (filters.olympiadId) {
    query = query.eq('olympiad_id', filters.olympiadId)
  }

  if (filters.validYear !== undefined) {
    query = query.eq('valid_year', filters.validYear)
  }

  if (
    filters.verificationStatus &&
    filters.verificationStatus !== 'all'
  ) {
    query = query.eq(
      'verification_status',
      filters.verificationStatus
    )
  }

  const { data, error } = await query

  if (error) {
    throw new AppError(
      'Не удалось загрузить условия олимпиадных льгот.',
      500,
      'BENEFITS_LOAD_FAILED'
    )
  }

  const rows = (data ?? []) as unknown as BenefitRow[]

  if (rows.length === 0) {
    return []
  }

  const universityIds = [
    ...new Set(rows.map((row) => row.university_id))
  ]

  const programIds = [
    ...new Set(
      rows
        .map((row) => row.program_id)
        .filter((id): id is string => id !== null)
    )
  ]

  const olympiadIds = [
    ...new Set(rows.map((row) => row.olympiad_id))
  ]

  const [universityResult, olympiadResult] = await Promise.all([
    supabase
      .from('universities')
      .select('id, name, short_name')
      .in('id', universityIds),

    supabase
      .from('olympiads')
      .select('id, name, organizer')
      .in('id', olympiadIds)
  ])

  if (universityResult.error) {
    throw new AppError(
      'Не удалось загрузить названия университетов для льгот.',
      500,
      'BENEFIT_UNIVERSITIES_LOAD_FAILED'
    )
  }

  if (olympiadResult.error) {
    throw new AppError(
      'Не удалось загрузить информацию об олимпиадах для льгот.',
      500,
      'BENEFIT_OLYMPIADS_LOAD_FAILED'
    )
  }

  let programRows: ProgramRow[] = []

  if (programIds.length > 0) {
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('id, name, direction')
      .in('id', programIds)

    if (programError) {
      throw new AppError(
        'Не удалось загрузить образовательные программы для льгот.',
        500,
        'BENEFIT_PROGRAMS_LOAD_FAILED'
      )
    }

    programRows = (programData ?? []) as unknown as ProgramRow[]
  }

  const universityRows = (
    universityResult.data ?? []
  ) as unknown as UniversityRow[]

  const olympiadRows = (
    olympiadResult.data ?? []
  ) as unknown as OlympiadRow[]

  const universities = new Map(
    universityRows.map((row) => [row.id, row])
  )

  const programs = new Map(
    programRows.map((row) => [row.id, row])
  )

  const olympiads = new Map(
    olympiadRows.map((row) => [row.id, row])
  )

  return rows.map((row) =>
    mapBenefit(row, universities, programs, olympiads)
  )
}