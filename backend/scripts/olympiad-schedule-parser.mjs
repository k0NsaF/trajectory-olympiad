const MONTHS = Object.freeze({
  января: 1, январь: 1,
  февраля: 2, февраль: 2,
  марта: 3, март: 3,
  апреля: 4, апрель: 4,
  мая: 5, май: 5,
  июня: 6, июнь: 6,
  июля: 7, июль: 7,
  августа: 8, август: 8,
  сентября: 9, сентябрь: 9,
  октября: 10, октябрь: 10,
  ноября: 11, ноябрь: 11,
  декабря: 12, декабрь: 12
})

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|')

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/ё/giu, 'е')
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function inferYear(month, checkedOn) {
  const fallback = '2026-10-26'
  const [yearValue, checkedMonthValue] = String(checkedOn || fallback)
    .slice(0, 10)
    .split('-')
    .map(Number)
  const year = Number.isInteger(yearValue) ? yearValue : 2026
  const checkedMonth = Number.isInteger(checkedMonthValue) ? checkedMonthValue : 10
  return month < checkedMonth ? year + 1 : year
}

function isoDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return null
  if (year < 2000 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function collectDateTokens(text) {
  const tokens = []
  const monthRegex = new RegExp(
    `(?<![\\p{L}\\d])(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4})(?:\\s+года)?)?(?!\\d)`,
    'giu'
  )

  for (const match of text.matchAll(monthRegex)) {
    const monthName = normalizeText(match[2]).toLocaleLowerCase('ru-RU')
    tokens.push({
      index: match.index,
      end: match.index + match[0].length,
      day: Number(match[1]),
      month: MONTHS[monthName],
      year: match[3] ? Number(match[3]) : null,
      source: 'month'
    })
  }

  const numericRegex = /(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{4})(?!\d)/gu
  for (const match of text.matchAll(numericRegex)) {
    tokens.push({
      index: match.index,
      end: match.index + match[0].length,
      day: Number(match[1]),
      month: Number(match[2]),
      year: Number(match[3]),
      source: 'numeric'
    })
  }

  return tokens.sort((a, b) => a.index - b.index)
}

function isSimpleRangeSeparator(value) {
  const residue = normalizeText(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/(^|[^а-яё])(?:с|до|по|года|год|мск|московскому|московское|времени|по времени)(?=$|[^а-яё])/giu, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/gu, ' ')
    .replace(/[\s,;:–—-]+/gu, '')
  return residue.length === 0
}

function resolveRange(first, second, checkedOn) {
  let startYear
  let endYear
  let precision = 'range'

  if (first.year && second.year) {
    startYear = first.year
    endYear = second.year
  } else if (second.year) {
    endYear = second.year
    startYear = first.month > second.month ? second.year - 1 : second.year
    if (!first.year && first.month !== second.month) precision = 'inferred_year'
  } else if (first.year) {
    startYear = first.year
    endYear = second.month < first.month ? first.year + 1 : first.year
  } else {
    startYear = inferYear(first.month, checkedOn)
    endYear = second.month < first.month ? startYear + 1 : startYear
    precision = 'inferred_year'
  }

  const startDate = isoDate(startYear, first.month, first.day)
  const endDate = isoDate(endYear, second.month, second.day)
  if (!startDate || !endDate || endDate < startDate) return null
  return { start_date: startDate, end_date: endDate, date_parse_status: precision }
}

function extractTimeValues(text) {
  return [...text.matchAll(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/gu)]
    .map((match) => `${String(Number(match[1])).padStart(2, '0')}:${match[2]}:00`)
}

function extractTimeZone(text) {
  const normalized = normalizeText(text).toLocaleLowerCase('ru-RU')
  const zones = []
  if (/(?:^|[^а-яё])мск(?:$|[^а-яё])|московск\w*\s+времен/iu.test(normalized)) zones.push('Europe/Moscow')
  if (/екатеринбург\w*|екб\b|уральск\w*\s+времен/iu.test(normalized)) zones.push('Asia/Yekaterinburg')
  if (/новосибирск\w*|новосиб\w*\s+времен/iu.test(normalized)) zones.push('Asia/Novosibirsk')
  if (/красноярск\w*/iu.test(normalized)) zones.push('Asia/Krasnoyarsk')
  if (/владивосток\w*/iu.test(normalized)) zones.push('Asia/Vladivostok')
  if (/иркутск\w*/iu.test(normalized)) zones.push('Asia/Irkutsk')
  const unique = [...new Set(zones)]
  return unique.length === 1 ? unique[0] : null
}

function hasUnreliableDateWording(text) {
  return /(?:^|[^а-яё])(?:не\s+ранее|примерно|ориентировочно|ориентировочный|дата\s+открытия\s+не\s+опубликована|даты?\s+расходятся|единый\s+срок\s+не\s+установлен|согласованный\s+час\s+не\s+установлен)(?=$|[^а-яё])/iu.test(text)
}

function isDeadline(text, stageName, kind) {
  const label = normalizeText(stageName).toLocaleLowerCase('ru-RU')
  const value = normalizeText(text).toLocaleLowerCase('ru-RU')
  const hasDeadlineWording = /(?:^|[^а-яё])(?:до|не\s+позднее)(?=$|[^а-яё])/iu.test(value)
  const hasDeadlineDate = /(?:^|[^а-яё])до\s+\d{1,2}\s+[а-яё]+/iu.test(value)
  const labelDeadline = /(?:^|[^а-яё])(?:крайний|предельный|последний)\s+срок(?=$|[^а-яё])/iu.test(`${label} ${value}`)
  const registrationClosed = /(?:^|[^а-яё])(?:закрытие|закрывается|закрылась|закрыт|окончание)\s+регистрац/iu.test(label)
  const genericDeadline = /(?:^|[^а-яё])(?:закрытие|последний\s+срок|крайний\s+срок|предельный\s+срок)(?=$|[^а-яё])/iu.test(label)
  const registrationDue = kind === 'registration' && /^(?:регистрац|запись|заявки|прием|приём)/iu.test(value) && hasDeadlineWording
  const resultsDue = /(?:результат|итог|публикац|список\s+победител)/iu.test(label) && hasDeadlineWording
  return /^\s*(?:до|не\s+позднее)/iu.test(value) || hasDeadlineDate || labelDeadline || registrationClosed || genericDeadline || registrationDue || resultsDue
}

function unresolvedResult(dateSemantics = 'unknown') {
  return {
    start_date: null,
    end_date: null,
    date_parse_status: 'unknown',
    date_semantics: dateSemantics,
    start_time: null,
    end_time: null,
    time_zone: null
  }
}

/**
 * Parse only one unambiguous date or one unambiguous date interval.
 * Multi-window, conflicting, approximate and lower-bound notices remain raw text.
 * Year inference is retained as metadata and is not eligible for reminders.
 */
export function parseScheduleDate(item) {
  const text = normalizeText(item.when)
  const checkedOn = item.checked_on || '2026-10-26'
  if (!text || hasUnreliableDateWording(text)) return unresolvedResult()

  const monthRange = new RegExp(
    `(?<!\\d)(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4})(?:\\s+года)?)?`,
    'iu'
  ).exec(text)

  let dateInfo = null
  let range = false
  let tokenCount = 0

  if (monthRange) {
    const tokens = collectDateTokens(text)
    tokenCount = tokens.length
    const month = MONTHS[normalizeText(monthRange[3]).toLocaleLowerCase('ru-RU')]
    const year = monthRange[4] ? Number(monthRange[4]) : inferYear(month, checkedOn)
    const startDate = isoDate(year, month, Number(monthRange[1]))
    const endDate = isoDate(year, month, Number(monthRange[2]))
    if (startDate && endDate && endDate >= startDate && tokens.length <= 1) {
      dateInfo = {
        start_date: startDate,
        end_date: endDate,
        date_parse_status: monthRange[4] ? 'range' : 'inferred_year'
      }
      range = true
      tokenCount = 2
    }
  }

  if (!dateInfo) {
    const tokens = collectDateTokens(text)
    tokenCount = tokens.length
    if (tokens.length === 2 && isSimpleRangeSeparator(text.slice(tokens[0].end, tokens[1].index))) {
      dateInfo = resolveRange(tokens[0], tokens[1], checkedOn)
      range = Boolean(dateInfo)
    } else if (tokens.length === 1) {
      const token = tokens[0]
      const year = token.year ?? inferYear(token.month, checkedOn)
      const date = isoDate(year, token.month, token.day)
      if (date) {
        dateInfo = {
          start_date: date,
          end_date: date,
          date_parse_status: token.year ? 'exact' : 'inferred_year'
        }
      }
    }
  }

  if (tokenCount > (range ? 2 : 1)) return unresolvedResult('mixed')
  if (!dateInfo) return unresolvedResult()

  const semantics = range
    ? 'period'
    : (isDeadline(text, item.stage, item.kind) ? 'deadline' : 'event')

  const times = extractTimeValues(text)
  let startTime = null
  let endTime = null
  const explicitTimeInterval = /(?:с\s*)?\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}|с\s*\d{1,2}:\d{2}[\s\S]{0,40}?до\s*\d{1,2}:\d{2}/iu.test(text)

  if (semantics === 'deadline') {
    // A deadline has one cutoff time. Multiple clock values may describe
    // preparation windows or separate actions, so do not guess which is binding.
    if (times.length === 1) endTime = times[0]
    else if (times.length > 1) return unresolvedResult('mixed')
  } else if (range) {
    if (times.length >= 2) {
      startTime = times[0]
      endTime = times[1]
    } else if (times.length === 1) {
      endTime = times[0]
    }
  } else if (times.length === 1) {
    startTime = times[0]
  } else if (times.length === 2 && explicitTimeInterval) {
    startTime = times[0]
    endTime = times[1]
  } else if (times.length > 1) {
    return unresolvedResult('mixed')
  }

  return {
    ...dateInfo,
    date_semantics: semantics,
    start_time: startTime,
    end_time: endTime,
    time_zone: extractTimeZone(text)
  }
}

