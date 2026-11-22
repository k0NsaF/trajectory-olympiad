
import type { RequestHandler } from 'express'

import { AppError } from '../utils/AppError.js'

export const notFound: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      `Маршрут ${req.method} ${req.originalUrl} не найден.`,
      404,
      'ROUTE_NOT_FOUND'
    )
  )
}
