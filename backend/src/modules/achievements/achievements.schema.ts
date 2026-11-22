import { z } from 'zod'

const proofUrlSchema = z
  .string()
  .trim()
  .url('Укажи корректную ссылку на диплом.')
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === 'https:' || protocol === 'http:'
    } catch {
      return false
    }
  }, 'Разрешены только HTTP и HTTPS ссылки.')

export const createAchievementSchema = z.object({
  olympiadId: z.string().uuid().optional(),
  olympiadName: z.string().trim().min(2, 'Укажи название олимпиады.').max(200),
  resultStatus: z.enum(['participant', 'prize', 'winner']),
  grade: z.number().int().min(7).max(11),
  achievementYear: z.number().int().min(2000).max(new Date().getFullYear() + 1),
  proofUrl: proofUrlSchema.optional()
})

export type CreateAchievementInput = z.infer<
  typeof createAchievementSchema
>
