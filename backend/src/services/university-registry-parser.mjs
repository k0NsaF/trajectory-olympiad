const MINOBRNAUKI_BASE = 'https://minobrnauki.gov.ru/abitur/'

export function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
}

export function htmlToText(value) {
  return decodeHtmlEntities(String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripLegalPrefix(value) {
  let text = String(value ?? '').trim()
  const prefixes = [
    /^(?:фгбоу|фгаоу|фгбу|фгоу|гбоу|гбпоу|фгбво|фгао)(?:\s+во)?\s+/iu,
    /^(?:федеральное\s+)?государственное\s+(?:(?:бюджетное|автономное|казенное|казённое)\s+)?(?:образовательное\s+)?(?:учреждение\s+)?высшего\s+образования\s+/iu,
    /^(?:государственное\s+)?(?:автономное\s+)?образовательное\s+учреждение\s+высшего\s+образования\s+/iu,
    /^(?:автономная\s+некоммерческая\s+организация|частное\s+образовательное\s+учреждение|негосударственное\s+образовательное\s+учреждение)\s+(?:высшего\s+образования\s+)?/iu,
    /^образовательная\s+организация\s+высшего\s+образования\s+/iu,
    /^религиозная\s+организация\s*[-–—]\s*духовная\s+образовательная\s+организация\s+высшего\s+образования\s+/iu
  ]

  for (let pass = 0; pass < 3; pass += 1) {
    const before = text
    for (const prefix of prefixes) text = text.replace(prefix, '')
    if (before === text) break
  }

  text = text.replace(
    /((?:^|\s)филиал|\(филиал\))\s+(?:федерального\s+)?государственного\s+(?:(?:бюджетного|автономного|казенного|казённого)\s+)?(?:образовательного\s+)?(?:учреждения\s+)?высшего\s+образования\s+/iu,
    '$1 '
  )
  text = text.replace(/\s+(?:министерства|министерству|федерального\s+агентства|правительства\s+российской\s+федерации)(?=\s|$)[\s\S]*$/iu, '')
  return text.trim()
}

export function normalizeRegistryName(value) {
  return stripLegalPrefix(htmlToText(value))
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\bим\.?\s+/giu, ' ')
    .replace(/\bимени\s+/giu, ' ')
    .replace(/[«»"'`]/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deriveRegistryShortName(value) {
  const text = htmlToText(value)

  // For branches, keep the local branch name and its marker. The text after
  // that marker is usually the long legal name of the parent institution.
  // Including it in short_name creates misleading, excessively long labels.
  const branchMarker = /^(.*?(?:филиал|\(филиал\)))/iu.exec(text)
  if (branchMarker) {
    const branchName = branchMarker[1].replace(/\s+/g, ' ').trim()
    const remainder = text.slice(branchMarker[0].length)
    if (branchName.length >= 7 && /(?:федерального|государственного|автономн\w*|бюджетного|образовательного|высшего образования)/iu.test(remainder)) {
      return branchName.length > 100 ? `${branchName.slice(0, 97).trim()}…` : branchName
    }
    if (branchName.toLocaleLowerCase('ru-RU') === 'филиал') {
      const parentName = /[«"]([^»"]{3,140})[»"]/u.exec(remainder)?.[1]?.trim()
      const locality = /(?:в\s+г\.?\s*|г\.?\s*)([А-ЯЁ][\p{L}.'-]*(?:\s+[А-ЯЁ][\p{L}.'-]*){0,2})/u.exec(remainder)?.[1]
      if (parentName) return `Филиал: ${parentName}${locality ? ` (${locality})` : ''}`
    }
  }

  const quoted = /[«"]([^»"]{3,140})[»"]/u.exec(text)?.[1]?.trim()
  if (quoted) return quoted.replace(/\s+/g, ' ')

  const acronym = /\(([А-ЯЁA-Z0-9][А-ЯЁA-Z0-9 -]{1,20})\)/u.exec(text)?.[1]?.trim()
  if (acronym && !/филиал|институт|университет/iu.test(acronym)) return acronym

  let clean = stripLegalPrefix(text)
  clean = clean.replace(/\s+(?:министерства|министерству|федерального\s+агентства|правительства\s+российской\s+федерации)(?=\s|$)[\s\S]*$/iu, '')
  clean = clean.replace(/^(?:[А-ЯЁ][\p{L}-]+(?:\s+[А-ЯЁ][\p{L}-]+){0,2}\s+(?:области|края|республики|автономного округа))\s+/iu, '')
  clean = clean.replace(/\s+/g, ' ').trim()
  if (!clean || /^(?:высшего образования|образования|государственного|государственное|федерального|образовательного)(?=\s|$)/iu.test(clean)) {
    return text.length > 100 ? `${text.slice(0, 97).trim()}…` : text
  }
  return clean.length > 100 ? `${clean.slice(0, 97).trim()}…` : clean
}

export function getOfficialHostname(hostOrUrl) {
  try {
    return new URL(/^https?:\/\//i.test(hostOrUrl) ? hostOrUrl : `https://${hostOrUrl}`)
      .hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export function getRootDomain(hostOrUrl) {
  const hostname = getOfficialHostname(hostOrUrl)
  if (!hostname) return null
  const parts = hostname.split('.').filter(Boolean)
  if (parts.length <= 2) return hostname

  const compoundSecondLevels = new Set([
    'com.ru', 'org.ru', 'net.ru', 'edu.ru', 'gov.ru', 'ac.ru', 'spb.ru'
  ])
  const suffix = parts.slice(-2).join('.')
  return compoundSecondLevels.has(suffix)
    ? parts.slice(-3).join('.')
    : parts.slice(-2).join('.')
}

function safeHttpUrl(href, baseUrl) {
  try {
    const url = new URL(decodeHtmlEntities(href).trim(), baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function extractAttributes(tag) {
  const attributes = {}
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match
  while ((match = pattern.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attributes
}

function extractAnchors(html, baseUrl) {
  const anchors = []
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    const attributes = extractAttributes(`<a ${match[1]}>`)
    const href = typeof attributes.href === 'string'
      ? safeHttpUrl(attributes.href, baseUrl)
      : null
    const text = htmlToText(match[2])
    if (href && text) anchors.push({ href, text })
  }
  return anchors
}

function extractHeadings(html) {
  const headings = []
  const pattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    headings.push({
      level: Number(match[1]),
      text: htmlToText(match[2]),
      start: match.index,
      end: pattern.lastIndex
    })
  }
  return headings
}

function isOrganizationHeading(value) {
  const text = value.trim()
  if (text.length < 18) return false
  return !/^(государственные|негосударственные|частные|поиск|информация о правилах|приемная кампания|архив)/iu.test(text)
}

function pickMinobrnaukiLinks(anchors) {
  const admission = anchors.find((item) => /страница приемной кампании|страница приёмной кампании|приемная кампания|приёмная кампания/iu.test(item.text))
  const rules = anchors.find((item) => /правил[аы]? приема|правил[аы]? приёма/iu.test(item.text))
  const places = anchors.find((item) => /числ[оа] мест|количество мест|места приема|места приёма/iu.test(item.text))
  return {
    admissionUrl: admission?.href ?? null,
    rulesUrl: rules?.href ?? null,
    placesUrl: places?.href ?? null
  }
}

export function parseMinobrnaukiAdmissionsPage(html, pageUrl = MINOBRNAUKI_BASE) {
  const headings = extractHeadings(html)
  const organizations = []

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    if (!isOrganizationHeading(heading.text)) continue

    const nextHeading = headings.slice(index + 1).find((item) => item.level <= heading.level)
    const end = nextHeading?.start ?? html.length
    const block = html.slice(heading.end, end)
    const anchors = extractAnchors(block, pageUrl)
    const links = pickMinobrnaukiLinks(anchors)
    const fallbackUrl = links.admissionUrl ?? links.rulesUrl ?? links.placesUrl
    const rootDomain = fallbackUrl ? getRootDomain(fallbackUrl) : null

    if (!fallbackUrl || !rootDomain) continue

    const normalizedName = normalizeRegistryName(heading.text)
    if (normalizedName.length < 5) continue

    organizations.push({
      sourceKey: 'minobrnauki_admission',
      sourceRecordKey: `${normalizedName}|${rootDomain}`,
      sourceYear: new Date().getFullYear(),
      dataYear: new Date().getFullYear(),
      organizationName: heading.text,
      normalizedName,
      shortName: deriveRegistryShortName(heading.text),
      city: null,
      region: null,
      address: null,
      inn: null,
      ogrn: null,
      organizationType: null,
      isBranch: /филиал/iu.test(heading.text),
      parentSourceRecordKey: null,
      parentOrganizationName: null,
      websiteUrl: `https://${rootDomain}`,
      officialDomain: rootDomain,
      admissionUrl: links.admissionUrl,
      rulesUrl: links.rulesUrl,
      placesUrl: links.placesUrl,
      sourceUrl: pageUrl,
      metadata: {
        source: 'Минобрнауки России',
        listingTitle: heading.text,
        sourceLinks: anchors.slice(0, 8)
      }
    })
  }

  return organizations
}

export function parseMinobrnaukiTotalPages(html, fallback = 61) {
  const matches = [...String(html).matchAll(/PAGEN_1=(\d+)/g)]
  const pages = matches.map((item) => Number(item[1])).filter((value) => Number.isInteger(value) && value > 0)
  return pages.length > 0 ? Math.max(...pages) : fallback
}

export function buildMinobrnaukiPageUrl(page) {
  const url = new URL(MINOBRNAUKI_BASE)
  if (page > 1) {
    url.searchParams.set('PAGEN_1', String(page))
    url.searchParams.set('SIZEN_1', '10')
  }
  return url.toString()
}

export function parseMicceduRegionsPage(html, year = 2025, baseUrl = `https://monitoring.miccedu.ru/?m=vpo&year=${year}`) {
  const anchors = extractAnchors(html, baseUrl)
  const regions = []
  const seen = new Set()

  for (const anchor of anchors) {
    const url = new URL(anchor.href)
    if (!url.pathname.includes(`/iam/${year}/_vpo/material.php`)) continue
    const id = url.searchParams.get('id')
    if (!id) continue
    const key = `${id}:${anchor.text}`
    if (seen.has(key)) continue
    seen.add(key)
    regions.push({
      sourceKey: 'miccedu_monitoring',
      regionKey: id,
      regionName: anchor.text,
      url: anchor.href
    })
  }

  return regions
}

export function parseMicceduRegionPage(html, region, year = 2025) {
  const profileAnchors = extractAnchors(html, region.url)
  const organizations = []
  const seen = new Set()

  for (const anchor of profileAnchors) {
    const url = new URL(anchor.href)
    if (!url.pathname.includes(`/iam/${year}/_vpo/inst.php`)) continue
    const externalId = url.searchParams.get('id')
    if (!externalId || seen.has(externalId)) continue

    const normalizedName = normalizeRegistryName(anchor.text)
    if (normalizedName.length < 4) continue
    seen.add(externalId)

    organizations.push({
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: externalId,
      sourceYear: year,
      dataYear: year - 1,
      organizationName: anchor.text,
      normalizedName,
      shortName: deriveRegistryShortName(anchor.text),
      city: /^г\.?\s*/iu.test(region.regionName) ? region.regionName.replace(/^г\.?\s*/iu, '').trim() : null,
      region: region.regionName,
      address: null,
      inn: null,
      ogrn: null,
      organizationType: null,
      isBranch: /филиал/iu.test(anchor.text),
      parentSourceRecordKey: null,
      parentOrganizationName: null,
      websiteUrl: null,
      officialDomain: null,
      admissionUrl: null,
      rulesUrl: null,
      placesUrl: null,
      sourceUrl: anchor.href,
      metadata: {
        source: 'Мониторинг высшего образования',
        sourceYear: year,
        dataYear: year - 1,
        regionKey: region.regionKey,
        regionName: region.regionName
      }
    })
  }

  return organizations
}

function extractTableRows(html) {
  const rows = []
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/giu
  let rowMatch
  while ((rowMatch = rowPattern.exec(String(html))) !== null) {
    const cells = []
    const cellPattern = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/giu
    let cellMatch
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) cells.push(cellMatch[1])
    if (cells.length >= 2) {
      rows.push({
        cells,
        label: htmlToText(cells[0]).replace(/\s*[:：]\s*$/u, ''),
        valueHtml: cells.slice(1).join(' '),
        valueText: htmlToText(cells.slice(1).join(' '))
      })
    }
  }
  return rows
}

function findRow(rows, labelPattern) {
  return rows.find((row) => labelPattern.test(row.label)) ?? null
}

function extractUrlFromValue(valueHtml, valueText, baseUrl) {
  const anchor = extractAnchors(valueHtml, baseUrl)[0]
  if (anchor) return anchor.href
  const rawUrl = /(?:https?:\/\/|www\.)[^\s<>"']+/iu.exec(valueText)?.[0]
  if (!rawUrl) return null
  return safeHttpUrl(rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl, baseUrl)
}

export function extractCityFromAddress(value, region = null) {
  const text = htmlToText(value)
  const segments = text.split(/[,;]/u).map((part) => part.trim()).filter(Boolean)
  const localityPrefix = /^(?:(?:пос[её]лок\s+городского\s+типа)|(?:рабочий\s+пос[её]лок)|(?:город)|(?:село)|(?:пос[её]лок)|(?:деревня)|(?:станица)|(?:хутор)|(?:пгт\.?|пс\.?|рп\.?|ст-ца\.?|ст\.?|х\.?|г\.?|с\.?|п\.?|д\.?))\s*/iu

  for (const segment of segments) {
    const marker = localityPrefix.exec(segment)
    if (!marker) continue

    let locality = segment.slice(marker[0].length)
      .replace(/\s+(?:ул\.?|улица|пр\.?|проспект|пр-кт|мкр\.?|микрорайон|пер\.?|переулок|д\.?|дом|пл\.?|площадь|наб\.?|набережная)\b[\s\S]*$/iu, '')
      .replace(/[.,;]+$/u, '')
      .trim()

    if (!locality || !/\p{L}/u.test(locality) || /^\d/u.test(locality)) continue
    if (locality.length > 90) locality = locality.slice(0, 90).trim()
    return locality || null
  }

  const regionMatch = /^\s*г\.?\s*(.+)$/iu.exec(String(region ?? '').trim())
  return regionMatch?.[1]?.trim() || null
}

function organizationTypeFromDepartment(value) {
  const text = String(value ?? '').toLocaleLowerCase('ru-RU')
  if (/частн|негосударствен|некоммерческ|религиозн/iu.test(text)) return 'private'
  if (/министерств|правительств|федеральн|государствен|муниципальн/iu.test(text)) return 'public'
  return 'unknown'
}

function isGenericParentOrganizationName(value) {
  const normalized = normalizeRegistryName(value)
  return /^(?:университет(?:а|у|ом)?|институт(?:а|у|ом)?|академи(?:я|и|ю|ей)|вуз|образовательная организация(?: высшего образования)?)$/iu.test(normalized)
}

function extractParentOrganizationFromBranchName(value) {
  const text = htmlToText(value)
  if (!/филиал/iu.test(text)) return null

  // Use Unicode-aware letter boundaries: JavaScript's \b does not reliably
  // recognize Cyrillic letters as word characters.
  const marker = /\(\s*филиал\s*\)|(?<![\p{L}\p{N}])филиал(?![\p{L}\p{N}])/iu.exec(text)
  if (!marker) return null

  const remainder = text.slice(marker.index + marker[0].length).trim()
  if (!remainder) return null

  const quoted = /[«"]([^»"]{5,180})[»"]/u.exec(remainder)?.[1]?.trim()
  if (quoted) return isGenericParentOrganizationName(quoted) ? null : quoted

  // Without quotes, only parse a parent when the remainder explicitly starts
  // with a legal-form / state-organization prefix. Generic phrases such as
  // "филиал университета в городе N" are not sufficient evidence.
  const hasLegalOrganizationPrefix = /^(?:фгбоу|фгаоу|фгбво|фгбу|гбоу|гбпоу)(?:\s+во)?\s+|^(?:федерального\s+)?государственного\s+(?:(?:бюджетного|автономного|казенного|казённого)\s+)?(?:образовательного\s+)?(?:учреждения\s+)?высшего\s+образования\s+|^(?:автономной\s+некоммерческой\s+организации|частного\s+образовательного\s+учреждения|негосударственного\s+образовательного\s+учреждения|образовательной\s+организации\s+высшего\s+образования)\s+/iu.test(remainder)
  if (!hasLegalOrganizationPrefix) return null

  let candidate = stripLegalPrefix(remainder)
  candidate = candidate.replace(/\s+(?:в\s+)?(?:г\.?|городе|город)\s+[А-ЯЁ][\p{L}.' -]*$/iu, '')
  candidate = candidate.replace(/\s+/g, ' ').trim()
  if (!candidate || isGenericParentOrganizationName(candidate)) return null

  const normalized = normalizeRegistryName(candidate)
  const ignoredTokens = new Set([
    'федеральный', 'федерального', 'государственный', 'государственного',
    'бюджетный', 'бюджетного', 'автономный', 'автономного', 'образовательный',
    'образовательного', 'учреждение', 'учреждения', 'высшего', 'образования',
    'университет', 'университета', 'институт', 'института', 'академия', 'академии'
  ])
  const meaningfulTokens = normalized.split(/\s+/u).filter((token) => token && !ignoredTokens.has(token))
  const hasInstitutionType = /университет|институт|академи|консерватори|консерватория/iu.test(candidate)
  if (!hasInstitutionType || meaningfulTokens.length < 2 || candidate.length < 8) return null

  return candidate
}

export function parseMicceduInstitutionPage(html, baseRecord) {
  const rows = extractTableRows(html)
  const nameRow = findRow(rows, /наименование образовательной организации/iu)
  const addressRow = findRow(rows, /регион\s*,?\s*адрес/iu)
  const departmentRow = findRow(rows, /ведомственная принадлежность/iu)
  const websiteRow = findRow(rows, /^web[-\s]?сайт$|сайт организации/iu)

  const organizationName = nameRow?.valueText || baseRecord.organizationName
  const addressText = addressRow?.valueText ?? ''
  const addressLinks = addressRow ? extractAnchors(addressRow.valueHtml, baseRecord.sourceUrl) : []
  const region = addressLinks.find((item) => !/на карте|карта/iu.test(item.text))?.text
    || baseRecord.region
    || null
  const websiteUrl = websiteRow
    ? extractUrlFromValue(websiteRow.valueHtml, websiteRow.valueText, baseRecord.sourceUrl)
    : null

  const parentRow = findRow(rows, /сведения о головной образовательной организации/iu)
  const parentAnchors = parentRow ? extractAnchors(parentRow.valueHtml, baseRecord.sourceUrl) : []
  const parentLink = parentAnchors.find((item) => /\/inst\.php\?/iu.test(item.href)) || null
  let parentSourceRecordKey = null
  if (parentLink) {
    try {
      parentSourceRecordKey = new URL(parentLink.href).searchParams.get('id')
    } catch {
      parentSourceRecordKey = null
    }
  }

  const parentOrganizationName = parentLink?.text
    || extractParentOrganizationFromBranchName(organizationName)
    || null
  const officialDomain = websiteUrl ? getOfficialHostname(websiteUrl) : null
  const departmentType = organizationTypeFromDepartment(departmentRow?.valueText)
  const isBranch = Boolean(
    baseRecord.isBranch
    || parentSourceRecordKey
    || parentOrganizationName
    || /филиал/iu.test(organizationName)
  )

  return {
    ...baseRecord,
    organizationName,
    normalizedName: normalizeRegistryName(organizationName),
    shortName: deriveRegistryShortName(organizationName),
    city: extractCityFromAddress(addressText, region) || baseRecord.city || null,
    region: region || baseRecord.region || null,
    address: addressText || null,
    organizationType: departmentType !== 'unknown' ? departmentType : baseRecord.organizationType,
    isBranch,
    parentSourceRecordKey,
    parentOrganizationName,
    websiteUrl: websiteUrl || baseRecord.websiteUrl || null,
    officialDomain: officialDomain || baseRecord.officialDomain || null,
    metadata: {
      ...(baseRecord.metadata ?? {}),
      profileEnriched: true,
      profileSourceUrl: baseRecord.sourceUrl,
      department: departmentRow?.valueText || null,
      parentSourceRecordKey,
      parentOrganizationName
    }
  }
}

export function deduplicateRegistryRecords(records) {
  const result = new Map()
  for (const record of records) {
    const key = `${record.sourceKey}:${record.sourceRecordKey}`
    const previous = result.get(key)
    if (!previous) {
      result.set(key, record)
      continue
    }
    result.set(key, {
      ...previous,
      ...record,
      city: record.city ?? previous.city,
      region: record.region ?? previous.region,
      address: record.address ?? previous.address,
      websiteUrl: record.websiteUrl ?? previous.websiteUrl,
      officialDomain: record.officialDomain ?? previous.officialDomain,
      admissionUrl: record.admissionUrl ?? previous.admissionUrl,
      rulesUrl: record.rulesUrl ?? previous.rulesUrl,
      placesUrl: record.placesUrl ?? previous.placesUrl,
      parentSourceRecordKey: record.parentSourceRecordKey ?? previous.parentSourceRecordKey,
      parentOrganizationName: record.parentOrganizationName ?? previous.parentOrganizationName
    })
  }
  return [...result.values()]
}
