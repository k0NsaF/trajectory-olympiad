
import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { UniversityQuery } from './universities.schema.js'

interface UniversityRow {
  id: string
  name: string
  short_name: string
  city: string
  website: string | null
  description: string | null
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
  programs: UniversityProgramResult[]
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
    city: row.city,
    ...(row.website ? { website: row.website } : {}),
    ...(row.description ? { description: row.description } : {}),
    programs: programs.map(mapProgram)
  }
}

export async function getUniversities(
  supabase: SupabaseClient,
  filters: UniversityQuery = {}
): Promise<UniversityResult[]> {
  let query = supabase
    .from('universities')
    .select('id, name, short_name, city, website, description')
    .order('name', { ascending: true })

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new AppError(
      'Не удалось загрузить список университетов.',
      500,
      'UNIVERSITIES_LOAD_FAILED'
    )
  }

  const universities = (data ?? []) as UniversityRow[]

  if (universities.length === 0) {
    return []
  }

  const universityIds = universities.map((item) => item.id)

  const { data: programData, error: programError } = await supabase
    .from('programs')
    .select('id, university_id, name, direction')
    .in('university_id', universityIds)
    .order('name', { ascending: true })

  if (programError) {
    throw new AppError(
      'Не удалось загрузить образовательные программы.',
      500,
      'PROGRAMS_LOAD_FAILED'
    )
  }

  const programs = (programData ?? []) as ProgramRow[]

  const programsByUniversity = new Map<string, ProgramRow[]>()

  for (const program of programs) {
    const current = programsByUniversity.get(program.university_id) ?? []
    current.push(program)
    programsByUniversity.set(program.university_id, current)
  }

  return universities.map((university) =>
    mapUniversity(
      university,
      programsByUniversity.get(university.id) ?? []
    )
  )
}

export async function getUniversityById(
  supabase: SupabaseClient,
  id: string
): Promise<UniversityResult> {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name, short_name, city, website, description')
    .eq('id', id)
    .maybeSingle()

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

  const university = data as UniversityRow

  const { data: programData, error: programError } = await supabase
    .from('programs')
    .select('id, university_id, name, direction')
    .eq('university_id', id)
    .order('name', { ascending: true })

  if (programError) {
    throw new AppError(
      'Не удалось загрузить образовательные программы.',
      500,
      'PROGRAMS_LOAD_FAILED'
    )
  }

  return mapUniversity(
    university,
    (programData ?? []) as ProgramRow[]
  )
}
