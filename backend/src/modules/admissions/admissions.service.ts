import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'

interface AdmissionCampaignRow {
  id: string
  university_id: string
  admission_year: number
  campaign_status: string
  source_status: string
  admission_page_url: string | null
  rules_url: string | null
  rules_title: string | null
  exam_list_url: string | null
  places_url: string | null
  tuition_url: string | null
  rules_published_at: string | null
  source_checked_at: string | null
}

export interface AdmissionCampaignResult {
  id: string
  universityId: string
  admissionYear: number
  status: string
  sourceStatus: string
  admissionPageUrl?: string
  rulesUrl?: string
  rulesTitle?: string
  examListUrl?: string
  placesUrl?: string
  tuitionUrl?: string
  rulesPublishedAt?: string
  sourceCheckedAt?: string
}

export async function getUniversityAdmissionCampaigns(
  supabase: SupabaseClient,
  universityId: string
): Promise<AdmissionCampaignResult[]> {
  const { data, error } = await supabase
    .from('university_admission_campaigns')
    .select([
      'id',
      'university_id',
      'admission_year',
      'campaign_status',
      'source_status',
      'admission_page_url',
      'rules_url',
      'rules_title',
      'exam_list_url',
      'places_url',
      'tuition_url',
      'rules_published_at',
      'source_checked_at'
    ].join(', '))
    .eq('university_id', universityId)
    .eq('source_status', 'official')
    .in('campaign_status', ['published', 'archived'])
    .order('admission_year', { ascending: false })

  if (error) {
    throw new AppError(
      'Не удалось загрузить приёмные кампании университета.',
      500,
      'ADMISSION_CAMPAIGNS_LOAD_FAILED'
    )
  }

  const rows = (data ?? []) as unknown as AdmissionCampaignRow[]

  return rows.map((row) => ({
    id: row.id,
    universityId: row.university_id,
    admissionYear: row.admission_year,
    status: row.campaign_status,
    sourceStatus: row.source_status,
    ...(row.admission_page_url ? { admissionPageUrl: row.admission_page_url } : {}),
    ...(row.rules_url ? { rulesUrl: row.rules_url } : {}),
    ...(row.rules_title ? { rulesTitle: row.rules_title } : {}),
    ...(row.exam_list_url ? { examListUrl: row.exam_list_url } : {}),
    ...(row.places_url ? { placesUrl: row.places_url } : {}),
    ...(row.tuition_url ? { tuitionUrl: row.tuition_url } : {}),
    ...(row.rules_published_at ? { rulesPublishedAt: row.rules_published_at } : {}),
    ...(row.source_checked_at ? { sourceCheckedAt: row.source_checked_at } : {})
  }))
}
interface AdmissionOptionRow {
  id: string
  program_id: string
  program_code: string | null
  competition_group: string | null
  campus_name: string | null
  education_level: string
  admission_basis: string
  study_form: string
  study_duration_years: number | null
  budget_places: number | null
  paid_places: number | null
  tuition_rub_per_year: number | null
  instruction_language: string | null
  official_program_url: string | null
  source_url: string
  source_title: string | null
  source_checked_at: string | null
  verification_status: string
}

interface AdmissionProgramRow {
  id: string
  name: string
  direction: string | null
  description: string | null
  official_url: string | null
  source_url: string | null
  source_title: string | null
  source_checked_at: string | null
}

interface AdmissionExamRow {
  id: string
  program_admission_option_id: string
  slot_number: number
  subject_id: string | null
  subject_name: string
  subject_code: string | null
  exam_type: string
  minimum_score: number | null
  maximum_score: number
  evidence_url: string | null
  evidence_checked_at: string | null
}

interface AchievementRuleRow {
  id: string
  program_admission_option_id: string
  achievement_code: string
  title: string
  description: string | null
  points_awarded: number
  points_cap: number | null
  source_url: string
  source_title: string | null
  source_checked_at: string | null
}

