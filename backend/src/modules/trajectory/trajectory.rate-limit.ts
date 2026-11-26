import type { RequestHandler } from 'express'

import { AppError } from '../../utils/AppError.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 3
const requestsByUser = new Map<string, RateLimitEntry>()
let lastCleanupAt = 0

/**
 * Process-level guard to avoid repeatedly loading catalogs and building drafts.
 * A second, authoritative limit is enforced in PostgreSQL for multi-instance
 * deployments and direct service-role RPC calls.
 */
export const trajectoryGenerationRateLimit: RequestHandler = (req, _res, next) => {
  const now = Date.now()
  const userId = req.user?.id

  if (!userId) {
    next(new AppError('Требуется авторизация.', 401, 'AUTHENTICATION_REQUIRED'))
    return
  }

  if (now - lastCleanupAt > WINDOW_MS) {
    for (const [id, entry] of requestsByUser) {
      if (entry.resetAt <= now) requestsByUser.delete(id)
    }
    lastCleanupAt = now
  }

  const current = requestsByUser.get(userId)
  if (!current || current.resetAt <= now) {
    requestsByUser.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    next()
    return
  }

  if (current.count >= MAX_REQUESTS) {
    next(new AppError(
      'Слишком часто запрашивается новая траектория. Подожди минуту и повтори попытку.',
      429,
      'TRAJECTORY_GENERATION_RATE_LIMIT'
    ))
    return
  }

  current.count += 1
  next()
}
