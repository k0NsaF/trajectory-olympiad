
import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import { olympiadDetailsQuerySchema, olympiadFiltersSchema, olympiadIdSchema } from './olympiads.schema.js'
import {
  getOlympiadById,
  getOlympiads
} from './olympiads.service.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const filters = olympiadFiltersSchema.parse(req.query)
    const supabase = createSupabaseClient()
    const olympiads = await getOlympiads(supabase, filters)

    res.status(200).json(olympiads)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = olympiadIdSchema.parse(req.params)
    const { academicYear, calendarYear } = olympiadDetailsQuerySchema.parse(req.query)
    const supabase = createSupabaseClient()
    const olympiad = await getOlympiadById(supabase, id, { academicYear, calendarYear })

    res.status(200).json(olympiad)
  } catch (error) {
    next(error)
  }
})

export default router
