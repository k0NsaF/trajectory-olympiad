import assert from 'node:assert/strict'
import type { NextFunction, Request, Response } from 'express'
import { test } from 'node:test'

import { trajectoryGenerationRateLimit } from '../src/modules/trajectory/trajectory.rate-limit.js'
import { AppError } from '../src/utils/AppError.js'

function runLimit(userId: string): AppError | undefined {
  let receivedError: AppError | undefined
  const req = { user: { id: userId } } as unknown as Request
  const next = ((error?: AppError) => {
    receivedError = error
  }) as NextFunction

  trajectoryGenerationRateLimit(req, {} as Response, next)
  return receivedError
}

test('ограничитель генерации персональной траектории', async (t) => {
  await t.test('ограничивает частоту отдельно для каждого пользователя', () => {
    const userA = 'trajectory-rate-limit-user-a'
    const userB = 'trajectory-rate-limit-user-b'

    assert.equal(runLimit(userA), undefined)
    assert.equal(runLimit(userA), undefined)
    assert.equal(runLimit(userA), undefined)

    const blocked = runLimit(userA)
    assert.ok(blocked instanceof AppError)
    assert.equal(blocked.statusCode, 429)
    assert.equal(blocked.code, 'TRAJECTORY_GENERATION_RATE_LIMIT')

    // Another account has its own independent window.
    assert.equal(runLimit(userB), undefined)
  })

  await t.test('не пропускает запрос без установленного пользователя', () => {
    const req = {} as Request
    let receivedError: AppError | undefined
    const next = ((error?: AppError) => {
      receivedError = error
    }) as NextFunction

    trajectoryGenerationRateLimit(req, {} as Response, next)

    assert.ok(receivedError instanceof AppError)
    assert.equal(receivedError.statusCode, 401)
    assert.equal(receivedError.code, 'AUTHENTICATION_REQUIRED')
  })
})
