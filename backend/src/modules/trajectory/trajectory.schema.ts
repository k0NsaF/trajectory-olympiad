import { z } from 'zod'

export const generateTrajectorySchema = z.object({
  requestId: z.string().uuid()
}).strict()

export const updateTrajectoryTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'completed', 'skipped'])
}).strict()

export const trajectoryTaskIdSchema = z.object({
  taskId: z.string().uuid()
}).strict()

export type GenerateTrajectoryInput = z.infer<typeof generateTrajectorySchema>
export type UpdateTrajectoryTaskStatusInput = z.infer<
  typeof updateTrajectoryTaskStatusSchema
>

export const trajectoryPlanIdSchema = z.object({
  planId: z.string().uuid()
}).strict()
