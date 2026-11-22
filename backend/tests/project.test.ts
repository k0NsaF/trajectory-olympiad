import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'

import { app } from '../src/app.js'
import { createAchievementSchema } from '../src/modules/achievements/achievements.schema.js'
import { aiAskSchema } from '../src/modules/ai/ai.schema.js'
import { benefitCompareSchema } from '../src/modules/benefits/benefits.schema.js'
import { olympiadFiltersSchema } from '../src/modules/olympiads/olympiads.schema.js'
import {
  saveProfilePreferencesSchema,
  saveProfileSchema
} from '../src/modules/profiles/profiles.schema.js'
import {
  createReminderSchema,
  updateReminderStatusSchema
} from '../src/modules/reminders/reminders.schema.js'
import { createTrajectorySchema } from '../src/modules/trajectory/trajectory.schema.js'

const UNIVERSITY_ID = '10000000-0000-4000-8000-000000000001'
const PROGRAM_ID = '50000000-0000-4000-8000-000000000001'

function validProfile() {
  return {
    grade: 9,
    region: 'Москва',
    subjects: ['mathematics', 'informatics']
  }
}

test('схемы данных: корректные сценарии и ограничения', async (t) => {
  await t.test('профиль принимает корректную анкету', () => {
    const result = saveProfileSchema.safeParse({
      ...validProfile(),
      targetUniversityId: UNIVERSITY_ID,
      targetProgramId: PROGRAM_ID
    })

    assert.equal(result.success, true)
  })

  await t.test('профиль запрещает класс вне диапазона 7–11', () => {
    const result = saveProfileSchema.safeParse({
      ...validProfile(),
      grade: 6
    })

    assert.equal(result.success, false)
  })

  await t.test('профиль требует вуз при выборе программы', () => {
    const result = saveProfileSchema.safeParse({
      ...validProfile(),
      targetProgramId: PROGRAM_ID
    })

    assert.equal(result.success, false)
  })

  await t.test('профиль запрещает повторяющиеся предметы', () => {
    const result = saveProfileSchema.safeParse({
      ...validProfile(),
      subjects: ['mathematics', 'mathematics']
    })

    assert.equal(result.success, false)
  })

  await t.test('настройки принимают только известную тему и три переключателя', () => {
    const result = saveProfilePreferencesSchema.safeParse({
      themePreference: 'system',
      notificationPreferences: {
        registrationReminders: true,
        stageDeadlines: false,
        newsUpdates: true
      }
    })

    assert.equal(result.success, true)
    assert.equal(saveProfilePreferencesSchema.safeParse({
      themePreference: 'blue',
      notificationPreferences: {
        registrationReminders: true,
        stageDeadlines: true,
        newsUpdates: true
      }
    }).success, false)
  })

  await t.test('генератор принимает валидные входные данные и отклоняет некорректный класс', () => {
    assert.equal(createTrajectorySchema.safeParse(validProfile()).success, true)
    assert.equal(createTrajectorySchema.safeParse({
      ...validProfile(),
      grade: 12
    }).success, false)
  })

  await t.test('достижение требует название, статус, класс и год', () => {
    const valid = {
      olympiadName: 'Олимпиада «Физтех»',
      resultStatus: 'winner',
      grade: 10,
      achievementYear: new Date().getFullYear()
    }

    assert.equal(createAchievementSchema.safeParse(valid).success, true)
    assert.equal(createAchievementSchema.safeParse({
      ...valid,
      grade: 6
    }).success, false)
    assert.equal(createAchievementSchema.safeParse({
      ...valid,
      proofUrl: 'javascript:alert(1)'
    }).success, false)
  })

  await t.test('напоминание требует дату со смещением часового пояса', () => {
    const valid = {
      title: 'Регистрация на олимпиаду',
      type: 'registration_deadline',
      dueAt: '2026-12-01T18:00:00+03:00'
    }

    assert.equal(createReminderSchema.safeParse(valid).success, true)
    assert.equal(createReminderSchema.safeParse({
      ...valid,
      dueAt: '2026-12-01'
    }).success, false)
    assert.equal(updateReminderStatusSchema.safeParse({ status: 'completed' }).success, true)
  })

  await t.test('каталог нормализует фильтры и удаляет повторяющиеся предметы', () => {
    const parsed = olympiadFiltersSchema.parse({
      subjects: 'mathematics,informatics,mathematics',
      hasBenefits: 'true',
      grade: '10',
      level: '2'
    })

    assert.deepEqual(parsed.subjects, ['mathematics', 'informatics'])
    assert.equal(parsed.hasBenefits, true)
    assert.equal(parsed.grade, 10)
    assert.equal(olympiadFiltersSchema.safeParse({ grade: '6' }).success, false)
    assert.equal(olympiadFiltersSchema.safeParse({}).success, true)
  })

  await t.test('сравнение льгот проверяет UUID, год и статус', () => {
    const parsed = benefitCompareSchema.parse({
      universityId: UNIVERSITY_ID,
      validYear: '2027',
      verificationStatus: 'official'
    })

    assert.equal(parsed.validYear, 2027)
    assert.equal(benefitCompareSchema.safeParse({
      universityId: 'wrong-id'
    }).success, false)
  })

  await t.test('ИИ ограничивает размер вопроса и истории и валидирует контекст', () => {
    const parsed = aiAskSchema.safeParse({
      question: 'Какие олимпиады подходят мне?',
      context: {
        grade: '9',
        page: 'catalog',
        subjects: ['mathematics', 'informatics']
      },
      history: [{ role: 'user', content: 'Я учусь в девятом классе' }]
    })

    assert.equal(parsed.success, true)
    assert.equal(aiAskSchema.safeParse({ question: 'да' }).success, false)
    assert.equal(aiAskSchema.safeParse({
      question: 'Подбери олимпиады',
      history: Array.from({ length: 9 }, () => ({
        role: 'user',
        content: 'Предыдущий вопрос'
      }))
    }).success, false)
  })
})

test('HTTP smoke-тесты Express API', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    const healthBody = await healthResponse.json() as { success?: boolean }
    assert.equal(healthBody.success, true)
    assert.equal(healthResponse.headers.get('x-powered-by'), null)

    const profileResponse = await fetch(`${baseUrl}/api/profile`)
    assert.equal(profileResponse.status, 401)
    const profileBody = await profileResponse.json() as { code?: string }
    assert.equal(profileBody.code, 'AUTHENTICATION_REQUIRED')

    const achievementsResponse = await fetch(`${baseUrl}/api/achievements`)
    assert.equal(achievementsResponse.status, 401)
    const achievementsBody = await achievementsResponse.json() as { code?: string }
    assert.equal(achievementsBody.code, 'AUTHENTICATION_REQUIRED')

    const invalidCatalogResponse = await fetch(`${baseUrl}/api/olympiads?grade=6`)
    assert.equal(invalidCatalogResponse.status, 400)
    const invalidCatalogBody = await invalidCatalogResponse.json() as { code?: string }
    assert.equal(invalidCatalogBody.code, 'VALIDATION_ERROR')

    const invalidAiResponse = await fetch(`${baseUrl}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'да' })
    })
    assert.equal(invalidAiResponse.status, 400)
    const invalidAiBody = await invalidAiResponse.json() as { code?: string }
    assert.equal(invalidAiBody.code, 'VALIDATION_ERROR')

    const corsResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example' }
    })
    assert.equal(corsResponse.status, 403)
    const corsBody = await corsResponse.json() as { code?: string }
    assert.equal(corsBody.code, 'CORS_ORIGIN_DENIED')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
