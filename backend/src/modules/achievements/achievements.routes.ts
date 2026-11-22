
import { Router } from 'express'

import { authenticate } from '../../middleware/authenticate.js'
import { validateBody } from '../../middleware/validate.js'
import { getAuthContext } from '../../utils/authContext.js'

import { createAchievementSchema } from './achievements.schema.js'
import {
  createAchievement,
  getAchievements
} from './achievements.service.js'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)

    const achievements = await getAchievements(
      supabase,
      userId
    )

    res.status(200).json(achievements)
  } catch (error) {
    next(error)
  }
})

router.post(
  '/',
  validateBody(createAchievementSchema),
  async (req, res, next) => {
    try {
      const { userId, supabase } = getAuthContext(req)

      const achievement = await createAchievement(
        supabase,
        userId,
        req.body
      )

      res.status(201).json(achievement)
    } catch (error) {
      next(error)
    }
  }
)

export default router
