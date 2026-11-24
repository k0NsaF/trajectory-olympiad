import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  buildMinobrnaukiPageUrl,
  deduplicateRegistryRecords,
  deriveRegistryShortName,
  getRootDomain,
  normalizeRegistryName,
  parseMicceduInstitutionPage,
  parseMicceduRegionPage,
  parseMicceduRegionsPage,
  parseMinobrnaukiAdmissionsPage,
  parseMinobrnaukiTotalPages
} from '../src/services/university-registry-parser.mjs'

const MINOBRNAUKI_BASE = 'https://minobrnauki.gov.ru/abitur/'
const MICCEDU_BASE = 'https://monitoring.miccedu.ru'
const DEFAULT_MICCEDU_YEAR = 2025
const USER_AGENT = 'TrajectoryUniversityRegistryBot/1.0 (+https://trajectory-olympiad.vercel.app; educational registry import)'
const REQUEST_TIMEOUT_MS = 25_000
const SOURCE_DELAY_MS = 350
const UPSERT_BATCH_SIZE = 100

function readArg(name, fallback = null) {
  const prefix = `--${name}=`
  const item = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeHost(value) {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function fetchOfficialPage(url, allowedHost) {
  let lastError

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.5'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })

      const finalHost = safeHost(response.url)
      if (!finalHost || (finalHost !== allowedHost && !finalHost.endsWith(`.${allowedHost}`))) {
        throw new Error(`Источник перенаправил запрос на посторонний домен: ${finalHost || 'unknown'}`)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType && !/text\/html|application\/xhtml\+xml/iu.test(contentType)) {
        throw new Error(`Ожидалась HTML-страница, получен Content-Type: ${contentType}`)
      }

      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(500 * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Не удалось получить страницу источника.')
}

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url) {
    throw new Error('В backend/.env не задан SUPABASE_URL.')
  }
  if (!key) {
    throw new Error('Для чтения и записи реестра добавь SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY в backend/.env. Не добавляй этот ключ во frontend или Render.')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}

function isPlaceholderCity(value) {
  return !value || /^(?:город не указан|не указан|unknown)$/iu.test(String(value).trim())
}

function isPoorShortName(value) {
  const text = String(value ?? '').trim()
  return !text
    || /…|\.\.\.$/u.test(text)
    || /^(?:высшего образования|образования|государственного|государственное|федерального|образовательного)(?=\s|$)/iu.test(text)
}

function findParentUniversityByName(parentName, catalog) {
  if (!parentName) return null
  const normalized = normalizeRegistryName(parentName)
  if (!normalized) return null

  const candidates = catalog.filter((item) => {
    if (item.is_branch) return false
    return normalizeRegistryName(item.name) === normalized
      || normalizeRegistryName(item.short_name) === normalized
  })
  return candidates.length === 1 ? candidates[0] : null
}

function compactParentLabel(parentName, parentUniversity = null) {
  const sourceName = parentName || parentUniversity?.name || ''
  const normalized = normalizeRegistryName(sourceName)
  if (!normalized) return null

  const knownLabels = [
    [/российская академия народного хозяйства/, 'РАНХиГС'],
    [/российский экономический университет/, 'РЭУ им. Г.В. Плеханова'],
    [/белгородский государственный технологический университет/, 'БГТУ им. В.Г. Шухова'],
    [/белгородский государственный национальный исследовательский университет/, 'БелГУ'],
    [/национальный исследовательский технологический университет/, 'НИТУ МИСИС'],
    [/орловский государственный университет/, 'ОГУ им. И.С. Тургенева'],
    [/брянский государственный университет/, 'БГУ им. академика И.Г. Петровского'],
    [/российский государственный геологоразведочный университет/, 'МГРИ']
  ]
  const known = knownLabels.find(([pattern]) => pattern.test(normalized))
  if (known) return known[1]

  const parentShortName = String(parentUniversity?.short_name ?? '').trim()
  const parentFullName = String(parentUniversity?.name ?? '').trim()
  if (parentShortName && parentShortName.length <= 48
    && normalizeRegistryName(parentShortName) !== normalizeRegistryName(parentFullName)
    && !/\.\.\.|…/u.test(parentShortName)) {
    return parentShortName
  }

  const cleaned = deriveRegistryShortName(parentUniversity?.name || sourceName)
  if (!cleaned) return null
  return cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}…` : cleaned
}

function buildBranchShortName(record, parentName, parentUniversity = null) {
  const localName = deriveRegistryShortName(record.organizationName || record.shortName || '')
  const parentLabel = compactParentLabel(parentName, parentUniversity)
  if (!localName || !parentLabel) return localName || record.shortName || null

  const normalizedLocal = normalizeRegistryName(localName)
  const normalizedParent = normalizeRegistryName(parentName || parentUniversity?.name || '')
  const normalizedLabel = normalizeRegistryName(parentLabel)
  if ((normalizedParent && normalizedLocal.includes(normalizedParent))
    || (normalizedLabel && normalizedLocal.includes(normalizedLabel))) {
    return localName
  }

  const combined = `${localName} ${parentLabel}`.replace(/\s+/g, ' ').trim()
  return combined.length > 100 ? `${combined.slice(0, 97).trim()}…` : combined
}

function regionsCompatible(left, right) {
  if (!left || !right) return true
  return String(left).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
    === String(right).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
}

function normalizeRegistryMatchHost(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//iu.test(raw) ? raw : `https://${raw}`
    )

    return url.hostname
      .toLowerCase()
      .replace(/^www\./u, '')
      .replace(/\.$/u, '') || null
  } catch {
    const host = raw
      .toLowerCase()
      .replace(/^https?:\/\//u, '')
      .split(/[/?#]/u)[0]
      .replace(/^www\./u, '')
      .replace(/\.$/u, '')

    return host || null
  }
}

function normalizeRegistryMatchCity(value) {
  let city = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/gu, 'е')

  if (!city || isPlaceholderCity(city)) return null

  city = city
    .replace(/^(?:г\s*-\s*к\.?|г\.\s*-\s*к\.?)\s*/u, '')
    .replace(/^(?:г\.\s*|город\s+|г\s+|с\.\s*|село\s+|с\s+|пос\.\s*|поселок\s+|пгт\.?\s*|рп\.\s*)/u, '')
    .replace(/^[^a-zа-я0-9]+/u, '')
    .replace(/^к\.\s*/u, '')
    .replace(/\s+\d{5,6}\b.*$/u, '')
    .replace(/\s+(?:ул(?:ица)?\.?|проспект|пр-т|переулок|пер\.?|дом|д\.?)\s*.*$/u, '')
    .replace(/\s+(?:[а-я-]+\s+){0,2}(?:область|области|обл\.?|край|края|республика|респ\.?|автономный округ|автономного округа)\b.*$/u, '')
    .replace(/[.,;:]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()

  if (!city) return null

  // Не считаем названием города значения, содержащие только название региона.
  if (/^(?:[а-я-]+\s+){0,2}(?:область|обл\.?|край|края|республика|респ\.?|автономный округ|автономного округа)\b/u.test(city)) {
    return null
  }

  return normalizeRegistryName(city) || null
}

function chooseMatch(record, catalog) {
  const normalized = record.normalizedName
    || normalizeRegistryName(record.organizationName)

  const isBranch = Boolean(record.isBranch)

  const sameBranch = (item) =>
    Boolean(item.is_branch) === isBranch

  const sameRegion = (item) =>
    regionsCompatible(record.region, item.region)

  const sameOrganizationType = (item) =>
    !record.organizationType
    || record.organizationType === 'unknown'
    || !item.organization_type
    || item.organization_type === 'unknown'
    || item.organization_type === record.organizationType

  const recordHost = normalizeRegistryMatchHost(record.officialDomain)

  const sameOfficialHost = (item) => {
    const itemHost = normalizeRegistryMatchHost(
      item.official_domain || item.website
    )

    return Boolean(recordHost && itemHost && recordHost === itemHost)
  }

  const sameName = (item) =>
    normalizeRegistryName(item.name) === normalized
    || normalizeRegistryName(item.short_name) === normalized

  // Для филиала необходимы одновременно город и регион.
  // Совпадения только по корневому домену недостаточно.
  const sameBranchLocation = (item) => {
    const recordCity = normalizeRegistryMatchCity(record.city)
    const candidateCity = normalizeRegistryMatchCity(item.city)
    const recordRegion = normalizeRegistryName(record.region)
    const candidateRegion = normalizeRegistryName(item.region)

    return Boolean(
      recordCity
      && candidateCity
      && recordCity === candidateCity
      && recordRegion
      && candidateRegion
      && sameRegion(item)
    )
  }

  const sameLocation = (item) =>
    isBranch ? sameBranchLocation(item) : sameRegion(item)

  // 1. Официальные идентификаторы.
  if (record.inn || record.ogrn) {
    const byIdentifiers = catalog.filter((item) => {
      const identifiersMatch =
        (!record.inn || item.inn === record.inn)
        && (!record.ogrn || item.ogrn === record.ogrn)
        && (record.inn ? item.inn === record.inn : item.ogrn === record.ogrn)

      if (!identifiersMatch || !sameBranch(item) || !sameOrganizationType(item)) {
        return false
      }

      // У нескольких филиалов может быть общий юридический идентификатор.
      if (isBranch) {
        return sameBranchLocation(item)
          && (sameName(item) || sameOfficialHost(item))
      }

      return true
    })

    if (byIdentifiers.length === 1) {
      return { match: byIdentifiers[0], reason: 'official_identifier' }
    }

    if (byIdentifiers.length > 1) {
      return { match: null, reason: 'review' }
    }
  }

  // 2. Филиалы: точный hostname + город + регион.
  if (isBranch && recordHost) {
    const byExactHost = catalog.filter((item) =>
      sameBranch(item)
      && sameOrganizationType(item)
      && sameOfficialHost(item)
    )

    const byHostAndName = byExactHost.filter((item) =>
      sameName(item) && sameBranchLocation(item)
    )

    if (byHostAndName.length === 1) {
      return { match: byHostAndName[0], reason: 'domain_name' }
    }

    if (byHostAndName.length > 1) {
      return { match: null, reason: 'review' }
    }

    const byHostAndLocation = byExactHost.filter(sameBranchLocation)

    if (byHostAndLocation.length === 1) {
      return { match: byHostAndLocation[0], reason: 'official_domain' }
    }

    if (byHostAndLocation.length > 1) {
      return { match: null, reason: 'review' }
    }
  }

  // 3. Для головных вузов сохраняем сопоставление по корневому домену.
  if (!isBranch && record.officialDomain) {
    const domain = getRootDomain(record.officialDomain)

    if (domain) {
      const byDomain = catalog.filter((item) => {
        const itemDomain = item.official_domain || item.website

        return itemDomain
          && getRootDomain(itemDomain) === domain
          && sameBranch(item)
          && sameOrganizationType(item)
      })

      const byDomainAndName = byDomain.filter(sameName)

      if (byDomainAndName.length === 1) {
        return { match: byDomainAndName[0], reason: 'domain_name' }
      }

      if (byDomainAndName.length > 1) {
        return { match: null, reason: 'review' }
      }

      const byDomainAndRegion = byDomain.filter(sameRegion)

      if (byDomainAndRegion.length === 1) {
        return { match: byDomainAndRegion[0], reason: 'official_domain' }
      }

      if (byDomain.length > 0) {
        return { match: null, reason: 'review' }
      }
    }
  }

  // 4. Точное название и местоположение.
  const byName = catalog.filter((item) =>
    sameName(item)
    && sameBranch(item)
    && sameOrganizationType(item)
    && sameLocation(item)
  )

  if (byName.length === 1) {
    return { match: byName[0], reason: 'name_region_type' }
  }

  if (byName.length > 1) {
    return { match: null, reason: 'review' }
  }

  // Филиал без надёжно распознанного города не создаём автоматически.
  if (isBranch && !normalizeRegistryMatchCity(record.city)) {
    return { match: null, reason: 'review' }
  }

  return { match: null, reason: 'new' }
}

function organizationTypeFromName(name) {
  if (/частное|негосударственное|автономная некоммерческая организация/iu.test(name)) return 'private'
  if (/федеральное государственное|государственное бюджетное|государственное автономное|государственное образовательное/iu.test(name)) return 'public'
  return 'unknown'
}

async function fetchAllUniversities(supabase) {
  const rows = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, short_name, city, address, website, description, region, official_domain, inn, ogrn, organization_type, is_branch, parent_university_id, registry_status, registry_sources, registry_last_seen_at, minobrnauki_admission_url, minobrnauki_rules_url, minobrnauki_places_url, miccedu_profile_url')
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`Не удалось прочитать universities: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

async function fetchAllExternalIds(supabase) {
  const rows = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('university_external_ids')
      .select('source_key, external_id, university_id')
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`Не удалось прочитать внешние идентификаторы университетов: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

async function insertRun(supabase, sourceKey, sourceYear, dataYear) {
  const { data, error } = await supabase
    .from('university_registry_import_runs')
    .insert({ source_key: sourceKey, source_year: sourceYear, data_year: dataYear, status: 'running' })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Не удалось создать журнал импорта ${sourceKey}: ${error?.message ?? 'нет id'}`)
  return data.id
}

async function updateRun(supabase, runId, values) {
  const { error } = await supabase
    .from('university_registry_import_runs')
    .update({ ...values, finished_at: new Date().toISOString() })
    .eq('id', runId)
  if (error) throw new Error(`Не удалось обновить журнал импорта: ${error.message}`)
}

function toStagingRow(record, runId, decision = {}) {
  return {
    import_run_id: runId,
    source_key: record.sourceKey,
    source_record_key: record.sourceRecordKey,
    source_year: record.sourceYear,
    data_year: record.dataYear,
    organization_name: record.organizationName,
    normalized_name: record.normalizedName,
    short_name: record.shortName ?? null,
    city: record.city ?? null,
    region: record.region ?? null,
    address: record.address ?? null,
    inn: record.inn ?? null,
    ogrn: record.ogrn ?? null,
    organization_type: record.organizationType ?? null,
    is_branch: Boolean(record.isBranch),
    website_url: record.websiteUrl ?? null,
    official_domain: record.officialDomain ?? null,
    admission_url: record.admissionUrl ?? null,
    rules_url: record.rulesUrl ?? null,
    places_url: record.placesUrl ?? null,
    source_url: record.sourceUrl,
    metadata: record.metadata ?? {},
    matched_university_id: decision.universityId ?? null,
    match_status: decision.status ?? 'pending',
    last_seen_at: new Date().toISOString()
  }
}

function combineRegistryStatus(sources) {
  const uniqueSources = new Set(sources)
  if (uniqueSources.has('minobrnauki_admission') && uniqueSources.has('miccedu_monitoring')) return 'multiple_sources'
  if (uniqueSources.has('minobrnauki_admission')) return 'minobrnauki_listed'
  if (uniqueSources.has('miccedu_monitoring')) return 'miccedu_listed'
  return 'manual'
}

function logReconciliationPreview(sourceKey, merged) {
  const decisions = merged.decisions
  const branchDecisions = decisions.filter((item) => item.record.isBranch)
  const count = (items, status) => items.filter((item) => item.status === status).length
  const byReason = new Map()

  for (const item of decisions) {
    const reason = item.reason || 'unknown'
    byReason.set(reason, (byReason.get(reason) || 0) + 1)
  }

  console.log(`\n=== Предварительное сопоставление: ${sourceKey} ===`)
  console.log(`Всего записей: ${decisions.length}`)
  console.log(`Сопоставлено: ${count(decisions, 'matched')}`)
  console.log(`Новых записей подготовлено: ${count(decisions, 'created')}`)
  console.log(`На ручную проверку: ${count(decisions, 'review')}`)
  console.log(`Филиалы: всего ${branchDecisions.length}; сопоставлено ${count(branchDecisions, 'matched')}; новых ${count(branchDecisions, 'created')}; на проверку ${count(branchDecisions, 'review')}`)
  console.log('Причины решений:')
  for (const [reason, total] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${total}`)
  }

  const cityChanges = merged.cityChanges ?? []
  console.log(`CITY_CHANGES ${cityChanges.length}`)
  for (const change of cityChanges) {
    console.log(`CITY_CHANGE ${JSON.stringify(change)}`)
  }
  const reviewExamples = decisions
    .filter((item) => item.status === 'review')
    .slice(0, 15)
  if (reviewExamples.length > 0) {
    console.log('Примеры записей на проверку:')
    for (const item of reviewExamples) {
      console.log(`  - ${item.record.organizationName} | ${item.record.city || 'город не указан'} | ${item.record.region || 'регион не указан'} | причина: ${item.reason || 'review'}`)
    }
  }
  console.log('Режим предпросмотра: изменения в Supabase не выполнялись.')
}

async function upsertStagingRecords(supabase, decisions, runId) {
  const rows = decisions.map((decision) => toStagingRow(decision.record, runId, decision))
  let upserted = 0

  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE)
    const { error } = await supabase
      .from('university_registry_records')
      .upsert(batch, { onConflict: 'source_key,source_record_key' })
    if (error) throw new Error(`Не удалось сохранить записи реестра: ${error.message}`)
    upserted += batch.length
  }

  return upserted
}

