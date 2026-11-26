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
  list_type?: 'school_olympiad' | 'intellectual_competition' | null
  official_list_number?: number | null
  source_document_title?: string | null
  source_document_url?: string | null
  source_checked_at?: string | null
  source_status?: 'official' | 'needs_review' | 'archived' | null
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
  level?: number | null
  list_type?: 'school_olympiad' | 'intellectual_competition' | null
  official_list_number?: number | null
  source_document_title?: string | null
  source_document_url?: string | null
  source_checked_at?: string | null
  source_status?: 'official' | 'needs_review' | 'archived' | null
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

interface OlympiadProfileRow {
  id: string
  olympiad_id: string
  profile_name: string
  level: number
  subjects: string[]
  source_subjects: string
}

interface ScheduleItemRow {
  id: string
  olympiad_id: string
  kind: 'registration' | 'stage'
  stage_name: string
  when_text: string
  is_confirmed: boolean
  checked_on: string | null
  organizer_url: string
  start_date: string | null
  end_date: string | null
  date_parse_status: 'exact' | 'range' | 'inferred_year' | 'unknown'
  date_semantics: 'event' | 'period' | 'deadline' | 'mixed' | 'unknown'
  start_time: string | null
  end_time: string | null
  time_zone: string | null
}

interface OlympiadProfileSummary {
  id: string
  profileName: string
  level: 1 | 2 | 3
  subjects: string[]
  sourceSubjects: string
}

interface OlympiadScheduleItemSummary {
  id: string
  kind: 'registration' | 'stage'
  stageName: string
  whenText: string
  isConfirmed: boolean
  checkedOn?: string
  organizerUrl: string
  startDate?: string
  endDate?: string
  dateParseStatus: 'exact' | 'range' | 'inferred_year' | 'unknown'
  dateSemantics: 'event' | 'period' | 'deadline' | 'mixed' | 'unknown'
  startTime?: string
  endTime?: string
  timeZone?: string
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
  listType: 'school_olympiad' | 'intellectual_competition'
  officialListNumber?: number
  sourceDocumentTitle?: string
  sourceDocumentUrl?: string
  sourceCheckedAt?: string
  sourceStatus?: 'official' | 'needs_review' | 'archived'
  subjects: string[]
  grades: number[]
  website?: string
  description?: string
  status: OlympiadStatus
  season?: OlympiadSeason
  benefitYear: number
  benefits: OlympiadBenefitSummary[]
  profiles: OlympiadProfileSummary[]
  scheduleItems: OlympiadScheduleItemSummary[]
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
    .replace(/\s+/g, ' ')
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

async function loadOlympiadProfiles(supabase: SupabaseClient, olympiadIds: string[]): Promise<OlympiadProfileRow[]> {
  const rows: OlympiadProfileRow[] = []
  for (let index = 0; index < olympiadIds.length; index += 150) {
    const ids = olympiadIds.slice(index, index + 150)
    const { data, error } = await supabase
      .from('olympiad_profiles')
      .select('id, olympiad_id, profile_name, level, subjects, source_subjects')
      .in('olympiad_id', ids)
      .order('order_n', { ascending: true })
      .order('profile_name', { ascending: true })
    if (error) throw new AppError('Не удалось загрузить профили олимпиад.', 500, 'OLYMPIAD_PROFILES_LOAD_FAILED')
    rows.push(...((data ?? []) as unknown as OlympiadProfileRow[]))
  }
  return rows
}

async function loadOlympiadScheduleItems(supabase: SupabaseClient, olympiadIds: string[]): Promise<ScheduleItemRow[]> {
  const rows: ScheduleItemRow[] = []
  const pageSize = 1000
  for (let index = 0; index < olympiadIds.length; index += 150) {
    const ids = olympiadIds.slice(index, index + 150)
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('olympiad_schedule_items')
        .select('id, olympiad_id, kind, stage_name, when_text, is_confirmed, checked_on, organizer_url, start_date, end_date, date_parse_status, date_semantics, start_time, end_time, time_zone')
        .in('olympiad_id', ids)
        .order('order_n', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (error) throw new AppError('Не удалось загрузить расписание олимпиад.', 500, 'OLYMPIAD_SCHEDULE_LOAD_FAILED')
      const page = (data ?? []) as unknown as ScheduleItemRow[]
      rows.push(...page)
      if (page.length < pageSize) break
    }
  }
  return rows
}

function mapOlympiadProfile(row: OlympiadProfileRow): OlympiadProfileSummary {
  return { id: row.id, profileName: row.profile_name, level: row.level as 1 | 2 | 3, subjects: row.subjects ?? [], sourceSubjects: row.source_subjects }
}

function mapScheduleItem(row: ScheduleItemRow): OlympiadScheduleItemSummary {
  return {
    id: row.id, kind: row.kind, stageName: row.stage_name, whenText: row.when_text,
    isConfirmed: row.is_confirmed, ...(row.checked_on ? { checkedOn: row.checked_on } : {}),
    organizerUrl: row.organizer_url, ...(row.start_date ? { startDate: row.start_date } : {}),
    ...(row.end_date ? { endDate: row.end_date } : {}),
    dateParseStatus: row.date_parse_status,
    dateSemantics: row.date_semantics,
    ...(row.start_time ? { startTime: row.start_time } : {}),
    ...(row.end_time ? { endTime: row.end_time } : {}),
    ...(row.time_zone ? { timeZone: row.time_zone } : {})
  }
}

function getScheduleStatus(items: OlympiadScheduleItemSummary[], now = new Date()): OlympiadStatus {
  const parseable = (item: OlympiadScheduleItemSummary) =>
    item.isConfirmed &&
    (item.dateParseStatus === 'exact' || item.dateParseStatus === 'range') &&
    Boolean(item.startDate && item.endDate)

  const periods = items
    .filter((item) => item.kind === 'registration' && item.dateSemantics === 'period' && parseable(item))
    .map((item) => ({ start: parseStageDate(item.startDate as string), end: parseStageDate(item.endDate as string, true) }))
    .filter((item) => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()) && item.end >= item.start)

