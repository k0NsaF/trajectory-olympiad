import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { UniversityQuery } from './universities.schema.js'

interface UniversityRow {
  id: string
  name: string
  short_name: string
  city: string | null
  address: string | null
  website: string | null
  description: string | null
  region: string | null
  official_domain: string | null
  inn: string | null
  ogrn: string | null
  organization_type: string | null
  is_branch: boolean | null
  registry_status: string | null
  registry_sources: string[] | null
  registry_last_seen_at: string | null
  minobrnauki_admission_url: string | null
  minobrnauki_rules_url: string | null
  minobrnauki_places_url: string | null
  miccedu_profile_url: string | null
  cover_image_url?: string | null
  cover_image_source_url?: string | null
  cover_image_license?: string | null
  cover_image_alt?: string | null
}

interface ProgramRow {
  id: string
  university_id: string
  name: string
  direction: string | null
}

interface UniversityProgramResult {
  id: string
  universityId: string
  name: string
  direction?: string
}

interface UniversityResult {
  id: string
  name: string
  shortName: string
  city: string
  website?: string
  description?: string
  region?: string
  officialDomain?: string
  inn?: string
  ogrn?: string
  organizationType?: string
  isBranch?: boolean
  registryStatus?: string
  registrySources?: string[]
  registryLastSeenAt?: string
  admissionUrl?: string
  admissionRulesUrl?: string
  admissionPlacesUrl?: string
  monitoringProfileUrl?: string
  coverImageUrl?: string
  coverImageSourceUrl?: string
  coverImageLicense?: string
  coverImageAlt?: string
  programs: UniversityProgramResult[]
}

const UNIVERSITY_SELECT = [
  'id',
  'name',
  'short_name',
  'city',
  'address',
  'website',
  'description',
  'region',
  'official_domain',
  'inn',
  'ogrn',
  'organization_type',
  'is_branch',
  'registry_status',
  'registry_sources',
  'registry_last_seen_at',
  'minobrnauki_admission_url',
  'minobrnauki_rules_url',
  'minobrnauki_places_url',
  'miccedu_profile_url',
  'cover_image_url',
  'cover_image_source_url',
  'cover_image_license',
  'cover_image_alt'
].join(', ')

const LEGACY_UNIVERSITY_SELECT = UNIVERSITY_SELECT.split(', ').filter((column) => !column.startsWith('cover_image_')).join(', ')

const PAGE_SIZE = 1000
const PROGRAM_UNIVERSITY_CHUNK_SIZE = 150

