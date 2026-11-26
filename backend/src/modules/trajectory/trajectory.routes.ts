import { Router } from 'express'

import { authenticate } from '../../middleware/authenticate.js'
import { validateBody } from '../../middleware/validate.js'
import { getAuthContext } from '../../utils/authContext.js'
import { trajectoryGenerationRateLimit } from './trajectory.rate-limit.js'
import {
  generateTrajectorySchema,
  trajectoryPlanIdSchema,
  trajectoryTaskIdSchema,
  updateTrajectoryTaskStatusSchema
} from './trajectory.schema.js'
import {
  generateTrajectory,
  getActiveTrajectory,
  getTrajectoryHistory,
  getTrajectoryPlanById,
  updateTrajectoryTaskStatus
} from './trajectory.service.js'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)
    const plan = await getActiveTrajectory(supabase, userId)
    res.status(200).json({ plan })
  } catch (error) {
    next(error)
  }
})

router.get('/history', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)
    const items = await getTrajectoryHistory(supabase, userId)
    res.status(200).json({ items })
  } catch (error) {
    next(error)
  }
})

router.get('/:planId', async (req, res, next) => {
  try {
    const { planId } = trajectoryPlanIdSchema.parse(req.params)
    const { userId, supabase } = getAuthContext(req)
    const plan = await getTrajectoryPlanById(supabase, userId, planId)
    res.status(200).json({ plan })
  } catch (error) {
    next(error)
  }
})

router.post('/generate', validateBody(generateTrajectorySchema), trajectoryGenerationRateLimit, async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)
    const plan = await generateTrajectory(supabase, userId, req.body.requestId)
    res.status(201).json({ plan })
  } catch (error) {
    next(error)
  }
})

router.patch(
  '/tasks/:taskId',
  validateBody(updateTrajectoryTaskStatusSchema),
  async (req, res, next) => {
    try {
      const { taskId } = trajectoryTaskIdSchema.parse(req.params)
      const { userId, supabase } = getAuthContext(req)
      const plan = await updateTrajectoryTaskStatus(
        supabase,
        userId,
        taskId,
        req.body.status
      )
      res.status(200).json({ plan })
    } catch (error) {
      next(error)
    }
  }
)

export default router
