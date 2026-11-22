
import type { RequestHandler } from 'express'

import { createSupabaseClient } from '../config/supabase.js'
import { AppError } from '../utils/AppError.js'

export const authenticate: RequestHandler = async (
  req,
  _res,
  next
) => {
  try {
    const authorization = req.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError(
        'Для выполнения этого действия необходимо войти в аккаунт.',
        401,
        'AUTHENTICATION_REQUIRED'
      )
    }

    const token = authorization.slice(7).trim()

    if (!token) {
      throw new AppError(
        'Токен авторизации отсутствует.',
        401,
        'INVALID_TOKEN'
      )
    }

    const supabase = createSupabaseClient(token)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      throw new AppError(
        'Сессия недействительна или истекла. Войди в аккаунт повторно.',
        401,
        'INVALID_SESSION'
      )
    }

    req.user = data.user
    req.supabase = supabase

    next()
  } catch (error) {
    next(error)
  }
}
