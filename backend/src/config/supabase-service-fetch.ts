/**
 * Supabase JS 2.57 sends the configured API key as both `apikey` and the
 * fallback `Authorization: Bearer ...` value. New `sb_secret_` keys are not
 * JWTs and must only be sent in `apikey`. Keep real Authorization JWTs intact.
 */
export function createSupabaseServiceFetch(
  apiKey: string,
  fetchImpl: typeof fetch = globalThis.fetch
): typeof fetch {
  if (!apiKey.startsWith('sb_secret_')) {
    return fetchImpl
  }

  return async (input, init) => {
    const requestHeaders = input instanceof Request ? input.headers : undefined
    const headers = new Headers(requestHeaders)

    new Headers(init?.headers).forEach((value, name) => {
      headers.set(name, value)
    })

    if (headers.get('authorization') === `Bearer ${apiKey}`) {
      headers.delete('authorization')
    }

    return fetchImpl(input, {
      ...init,
      headers
    })
  }
}
