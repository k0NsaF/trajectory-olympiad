import assert from 'node:assert/strict'
import test from 'node:test'

import { createSupabaseServiceFetch } from '../src/config/supabase-service-fetch.js'

const secretKey = 'sb_secret_test-key-value'

function recordingFetch() {
  let capturedHeaders: Headers | null = null
  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response(null, { status: 204 })
  }
  return {
    fetchImpl,
    getHeaders: () => capturedHeaders
  }
}

test('new Supabase secret key stays in apikey and is not copied into Authorization', async () => {
  const recorder = recordingFetch()
  const wrappedFetch = createSupabaseServiceFetch(secretKey, recorder.fetchImpl)
  const request = new Request('https://staging.supabase.co/rest/v1/profiles', {
    method: 'POST',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  })

  await wrappedFetch(request)

  const headers = recorder.getHeaders()
  assert.ok(headers)
  assert.equal(headers.get('apikey'), secretKey)
  assert.equal(headers.get('authorization'), null)
  assert.equal(headers.get('content-type'), 'application/json')
})

test('new Supabase secret key does not remove a genuine user JWT Authorization header', async () => {
  const recorder = recordingFetch()
  const wrappedFetch = createSupabaseServiceFetch(secretKey, recorder.fetchImpl)
  const userJwt = 'eyJhbGciOiJIUzI1NiJ9.user.signature'
  const request = new Request('https://staging.supabase.co/rest/v1/profiles', {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${userJwt}`
    }
  })

  await wrappedFetch(request)

  assert.equal(recorder.getHeaders()?.get('authorization'), `Bearer ${userJwt}`)
})

test('legacy service_role JWT keeps the SDK default Authorization behavior', () => {
  const legacyKey = 'eyJhbGciOiJIUzI1NiJ9.legacy.signature'
  const recorder = recordingFetch()

  assert.equal(
    createSupabaseServiceFetch(legacyKey, recorder.fetchImpl),
    recorder.fetchImpl
  )
})