async function reconcileUniversities(supabase, records, { dryRun = false } = {}) {
  const [catalog, existingExternalIds] = await Promise.all([
    fetchAllUniversities(supabase),
    fetchAllExternalIds(supabase)
  ])
  const catalogById = new Map(catalog.map((item) => [item.id, { ...item }]))
  const originalCityById = new Map(catalog.map((item) => [item.id, item.city ?? null]))
  const externalIdIndex = new Map(existingExternalIds.map((item) => [
    `${item.source_key}:${item.external_id}`,
    item.university_id
  ]))
  const localByNameAndRegion = new Map()
  const touchedUniversityIds = new Set()
  const decisions = []

  // Existing external IDs are not blindly trusted for branches.
  // Their city/region/name-or-host are revalidated on every import.
  for (const record of records) {
    const externalUniversityId = externalIdIndex.get(`${record.sourceKey}:${record.sourceRecordKey}`)
    const externalMatch = externalUniversityId ? catalogById.get(externalUniversityId) : null
    let initial

    if (externalMatch && Boolean(externalMatch.is_branch) === Boolean(record.isBranch)) {
      if (!record.isBranch) {
        initial = { match: externalMatch, reason: 'external_id' }
      } else {
        const verification = chooseMatch(record, [externalMatch])
        if (verification.match?.id === externalMatch.id) {
          initial = { match: externalMatch, reason: 'external_id_verified' }
        } else {
          // Re-evaluate across the entire catalog instead of retaining a stale branch link.
          initial = chooseMatch(record, [...catalogById.values()])
        }
      }
    } else {
      initial = chooseMatch(record, [...catalogById.values()])
    }

    if (initial.reason === 'review') {
      decisions.push({ record, status: 'review', universityId: null, reason: initial.reason })
      continue
    }

    let university = initial.match
    let matchedLocalRecord = false

    if (!university && initial.reason === 'new') {
      const cityKey = record.isBranch
        ? (normalizeRegistryMatchCity(record.city) || 'unknown-city')
        : ''
      const localKey = [
        record.isBranch ? 'branch' : 'main',
        record.normalizedName,
        (record.region ?? '').toLocaleLowerCase('ru-RU'),
        cityKey
      ].join('|')
      const local = localByNameAndRegion.get(localKey)
      if (local) {
        university = local
        matchedLocalRecord = true
      } else {
        const id = randomUUID()
        university = {
          id,
          name: record.organizationName,
          short_name: record.shortName || deriveRegistryShortName(record.organizationName),
          city: record.city || 'Город не указан',
          address: record.address || null,
          website: record.websiteUrl || null,
          description: record.region ? `Регион: ${record.region}. Запись импортирована из государственного реестра; сведения о приёме ещё требуют проверки.` : 'Запись импортирована из государственного реестра; сведения о приёме ещё требуют проверки.',
          region: record.region || null,
          official_domain: record.officialDomain || null,
          inn: record.inn || null,
          ogrn: record.ogrn || null,
          organization_type: record.organizationType || organizationTypeFromName(record.organizationName),
          is_branch: Boolean(record.isBranch),
          parent_university_id: null,
          registry_status: record.sourceKey === 'minobrnauki_admission' ? 'minobrnauki_listed' : 'miccedu_listed',
          registry_sources: [record.sourceKey],
          registry_last_seen_at: new Date().toISOString(),
          minobrnauki_admission_url: record.admissionUrl || null,
          minobrnauki_rules_url: record.rulesUrl || null,
          minobrnauki_places_url: record.placesUrl || null,
          miccedu_profile_url: record.sourceKey === 'miccedu_monitoring' ? record.sourceUrl : null
        }
        catalogById.set(id, university)
        localByNameAndRegion.set(localKey, university)
      }
    }

    if (!university) {
      decisions.push({ record, status: 'review', universityId: null, reason: 'no_university_after_match' })
      continue
    }

    const currentSources = Array.isArray(university.registry_sources)
      ? university.registry_sources
      : []
    const sources = [...new Set([...currentSources, record.sourceKey])]
    const profileEnriched = record.sourceKey === 'miccedu_monitoring' && record.metadata?.profileEnriched === true
    const officialDomain = profileEnriched && record.officialDomain
      ? record.officialDomain
      : (university.official_domain || record.officialDomain || null)
    const website = profileEnriched && record.websiteUrl
      ? record.websiteUrl
      : (university.website || record.websiteUrl || null)
    const profileCity = profileEnriched && !isPlaceholderCity(record.city)
      ? record.city
      : null
    const city = profileCity
      || (isPlaceholderCity(university.city)
        ? (record.city || university.city || 'Город не указан')
        : university.city)
    const shortName = isPoorShortName(university.short_name)
      ? (record.shortName || deriveRegistryShortName(record.organizationName))
      : university.short_name

    Object.assign(university, {
      short_name: shortName,
      city,
      address: record.address || university.address || null,
      website,
      region: profileEnriched && record.region
        ? record.region
        : (university.region || record.region || null),
      official_domain: officialDomain,
      inn: university.inn || record.inn || null,
      ogrn: university.ogrn || record.ogrn || null,
      organization_type: record.organizationType && record.organizationType !== 'unknown'
        ? record.organizationType
        : (university.organization_type || organizationTypeFromName(record.organizationName)),
      is_branch: Boolean(university.is_branch || record.isBranch),
      registry_status: combineRegistryStatus(sources),
      registry_sources: sources,
      registry_last_seen_at: new Date().toISOString(),
      minobrnauki_admission_url: university.minobrnauki_admission_url || record.admissionUrl || null,
      minobrnauki_rules_url: university.minobrnauki_rules_url || record.rulesUrl || null,
      minobrnauki_places_url: university.minobrnauki_places_url || record.placesUrl || null,
      miccedu_profile_url: university.miccedu_profile_url || (record.sourceKey === 'miccedu_monitoring' ? record.sourceUrl : null)
    })

    touchedUniversityIds.add(university.id)
    decisions.push({
      record,
      status: initial.match || matchedLocalRecord ? 'matched' : 'created',
      universityId: university.id,
      reason: initial.reason
    })
  }

  // Build source-record -> university ID map before resolving parent branches.
  // MICCEDU parentSourceRecordKey points to another record from the same source.
  const sourceIdToUniversityId = new Map()
  for (const decision of decisions) {
    if (!decision.universityId) continue
    sourceIdToUniversityId.set(
      `${decision.record.sourceKey}:${decision.record.sourceRecordKey}`,
      decision.universityId
    )
  }

  for (const decision of decisions) {
    const { record, universityId } = decision
    if (!universityId) continue

    const branch = catalogById.get(universityId)
    if (!branch || !(record.isBranch || branch.is_branch)) continue

    let parentUniversityId = record.parentSourceRecordKey
      ? (
          sourceIdToUniversityId.get(`miccedu_monitoring:${record.parentSourceRecordKey}`)
          || sourceIdToUniversityId.get(`${record.sourceKey}:${record.parentSourceRecordKey}`)
          || null
        )
      : null
    let parentUniversity = parentUniversityId ? catalogById.get(parentUniversityId) || null : null

    if ((!parentUniversity || parentUniversity.is_branch) && record.parentOrganizationName) {
      parentUniversity = findParentUniversityByName(record.parentOrganizationName, [...catalogById.values()])
      parentUniversityId = parentUniversity?.id || null
    }

    // Set parent only when exactly one non-branch institution is identified.
    // Never overwrite a different pre-existing parent automatically.
    if (parentUniversity && !parentUniversity.is_branch && parentUniversity.id !== universityId) {
      if (!branch.parent_university_id || branch.parent_university_id === parentUniversity.id) {
        if (branch.parent_university_id !== parentUniversity.id) {
          branch.parent_university_id = parentUniversity.id
          touchedUniversityIds.add(universityId)
        }
      }
    } else {
      parentUniversity = null
    }

    const parentName = record.parentOrganizationName || parentUniversity?.name || null
    const proposedShortName = buildBranchShortName(record, parentName, parentUniversity)
    const parserShortName = deriveRegistryShortName(record.organizationName)
    const currentShortName = String(branch.short_name ?? '').trim()
    const currentIsImporterDefault = !currentShortName
      || normalizeRegistryName(currentShortName) === normalizeRegistryName(parserShortName)
      || isPoorShortName(currentShortName)

    if (proposedShortName && currentIsImporterDefault && currentShortName !== proposedShortName) {
      branch.short_name = proposedShortName
      touchedUniversityIds.add(universityId)
    }
    if (proposedShortName) record.shortName = proposedShortName
  }

  const universityRows = [...catalogById.values()]
    .filter((university) => touchedUniversityIds.has(university.id))
    .map((university) => ({
      id: university.id,
      name: university.name,
      short_name: university.short_name,
      city: university.city || 'Город не указан',
      address: university.address || null,
      website: university.website,
      description: university.description,
      region: university.region,
      official_domain: university.official_domain,
      inn: university.inn,
      ogrn: university.ogrn,
      organization_type: university.organization_type,
      is_branch: university.is_branch,
      parent_university_id: university.parent_university_id,
      registry_status: university.registry_status,
      registry_sources: university.registry_sources ?? [],
      registry_last_seen_at: university.registry_last_seen_at,
      minobrnauki_admission_url: university.minobrnauki_admission_url,
      minobrnauki_rules_url: university.minobrnauki_rules_url,
      minobrnauki_places_url: university.minobrnauki_places_url,
      miccedu_profile_url: university.miccedu_profile_url
    }))

  const cityChanges = universityRows.flatMap((row) => {
    if (!originalCityById.has(row.id)) return []

    const oldCity = originalCityById.get(row.id)
    const newCity = row.city ?? null

    if (oldCity === newCity || !newCity || isPlaceholderCity(newCity)) return []

    const sources = decisions
      .filter((item) => item.universityId === row.id)
      .map(({ record, reason, status }) => ({
        sourceKey: record.sourceKey,
        sourceRecordKey: record.sourceRecordKey,
        sourceUrl: record.sourceUrl ?? null,
        sourceCity: record.city ?? null,
        sourceRegion: record.region ?? null,
        address: record.address ?? null,
        profileEnriched: record.metadata?.profileEnriched === true,
        status,
        matchReason: reason ?? null
      }))

    return [{
      universityId: row.id,
      universityName: row.name,
      oldCity,
      newCity,
      region: row.region ?? null,
      isBranch: Boolean(row.is_branch),
      parentUniversityId: row.parent_university_id ?? null,
      sources
    }]
  })
  // Check deferred parent FK references even in dry-run mode.
  const existingUniversityIds = new Set(catalog.map((university) => university.id))
  const rowsToInsertBeforeParentLinks = universityRows.map((row) => ({
    ...row,
    parent_university_id: row.parent_university_id && existingUniversityIds.has(row.parent_university_id)
      ? row.parent_university_id
      : null
  }))
  const preparedUniversityIds = new Set(universityRows.map((row) => row.id))
  const deferredParentRows = universityRows
    .filter((row) => row.parent_university_id && !existingUniversityIds.has(row.parent_university_id))
    .map((row) => ({ id: row.id, parent_university_id: row.parent_university_id }))

  const unresolvedParentRows = deferredParentRows.filter((row) => {
    const existsInThisImport = preparedUniversityIds.has(row.parent_university_id)
    return !existsInThisImport
  })
  if (unresolvedParentRows.length > 0) {
    throw new Error(
      'Невозможно сохранить связи филиалов: головные университеты отсутствуют среди подготовленных записей (' + unresolvedParentRows.length + '). Первые ID: ' + unresolvedParentRows.slice(0, 5).map((row) => row.parent_university_id).join(', ')
    )
  }

  const externalIds = decisions
    .filter((item) => item.universityId)
    .map((item) => ({
      university_id: item.universityId,
      source_key: item.record.sourceKey,
      external_id: item.record.sourceRecordKey,
      source_url: item.record.sourceUrl,
      last_seen_at: new Date().toISOString()
    }))

  const domains = decisions
    .filter((item) => item.universityId && item.record.officialDomain)
    .map((item) => {
      const isMiccedu = item.record.sourceKey === 'miccedu_monitoring'
      return {
        university_id: item.universityId,
        domain: item.record.officialDomain,
        domain_role: isMiccedu ? 'main' : 'admissions',
        verification_status: isMiccedu ? 'listed_by_miccedu' : 'listed_by_ministry',
        verification_method: isMiccedu ? 'miccedu_institution_profile' : 'minobrnauki_catalog',
        source_url: isMiccedu ? item.record.sourceUrl : (item.record.admissionUrl || item.record.sourceUrl),
        last_verified_at: new Date().toISOString()
      }
    })

  // Supabase cannot update the same conflict key twice in one upsert statement.
  const uniqueDomainsByConflictKey = new Map()
  for (const domain of domains) {
    const conflictKey = JSON.stringify([
      domain.university_id,
      domain.domain,
      domain.domain_role
    ])
    uniqueDomainsByConflictKey.set(conflictKey, domain)
  }
  const uniqueDomains = [...uniqueDomainsByConflictKey.values()]
  const duplicatesRemoved = domains.length - uniqueDomains.length

  console.log(
    'Официальные домены: уникальных ' + uniqueDomains.length
    + ', повторов объединено ' + duplicatesRemoved
  )

  if (!dryRun) {
    // Persist universities first. Parent links to newly created parents are deferred.
    for (let index = 0; index < rowsToInsertBeforeParentLinks.length; index += UPSERT_BATCH_SIZE) {
      const batch = rowsToInsertBeforeParentLinks.slice(index, index + UPSERT_BATCH_SIZE)
      const { error } = await supabase
        .from('universities')
        .upsert(batch, { onConflict: 'id' })
      if (error) throw new Error('Не удалось сохранить universities (этап 1/2): ' + error.message)
    }

    const childrenByParent = new Map()
    for (const row of deferredParentRows) {
      if (!row.id || !row.parent_university_id) continue
      const childIds = childrenByParent.get(row.parent_university_id) || []
      childIds.push(row.id)
      childrenByParent.set(row.parent_university_id, childIds)
    }

    for (const [parentId, childIds] of childrenByParent) {
      for (let index = 0; index < childIds.length; index += UPSERT_BATCH_SIZE) {
        const batch = childIds.slice(index, index + UPSERT_BATCH_SIZE)
        const { data, error } = await supabase
          .from('universities')
          .update({ parent_university_id: parentId })
          .in('id', batch)
          .select('id')

        if (error) {
          throw new Error('Не удалось установить связи филиалов: ' + error.message)
        }

        const updatedIds = new Set((data ?? []).map((item) => item.id))
        const missingIds = batch.filter((id) => !updatedIds.has(id))
        if (missingIds.length > 0) {
          throw new Error('Не все связи филиалов обновлены. Не найдено записей: ' + missingIds.length)
        }
      }
    }

    for (let index = 0; index < externalIds.length; index += UPSERT_BATCH_SIZE) {
      const batch = externalIds.slice(index, index + UPSERT_BATCH_SIZE)
      const { error } = await supabase
        .from('university_external_ids')
        .upsert(batch, { onConflict: 'source_key,external_id' })
      if (error) throw new Error(`Не удалось сохранить внешние идентификаторы: ${error.message}`)
    }

    for (let index = 0; index < uniqueDomains.length; index += UPSERT_BATCH_SIZE) {
      const batch = uniqueDomains.slice(index, index + UPSERT_BATCH_SIZE)
      const { error } = await supabase
        .from('university_official_domains')
        .upsert(batch, { onConflict: 'university_id,domain,domain_role' })
      if (error) throw new Error('Не удалось сохранить официальные домены: ' + error.message)
    }
  }

  return {
    created: decisions.filter((item) => item.status === 'created').length,
    matched: decisions.filter((item) => item.status === 'matched').length,
    review: decisions.filter((item) => item.status === 'review').length,
    decisions,
    universityRowsPrepared: universityRows.length,
    externalIdsPrepared: externalIds.length,
    domainsPrepared: uniqueDomains.length,
    parentLinksPrepared: universityRows.filter((row) => row.is_branch && row.parent_university_id).length,
    cityChanges,
    dryRun
  }
}

