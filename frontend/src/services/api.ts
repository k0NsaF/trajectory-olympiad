import { APP_CONFIG, API_BASE_URL, IS_SUPABASE_CONFIGURED } from '@/config/env'
import { getSupabaseClient } from '@/lib/supabase'

export interface ApiErrorPayload {
  message?: string
  code?: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface ApiRequestOptions
  extends Omit<RequestInit, 'method' | 'body'> {
  token?: string | null
  timeoutMs?: number
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message
  }

  return fallback
}

async function resolveAccessToken(
  explicitToken?: string | null
): Promise<string | null> {
  if (explicitToken) {
    return explicitToken
  }

  if (!IS_SUPABASE_CONFIGURED) {
    return null
  }

  try {
    const {
      data: { session }
    } = await getSupabaseClient().auth.getSession()

    return session?.access_token ?? null
  } catch {
    return null
  }
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { token, timeoutMs, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)

  headers.set('Accept', 'application/json')

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const accessToken = await resolveAccessToken(token)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs ?? APP_CONFIG.requestTimeout
  )

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      method,
      headers,
      signal: fetchOptions.signal ?? controller.signal,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body)
    })

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    let data: unknown

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      const message = getErrorMessage(
        data,
        `Ошибка запроса: ${response.status}`
      )

      const errorData =
        data && typeof data === 'object'
          ? (data as ApiErrorPayload)
          : undefined

      throw new ApiError(
        message,
        response.status,
        errorData?.code,
        errorData?.details
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'Превышено время ожидания ответа сервера',
        408
      )
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        'Не удалось связаться с сервером. Проверь подключение.',
        0
      )
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  get<T>(
    path: string,
    options?: ApiRequestOptions
  ): Promise<T> {
    return request<T>(path, 'GET', undefined, options)
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return request<TResponse>(path, 'POST', body, options)
  },

  put<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return request<TResponse>(path, 'PUT', body, options)
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return request<TResponse>(path, 'PATCH', body, options)
  },

  delete<TResponse>(
    path: string,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return request<TResponse>(path, 'DELETE', undefined, options)
  }
}
