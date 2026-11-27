import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TrajectoryPlan,
  TrajectoryPlanHistoryItem,
  TrajectoryPlanStatus,
  TrajectoryStage,
  TrajectoryStageStatus,
  TrajectoryStageType,
  TrajectoryTask,
  TrajectoryTaskPriority,
  TrajectoryTaskStatus,
  TrajectoryTaskType
} from './trajectory.types.js'

import { AppError } from '../../utils/AppError.js'
import { createSupabaseServiceClient } from '../../config/supabase.js'
import { getProfile } from '../profiles/profiles.service.js'
import { getOlympiads } from '../olympiads/olympiads.service.js'
import {
  buildTrajectoryPlanDraft,
  validateTrajectoryProfile,
  type TrajectoryUniversityInput
} from './trajectory.engine.js'

interface TrajectoryPlanRow {
  id: string
  user_id: string
  version: number
  status: TrajectoryPlanStatus
  title: string
  summary: string | null
  academic_year: string | null
  rule_version: string
  profile_snapshot: unknown
  created_at: string
  activated_at: string | null
  superseded_at: string | null
}

interface TrajectoryStageRow {
  id: string
  plan_id: string
  user_id: string
  stable_key: string
  position: number
  stage_type: TrajectoryStageType
  title: string
  description: string | null
  status: TrajectoryStageStatus
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

interface TrajectoryTaskRow {
  id: string
  plan_id: string
  stage_id: string
  user_id: string
  stable_key: string
  position: number
  title: string
  description: string | null
  task_type: TrajectoryTaskType
  priority: TrajectoryTaskPriority
  status: TrajectoryTaskStatus
  start_date: string | null
  due_date: string | null
  estimated_minutes: number | null
  weekly_minutes: number | null
  related_olympiad_id: string | null
  related_university_id: string | null
  related_program_id: string | null
  source_url: string | null
  source_label: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const PLAN_FIELDS = 'id, user_id, version, status, title, summary, academic_year, rule_version, profile_snapshot, created_at, activated_at, superseded_at'
const STAGE_FIELDS = 'id, plan_id, user_id, stable_key, position, stage_type, title, description, status, start_date, end_date, created_at, updated_at'
const TASK_FIELDS = 'id, plan_id, stage_id, user_id, stable_key, position, title, description, task_type, priority, status, start_date, due_date, estimated_minutes, weekly_minutes, related_olympiad_id, related_university_id, related_program_id, source_url, source_label, completed_at, created_at, updated_at'

function fail(message: string, status: number, code: string): never {
  throw new AppError(message, status, code)
}

function mapTask(row: TrajectoryTaskRow): TrajectoryTask {
  return {
    id: row.id,
    stableKey: row.stable_key,
    position: row.position,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    taskType: row.task_type,
    priority: row.priority,
    status: row.status,
    ...(row.start_date ? { startDate: row.start_date } : {}),
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.estimated_minutes !== null ? { estimatedMinutes: row.estimated_minutes } : {}),
    ...(row.weekly_minutes !== null ? { weeklyMinutes: row.weekly_minutes } : {}),
    ...(row.related_olympiad_id ? { relatedOlympiadId: row.related_olympiad_id } : {}),
    ...(row.related_university_id ? { relatedUniversityId: row.related_university_id } : {}),
    ...(row.related_program_id ? { relatedProgramId: row.related_program_id } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.source_label ? { sourceLabel: row.source_label } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapStage(row: TrajectoryStageRow, tasks: TrajectoryTask[]): TrajectoryStage {
  return {
    id: row.id,
    stableKey: row.stable_key,
    position: row.position,
    stageType: row.stage_type,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    ...(row.start_date ? { startDate: row.start_date } : {}),
    ...(row.end_date ? { endDate: row.end_date } : {}),
    tasks: tasks.sort((a, b) => a.position - b.position),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapHistoryItem(row: TrajectoryPlanRow): TrajectoryPlanHistoryItem {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.academic_year ? { academicYear: row.academic_year } : {}),
    ruleVersion: row.rule_version,
    createdAt: row.created_at,
    ...(row.activated_at ? { activatedAt: row.activated_at } : {}),
    ...(row.superseded_at ? { supersededAt: row.superseded_at } : {})
  }
}

async function getPlanById(
  supabase: SupabaseClient,
  userId: string,
  planId: string
): Promise<TrajectoryPlan> {
  const { data: planData, error: planError } = await supabase
    .from('trajectory_plans')
    .select(PLAN_FIELDS)
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle()

  if (planError) {
    throw new AppError('Не удалось загрузить персональную траекторию.', 500, 'TRAJECTORY_PLAN_LOAD_FAILED')
  }
  if (!planData) {
    throw new AppError('Персональная траектория не найдена.', 404, 'TRAJECTORY_PLAN_NOT_FOUND')
  }

  const [stagesResult, tasksResult] = await Promise.all([
    supabase
      .from('trajectory_stages')
      .select(STAGE_FIELDS)
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .order('position', { ascending: true }),
    supabase
      .from('trajectory_tasks')
      .select(TASK_FIELDS)
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .order('position', { ascending: true })
  ])

  if (stagesResult.error || tasksResult.error) {
    throw new AppError('Не удалось загрузить этапы и задачи траектории.', 500, 'TRAJECTORY_DETAILS_LOAD_FAILED')
  }

  const stageRows = (stagesResult.data ?? []) as unknown as TrajectoryStageRow[]
  const taskRows = (tasksResult.data ?? []) as unknown as TrajectoryTaskRow[]
  const tasksByStage = new Map<string, TrajectoryTask[]>()

  for (const row of taskRows) {
    const current = tasksByStage.get(row.stage_id) ?? []
    current.push(mapTask(row))
    tasksByStage.set(row.stage_id, current)
  }

  const plan = planData as unknown as TrajectoryPlanRow
  return {
    id: plan.id,
    version: plan.version,
    status: plan.status,
    title: plan.title,
    ...(plan.summary ? { summary: plan.summary } : {}),
    ...(plan.academic_year ? { academicYear: plan.academic_year } : {}),
    ruleVersion: plan.rule_version,
    profileSnapshot: plan.profile_snapshot as TrajectoryPlan['profileSnapshot'],
    stages: stageRows.map((row) => mapStage(row, tasksByStage.get(row.id) ?? [])),
    createdAt: plan.created_at,
    ...(plan.activated_at ? { activatedAt: plan.activated_at } : {}),
    ...(plan.superseded_at ? { supersededAt: plan.superseded_at } : {})
  }
}

export async function getTrajectoryPlanById(
  supabase: SupabaseClient,
  userId: string,
  planId: string
): Promise<TrajectoryPlan> {
  return getPlanById(supabase, userId, planId)
}

export async function getActiveTrajectory(
  supabase: SupabaseClient,
  userId: string
): Promise<TrajectoryPlan | null> {
  const { data, error } = await supabase
    .from('trajectory_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new AppError('Не удалось проверить активную траекторию.', 500, 'TRAJECTORY_ACTIVE_LOAD_FAILED')
  }
  if (!data) return null

  return getPlanById(supabase, userId, data.id as string)
}

export async function getTrajectoryHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<TrajectoryPlanHistoryItem[]> {
  const { data, error } = await supabase
    .from('trajectory_plans')
    .select(PLAN_FIELDS)
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(25)

  if (error) {
    throw new AppError('Не удалось загрузить историю версий траектории.', 500, 'TRAJECTORY_HISTORY_LOAD_FAILED')
  }

  return ((data ?? []) as unknown as TrajectoryPlanRow[]).map(mapHistoryItem)
}

export async function generateTrajectory(
  supabase: SupabaseClient,
  userId: string,
  requestId: string
): Promise<TrajectoryPlan> {
  const profile = await getProfile(supabase, userId)
  if (!profile) {
    fail('Сначала заполни и сохрани профиль.', 422, 'TRAJECTORY_PROFILE_NOT_FOUND')
  }
  validateTrajectoryProfile(profile)

  const olympiads = await getOlympiads(supabase, {
    grade: profile.grade,
    subjects: profile.subjects,
    region: profile.region,
    benefitYear: profile.targetAdmissionYear
  })

  const universityIds = [...new Set([
    ...(profile.targetUniversityId ? [profile.targetUniversityId] : []),
    ...profile.alternativeUniversityIds
  ])]
  let universities: TrajectoryUniversityInput[] = []

  if (universityIds.length > 0) {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, website, minobrnauki_admission_url, minobrnauki_rules_url')
      .in('id', universityIds)

    if (error) {
      throw new AppError('Не удалось загрузить выбранные университеты для траектории.', 500, 'TRAJECTORY_UNIVERSITIES_LOAD_FAILED')
    }

    universities = (data ?? []) as unknown as TrajectoryUniversityInput[]
    const loadedUniversityIds = new Set(universities.map((university) => university.id))
    const missingUniversityIds = universityIds.filter((id) => !loadedUniversityIds.has(id))
    if (missingUniversityIds.length > 0) {
      throw new AppError(
        'Один из выбранных университетов больше недоступен в каталоге. Обнови выбор вузов в профиле.',
        409,
        'TRAJECTORY_SELECTED_UNIVERSITY_NOT_FOUND'
      )
    }
  }

  const draft = buildTrajectoryPlanDraft(profile, olympiads, universities, requestId)
  // Only the authenticated backend may call the privileged plan-writing RPC.
  // The user id comes from the already verified access token, never from req.body.
  const serviceSupabase = createSupabaseServiceClient()
  const { data: planId, error: createError } = await serviceSupabase.rpc(
    'create_trajectory_plan',
    { p_user_id: userId, p_plan: draft }
  )

  if (createError) {
    const missingFunction = /create_trajectory_plan|function .* does not exist|schema cache/i.test(createError.message)
    const profileChanged = createError.code === '40001'
    const rateLimited = createError.code === 'P0001' && /TRAJECTORY_GENERATION_RATE_LIMIT/.test(createError.message)
    throw new AppError(
      missingFunction
        ? 'Схема персональной траектории ещё не обновлена. Примени миграцию backend/supabase/migrations и повтори запрос.'
        : profileChanged
          ? 'Профиль изменился во время подготовки плана. Сохрани изменения и повтори генерацию.'
          : rateLimited
            ? 'Слишком часто создаются новые версии траектории. Подожди немного и повтори попытку.'
            : 'Не удалось сохранить новую версию персональной траектории.',
      missingFunction ? 503 : profileChanged ? 409 : rateLimited ? 429 : 500,
      missingFunction
        ? 'TRAJECTORY_SCHEMA_NOT_READY'
        : profileChanged
          ? 'TRAJECTORY_PROFILE_CHANGED'
          : rateLimited
            ? 'TRAJECTORY_GENERATION_RATE_LIMIT'
            : 'TRAJECTORY_GENERATE_FAILED'
    )
  }

  if (typeof planId !== 'string') {
    throw new AppError('Сервер не вернул идентификатор сохранённой траектории.', 500, 'TRAJECTORY_GENERATE_EMPTY_RESULT')
  }

  return getPlanById(supabase, userId, planId)
}

export async function updateTrajectoryTaskStatus(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  status: TrajectoryTaskStatus
): Promise<TrajectoryPlan> {
  // Direct authenticated clients cannot execute this write RPC. The backend
  // uses its server-only Supabase secret after verifying the caller's session.
  const serviceSupabase = createSupabaseServiceClient()
  const { data: planId, error } = await serviceSupabase.rpc(
    'update_trajectory_task_status',
    {
      p_user_id: userId,
      p_task_id: taskId,
      p_status: status
    }
  )

  if (error) {
    const missingFunction = /update_trajectory_task_status|function .* does not exist|schema cache/i.test(error.message)
    const taskNotFound = error.code === 'P0002'
    throw new AppError(
      missingFunction
        ? 'Схема персональной траектории ещё не обновлена. Примени миграцию и повтори запрос.'
        : taskNotFound
          ? 'Задача не найдена или относится к другой версии траектории.'
          : 'Не удалось обновить статус задачи из-за ошибки базы данных.',
      missingFunction ? 503 : taskNotFound ? 404 : 500,
      missingFunction
        ? 'TRAJECTORY_SCHEMA_NOT_READY'
        : taskNotFound
          ? 'TRAJECTORY_TASK_NOT_FOUND'
          : 'TRAJECTORY_TASK_UPDATE_FAILED'
    )
  }

  if (typeof planId !== 'string') {
    throw new AppError('Не удалось определить траекторию задачи.', 500, 'TRAJECTORY_TASK_PLAN_NOT_FOUND')
  }

  return getPlanById(supabase, userId, planId)
}