export async function getUniversityAdmissionPrograms(
  supabase: SupabaseClient,
  universityId: string,
  campaignId: string
) {
  const { data: campaign, error: campaignError } = await supabase
    .from('university_admission_campaigns')
    .select('id, university_id, admission_year, campaign_status, source_status')
    .eq('id', campaignId)
    .eq('university_id', universityId)
    .eq('source_status', 'official')
    .in('campaign_status', ['published', 'archived'])
    .maybeSingle()

  if (campaignError) {
    throw new AppError(
      'Не удалось загрузить приёмную кампанию.',
      500,
      'ADMISSION_CAMPAIGN_LOAD_FAILED'
    )
  }

  if (!campaign) {
    throw new AppError(
      'Опубликованная приёмная кампания не найдена.',
      404,
      'ADMISSION_CAMPAIGN_NOT_FOUND'
    )
  }

  const { data: optionData, error: optionError } = await supabase
    .from('program_admission_options')
    .select([
      'id',
      'program_id',
      'program_code',
      'competition_group',
      'campus_name',
      'education_level',
      'admission_basis',
      'study_form',
      'study_duration_years',
      'budget_places',
      'paid_places',
      'tuition_rub_per_year',
      'instruction_language',
      'official_program_url',
      'source_url',
      'source_title',
      'source_checked_at',
      'verification_status'
    ].join(', '))
    .eq('admission_campaign_id', campaignId)
    .eq('university_id', universityId)
    .in('verification_status', ['official', 'archived'])

  if (optionError) {
    throw new AppError(
      'Не удалось загрузить варианты поступления.',
      500,
      'ADMISSION_OPTIONS_LOAD_FAILED'
    )
  }

  const options = (optionData ?? []) as unknown as AdmissionOptionRow[]

  if (options.length === 0) {
    return {
      campaign: {
        id: campaign.id,
        universityId,
        admissionYear: campaign.admission_year,
        status: campaign.campaign_status
      },
      programs: []
    }
  }

  const programIds = [...new Set(options.map((item) => item.program_id))]

  const { data: programData, error: programError } = await supabase
    .from('programs')
    .select([
      'id',
      'name',
      'direction',
      'description',
      'official_url',
      'source_url',
      'source_title',
      'source_checked_at'
    ].join(', '))
    .eq('university_id', universityId)
    .in('id', programIds)
    .in('catalog_status', ['official', 'archived'])

  if (programError) {
    throw new AppError(
      'Не удалось загрузить образовательные программы.',
      500,
      'ADMISSION_PROGRAMS_LOAD_FAILED'
    )
  }

  const programs = (programData ?? []) as unknown as AdmissionProgramRow[]
  const visibleProgramIds = new Set(programs.map((item) => item.id))

  const visibleOptions = options.filter(
    (item) => visibleProgramIds.has(item.program_id)
  )

  const optionIds = visibleOptions.map((item) => item.id)

  if (optionIds.length === 0) {
    return {
      campaign: {
        id: campaign.id,
        universityId,
        admissionYear: campaign.admission_year,
        status: campaign.campaign_status
      },
      programs: []
    }
  }

  const [examResult, achievementResult] = await Promise.all([
    supabase
      .from('program_admission_exams')
      .select([
        'id',
        'program_admission_option_id',
        'slot_number',
        'subject_id',
        'subject_name',
        'subject_code',
        'exam_type',
        'minimum_score',
        'maximum_score',
        'evidence_url',
        'evidence_checked_at'
      ].join(', '))
      .in('program_admission_option_id', optionIds),

    supabase
      .from('program_admission_achievement_rules')
      .select([
        'id',
        'program_admission_option_id',
        'achievement_code',
        'title',
        'description',
        'points_awarded',
        'points_cap',
        'source_url',
        'source_title',
        'source_checked_at'
      ].join(', '))
      .in('program_admission_option_id', optionIds)
      .in('verification_status', ['official', 'archived'])
  ])

  if (examResult.error || achievementResult.error) {
    throw new AppError(
      'Не удалось загрузить вступительные испытания и достижения.',
      500,
      'ADMISSION_DETAILS_LOAD_FAILED'
    )
  }

  const exams = (examResult.data ?? []) as unknown as AdmissionExamRow[]
  const achievements = (
    achievementResult.data ?? []
  ) as unknown as AchievementRuleRow[]

  return {
    campaign: {
      id: campaign.id,
      universityId,
      admissionYear: campaign.admission_year,
      status: campaign.campaign_status
    },
    programs: programs.map((program) => ({
      id: program.id,
      name: program.name,
      ...(program.direction ? { direction: program.direction } : {}),
      ...(program.description ? { description: program.description } : {}),
      ...(program.official_url ? { officialUrl: program.official_url } : {}),
      ...(program.source_url ? { sourceUrl: program.source_url } : {}),
      ...(program.source_title ? { sourceTitle: program.source_title } : {}),
      ...(program.source_checked_at ? { sourceCheckedAt: program.source_checked_at } : {}),
      admissionOptions: visibleOptions
        .filter((option) => option.program_id === program.id)
        .map((option) => ({
          id: option.id,
          programCode: option.program_code,
          competitionGroup: option.competition_group,
          campusName: option.campus_name,
          educationLevel: option.education_level,
          admissionBasis: option.admission_basis,
          studyForm: option.study_form,
          studyDurationYears: option.study_duration_years,
          budgetPlaces: option.budget_places,
          paidPlaces: option.paid_places,
          tuitionRubPerYear: option.tuition_rub_per_year,
          instructionLanguage: option.instruction_language,
          officialProgramUrl: option.official_program_url,
          sourceUrl: option.source_url,
          sourceTitle: option.source_title,
          sourceCheckedAt: option.source_checked_at,
          verificationStatus: option.verification_status,
          exams: exams
            .filter((exam) => exam.program_admission_option_id === option.id)
            .map((exam) => ({
              id: exam.id,
              slotNumber: exam.slot_number,
              subjectId: exam.subject_id,
              subjectName: exam.subject_name,
              subjectCode: exam.subject_code,
              examType: exam.exam_type,
              minimumScore: exam.minimum_score,
              maximumScore: exam.maximum_score,
              evidenceUrl: exam.evidence_url,
              evidenceCheckedAt: exam.evidence_checked_at
            })),
          achievements: achievements
            .filter((item) => item.program_admission_option_id === option.id)
            .map((item) => ({
              id: item.id,
              code: item.achievement_code,
              title: item.title,
              description: item.description,
              pointsAwarded: item.points_awarded,
              pointsCap: item.points_cap,
              sourceUrl: item.source_url,
              sourceTitle: item.source_title,
              sourceCheckedAt: item.source_checked_at
            }))
        }))
    }))
  }
}