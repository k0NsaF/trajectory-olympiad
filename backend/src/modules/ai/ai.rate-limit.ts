import type { RequestHandler } from 'express'

import { AppError } from '../../utils/AppError.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 12
const requestsByIp = new Map<string, RateLimitEntry>()
let lastCleanupAt = 0

export const aiRateLimit: RequestHandler = (req, _res, next) => {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'

  if (now - lastCleanupAt > WINDOW_MS) {
    for (const [ip, entry] of requestsByIp) {
      if (entry.resetAt <= now) requestsByIp.delete(ip)
    }
    lastCleanupAt = now
  }

  const current = requestsByIp.get(key)

  if (!current || current.resetAt <= now) {
    requestsByIp.set(key, { count: 1, resetAt: now + WINDOW_MS })
    next()
    return
  }

  if (current.count >= MAX_REQUESTS) {
    next(new AppError(
      'Слишком много запросов к консультанту. Попробуй ещё раз через минуту.',
      429,
      'AI_RATE_LIMITED'
    ))
    return
  }

  current.count += 1
  next()
}
