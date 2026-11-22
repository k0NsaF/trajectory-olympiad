
import { useCallback, useEffect, useState } from 'react'

export type AsyncLoader<T> = () => Promise<T>

export interface AsyncDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useAsyncData<T>(
  loader: AsyncLoader<T>,
  initialData: T | null = null
): AsyncDataResult<T> {
  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await loader()

        if (active) {
          setData(result)
        }
      } catch (cause: unknown) {
        if (!active) {
          return
        }

        setError(
          cause instanceof Error
            ? cause.message
            : 'Произошла неизвестная ошибка'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [loader, reloadKey])

  return {
    data,
    loading,
    error,
    reload
  }
}
