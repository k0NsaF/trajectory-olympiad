
import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import {
  universityIdSchema,
  universityQuerySchema
} from './universities.schema.js'
import {
  getUniversities,
  getUniversityById
} from './universities.service.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const filters = universityQuerySchema.parse(req.query)
    const supabase = createSupabaseClient()

    const universities = await getUniversities(
      supabase,
      filters
    )

    res.status(200).json(universities)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = universityIdSchema.parse(req.params)
    const supabase = createSupabaseClient()

    const university = await getUniversityById(
      supabase,
      id
    )

    res.status(200).json(university)
  } catch (error) {
    next(error)
  }
})

export default router
