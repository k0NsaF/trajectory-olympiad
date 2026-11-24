import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { CatalogListQuery } from './catalog.schema.js'

interface CatalogPage<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface ProfessionRow {
  id: string
  slug: string
  name: string
  category: string
  summary: string
  description?: string
  typical_tasks?: string[]
  skills?: string[]
  school_subjects?: string[]
  interests?: string[]
  content_status: 'editorial' | 'official' | 'needs_review'
  source_url?: string | null
}

interface DirectionRow {
  id: string
  slug: string
  code: string
  name: string
  education_level: 'bachelor' | 'specialist' | 'master'
  category: string
  summary: string
  description?: string
  content_status: 'editorial' | 'official' | 'needs_review'
  source_url?: string | null
}

interface ProfessionDirectionLinkRow {
  profession_id: string
  direction_id: string
  relationship: 'primary' | 'related'
  rationale: string
}

interface ProgramDirectionLinkRow {
  program_id: string
  source_url: string
  verified_at: string | null
}

interface ProgramRow {
  id: string
  name: string
  direction: string | null
  university_id: string
}

interface UniversityRow {
  id: string
  name: string
  short_name: string
  city: string
  region: string | null
}

function fail(message: string, code: string): never {
  throw new AppError(message, 500, code)
}

function pageResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number | null
): CatalogPage<T> {
  const safeTotal = total ?? items.length
  return {
    items,
    page,
    pageSize,
    total: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / pageSize))
  }
}

export async function getProfessions(
  supabase: SupabaseClient,
  filters: CatalogListQuery
) {
  let query = supabase
    .from('professions')
    .select('id, slug, name, category, summary, content_status', { count: 'exact' })
    .eq('is_published', true)
    .neq('content_status', 'needs_review')
    .order('name', { ascending: true })
    .range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1)

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.category) query = query.eq('category', filters.category)

  const { data, error, count } = await query
  if (error) fail('Не удалось загрузить каталог профессий.', 'PROFESSIONS_LOAD_FAILED')

  return pageResult(
    (data ?? []) as unknown as Array<Pick<ProfessionRow, 'id' | 'slug' | 'name' | 'category' | 'summary' | 'content_status'>>,
    filters.page,
    filters.pageSize,
    count
  )
}

export async function getProfessionBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from('professions')
    .select('id, slug, name, category, summary, description, typical_tasks, skills, school_subjects, interests, content_status, source_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .neq('content_status', 'needs_review')
    .maybeSingle()

  if (error) fail('Не удалось загрузить профессию.', 'PROFESSION_LOAD_FAILED')
  if (!data) throw new AppError('Профессия не найдена.', 404, 'PROFESSION_NOT_FOUND')

  const profession = data as unknown as ProfessionRow
  const { data: links, error: linksError } = await supabase
    .from('profession_direction_links')
    .select('direction_id, relationship, rationale')
    .eq('profession_id', profession.id)
    .order('relationship', { ascending: true })

  if (linksError) fail('Не удалось загрузить связанные направления.', 'PROFESSION_DIRECTIONS_LOAD_FAILED')

  const linkRows = (links ?? []) as unknown as Array<Pick<ProfessionDirectionLinkRow, 'direction_id' | 'relationship' | 'rationale'>>
  const directionIds = [...new Set(linkRows.map((item) => item.direction_id))]
  let directionRows: DirectionRow[] = []

  if (directionIds.length > 0) {
    const { data: directions, error: directionsError } = await supabase
      .from('education_directions')
      .select('id, slug, code, name, education_level, category, summary, content_status')
      .in('id', directionIds)
      .eq('is_published', true)
      .neq('content_status', 'needs_review')

    if (directionsError) fail('Не удалось загрузить направления.', 'DIRECTIONS_LOAD_FAILED')
    directionRows = (directions ?? []) as unknown as DirectionRow[]
  }

  const directionById = new Map(directionRows.map((item) => [item.id, item]))
  return {
    ...profession,
    directions: linkRows.flatMap((link) => {
      const direction = directionById.get(link.direction_id)
      return direction ? [{ ...direction, relationship: link.relationship, rationale: link.rationale }] : []
    })
  }
}

