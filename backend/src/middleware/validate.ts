
import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

import { AppError } from '../utils/AppError.js'

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      next(
        new AppError(
          'Проверь правильность заполнения отправленных данных.',
          400,
          'VALIDATION_ERROR',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        )
      )

      return
    }

    req.body = result.data
    next()
  }
}
