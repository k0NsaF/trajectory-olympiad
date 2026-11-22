import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import {
  universityDiscoverySchema,
  universityIdSchema,
  universityQuerySchema
} from './universities.schema.js'
import {
  getUniversities,
  getUniversityById
} from './universities.service.js'
import { universityDiscoveryRateLimit } from './universities.discovery-rate-limit.js'
import {
  getTavilySearchStatus,
  searchTavilyWeb
} from '../../services/tavily-search.service.js'

const router = Router()

router.get('/discover/status', (_req, res) => {
  res.status(200).json(getTavilySearchStatus())
})

router.get('/discover', universityDiscoveryRateLimit, async (req, res, next) => {
  try {
    const filters = universityDiscoverySchema.parse(req.query)
    const results = await searchTavilyWeb(filters)

    res.status(200).json({
      query: filters.query,
      mode: filters.mode,
      results,
      note: 'Это результаты внешнего поиска. Они не добавлены в справочник проекта и не подтверждают официальность условий приёма. Проверяй сайт университета.'
    })
  } catch (error) {
    next(error)
  }
})

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