  if (periods.some((item) => item.start <= now && item.end >= now)) return 'eligible'
  if (periods.some((item) => item.start > now)) return 'upcoming'

  const deadlines = items
    .filter((item) => item.kind === 'registration' && item.dateSemantics === 'deadline' && parseable(item))
    .map((item) => parseStageDate(item.endDate as string, true))
    .filter((date) => !Number.isNaN(date.getTime()))

  // A deadline alone does not prove that registration is open before that day.
  if (periods.length > 0 && periods.every((item) => item.end < now) && deadlines.every((date) => date < now)) return 'closed'
  if (periods.length === 0 && deadlines.length > 0 && deadlines.every((date) => date < now)) return 'closed'
  return 'unknown'
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
  const extendedSelect = 'id, name, organizer, level, list_type, official_list_number, source_document_title, source_document_url, source_checked_at, source_status, subjects, grades, website, description'
  const legacySelect = 'id, name, organizer, level, subjects, grades, website, description'
  const extendedOlympiadResult = await supabase
    .from('olympiads')
    .select(extendedSelect)
    .order('name', { ascending: true })
  // The legacy fallback has a narrower SELECT; normalize it to OlympiadRow.
  let olympiadData: OlympiadRow[] | null = extendedOlympiadResult.data as unknown as OlympiadRow[] | null
  let olympiadError = extendedOlympiadResult.error

  if (olympiadError && /list_type|official_list_number|source_document|source_checked_at|source_status|schema cache|column .* does not exist/i.test(olympiadError.message)) {
    const legacyResult = await supabase
      .from('olympiads')
      .select(legacySelect)
      .order('name', { ascending: true })
    olympiadData = legacyResult.data as unknown as OlympiadRow[] | null
    olympiadError = legacyResult.error
  }

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
  const [profileRows, scheduleRows] = await Promise.all([
    loadOlympiadProfiles(supabase, olympiadIds),
    loadOlympiadScheduleItems(supabase, olympiadIds)
  ])
  const profilesByOlympiad = new Map<string, OlympiadProfileSummary[]>()
  for (const row of profileRows) {
    const current = profilesByOlympiad.get(row.olympiad_id) ?? []
    current.push(mapOlympiadProfile(row))
    profilesByOlympiad.set(row.olympiad_id, current)
  }
  const scheduleByOlympiad = new Map<string, OlympiadScheduleItemSummary[]>()
  for (const row of scheduleRows) {
    const current = scheduleByOlympiad.get(row.olympiad_id) ?? []
    current.push(mapScheduleItem(row))
    scheduleByOlympiad.set(row.olympiad_id, current)
  }
  const benefitYear = filters.benefitYear ?? getNextAdmissionYear()
  const academicYear = getCurrentAcademicYear()

  const extendedSeasonSelect = 'id, olympiad_id, academic_year, grades, level, list_type, official_list_number, source_document_title, source_document_url, source_checked_at, source_status'
  const legacySeasonSelect = 'id, olympiad_id, academic_year, grades'
  const extendedSeasonResult = await supabase
    .from('olympiad_seasons')
    .select(extendedSeasonSelect)
    .in('olympiad_id', olympiadIds)
    .eq('academic_year', academicYear)
  // Legacy rows omit year-specific metadata and are normalized to SeasonRow.
  let seasonData: SeasonRow[] | null = extendedSeasonResult.data as unknown as SeasonRow[] | null
  let seasonError = extendedSeasonResult.error

