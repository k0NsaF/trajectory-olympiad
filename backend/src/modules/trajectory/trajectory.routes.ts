
import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import { validateBody } from '../../middleware/validate.js'
import { createTrajectorySchema } from './trajectory.schema.js'
import { generateTrajectory } from './trajectory.service.js'

const router = Router()

router.post(
  '/',
  validateBody(createTrajectorySchema),
  async (req, res, next) => {
    try {
      const supabase = createSupabaseClient()
      const trajectory = await generateTrajectory(
        supabase,
        req.body
      )

      res.status(200).json(trajectory)
    } catch (error) {
      next(error)
    }
  }
)

export default router