async function importMinobrnauki(supabase, options) {
  const sourceKey = 'minobrnauki_admission'
  const runId = options.dryRun ? null : await insertRun(supabase, sourceKey, new Date().getFullYear(), new Date().getFullYear())
  const errors = []
  const records = []
  let pagesSeen = 0

  try {
    const firstPageUrl = buildMinobrnaukiPageUrl(1)
    const firstHtml = await fetchOfficialPage(firstPageUrl, 'minobrnauki.gov.ru')
    pagesSeen += 1
    records.push(...parseMinobrnaukiAdmissionsPage(firstHtml, firstPageUrl))

    if (records.length === 0) {
      throw new Error('Каталог Минобрнауки не вернул университеты. Возможно, сайт находится на техническом обслуживании или изменил HTML-разметку.')
    }

    const discoveredPages = parseMinobrnaukiTotalPages(firstHtml, 61)
    const maxPages = Math.min(discoveredPages, options.minobrnaukiPages ?? discoveredPages)

    for (let page = 2; page <= maxPages; page += 1) {
      await sleep(SOURCE_DELAY_MS)
      const url = buildMinobrnaukiPageUrl(page)
      try {
        const html = await fetchOfficialPage(url, 'minobrnauki.gov.ru')
        pagesSeen += 1
        records.push(...parseMinobrnaukiAdmissionsPage(html, url))
      } catch (error) {
        errors.push({ page, message: error instanceof Error ? error.message : String(error) })
        console.warn(`Минобрнауки: страница ${page} пропущена — ${errors.at(-1).message}`)
      }
    }

    const uniqueRecords = deduplicateRegistryRecords(records)
    console.log(`Минобрнауки: страниц ${pagesSeen}/${maxPages}, уникальных организаций ${uniqueRecords.length}, ошибок ${errors.length}`)

    const merged = await reconcileUniversities(supabase, uniqueRecords, { dryRun: options.dryRun })
    if (options.dryRun) {
      logReconciliationPreview(sourceKey, merged)
    } else {
      const upserted = await upsertStagingRecords(supabase, merged.decisions, runId)
      await updateRun(supabase, runId, {
        status: errors.length > 0 ? 'partial' : 'completed',
        pages_seen: pagesSeen,
        records_seen: uniqueRecords.length,
        records_upserted: upserted,
        universities_created: merged.created,
        universities_matched: merged.matched,
        records_for_review: merged.review,
        error_count: errors.length,
        error_summary: errors.slice(0, 100)
      })
      await supabase.from('university_registry_sources')
        .update({ last_imported_at: new Date().toISOString() })
        .eq('source_key', sourceKey)
    }

    return { sourceKey, pagesSeen, recordCount: uniqueRecords.length, errors, runId, merged }
  } catch (error) {
    if (!options.dryRun && runId) {
      await updateRun(supabase, runId, {
        status: 'failed',
        pages_seen: pagesSeen,
        records_seen: records.length,
        error_count: 1,
        error_summary: [{ message: error instanceof Error ? error.message : String(error) }]
      }).catch(() => undefined)
    }
    throw error
  }
}