function classifyScheduleKind(item) {
  const sourceKind = normalizeText(item.kind).toLocaleLowerCase('ru-RU')
  if (sourceKind === 'регистрация' || sourceKind === 'registration') return 'registration'

  const label = normalizeText(item.stage)
  const raw = normalizeText(item.when)
  const registrationLabel = /^(?:регистрация|закрытие\s+регистрации|окончание\s+регистрации|запись\s+на|подача\s+заявок|прием\s+заявок|приём\s+заявок|последний\s+срок\s+регистрации)(?:$|\s|:)/iu
  if (registrationLabel.test(label)) return 'registration'
  if (!label && registrationLabel.test(raw)) return 'registration'
  return 'stage'
}

export function normalizeScheduleItem(item) {
  const kind = classifyScheduleKind(item)
  const date = parseScheduleDate({ ...item, kind })
  return { kind, date }
}

/** Stable source identity intentionally uses the source's original kind. */
export function getScheduleSourceKey(item) {
  // Match the legacy importer key exactly: its source-kind mapping was case-sensitive.
  const sourceKind = item.kind === 'регистрация' ? 'registration' : 'stage'
  return JSON.stringify([
    item.order_n,
    sourceKind,
    item.stage || '',
    item.when,
    item.confirmed,
    item.checked_on || '',
    item.organizer_url
  ])
}

export function deduplicateExactScheduleRows(rows) {
  const seen = new Set()
  const result = []
  for (const row of rows) {
    const key = JSON.stringify([
      row.order_n,
      row.kind,
      normalizeText(row.stage_name),
      normalizeText(row.when_text),
      row.is_confirmed,
      row.checked_on || null,
      row.organizer_url
    ])
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}
