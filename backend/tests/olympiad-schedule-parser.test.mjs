import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deduplicateExactScheduleRows,
  getScheduleSourceKey,
  normalizeScheduleItem,
  parseScheduleDate
} from '../scripts/olympiad-schedule-parser.mjs'

const confirmed = {
  confirmed: 'да',
  checked_on: '2026-10-26',
  organizer_url: 'https://example.org/event'
}

test('«до 1 июня» становится дедлайном, а не мероприятием', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Вручение дипломов',
    when: 'до 1 июня 2027'
  })
  assert.equal(result.date_semantics, 'deadline')
  assert.equal(result.start_date, '2027-06-01')
  assert.equal(result.end_date, '2027-06-01')
  assert.equal(result.date_parse_status, 'exact')
})

test('точное мероприятие с временем не превращается в дедлайн только из-за «до 18:00»', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Проведение тура',
    when: '17 октября 2026, с 10:00 до 18:00 МСК'
  })
  assert.equal(result.date_semantics, 'event')
  assert.equal(result.start_date, '2026-10-17')
  assert.equal(result.start_time, '10:00:00')
  assert.equal(result.end_time, '18:00:00')
  assert.equal(result.time_zone, 'Europe/Moscow')
})

test('результаты «до 18:00» классифицируются как дедлайн публикации', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Итоги тура 1',
    when: '17 октября 2026, до 18:00 МСК'
  })
  assert.equal(result.date_semantics, 'deadline')
  assert.equal(result.end_time, '18:00:00')
})

test('период с двумя месяцами и разными годами корректно разбирается', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Регистрация',
    when: '1 октября 2026 — 11 января 2027, до 23:59 МСК'
  })
  assert.equal(result.date_semantics, 'period')
  assert.equal(result.start_date, '2026-10-01')
  assert.equal(result.end_date, '2027-01-11')
  assert.equal(result.end_time, '23:59:00')
  assert.equal(result.time_zone, 'Europe/Moscow')
})

test('период «с ... до ...» извлекает обе даты, время и часовой пояс', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Первый этап',
    when: 'с 00:01 МСК 10 ноября 2026 года до 23:59 МСК 30 ноября 2026 года'
  })
  assert.equal(result.date_semantics, 'period')
  assert.equal(result.start_date, '2026-11-10')
  assert.equal(result.end_date, '2026-11-30')
  assert.equal(result.start_time, '00:01:00')
  assert.equal(result.end_time, '23:59:00')
  assert.equal(result.time_zone, 'Europe/Moscow')
})

test('диапазон дней в одном месяце разбирается как период', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Отборочный этап',
    when: '2–13 декабря 2026, до 180 минут'
  })
  assert.equal(result.date_semantics, 'period')
  assert.equal(result.start_date, '2026-12-02')
  assert.equal(result.end_date, '2026-12-13')
})

test('диапазон между месяцами без начального года сохраняет признак inferred_year', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Регистрация',
    when: '15 октября — 6 декабря 2026'
  })
  assert.equal(result.date_semantics, 'period')
  assert.equal(result.start_date, '2026-10-15')
  assert.equal(result.end_date, '2026-12-06')
  assert.equal(result.date_parse_status, 'inferred_year')
})

test('крайний срок регистрации с временем становится deadline', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Закрытие регистрации на тренировку',
    when: 'до 1 ноября 2026, 12:30 МСК'
  })
  assert.equal(result.date_semantics, 'deadline')
  assert.equal(result.end_date, '2026-11-01')
  assert.equal(result.end_time, '12:30:00')
})

test('«не ранее» не превращается в точную дату напоминания', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Окончательные результаты',
    when: 'не ранее 15 марта 2027'
  })
  assert.equal(result.date_semantics, 'unknown')
  assert.equal(result.start_date, null)
  assert.equal(result.date_parse_status, 'unknown')
})

test('несколько окон или несколько дат в одной записи остаются неоднозначными', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: '',
    when: 'Информатика до 14 октября 2026; второй тур 19 октября — 18 ноября 2026; математика до 20 октября 2026'
  })
  assert.equal(result.date_semantics, 'mixed')
  assert.equal(result.start_date, null)
  assert.equal(result.end_date, null)
})

test('регистрация, размеченная источником как stage, нормализуется в registration', () => {
  const result = normalizeScheduleItem({
    ...confirmed,
    kind: 'этап',
    stage: 'Регистрация на отборочный этап',
    when: '1 октября — 11 января 2027'
  })
  assert.equal(result.kind, 'registration')
  assert.equal(result.date.date_semantics, 'period')
})

test('регистрация, упомянутая в описании настоящего этапа, не меняет kind', () => {
  const result = normalizeScheduleItem({
    ...confirmed,
    kind: 'этап',
    stage: 'Отборочный этап по математике',
    when: 'Этап проходит 1–10 декабря 2026; регистрация доступна до конца этапа'
  })
  assert.equal(result.kind, 'stage')
  assert.equal(result.date.date_semantics, 'period')
})

