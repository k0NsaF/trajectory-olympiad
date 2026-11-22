import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import { validateBody } from '../../middleware/validate.js'
import { aiRateLimit } from './ai.rate-limit.js'
import { aiAskSchema } from './ai.schema.js'
import { askAI } from './ai.service.js'

const router = Router()

router.post(
  '/ask',
  aiRateLimit,
  validateBody(aiAskSchema),
  async (req, res, next) => {
    try {
      const supabase = createSupabaseClient()
      const result = await askAI(supabase, req.body)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  }
)

export default router
