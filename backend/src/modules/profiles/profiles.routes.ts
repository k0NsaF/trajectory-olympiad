import { Router } from 'express'

import { authenticate } from '../../middleware/authenticate.js'
import { validateBody } from '../../middleware/validate.js'
import { getAuthContext } from '../../utils/authContext.js'

import {
  saveProfilePreferencesSchema,
  saveProfileSchema
} from './profiles.schema.js'
import {
  getProfile,
  getProfilePreferences,
  saveProfile,
  saveProfilePreferences
} from './profiles.service.js'

const router = Router()

router.use(authenticate)

router.get('/preferences', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)
    const preferences = await getProfilePreferences(supabase, userId)
    res.status(200).json(preferences)
  } catch (error) {
    next(error)
  }
})

router.put(
  '/preferences',
  validateBody(saveProfilePreferencesSchema),
  async (req, res, next) => {
    try {
      const { userId, supabase } = getAuthContext(req)
      const preferences = await saveProfilePreferences(
        supabase,
        userId,
        req.body
      )
      res.status(200).json(preferences)
    } catch (error) {
      next(error)
    }
  }
)

router.get('/', async (req, res, next) => {
  try {
    const { userId, supabase } = getAuthContext(req)
    const profile = await getProfile(supabase, userId)
    res.status(200).json(profile)
  } catch (error) {
    next(error)
  }
})

router.put(
  '/',
  validateBody(saveProfileSchema),
  async (req, res, next) => {
    try {
      const { userId, supabase } = getAuthContext(req)

      const user = req.user
      const fullName = typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : undefined
      const profile = await saveProfile(
        supabase,
        userId,
        req.body,
        user?.email,
        fullName
      )

      res.status(200).json(profile)
    } catch (error) {
      next(error)
    }
  }
)

export default router
