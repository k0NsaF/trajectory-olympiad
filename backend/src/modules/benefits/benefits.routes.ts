
import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import { benefitCompareSchema } from './benefits.schema.js'
import { compareBenefits } from './benefits.service.js'

const router = Router()

router.get('/compare', async (req, res, next) => {
  try {
    const filters = benefitCompareSchema.parse(req.query)
    const supabase = createSupabaseClient()

    const benefits = await compareBenefits(
      supabase,
      filters
    )

    res.status(200).json(benefits)
  } catch (error) {
    next(error)
  }
})

export default router
