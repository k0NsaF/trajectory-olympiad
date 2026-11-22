import type { SupabaseClient } from '@supabase/supabase-js'

import { AppError } from '../../utils/AppError.js'
import type { CreateAchievementInput } from './achievements.schema.js'

type AchievementResultStatus = 'participant' | 'prize' | 'winner'
type AchievementVerificationStatus = 'pending' | 'verified' | 'rejected'

interface AchievementRow {
  id: string
  user_id: string
  olympiad_id: string | null
  olympiad_name: string
  title: string
  result: string
  result_status: AchievementResultStatus | null
  grade: number | null
  achievement_year: number | null
  achieved_at: string | null
  proof_url: string | null
  verification_status: AchievementVerificationStatus
  created_at: string
  updated_at: string
}

export interface AchievementResult {
  id: string
  userId: string
  olympiadId?: string
  olympiadName: string
  title: string
  result: string
  resultStatus?: AchievementResultStatus
  grade?: number
  achievementYear?: number
  achievedAt?: string
  proofUrl?: string
  verificationStatus: AchievementVerificationStatus
  createdAt: string
  updatedAt: string
}

const RESULT_LABELS: Record<AchievementResultStatus, string> = {
  participant: 'Участник',
  prize: 'Призёр',
  winner: 'Победитель'
}

const TITLE_LABELS: Record<AchievementResultStatus, string> = {
  participant: 'Участие в олимпиаде',
  prize: 'Диплом призёра',
  winner: 'Диплом победителя'
}

function mapAchievement(row: AchievementRow): AchievementResult {
  return {
    id: row.id,
    userId: row.user_id,
    ...(row.olympiad_id ? { olympiadId: row.olympiad_id } : {}),
    olympiadName: row.olympiad_name,
    title: row.title,
    result: row.result,
    ...(row.result_status ? { resultStatus: row.result_status } : {}),
    ...(row.grade !== null ? { grade: row.grade } : {}),
    ...(row.achievement_year !== null
      ? { achievementYear: row.achievement_year }
      : {}),
    ...(row.achieved_at ? { achievedAt: row.achieved_at } : {}),
    ...(row.proof_url ? { proofUrl: row.proof_url } : {}),
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const ACHIEVEMENT_FIELDS =
  'id, user_id, olympiad_id, olympiad_name, title, result, result_status, grade, achievement_year, achieved_at, proof_url, verification_status, created_at, updated_at'

export async function getAchievements(
  supabase: SupabaseClient,
  userId: string
): Promise<AchievementResult[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select(ACHIEVEMENT_FIELDS)
    .eq('user_id', userId)
    .order('achievement_year', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new AppError(
      'Не удалось загрузить достижения.',
      500,
      'ACHIEVEMENTS_LOAD_FAILED'
    )
  }

  return ((data ?? []) as unknown as AchievementRow[]).map(mapAchievement)
}

export async function createAchievement(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAchievementInput
): Promise<AchievementResult> {
  const resultLabel = RESULT_LABELS[input.resultStatus]
  const title = TITLE_LABELS[input.resultStatus]
  const result = `${resultLabel} · ${input.grade} класс`

  const { data, error } = await supabase
    .from('achievements')
    .insert({
      user_id: userId,
      olympiad_id: input.olympiadId ?? null,
      olympiad_name: input.olympiadName,
      title,
      result,
      result_status: input.resultStatus,
      grade: input.grade,
      achievement_year: input.achievementYear,
      achieved_at: null,
      proof_url: input.proofUrl ?? null
    })
    .select(ACHIEVEMENT_FIELDS)
    .single()

  if (error || !data) {
    throw new AppError(
      'Не удалось сохранить достижение. Проверь, что SQL-миграция применена.',
      500,
      'ACHIEVEMENT_CREATE_FAILED'
    )
  }

  return mapAchievement(data as unknown as AchievementRow)
}
