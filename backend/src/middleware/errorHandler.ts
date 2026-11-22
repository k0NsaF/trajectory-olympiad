
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { env, isProduction } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {
  if (res.headersSent) {
    next(error)
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Проверь правильность заполнения данных.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    })
    return
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details !== undefined
        ? { details: error.details }
        : {})
    })
    return
  }

  console.error('Unhandled API error:', {
    method: req.method,
    path: req.originalUrl,
    error
  })

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: isProduction
      ? 'Внутренняя ошибка сервера.'
      : error instanceof Error
        ? error.message
        : 'Неизвестная ошибка сервера.',
    ...(env.nodeEnv !== 'production' && error instanceof Error
      ? { stack: error.stack }
      : {})
  })
}