test('год без указания определяется, но остаётся inferred_year', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Этап',
    when: '10 декабря'
  })
  assert.equal(result.start_date, '2026-12-10')
  assert.equal(result.date_parse_status, 'inferred_year')
})

test('числовая дата DD.MM.YYYY распознаётся', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Этап',
    when: 'состоится 07.12.2026'
  })
  assert.equal(result.start_date, '2026-12-07')
  assert.equal(result.date_semantics, 'event')
})

test('явно указанные Екатеринбург и Новосибирск распознаются, часовой пояс не угадывается', () => {
  const ekb = parseScheduleDate({
    ...confirmed,
    stage: 'Регистрация',
    when: '1 сентября 2026 — 19 января 2027 до 23:59 по времени Екатеринбурга'
  })
  const unknown = parseScheduleDate({
    ...confirmed,
    stage: 'Этап',
    when: '1 декабря 2026, 10:00'
  })
  assert.equal(ekb.time_zone, 'Asia/Yekaterinburg')
  assert.equal(unknown.time_zone, null)
})

test('разные исходные профили не объединяются по одинаковому сроку', () => {
  const first = {
    order_n: 10, kind: 'этап', stage: 'Регистрация по физике',
    when: '1–10 декабря 2026', ...confirmed
  }
  const second = {
    ...first, stage: 'Регистрация по химии'
  }
  const one = normalizeScheduleItem(first)
  const two = normalizeScheduleItem(second)
  const rows = [
    { order_n: 10, kind: one.kind, stage_name: first.stage, when_text: first.when, is_confirmed: true, checked_on: first.checked_on, organizer_url: first.organizer_url },
    { order_n: 10, kind: two.kind, stage_name: second.stage, when_text: second.when, is_confirmed: true, checked_on: second.checked_on, organizer_url: second.organizer_url }
  ]
  assert.equal(deduplicateExactScheduleRows(rows).length, 2)
})

test('точные дубли удаляются, но исходный identity key остаётся независимым от нормализованного kind', () => {
  const row = { order_n: 1, kind: 'registration', stage_name: 'Регистрация', when_text: 'до 1 декабря 2026', is_confirmed: true, checked_on: '2026-10-26', organizer_url: 'https://example.org' }
  assert.equal(deduplicateExactScheduleRows([row, row]).length, 1)
  const source = { order_n: 1, kind: 'этап', stage: 'Регистрация', when: 'до 1 декабря 2026', confirmed: 'да', checked_on: '2026-10-26', organizer_url: 'https://example.org' }
  assert.equal(getScheduleSourceKey(source), JSON.stringify([1, 'stage', 'Регистрация', 'до 1 декабря 2026', 'да', '2026-10-26', 'https://example.org']))
})

test('разные условия ручной и автоматической проверки не сводятся к одному сроку', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Этап II, командный отборочный',
    when: '10 ноября – 7 декабря 2026 при ручной проверке, до 11 декабря при автоматической'
  })
  assert.equal(result.date_semantics, 'mixed')
  assert.equal(result.start_date, null)
  assert.equal(result.end_date, null)
})

test('разные даты регистрации по нескольким профилям не объединяются', () => {
  const result = parseScheduleDate({
    ...confirmed,
    kind: 'registration',
    stage: '',
    when: 'Биология до 30 октября 2026; информатика до 6 ноября; физика 26 октября – 13 ноября; химия 26 октября – 20 ноября'
  })
  assert.equal(result.date_semantics, 'mixed')
  assert.equal(result.start_date, null)
  assert.equal(result.end_date, null)
})

test('одна дата с несколькими самостоятельными временными ориентирами остаётся неоднозначной', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Последний старт с полным временем отбора',
    when: '29 ноября 2026, 22:59 МСК; выполнение закрывается в 23:59 МСК'
  })
  assert.equal(result.date_semantics, 'mixed')
  assert.equal(result.start_date, null)
})

test('период регистрации сохраняется периодом, даже если указан крайний час закрытия', () => {
  const result = parseScheduleDate({
    ...confirmed,
    kind: 'registration',
    stage: '',
    when: '1 октября 2026 — 11 января 2027, до 23:59 МСК'
  })
  assert.equal(result.date_semantics, 'period')
  assert.equal(result.start_date, '2026-10-01')
  assert.equal(result.end_date, '2027-01-11')
  assert.equal(result.end_time, '23:59:00')
})


test('две даты, соединённые союзом «и», не считаются одним периодом автоматически', () => {
  const result = parseScheduleDate({
    ...confirmed,
    stage: 'Два тура',
    when: '1 ноября 2026 и 3 ноября 2026'
  })
  assert.equal(result.date_semantics, 'mixed')
  assert.equal(result.start_date, null)
})
