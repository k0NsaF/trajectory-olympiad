import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import { catalogListQuerySchema, catalogSlugSchema } from './catalog.schema.js'
import {
  getDirectionBySlug,
  getDirections,
  getProfessionBySlug,
  getProfessions
} from './catalog.service.js'

const router = Router()

router.get('/professions', async (req, res, next) => {
  try {
    const filters = catalogListQuerySchema.parse(req.query)
    res.status(200).json(await getProfessions(createSupabaseClient(), filters))
  } catch (error) {
    next(error)
  }
})

router.get('/professions/:slug', async (req, res, next) => {
  try {
    const { slug } = catalogSlugSchema.parse(req.params)
    res.status(200).json(await getProfessionBySlug(createSupabaseClient(), slug))
  } catch (error) {
    next(error)
  }
})

router.get('/directions', async (req, res, next) => {
  try {
    const filters = catalogListQuerySchema.parse(req.query)
    res.status(200).json(await getDirections(createSupabaseClient(), filters))
  } catch (error) {
    next(error)
  }
})

router.get('/directions/:slug', async (req, res, next) => {
  try {
    const { slug } = catalogSlugSchema.parse(req.params)
    res.status(200).json(await getDirectionBySlug(createSupabaseClient(), slug))
  } catch (error) {
    next(error)
  }
})

export default router
