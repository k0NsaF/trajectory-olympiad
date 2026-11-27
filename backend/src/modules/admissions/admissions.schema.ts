import { z } from 'zod'

export const admissionUniversityParamsSchema = z.object({
  universityId: z.string().uuid()
})

export type AdmissionUniversityParams = z.infer<
  typeof admissionUniversityParamsSchema
>
export const admissionCampaignParamsSchema = z.object({
  universityId: z.string().uuid(),
  campaignId: z.string().uuid()
})