async function enrichMicceduProfiles(records, options, errors) {
  const limit = options.micceduProfileLimit == null
    ? records.length
    : Math.min(records.length, options.micceduProfileLimit)
  let enriched = 0
  let attempted = 0

  for (const record of records.slice(0, limit)) {
    attempted += 1
    await sleep(SOURCE_DELAY_MS)
    try {
      const html = await fetchOfficialPage(record.sourceUrl, 'monitoring.miccedu.ru')
      const details = parseMicceduInstitutionPage(html, record)
      Object.assign(record, details)
      enriched += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ profile: record.sourceRecordKey, organization: record.organizationName, message })
      console.warn(`MICCEDU: карточка «${record.organizationName}» не обогащена — ${message}`)
    }
  }

  return { attempted, enriched, skipped: records.length - limit }
}

async function importMiccedu(supabase, options) {
  const year = options.micceduYear ?? DEFAULT_MICCEDU_YEAR
  const dataYear = year - 1
  const sourceKey = 'miccedu_monitoring'
  const runId = options.dryRun ? null : await insertRun(supabase, sourceKey, year, dataYear)
  const errors = []
  let pagesSeen = 0

  try {
    const indexUrl = `${MICCEDU_BASE}/?m=vpo&year=${year}`
    const indexHtml = await fetchOfficialPage(indexUrl, 'monitoring.miccedu.ru')
    pagesSeen += 1
    const regions = parseMicceduRegionsPage(indexHtml, year, indexUrl)

    if (regions.length === 0) {
      throw new Error(`Мониторинг ${year}: не удалось обнаружить региональные страницы. Возможно, источник изменил разметку или этот год ещё не опубликован.`)
    }

    const maxRegions = options.maxRegions ?? regions.length
    const selectedRegions = regions.slice(0, maxRegions)
    const records = []

    for (const region of selectedRegions) {
      await sleep(SOURCE_DELAY_MS)
      try {
        const html = await fetchOfficialPage(region.url, 'monitoring.miccedu.ru')
        pagesSeen += 1
        records.push(...parseMicceduRegionPage(html, region, year))
      } catch (error) {
        errors.push({ region: region.regionName, url: region.url, message: error instanceof Error ? error.message : String(error) })
        console.warn(`Мониторинг ${year}: регион «${region.regionName}» пропущен — ${errors.at(-1).message}`)
      }
    }

    const uniqueRecords = deduplicateRegistryRecords(records)
    const profileStats = await enrichMicceduProfiles(uniqueRecords, options, errors)
    pagesSeen += profileStats.attempted
    console.log(`Мониторинг ${year} (данные ${dataYear}): регионов ${selectedRegions.length}, организаций ${uniqueRecords.length}`)
    console.log(`Карточки организаций MICCEDU: обогащено ${profileStats.enriched}/${profileStats.attempted}, пропущено ${profileStats.skipped}, ошибок ${errors.length}`)

    const merged = await reconcileUniversities(supabase, uniqueRecords, { dryRun: options.dryRun })
    if (options.dryRun) {
      logReconciliationPreview(sourceKey, merged)
    } else {
      const upserted = await upsertStagingRecords(supabase, merged.decisions, runId)
      await updateRun(supabase, runId, {
        status: errors.length > 0 ? 'partial' : 'completed',
        pages_seen: pagesSeen,
        records_seen: uniqueRecords.length,
        records_upserted: upserted,
        universities_created: merged.created,
        universities_matched: merged.matched,
        records_for_review: merged.review,
        error_count: errors.length,
        error_summary: errors.slice(0, 100)
      })
      await supabase.from('university_registry_sources')
        .update({ last_imported_at: new Date().toISOString() })
        .eq('source_key', sourceKey)
    }

    return { sourceKey, pagesSeen, recordCount: uniqueRecords.length, errors, runId, sourceYear: year, dataYear, merged }
  } catch (error) {
    if (!options.dryRun && runId) {
      await updateRun(supabase, runId, {
        status: 'failed',
        pages_seen: pagesSeen,
        records_seen: 0,
        error_count: 1,
        error_summary: [{ message: error instanceof Error ? error.message : String(error) }]
      }).catch(() => undefined)
    }
    throw error
  }
}

