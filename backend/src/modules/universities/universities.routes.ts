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
  getUniversitySearchStatus,
  searchUniversitiesWeb
} from '../../services/groq-university-search.service.js'

const router = Router()

router.get('/discover/status', (_req, res) => {
  res.status(200).json(getUniversitySearchStatus())
})

router.get('/discover', universityDiscoveryRateLimit, async (req, res, next) => {
  try {
    const filters = universityDiscoverySchema.parse(req.query)
    const search = await searchUniversitiesWeb(filters)

    res.status(200).json({
      query: filters.query,
      mode: filters.mode,
      provider: search.provider,
      results: search.results,
      note: `${search.provider === 'groq' ? 'Поиск выполнен через Groq Browser Search.' : 'Основной поиск Groq был недоступен, использован резервный Tavily.'} Найденные страницы — кандидаты для изучения: они не добавлены в справочник и сами по себе не подтверждают аккредитацию, действующие условия приёма или олимпиадные льготы. Проверяй первоисточник.`
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
