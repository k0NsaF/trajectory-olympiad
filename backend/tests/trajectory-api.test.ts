import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'

import { app } from '../src/app.js'

test('API персональной траектории закрыт авторизацией', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const endpoints = [
      { url: '/api/trajectory', method: 'GET' },
      { url: '/api/trajectory/history', method: 'GET' },
      { url: '/api/trajectory/00000000-0000-4000-8000-000000000001', method: 'GET' },
      { url: '/api/trajectory/generate', method: 'POST' },
      { url: '/api/trajectory/tasks/00000000-0000-4000-8000-000000000001', method: 'PATCH' }
    ] as const

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint.url}`, { method: endpoint.method })
      assert.equal(response.status, 401, `${endpoint.method} ${endpoint.url} must require authentication`)
      const body = await response.json() as { code?: string }
      assert.equal(body.code, 'AUTHENTICATION_REQUIRED')
    }
  } finally {
    server.close()
    await once(server, 'close')
  }
})
