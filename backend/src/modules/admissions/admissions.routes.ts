import { Router } from 'express'

import { createSupabaseClient } from '../../config/supabase.js'
import {
  admissionUniversityParamsSchema,
  admissionCampaignParamsSchema
} from './admissions.schema.js'
import {
  getUniversityAdmissionCampaigns,
  getUniversityAdmissionPrograms
} from './admissions.service.js'

const router = Router()

router.get('/universities/:universityId/campaigns', async (req, res, next) => {
  try {
    const { universityId } = admissionUniversityParamsSchema.parse(req.params)
    const supabase = createSupabaseClient()

    const campaigns = await getUniversityAdmissionCampaigns(
      supabase,
      universityId
    )

    res.status(200).json(campaigns)
  } catch (error) {
    next(error)
  }
})

router.get('/universities/:universityId/campaigns/:campaignId/programs', async (req, res, next) => {
  try {
    const params = admissionCampaignParamsSchema.parse(req.params)
    const supabase = createSupabaseClient()

    const result = await getUniversityAdmissionPrograms(
      supabase,
      params.universityId,
      params.campaignId
    )

    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
})

export default router