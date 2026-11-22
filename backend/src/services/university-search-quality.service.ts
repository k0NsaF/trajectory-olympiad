export interface UniversitySearchQualityInput {
  query: string
  mode: 'universities' | 'programs'
  domain?: string
}

export interface UniversitySearchCandidate {
  title: string
  url: string
  domain: string
  snippet: string
}

const BLOCKED_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'vk.com',
  't.me',
  'telegram.me',
  'youtube.com',
  'tiktok.com',
  'spark-interfax.ru',
  'focus.kontur.ru',
  'kontur.ru',
  'firmalyze.ru',
  'rusprofile.ru',
  'checko.ru',
  'list-org.com',
  'companies.rbc.ru',
  'hh.ru',
  'rabota.ru',
  'superjob.ru',
  'avito.ru',
  'zoon.ru',
  'vuzopedia.ru',
  'postupi.online',
  'tabiturient.ru',
  'vuzoteka.ru',
  'ucheba.ru',
  'abiturients.info',
  'russiavuz.ru',
  'moeobrazovanie.ru'
]

const EDUCATION_SIGNALS = /(?:университет|институт|академи[яи]|высш(?:ая|ей)\s+школа|при[её]мн(?:ая|ой)\s+комисс|абитуриент|бакалавриат|специалитет|магистратур|образовательн\w*\s+программ|направлени\w*\s+подготов|факультет|поступлени|university|college|admissions|undergraduate|bachelor(?:'s)?\s+degree)/iu
const ADMISSION_SIGNALS = /(?:официальн\w*\s+сайт|при[её]мн\w*\s+комисс|абитуриент|бакалавриат|специалитет|магистратур|правил\w*\s+при[её]ма|admissions|undergraduate)/iu
const LOW_QUALITY_SIGNALS = /(?:ваканси|ищем\s+сотрудник|работа\s+в\s+(?:компании|команд|москэнерго)|карьер\w*\s+в\s+компани|для\s+работодател|реквизит\w*|выписк\w*\s+из\s+егрюл|финансов\w*\s+показател|уставн\w*\s+капитал|поставщик|промышленн\w*\s+инструмент|магазин\s+товаров|корпоративн\w*\s+жизн|оставьте\s+(?:свои\s+)?контактн\w*\s+данн|инн\s*\d|огрн\s*\d)/iu
const COMPANY_TITLE = /^(?:ооо|ао|пао|ип|зао|нко)\b/iu
const BROAD_SEARCH_WORDS = /\b(?:вузы|вузов|вузам|университеты|университетов|университетам|институты|институтов|академии|академий)\b/iu
const GENERIC_WORDS = new Set([
  'найди', 'найти', 'ищи', 'искать', 'подбери', 'подобрать', 'покажи', 'показать', 'сравни', 'сравнить',
  'официальный', 'официального', 'официальном', 'сайт', 'сайты', 'сайта', 'страница', 'страницы',
  'университет', 'университета', 'университетский', 'университетского', 'вуз', 'институт', 'института',
  'государственный', 'государственного', 'федеральный', 'федерального', 'образовательные', 'образовательных',
  'программы', 'программа', 'программой', 'поступление', 'поступления', 'абитуриент', 'абитуриентов',
  'бакалавриат', 'специалитет', 'магистратура', 'направление', 'направления', 'подготовки', 'приемная', 'приёмная',
  'комиссия', 'комиссии', 'по', 'для', 'на', 'в', 'во', 'из', 'с', 'со', 'и', 'или', 'где', 'какие', 'какой',
  'россии', 'россия', 'российские', 'российских', 'москвы', 'москва', 'санкт-петербурга', 'санкт-петербург',
  'сургута', 'сургуте', 'сургут', 'новосибирска', 'новосибирск', 'казани', 'казань', 'екатеринбурга', 'екатеринбург'
])

const KNOWN_DOMAIN_ALIASES: Record<string, string[]> = {
  'мгу': ['msu.ru'],
  'спбгу': ['spbu.ru'],
  'вшэ': ['hse.ru'],
  'мфти': ['mipt.ru'],
  'итмо': ['itmo.ru'],
  'сургу': ['surgu.ru'],
  'surgu': ['surgu.ru'],
  'сургутский': ['surgu.ru'],
  'surgut': ['surgu.ru'],
  'mgu': ['msu.ru'],
  'spbgu': ['spbu.ru'],
  'vshe': ['hse.ru'],
  'mfti': ['mipt.ru'],
  'itmo': ['itmo.ru']
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, ' ')
    .replace(/[^\p{L}\p{N}.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function transliterate(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: ''
  }
  return normalizeText(value).replace(/[а-я]/g, (char) => map[char] ?? char).replace(/[^a-z0-9]/g, '')
}

function isBlockedDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return BLOCKED_DOMAINS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
}

function extractSpecificInstitutionAliases(query: string): string[] {
  const normalized = normalizeText(query)
  if (!normalized || BROAD_SEARCH_WORDS.test(normalized)) return []
  if (/\b(?:университет|вуз|институт)\s+(?:в|из|рядом\s+с)\b/iu.test(normalized)) return []

  const tokens = normalized.split(' ').filter(Boolean)
  const compact = tokens.filter((token) => !GENERIC_WORDS.has(token) && token.length >= 2)
  let candidates: string[] = []

  const known = compact.filter((token) => Object.hasOwn(KNOWN_DOMAIN_ALIASES, token))
  if (known.length > 0) candidates = known
  else if (tokens.length === 1 && compact.length === 1 && compact[0]!.length <= 12) {
    candidates = compact
  } else if (/\b(?:университет|институт|академия)\b/iu.test(normalized)) {
    const markerIndex = tokens.findIndex((token) => ['университет', 'институт', 'академия'].includes(token))
    const beforeMarker = tokens.slice(0, markerIndex).filter((token) => !GENERIC_WORDS.has(token) && token.length >= 4)
    candidates = beforeMarker
  }

  const aliases = new Set<string>()
  for (const candidate of candidates) {
    aliases.add(candidate)
    const latin = transliterate(candidate)
    if (latin.length >= 3) aliases.add(latin)
    if (latin.length >= 5) aliases.add(latin.slice(0, 5))
    for (const domain of KNOWN_DOMAIN_ALIASES[candidate] ?? []) aliases.add(domain)
  }

  return [...aliases].filter((alias) => alias.length >= 3)
}

function getKnownInstitutionDomains(query: string): string[] {
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  return [...new Set(tokens.flatMap((token) => KNOWN_DOMAIN_ALIASES[token] ?? []))]
}

function matchesSpecificInstitution(
  result: UniversitySearchCandidate,
  aliases: string[],
  knownDomains: string[]
): boolean {
  if (aliases.length === 0) return true
  const url = new URL(result.url)
  const host = url.hostname.toLowerCase()

  // For common abbreviations (e.g. СурГУ, МГУ, ВШЭ), accept only the known official domain.
  // This prevents directories, social networks and sponsored listings from passing by keyword alone.
  if (knownDomains.length > 0) {
    return knownDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  }
  const corpus = normalizeText(`${result.title} ${result.snippet} ${result.domain}`)
  const latinCorpus = transliterate(`${result.title} ${result.snippet} ${result.domain}`)

  return aliases.some((alias) => {
    if (alias.includes('.')) return host === alias || host.endsWith(`.${alias}`)
    if (host.includes(alias)) return true
    if (corpus.includes(alias)) return true
    const latinAlias = transliterate(alias)
    return latinAlias.length >= 3 && latinCorpus.includes(latinAlias)
  })
}

function getRootDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  return labels.length >= 2 ? labels.slice(-2).join('.') : hostname
}

function scoreResult(result: UniversitySearchCandidate): number {
  const text = `${result.title} ${result.snippet}`
  let score = 0
  if (ADMISSION_SIGNALS.test(text)) score += 50
  if (/официальн\w*\s+сайт/iu.test(text)) score += 30
  if (/\.ru$/iu.test(result.domain)) score += 10
  if (/^https:\/\/(?:abiturient|admission|priem|go)\./iu.test(result.url)) score += 15
  return score
}

export function filterAndRankUniversityResults<T extends UniversitySearchCandidate>(
  results: T[],
  input: UniversitySearchQualityInput
): T[] {
  const aliases = input.mode === 'universities'
    ? extractSpecificInstitutionAliases(input.query)
    : []
  const knownDomains = input.mode === 'universities'
    ? getKnownInstitutionDomains(input.query)
    : []
  const allowedDomain = input.mode === 'programs' ? input.domain?.toLowerCase() : undefined
  const scored: Array<{ result: T; score: number }> = []
  const seenUrls = new Set<string>()

  for (const result of results) {
    let url: URL
    try {
      url = new URL(result.url)
    } catch {
      continue
    }

    if (url.protocol !== 'https:' || isBlockedDomain(url.hostname)) continue
    if (allowedDomain && url.hostname !== allowedDomain && !url.hostname.endsWith(`.${allowedDomain}`)) continue
    const searchableText = `${result.title} ${result.snippet}`
    if (COMPANY_TITLE.test(result.title) || LOW_QUALITY_SIGNALS.test(searchableText)) continue
    if (!EDUCATION_SIGNALS.test(searchableText)) continue
    if (input.mode === 'universities' && !ADMISSION_SIGNALS.test(searchableText)) continue
    if (!matchesSpecificInstitution(result, aliases, knownDomains)) continue

    const normalizedUrl = url.toString()
    if (seenUrls.has(normalizedUrl)) continue
    seenUrls.add(normalizedUrl)
    scored.push({ result, score: scoreResult(result) + (aliases.length > 0 ? 100 : 0) })
  }

  scored.sort((a, b) => b.score - a.score)

  const domainCounts = new Map<string, number>()
  const maxPerUniversity = aliases.length > 0 ? 3 : 2
  const filtered: T[] = []

  for (const item of scored) {
    const rootDomain = getRootDomain(new URL(item.result.url).hostname)
    const currentCount = domainCounts.get(rootDomain) ?? 0
    if (currentCount >= maxPerUniversity) continue

    domainCounts.set(rootDomain, currentCount + 1)
    filtered.push(item.result)
    if (filtered.length >= 8) break
  }

  return filtered
}

export function isSpecificUniversityQuery(query: string): boolean {
  return extractSpecificInstitutionAliases(query).length > 0
}