function cleanCityCandidate(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\b\d{5,6}\b/g, ' ')
    .replace(/^\s*(?:г\.\s*|г\s+|город(?:\.|\s+))/iu, '')
    .replace(/[.,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveUniversityCity(city: string | null, address: string | null): string {
  // Prefer the structured university city; address strings can mention branch locations too.
  const fromCity = cleanCityCandidate(city)
  if (fromCity && !/(?:область|край|республик|автономн(?:ый|ая) округ)/i.test(fromCity) && !/^(?:не указан|неизвестно)$/i.test(fromCity)) return fromCity

  const explicitMatches = [...(address ?? '').matchAll(/(?:^|[,;]\s*)г(?:ород)?\.?\s*([^,;]+)/giu)]
  const fromAddress = cleanCityCandidate(explicitMatches[0]?.[1])
  if (fromAddress && !/^(?:не указан|неизвестно)$/i.test(fromAddress)) return fromAddress
  return 'Город не указан'
}

function mapProgram(row: ProgramRow): UniversityProgramResult {
  return {
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    ...(row.direction ? { direction: row.direction } : {})
  }
}

function mapUniversity(
  row: UniversityRow,
  programs: ProgramRow[]
): UniversityResult {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    city: resolveUniversityCity(row.city, row.address),
    ...(row.website ? { website: row.website } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.region ? { region: row.region } : {}),
    ...(row.official_domain ? { officialDomain: row.official_domain } : {}),
    ...(row.inn ? { inn: row.inn } : {}),
    ...(row.ogrn ? { ogrn: row.ogrn } : {}),
    ...(row.organization_type ? { organizationType: row.organization_type } : {}),
    ...(row.is_branch != null ? { isBranch: row.is_branch } : {}),
    ...(row.registry_status ? { registryStatus: row.registry_status } : {}),
    ...(row.registry_sources?.length ? { registrySources: row.registry_sources } : {}),
    ...(row.registry_last_seen_at ? { registryLastSeenAt: row.registry_last_seen_at } : {}),
    ...(row.minobrnauki_admission_url ? { admissionUrl: row.minobrnauki_admission_url } : {}),
    ...(row.minobrnauki_rules_url ? { admissionRulesUrl: row.minobrnauki_rules_url } : {}),
    ...(row.minobrnauki_places_url ? { admissionPlacesUrl: row.minobrnauki_places_url } : {}),
    ...(row.miccedu_profile_url ? { monitoringProfileUrl: row.miccedu_profile_url } : {}),
    ...(row.cover_image_url ? { coverImageUrl: row.cover_image_url } : {}),
    ...(row.cover_image_source_url ? { coverImageSourceUrl: row.cover_image_source_url } : {}),
    ...(row.cover_image_license ? { coverImageLicense: row.cover_image_license } : {}),
    ...(row.cover_image_alt ? { coverImageAlt: row.cover_image_alt } : {}),
    programs: programs.map(mapProgram)
  }
}

async function loadAllUniversities(
  supabase: SupabaseClient,
  filters: UniversityQuery
): Promise<UniversityRow[]> {
  const universities: UniversityRow[] = []

  const pageSize = filters.limit ?? PAGE_SIZE
  const searchTerm = filters.search?.replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (filters.search && !searchTerm) return []

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('universities')
      .select(UNIVERSITY_SELECT)
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1)

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,short_name.ilike.%${searchTerm}%`)
    }

    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }

    let { data, error } = await query

    if (error && /cover_image_(url|source_url|license|alt)|column .* does not exist|schema cache/i.test(error.message)) {
      let legacyQuery = supabase
        .from('universities')
        .select(LEGACY_UNIVERSITY_SELECT)
        .order('name', { ascending: true })
        .range(from, from + pageSize - 1)
      if (searchTerm) legacyQuery = legacyQuery.or(`name.ilike.%${searchTerm}%,short_name.ilike.%${searchTerm}%`)
      if (filters.city) legacyQuery = legacyQuery.ilike('city', `%${filters.city}%`)
      const legacyResult = await legacyQuery
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error) {
      throw new AppError(
        'Не удалось загрузить список университетов.',
        500,
        'UNIVERSITIES_LOAD_FAILED'
      )
    }

    const page = (data ?? []) as unknown as UniversityRow[]
    universities.push(...page)
    if (filters.limit !== undefined || page.length < pageSize) break
  }

  return universities
}

async function loadProgramsForUniversities(
  supabase: SupabaseClient,
  universityIds: string[]
): Promise<ProgramRow[]> {
  const programs: ProgramRow[] = []

  for (let index = 0; index < universityIds.length; index += PROGRAM_UNIVERSITY_CHUNK_SIZE) {
    const ids = universityIds.slice(index, index + PROGRAM_UNIVERSITY_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('programs')
      .select('id, university_id, name, direction')
      .in('university_id', ids)
      .order('name', { ascending: true })

    if (error) {
      throw new AppError(
        'Не удалось загрузить образовательные программы.',
        500,
        'PROGRAMS_LOAD_FAILED'
      )
    }

    programs.push(...((data ?? []) as ProgramRow[]))
  }

  return programs
}

export async function getUniversities(
  supabase: SupabaseClient,
  filters: UniversityQuery = {}
): Promise<UniversityResult[]> {
  const universities = await loadAllUniversities(supabase, filters)
  if (universities.length === 0) return []

  const programRows = await loadProgramsForUniversities(
    supabase,
    universities.map((item) => item.id)
  )

  const programsByUniversity = new Map<string, ProgramRow[]>()
  for (const program of programRows) {
    const current = programsByUniversity.get(program.university_id) ?? []
    current.push(program)
    programsByUniversity.set(program.university_id, current)
  }

  return universities.map((university) => mapUniversity(
    university,
    programsByUniversity.get(university.id) ?? []
  ))
}

export async function getUniversityById(
  supabase: SupabaseClient,
  id: string
): Promise<UniversityResult> {
  let { data, error } = await supabase
    .from('universities')
    .select(UNIVERSITY_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error && /cover_image_(url|source_url|license|alt)|column .* does not exist|schema cache/i.test(error.message)) {
    const legacyResult = await supabase
      .from('universities')
      .select(LEGACY_UNIVERSITY_SELECT)
      .eq('id', id)
      .maybeSingle()
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) {
    throw new AppError(
      'Не удалось загрузить информацию об университете.',
      500,
      'UNIVERSITY_LOAD_FAILED'
    )
  }

  if (!data) {
    throw new AppError(
      'Университет не найден.',
      404,
      'UNIVERSITY_NOT_FOUND'
    )
  }

  const university = data as unknown as UniversityRow
  const programRows = await loadProgramsForUniversities(supabase, [id])

  return mapUniversity(university, programRows)
}
