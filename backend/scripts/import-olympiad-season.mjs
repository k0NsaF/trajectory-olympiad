import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'
import { getScheduleSourceKey, normalizeScheduleItem } from './olympiad-schedule-parser.mjs'

const DATA_BASE = 'https://raw.githubusercontent.com/Cyberhand2/codolymp-opendata/master'
const OFFICIAL_DOCUMENT_URL = 'https://publication.pravo.gov.ru/document/0001202609300016'
const OFFICIAL_DOCUMENT_TITLE = 'Приказ Минобрнауки России от 31.08.2026 № 521 «Об утверждении перечня олимпиад школьников и их уровней на 2026/27 учебный год»'
const EXPECTED_STAGING_URL = 'https://uzsossytdoysravlbgcp.supabase.co'
const BATCH_SIZE = 100
const INTERNAL_SUBJECTS = {
  matematika: 'mathematics',
  informatika: 'informatics',
  fizika: 'physics',
  biologiya: 'biology',
  himiya: 'chemistry',
  ekonomika: 'economics',
  istoriya: 'history',
  obshchestvo: 'social_studies',
  yazyki: 'foreign_language'
}
const MONTHS = {
  января: 1, январь: 1, февраля: 2, февраль: 2, марта: 3, март: 3,
  апреля: 4, апрель: 4, мая: 5, май: 5, июня: 6, июнь: 6,
  июля: 7, июль: 7, августа: 8, август: 8, сентября: 9, сентябрь: 9,
  октября: 10, октябрь: 10, ноября: 11, ноябрь: 11, декабря: 12, декабрь: 12
}
const MONTH_PATTERN = Object.keys(MONTHS).join('|')

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(fileName) {
  const url = `${DATA_BASE}/${fileName}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'TrajectoryOlympiadRegistry/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  })
  const finalHost = new URL(response.url).hostname.toLowerCase()
  if (finalHost !== 'raw.githubusercontent.com') {
    throw new Error(`${fileName}: источник перенаправил запрос на неожиданный домен ${finalHost}`)
  }
  if (!response.ok) throw new Error(`${fileName}: HTTP ${response.status}`)
  return response.json()
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function profileSlugs(profile) {
  return unique(String(profile.subject_slugs ?? '').split(';').map((item) => item.trim()))
}

function mappedSubjects(profile) {
  return unique(profileSlugs(profile).map((slug) => INTERNAL_SUBJECTS[slug]))
}

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}



function buildDataset(manifest, profiles, schedule) {
  const profileGroups = new Map()
  for (const profile of profiles) {
    const current = profileGroups.get(Number(profile.order_n)) ?? []
    current.push(profile)
    profileGroups.set(Number(profile.order_n), current)
  }

  const scheduleByOrder = new Map()
  for (const item of schedule) {
    if (!scheduleByOrder.has(Number(item.order_n))) scheduleByOrder.set(Number(item.order_n), [])
    scheduleByOrder.get(Number(item.order_n)).push(item)
  }

  const checkedOn = manifest.datasets.find((dataset) => dataset.id === 'perechen')?.checked_on ?? '2026-10-26'
  const base = [...profileGroups.entries()].map(([orderN, rows]) => {
    const organizerUrl = scheduleByOrder.get(orderN)?.find((item) => item.organizer_url)?.organizer_url ?? null
    return {
      name: rows[0].name,
      organizer: 'Организаторы указаны в официальном перечне и на сайте олимпиады',
      level: null,
      list_type: 'school_olympiad',
      official_list_number: orderN,
      source_document_title: OFFICIAL_DOCUMENT_TITLE,
      source_document_url: OFFICIAL_DOCUMENT_URL,
      source_checked_at: `${checkedOn}T12:00:00.000Z`,
      source_status: 'official',
      subjects: unique(rows.flatMap(mappedSubjects)),
      // The order does not set grade eligibility. Empty means "not verified".
      grades: [],
      website: organizerUrl,
      description: 'Олимпиада включена в перечень Минобрнауки России на 2026/27 учебный год. Уровень определяется отдельно для каждого профиля. Допустимые классы проверяйте на сайте организатора.'
    }
  })

  const profileRows = profiles.map((profile) => ({
    source_profile_key: `2026-2027:${profile.order_n}:${String(profile.profile).toLocaleLowerCase('ru-RU')}:${profile.level}:${profile.subject_slugs}`,
    source_event_slug: profile.slug,
    order_n: Number(profile.order_n),
    profile_name: profile.profile,
    level: Number(profile.level),
    source_subjects: profile.subjects,
    subject_slugs: profileSlugs(profile),
    subjects: mappedSubjects(profile),
    source_document_title: OFFICIAL_DOCUMENT_TITLE,
    source_document_url: OFFICIAL_DOCUMENT_URL,
    source_checked_on: checkedOn,
    source_provider: manifest.publisher,
    source_license: manifest.license
  }))

  const scheduleRows = schedule.map((item) => {
    const normalized = normalizeScheduleItem(item)
    return {
      // Keep the historical source identity so this upsert updates the existing 1,339 rows.
      source_item_key: getScheduleSourceKey(item),
      order_n: Number(item.order_n),
      kind: normalized.kind,
      stage_name: item.stage || '',
      when_text: item.when,
      is_confirmed: item.confirmed === 'да',
      checked_on: item.checked_on || null,
      organizer_url: item.organizer_url,
      ...normalized.date,
      source_provider: manifest.publisher,
      source_license: manifest.license
    }
  })

  const semanticLabels = ['event', 'period', 'deadline', 'mixed', 'unknown']
  const semanticCounts = Object.fromEntries(semanticLabels.map((label) => [label, scheduleRows.filter((row) => row.date_semantics === label).length]))
  const calendarReadyCount = scheduleRows.filter((row) => row.is_confirmed && ['exact', 'range'].includes(row.date_parse_status) && ['event', 'period', 'deadline'].includes(row.date_semantics)).length
  console.log('Семантика расписания:', JSON.stringify(semanticCounts))
  console.log('Подтверждённых календарных записей:', calendarReadyCount)

  return { base, profileRows, scheduleRows, checkedOn }
}

async function upsertBatches(supabase, table, rows, onConflict) {
  let saved = 0
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) throw new Error(`${table}: ${error.message}`)
    saved += batch.length
    console.log(`${table}: ${saved}/${rows.length}`)
  }
  return saved
}

async function main() {
  const dryRun = hasFlag('dry-run')
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  assert(supabaseUrl === EXPECTED_STAGING_URL,
    'Безопасная остановка: этот импорт разрешён только в trajectory-olympiad-staging. Проверь backend/.env.')
  assert(secretKey, 'В backend/.env не задан SUPABASE_SECRET_KEY.')

  console.log('Источник: Кодолимп, лицензия CC BY 4.0')
  console.log('Приказ: Минобрнауки России № 521 от 31.08.2026, 2026/27')

  const [manifest, profiles, schedule] = await Promise.all([
    fetchJson('manifest.json'),
    fetchJson('perechen.json'),
    fetchJson('schedule.json')
  ])

  const listMetadata = manifest.datasets.find((dataset) => dataset.id === 'perechen')
  const scheduleMetadata = manifest.datasets.find((dataset) => dataset.id === 'schedule')
  assert(listMetadata?.order?.number === '521' && listMetadata.season === '2026/27',
    'Манифест не соответствует приказу № 521 на 2026/27 год.')
  assert(profiles.length === 272 && listMetadata.olympiads === 60,
    `Неожиданный состав перечня: ${profiles.length} профилей, ожидалось 272.`)
  assert(schedule.length === scheduleMetadata.rows,
    `Неожиданное число календарных строк: ${schedule.length}, ожидалось ${scheduleMetadata.rows}.`)

  const dataset = buildDataset(manifest, profiles, schedule)
  const uniqueKeys = new Set(dataset.scheduleRows.map((row) => row.source_item_key))
  assert(uniqueKeys.size === dataset.scheduleRows.length, 'В расписании обнаружены повторяющиеся ключи строк.')

  const stats = {
    olympiads: dataset.base.length,
    profiles: dataset.profileRows.length,
    mappedProfiles: dataset.profileRows.filter((row) => row.subjects.length > 0).length,
    scheduleItems: dataset.scheduleRows.length,
    confirmedItems: dataset.scheduleRows.filter((row) => row.is_confirmed).length,
    confirmedCalendarDates: dataset.scheduleRows.filter((row) => row.is_confirmed && ['exact', 'range'].includes(row.date_parse_status)).length,
    inferredDates: dataset.scheduleRows.filter((row) => row.date_parse_status === 'inferred_year').length,
    noExactDate: dataset.scheduleRows.filter((row) => row.date_parse_status === 'unknown').length,
    sourceCheckedOn: dataset.checkedOn,
    builtOn: manifest.built_on
  }
  console.log('\nПредпросмотр импорта:')
  console.log(JSON.stringify(stats, null, 2))

  if (dryRun) {
    console.log('\nРежим --dry-run: Supabase не изменялся.')
    return
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  })

  const { error: schemaError } = await supabase.from('olympiad_profiles').select('id').limit(1)
  if (schemaError) throw new Error(`Миграции олимпиадного каталога ещё не применены: ${schemaError.message}`)

  await upsertBatches(supabase, 'olympiads', dataset.base, 'source_document_url,official_list_number')

  const { data: savedOlympiads, error: lookupError } = await supabase
    .from('olympiads')
    .select('id, official_list_number')
    .eq('source_document_url', OFFICIAL_DOCUMENT_URL)
  if (lookupError) throw new Error(`Не удалось прочитать сохранённые олимпиады: ${lookupError.message}`)
  assert(savedOlympiads?.length === 60, `В БД найдено ${savedOlympiads?.length ?? 0} олимпиад вместо 60.`)

  const idsByOrder = new Map(savedOlympiads.map((row) => [row.official_list_number, row.id]))
  const seasons = dataset.base.map((row) => ({
    olympiad_id: idsByOrder.get(row.official_list_number),
    academic_year: '2026-2027',
    grades: [],
    level: null,
    list_type: 'school_olympiad',
    official_list_number: row.official_list_number,
    source_document_title: OFFICIAL_DOCUMENT_TITLE,
    source_document_url: OFFICIAL_DOCUMENT_URL,
    source_checked_at: row.source_checked_at,
    source_status: 'official'
  }))
  assert(seasons.every((row) => row.olympiad_id), 'Не для всех олимпиад найдены ID сезонов.')
  await upsertBatches(supabase, 'olympiad_seasons', seasons, 'olympiad_id,academic_year')

  const profilesWithIds = dataset.profileRows.map((row) => ({
    ...row,
    olympiad_id: idsByOrder.get(row.order_n)
  }))
  await upsertBatches(supabase, 'olympiad_profiles', profilesWithIds, 'source_profile_key')

  const scheduleWithIds = dataset.scheduleRows.map((row) => ({
    ...row,
    olympiad_id: idsByOrder.get(row.order_n)
  }))
  await upsertBatches(supabase, 'olympiad_schedule_items', scheduleWithIds, 'source_item_key')

  console.log('\nИмпорт завершён. Проверь количество строк в Supabase и не забудь указать атрибуцию источника в документации продукта.')
}

main().catch((error) => {
  console.error('\nИмпорт прерван:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