  if (seasonError && /level|list_type|official_list_number|source_document|source_checked_at|source_status|schema cache|column .* does not exist/i.test(seasonError.message)) {
    const legacySeasonResult = await supabase
      .from('olympiad_seasons')
      .select(legacySeasonSelect)
      .in('olympiad_id', olympiadIds)
      .eq('academic_year', academicYear)
    seasonData = legacySeasonResult.data as unknown as SeasonRow[] | null
    seasonError = legacySeasonResult.error
  }

  if (seasonError) {
    throw new AppError(
      'Не удалось загрузить сезоны олимпиад.',
      500,
      'OLYMPIAD_SEASONS_LOAD_FAILED'
    )
  }

  const seasons = (seasonData ?? []) as SeasonRow[]
  const seasonByOlympiad = new Map(seasons.map((season) => [season.olympiad_id, season]))
  const schoolOlympiadIds = olympiadRows
    .filter((item) => (seasonByOlympiad.get(item.id)?.list_type ?? item.list_type) !== 'intellectual_competition')
    .map((item) => item.id)
  const benefitsByOlympiad = schoolOlympiadIds.length > 0
    ? await getOfficialBenefits(supabase, schoolOlympiadIds, filters, benefitYear)
    : new Map<string, OlympiadBenefitSummary[]>()
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

    const hasYearMetadata = Boolean(season && Object.prototype.hasOwnProperty.call(season, 'list_type'))
    const profiles = profilesByOlympiad.get(olympiad.id) ?? []
    const scheduleItems = scheduleByOlympiad.get(olympiad.id) ?? []
    const distinctProfileLevels = [...new Set(profiles.map((profile) => profile.level))]
    // Level belongs to an individual profile; an event with mixed levels has no single level.
    const effectiveLevel = profiles.length > 0
      ? (distinctProfileLevels.length === 1 ? distinctProfileLevels[0] : null)
      : (hasYearMetadata ? (season?.level ?? null) : olympiad.level)
    const effectiveListNumber = hasYearMetadata ? season?.official_list_number : olympiad.official_list_number
    const effectiveSourceTitle = hasYearMetadata ? season?.source_document_title : olympiad.source_document_title
    const effectiveSourceUrl = hasYearMetadata ? season?.source_document_url : olympiad.source_document_url
    const effectiveSourceCheckedAt = hasYearMetadata ? season?.source_checked_at : olympiad.source_checked_at
    const effectiveSourceStatus = hasYearMetadata ? (season?.source_status ?? 'needs_review') : olympiad.source_status

    return {
      id: olympiad.id,
      name: olympiad.name,
      organizer: olympiad.organizer,
      level: effectiveLevel,
      listType: (season?.list_type ?? olympiad.list_type) === 'intellectual_competition' ? 'intellectual_competition' : 'school_olympiad',
      ...(effectiveListNumber != null ? { officialListNumber: effectiveListNumber } : {}),
      ...(effectiveSourceTitle ? { sourceDocumentTitle: effectiveSourceTitle } : {}),
      ...(effectiveSourceUrl ? { sourceDocumentUrl: effectiveSourceUrl } : {}),
      ...(effectiveSourceCheckedAt ? { sourceCheckedAt: effectiveSourceCheckedAt } : {}),
      ...(effectiveSourceStatus ? { sourceStatus: effectiveSourceStatus } : {}),
      subjects: olympiad.subjects ?? [],
      grades: mappedSeason?.grades ?? olympiad.grades ?? [],
      status: scheduleItems.length > 0 ? getScheduleStatus(scheduleItems) : getOlympiadStatus(mappedStages),
      benefitYear,
      benefits: benefitsByOlympiad.get(olympiad.id) ?? [],
      profiles,
      scheduleItems,
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
    if (filters.listType && olympiad.listType !== filters.listType) return false

    if (
      requestedSubjects.length > 0 &&
      !requestedSubjects.some((subject) => olympiad.subjects.includes(subject))
    ) return false

    // An empty list means school-grade eligibility is not stated in the official list.
    // Do not mark the olympiad unavailable; let the student verify organizer rules.
    if (filters.grade !== undefined && olympiad.grades.length > 0 && !olympiad.grades.includes(filters.grade)) {
      return false
    }

    if (filters.level !== undefined) {
      const hasMatchingProfile = olympiad.profiles.some((profile) => profile.level === filters.level)
      if (olympiad.profiles.length > 0 ? !hasMatchingProfile : olympiad.level !== filters.level) return false
    }

    if (filters.status && olympiad.status !== filters.status) {
      return false
    }

    if (filters.format) {
      const stagesForFormat = olympiad.season?.stages ?? []
      if (stagesForFormat.length > 0 && !stagesForFormat.some((stage) => stage.format === filters.format)) return false
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
        ...olympiad.subjects.map((subject) => SUBJECT_LABELS[subject] ?? subject),
        ...olympiad.profiles.map((profile) => profile.profileName),
        ...olympiad.profiles.map((profile) => profile.sourceSubjects)
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
