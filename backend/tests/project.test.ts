import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'

import { app } from '../src/app.js'
import { createAchievementSchema } from '../src/modules/achievements/achievements.schema.js'
import { aiAskSchema } from '../src/modules/ai/ai.schema.js'
import { shouldUseExternalUniversitySearch } from '../src/modules/ai/ai.service.js'
import { universityDiscoverySchema } from '../src/modules/universities/universities.schema.js'
import { buildUniversitySearchQuery, parseTavilySearchResponse } from '../src/services/tavily-search.service.js'
import {
  buildCloudflareMessages,
  buildCloudflareRequestPayload,
  extractCloudflareText
} from '../src/services/cloudflare-ai.service.js'
import {
  buildGroqMessages,
  buildGroqRequestPayload,
  extractGroqText
} from '../src/services/groq-ai.service.js'
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

  await t.test('поиск вузов принимает запрос и требует домен для поиска программ', () => {
    assert.equal(universityDiscoverySchema.safeParse({
      query: 'университеты Москвы',
      mode: 'universities'
    }).success, true)

    assert.equal(universityDiscoverySchema.safeParse({
      query: 'программы искусственного интеллекта',
      mode: 'programs'
    }).success, false)

    assert.equal(universityDiscoverySchema.safeParse({
      query: 'программы искусственного интеллекта',
      mode: 'programs',
      domain: 'mipt.ru'
    }).success, true)
  })

  await t.test('поиск программ ограничивается доменом выбранного вуза', () => {
    const query = buildUniversitySearchQuery({
      query: 'искусственный интеллект',
      mode: 'programs',
      domain: 'mipt.ru'
    })
    assert.match(query, /site:mipt\.ru/u)
    assert.match(query, /искусственный интеллект/u)
  })

  await t.test('парсер Tavily Search API извлекает ссылки и отбрасывает локальные адреса', () => {
    const payload = {
      results: [
        {
          title: 'МФТИ — официальный сайт',
          url: 'https://www.mipt.ru/',
          content: 'Официальный сайт Московского физико-технического института.'
        },
        {
          title: 'Локальный адрес',
          url: 'http://127.0.0.1/admin',
          content: 'Не должен отображаться'
        },
        {
          title: 'Внутренний адрес',
          url: 'https://localhost/admin',
          content: 'Не должен отображаться'
        }
      ]
    }
    const results = parseTavilySearchResponse(payload)
    assert.equal(results.length, 1)
    assert.equal(results[0]?.domain, 'mipt.ru')
    assert.equal(results[0]?.title, 'МФТИ — официальный сайт')
    assert.match(results[0]?.snippet ?? '', /физико-технического/u)
  })

  await t.test('парсер Cloudflare Workers AI извлекает текст из REST API response', () => {
    const response = {
      success: true,
      result: { response: 'МФТИ предлагает образовательные программы.' },
      errors: [],
      messages: []
    }

    assert.equal(extractCloudflareText(response), 'МФТИ предлагает образовательные программы.')
    assert.equal(extractCloudflareText({
      success: true,
      result: {
        choices: [{ message: { content: 'План подготовки на три месяца.' } }]
      }
    }), 'План подготовки на три месяца.')
    assert.equal(extractCloudflareText({ success: true, result: {} }), null)
  })

  await t.test('Cloudflare отключает reasoning, чтобы модель возвращала итоговый ответ', () => {
    const payload = buildCloudflareRequestPayload({
      systemInstruction: 'Ты — образовательный консультант.',
      userPrompt: 'Составь план подготовки.'
    })

    assert.deepEqual(payload.chat_template_kwargs, { enable_thinking: false })
    assert.equal(payload.max_completion_tokens, 1_400)
    assert.equal(payload.messages.at(-1)?.content, 'Составь план подготовки.')
  })

  await t.test('Cloudflare получает system prompt, историю и текущий вопрос в правильном порядке', () => {
    const messages = buildCloudflareMessages({
      systemInstruction: 'Ты — образовательный консультант.',
      history: [
        { role: 'assistant', content: 'Старое сообщение до истории пользователя' },
        { role: 'user', content: 'Я учусь в 9 классе.' },
        { role: 'assistant', content: 'Понял.' }
      ],
      userPrompt: 'Подбери олимпиады.'
    })

    assert.deepEqual(messages.map((message) => message.role), ['system', 'user', 'assistant', 'user'])
    assert.equal(messages[0]?.content, 'Ты — образовательный консультант.')
    assert.equal(messages.at(-1)?.content, 'Подбери олимпиады.')
  })

  await t.test('Groq API извлекает текст из Chat Completions response', () => {
    assert.equal(extractGroqText({
      choices: [{ message: { content: 'План подготовки на 12 недель.' } }]
    }), 'План подготовки на 12 недель.')
    assert.equal(extractGroqText({
      choices: [{ message: { content: [
        { type: 'text', text: 'Сначала изучи теорию.' },
        { type: 'text', text: 'Затем решай задачи.' }
      ] } }]
    }), 'Сначала изучи теорию.\nЗатем решай задачи.')
    assert.equal(extractGroqText({ choices: [{ message: { content: '' } }] }), null)
  })

  await t.test('Groq формирует совместимый запрос для GPT-OSS-120B', () => {
    const payload = buildGroqRequestPayload({
      systemInstruction: 'Ты — образовательный консультант.',
      history: [{ role: 'user', content: 'Я учусь в 9 классе.' }],
      userPrompt: 'Составь план подготовки.'
    })

    assert.equal(payload.model, 'openai/gpt-oss-120b')
    assert.equal(payload.reasoning_effort, 'low')
    assert.equal(payload.max_completion_tokens, 2_600)
    assert.deepEqual(payload.messages.map((message) => message.role), ['system', 'user'])
    assert.match(payload.messages.at(-1)?.content ?? '', /Составь план подготовки/u)
    assert.match(payload.messages.at(-1)?.content ?? '', /Я учусь в 9 классе/u)
  })

  await t.test('Groq сохраняет историю диалога и пропускает раннее сообщение ассистента', () => {
    const messages = buildGroqMessages({
      systemInstruction: 'Системная инструкция.',
      history: [
        { role: 'assistant', content: 'Сообщение без вопроса' },
        { role: 'user', content: 'Мне нужна математика.' },
        { role: 'assistant', content: 'Хорошо.' }
      ],
      userPrompt: 'Подбери олимпиаду.'
    })

    assert.deepEqual(messages.map((message) => message.role), ['system', 'user', 'assistant', 'user'])
    assert.equal(messages.at(-1)?.content, 'Подбери олимпиаду.')
  })

  await t.test('ИИ запускает внешний поиск только для запросов о поиске вузов и программ', () => {
    assert.equal(shouldUseExternalUniversitySearch('Найди вузы Москвы с программой биоинформатика'), true)
    assert.equal(shouldUseExternalUniversitySearch('Подбери образовательные программы по искусственному интеллекту'), true)
    assert.equal(shouldUseExternalUniversitySearch('Как подготовиться к олимпиаде по математике?'), false)
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

    const aiStatusResponse = await fetch(`${baseUrl}/api/ai/status`)
    assert.equal(aiStatusResponse.status, 200)
    const aiStatus = await aiStatusResponse.json() as Record<string, unknown>
    assert.equal(typeof aiStatus.modelConfigured, 'boolean')
    assert.equal(typeof aiStatus.webSearchEnabled, 'boolean')
    assert.equal(typeof aiStatus.webSearchConfigured, 'boolean')
    assert.equal(typeof aiStatus.model, 'string')
    assert.equal('apiKey' in aiStatus, false)

    const universitySearchStatus = await fetch(`${baseUrl}/api/universities/discover/status`)
    assert.equal(universitySearchStatus.status, 200)
    const universitySearchStatusBody = await universitySearchStatus.json() as Record<string, unknown>
    assert.equal(typeof universitySearchStatusBody.enabled, 'boolean')
    assert.equal(typeof universitySearchStatusBody.configured, 'boolean')

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

    const invalidUniversitySearchResponse = await fetch(`${baseUrl}/api/universities/discover?query=ab`)
    assert.equal(invalidUniversitySearchResponse.status, 400)
    const invalidUniversitySearchBody = await invalidUniversitySearchResponse.json() as { code?: string }
    assert.equal(invalidUniversitySearchBody.code, 'VALIDATION_ERROR')

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