export async function getDirections(
  supabase: SupabaseClient,
  filters: CatalogListQuery
) {
  let query = supabase
    .from('education_directions')
    .select('id, slug, code, name, education_level, category, summary, content_status', { count: 'exact' })
    .eq('is_published', true)
    .neq('content_status', 'needs_review')
    .order('code', { ascending: true })
    .range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1)

  if (filters.search) {
    const safeSearch = filters.search.replace(/[^\p{L}\p{N}.\s-]/gu, ' ').replace(/\s+/gu, ' ').trim()
    if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,code.ilike.%${safeSearch}%`)
  }
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.level) query = query.eq('education_level', filters.level)

  const { data, error, count } = await query
  if (error) fail('Не удалось загрузить каталог направлений.', 'DIRECTIONS_LOAD_FAILED')

  return pageResult(
    (data ?? []) as unknown as Array<Pick<DirectionRow, 'id' | 'slug' | 'code' | 'name' | 'education_level' | 'category' | 'summary' | 'content_status'>>,
    filters.page,
    filters.pageSize,
    count
  )
}

export async function getDirectionBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from('education_directions')
    .select('id, slug, code, name, education_level, category, summary, description, content_status, source_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .neq('content_status', 'needs_review')
    .maybeSingle()

  if (error) fail('Не удалось загрузить направление.', 'DIRECTION_LOAD_FAILED')
  if (!data) throw new AppError('Направление не найдено.', 404, 'DIRECTION_NOT_FOUND')

  const direction = data as unknown as DirectionRow
  const [professionLinksResult, programLinksResult] = await Promise.all([
    supabase.from('profession_direction_links')
      .select('profession_id, relationship, rationale')
      .eq('direction_id', direction.id)
      .order('relationship', { ascending: true }),
    supabase.from('program_direction_links')
      .select('program_id, source_url, verified_at')
      .eq('direction_id', direction.id)
      .eq('verification_status', 'verified')
  ])

  if (professionLinksResult.error) fail('Не удалось загрузить связанные профессии.', 'DIRECTION_PROFESSIONS_LOAD_FAILED')
  if (programLinksResult.error) fail('Не удалось загрузить подтверждённые программы.', 'DIRECTION_PROGRAMS_LOAD_FAILED')

  const professionLinks = (professionLinksResult.data ?? []) as unknown as Array<Pick<ProfessionDirectionLinkRow, 'profession_id' | 'relationship' | 'rationale'>>
  const professionIds = [...new Set(professionLinks.map((item) => item.profession_id))]
  let professions: ProfessionRow[] = []

  if (professionIds.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from('professions')
      .select('id, slug, name, category, summary, content_status')
      .in('id', professionIds)
      .eq('is_published', true)
      .neq('content_status', 'needs_review')
    if (rowsError) fail('Не удалось загрузить профессии.', 'PROFESSIONS_LOAD_FAILED')
    professions = (rows ?? []) as unknown as ProfessionRow[]
  }

  const professionById = new Map(professions.map((item) => [item.id, item]))
  const mappedProfessions = professionLinks.flatMap((link) => {
    const profession = professionById.get(link.profession_id)
    return profession ? [{ ...profession, relationship: link.relationship, rationale: link.rationale }] : []
  })

  const programLinks = (programLinksResult.data ?? []) as unknown as ProgramDirectionLinkRow[]
  const programIds = [...new Set(programLinks.map((item) => item.program_id))]
  let programs: ProgramRow[] = []

  if (programIds.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from('programs')
      .select('id, name, direction, university_id')
      .in('id', programIds)
      .order('name', { ascending: true })
    if (rowsError) fail('Не удалось загрузить программы.', 'DIRECTION_PROGRAMS_LOAD_FAILED')
    programs = (rows ?? []) as unknown as ProgramRow[]
  }

  const universityIds = [...new Set(programs.map((item) => item.university_id))]
  let universities: UniversityRow[] = []

  if (universityIds.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from('universities')
      .select('id, name, short_name, city, region')
      .in('id', universityIds)
    if (rowsError) fail('Не удалось загрузить университеты программ.', 'DIRECTION_UNIVERSITIES_LOAD_FAILED')
    universities = (rows ?? []) as unknown as UniversityRow[]
  }

  const universityById = new Map(universities.map((item) => [item.id, item]))
  const sourceByProgramId = new Map(programLinks.map((item) => [item.program_id, item]))

  return {
    ...direction,
    professions: mappedProfessions,
    programs: programs.flatMap((program) => {
      const university = universityById.get(program.university_id)
      const source = sourceByProgramId.get(program.id)
      return university && source ? [{
        id: program.id,
        name: program.name,
        legacyDirection: program.direction,
        university: {
          id: university.id,
          name: university.name,
          shortName: university.short_name,
          city: university.city,
          region: university.region
        },
        sourceUrl: source.source_url,
        verifiedAt: source.verified_at
      }] : []
    })
  }
}