async function main() {
  const source = readArg('source', 'all')
  const dryRun = hasFlag('dry-run')
  const minobrnaukiPagesRaw = readArg('minobrnauki-pages')
  const micceduYearRaw = readArg('miccedu-year')
  const maxRegionsRaw = readArg('max-regions')
  const micceduProfileLimitRaw = readArg('miccedu-profile-limit')
  const options = {
    dryRun,
    minobrnaukiPages: minobrnaukiPagesRaw ? Number(minobrnaukiPagesRaw) : null,
    micceduYear: micceduYearRaw ? Number(micceduYearRaw) : DEFAULT_MICCEDU_YEAR,
    maxRegions: maxRegionsRaw ? Number(maxRegionsRaw) : null,
    micceduProfileLimit: micceduProfileLimitRaw ? Number(micceduProfileLimitRaw) : null
  }

  if (options.minobrnaukiPages != null && (!Number.isInteger(options.minobrnaukiPages) || options.minobrnaukiPages < 1)) {
    throw new Error('Параметр --minobrnauki-pages должен быть целым числом от 1 до 61.')
  }
  if (options.minobrnaukiPages != null) options.minobrnaukiPages = Math.min(61, options.minobrnaukiPages)
  if (options.maxRegions != null && (!Number.isInteger(options.maxRegions) || options.maxRegions < 1)) {
    throw new Error('Параметр --max-regions должен быть положительным целым числом.')
  }
  if (options.micceduProfileLimit != null && (!Number.isInteger(options.micceduProfileLimit) || options.micceduProfileLimit < 1)) {
    throw new Error('Параметр --miccedu-profile-limit должен быть положительным целым числом.')
  }

  if (!['all', 'minobrnauki', 'miccedu'].includes(source)) {
    throw new Error('Параметр --source должен быть all, minobrnauki или miccedu.')
  }
  if (!Number.isInteger(options.micceduYear) || options.micceduYear < 2015 || options.micceduYear > 2035) {
    throw new Error('Некорректный год мониторинга MICCEDU.')
  }

  // Dry-run also needs read access to the current catalog for a meaningful preview.
  // reconcileUniversities skips every write when options.dryRun is true.
  const supabase = createSupabaseAdmin()
  const results = []
  const failures = []

  if (source === 'all' || source === 'minobrnauki') {
    console.log('\n=== Импорт каталога Минобрнауки ===')
    try {
      results.push(await importMinobrnauki(supabase, options))
    } catch (error) {
      failures.push({ source: 'minobrnauki_admission', message: error instanceof Error ? error.message : String(error) })
      console.error(`Минобрнауки: импорт не завершён — ${failures.at(-1).message}`)
    }
  }

  if (source === 'all' || source === 'miccedu') {
    console.log('\n=== Импорт мониторинга MICCEDU ===')
    try {
      results.push(await importMiccedu(supabase, options))
    } catch (error) {
      failures.push({ source: 'miccedu_monitoring', message: error instanceof Error ? error.message : String(error) })
      console.error(`MICCEDU: импорт не завершён — ${failures.at(-1).message}`)
    }
  }

  console.log('\n=== Итог импорта ===')
  for (const result of results) {
    console.log(`${result.sourceKey}: ${result.recordCount} записей, ${result.pagesSeen} страниц${result.errors.length ? `, ошибок: ${result.errors.length}` : ''}`)
    if (dryRun && result.merged) {
      console.log(`Подготовка без записи: новых вузов ${result.merged.created}, сопоставлено ${result.merged.matched}, на проверку ${result.merged.review}, подготовлено обновлений вузов ${result.merged.universityRowsPrepared}, внешних ID ${result.merged.externalIdsPrepared}, доменов ${result.merged.domainsPrepared}, связей филиал-вуз ${result.merged.parentLinksPrepared}.`)
    }
  }
  for (const failure of failures) console.log(`${failure.source}: ошибка — ${failure.message}`)

  if (dryRun) {
    console.log('\nРежим --dry-run: Supabase использовался только для чтения; данные не записывались.')
  }
  if (failures.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nИмпорт прерван:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
