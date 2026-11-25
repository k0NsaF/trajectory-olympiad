import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, ExternalLink, GitCompareArrows, GraduationCap, Info, MapPin, Search, Sparkles, X } from 'lucide-react'

import type { University } from '@trajectory/shared'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { UniversityDiscoveryPanel } from '@/components/universities/UniversityDiscoveryPanel'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useAuth } from '@/app/providers'
import { universityService } from '@/services/university.service'
import { readComparisonUniversityIds, readDiscoveredComparisonUniversities, removeComparisonSelection, subscribeToComparisonChanges } from '@/services/university-comparison.store'
import { isFavorite, readFavorites, subscribeToFavorites, toggleFavorite } from '@/services/favorites.store'

import './benefits-enhancements.css'

type SortMode = 'name' | 'city' | 'region'
type BranchFilter = 'all' | 'main' | 'branches'

function safeUrl(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

interface CampusMedia {
  imageUrl: string
  sourceUrl: string
  author: string
  license: string
  alt: string
}

const CAMPUS_MEDIA: Record<string, CampusMedia> = {
  'msu.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Moscow._Main_building_of_Moscow_State_University_P4131808_2600.jpg/1024px-Moscow._Main_building_of_Moscow_State_University_P4131808_2600.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Moscow._Main_building_of_Moscow_State_University_P4131808_2600.jpg',
    author: 'Alexxx1979 (Alexxx-Malev)', license: 'CC BY-SA 4.0', alt: 'Главное здание Московского государственного университета'
  },
  'bmstu.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Main_building_of_the_Bauman_Moscow_State_Technical_University_01.jpg/1280px-Main_building_of_the_Bauman_Moscow_State_Technical_University_01.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Main_building_of_the_Bauman_Moscow_State_Technical_University_01.jpg',
    author: 'MBH', license: 'CC BY 4.0', alt: 'Главный корпус МГТУ имени Н.Э. Баумана'
  },
  'mipt.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/%D0%A4%D0%B8%D0%B7%D1%82%D0%B5%D1%85_%D0%BA%D0%B0%D0%BC%D0%BF%D1%83%D1%81.jpg/1024px-%D0%A4%D0%B8%D0%B7%D1%82%D0%B5%D1%85_%D0%BA%D0%B0%D0%BC%D0%BF%D1%83%D1%81.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Физтех_кампус.jpg',
    author: 'Lesless', license: 'CC BY-SA 4.0', alt: 'Здание кампуса Московского физико-технического института'
  },
  'spbu.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/2018_SPb_Universitetskaya_01.jpg/1280px-2018_SPb_Universitetskaya_01.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:2018_SPb_Universitetskaya_01.jpg',
    author: 'Andrey Korzun', license: 'CC BY-SA 4.0', alt: 'Здание Санкт-Петербургского государственного университета на Университетской набережной'
  },
  'itmo.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/ITMO_University_Main_Campus_October_2024.jpg/1280px-ITMO_University_Main_Campus_October_2024.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:ITMO_University_Main_Campus_October_2024.jpg',
    author: 'Hvost239', license: 'CC BY-SA 4.0', alt: 'Главный кампус Университета ИТМО'
  },
  'nsu.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/NSU_new_building.jpg/1280px-NSU_new_building.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:NSU_new_building.jpg',
    author: 'Nsu marketing', license: 'CC BY-SA 4.0', alt: 'Новое здание Новосибирского государственного университета'
  },
  'nstu.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/NSTU_Main_Building.JPG/768px-NSTU_Main_Building.JPG',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:NSTU_Main_Building.JPG',
    author: 'DMX Diman', license: 'Public Domain', alt: 'Главный корпус Новосибирского государственного технического университета'
  },
  'mgimo.ru': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/dc/MGIMO-University-main_building.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:MGIMO-University-main_building.jpg',
    author: 'Foma', license: 'CC BY-SA 3.0', alt: 'Главное здание МГИМО'
  },
  'kpfu.ru': {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kazan_Federal_Unievrsity.jpg?width=1280',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kazan_Federal_Unievrsity.jpg',
    author: 'Ianiworld (Iani Nikolov)', license: 'CC BY-SA 4.0', alt: 'Главное здание Казанского федерального университета'
  }
}

const UNIVERSITY_SHORT_LABELS: Record<string, string> = {
  'msu.ru': 'МГУ', 'bmstu.ru': 'МГТУ им. Баумана', 'mipt.ru': 'МФТИ',
  'spbu.ru': 'СПбГУ', 'itmo.ru': 'ИТМО', 'nsu.ru': 'НГУ',
  'nstu.ru': 'НГТУ', 'mgimo.ru': 'МГИМО', 'kpfu.ru': 'КФУ'
}

function universityHost(university: University): string {
  const value = safeUrl(university.officialDomain) || safeUrl(university.website)
  if (!value) return ''
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function campusMediaFor(university: University): CampusMedia | null {
  if (university.isBranch) return null
  return CAMPUS_MEDIA[universityHost(university)] ?? null
}

function universityDisplayName(university: University): string {
  return UNIVERSITY_SHORT_LABELS[universityHost(university)] || university.shortName || university.name
}

function organizationTypeLabel(value?: string): string {
  if (value === 'public') return 'Государственный вуз'
  if (value === 'private') return 'Негосударственный вуз'
  if (value === 'unknown') return 'Тип не определён'
  return value || 'Тип не указан'
}

export function UniversitiesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const favoriteScope = user?.id ? `user:${user.id}` : 'guest'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedOrganizationType, setSelectedOrganizationType] = useState('')
  const [branchFilter, setBranchFilter] = useState<BranchFilter>('all')
  const [sortBy, setSortBy] = useState<SortMode>('name')
  const [currentPage, setCurrentPage] = useState(1)
  const [comparisonIds, setComparisonIds] = useState<string[]>(readComparisonUniversityIds)
  const [discoveredCount, setDiscoveredCount] = useState(readDiscoveredComparisonUniversities().length)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavorites(favoriteScope).filter((entry) => entry.kind === 'university').map((entry) => entry.id))

  useEffect(() => subscribeToComparisonChanges(() => {
    setComparisonIds(readComparisonUniversityIds())
    setDiscoveredCount(readDiscoveredComparisonUniversities().length)
  }), [])

  useEffect(() => {
    setFavoriteIds(readFavorites(favoriteScope).filter((entry) => entry.kind === 'university').map((entry) => entry.id))
    return subscribeToFavorites(favoriteScope, () => setFavoriteIds(readFavorites(favoriteScope).filter((entry) => entry.kind === 'university').map((entry) => entry.id)))
  }, [favoriteScope])

  const loadUniversities = useCallback(() => universityService.getAll(), [])
  const { data: universities, loading, error, reload } = useAsyncData(loadUniversities, [])

  const cities = useMemo(() => [...new Set((universities ?? []).map((item) => item.city?.trim()).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, 'ru')), [universities])
  const regions = useMemo(() => [...new Set((universities ?? []).map((item) => item.region?.trim()).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, 'ru')), [universities])
  const organizationTypes = useMemo(() => [...new Set((universities ?? []).map((item) => item.organizationType?.trim()).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, 'ru')), [universities])

  const filteredUniversities = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ru')
    const items = (universities ?? []).filter((university) => {
      if (selectedCity && university.city !== selectedCity) return false
      if (selectedRegion && university.region !== selectedRegion) return false
      if (selectedOrganizationType && university.organizationType !== selectedOrganizationType) return false
      if (branchFilter === 'main' && university.isBranch) return false
      if (branchFilter === 'branches' && !university.isBranch) return false
      const searchable = [university.name, university.shortName, university.city, university.region, university.description, university.organizationType, university.officialDomain, ...(university.programs ?? []).flatMap((program) => [program.name, program.direction ?? ''])]
        .filter(Boolean).join(' ').toLocaleLowerCase('ru')
      return !query || searchable.includes(query)
    })
    return items.sort((a, b) => {
      if (sortBy === 'city') return a.city.localeCompare(b.city, 'ru') || a.name.localeCompare(b.name, 'ru')
      if (sortBy === 'region') return (a.region ?? '').localeCompare(b.region ?? '', 'ru') || a.name.localeCompare(b.name, 'ru')
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [universities, searchQuery, selectedCity, selectedRegion, selectedOrganizationType, branchFilter, sortBy])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, selectedCity, selectedRegion, selectedOrganizationType, branchFilter, sortBy])
  const totalPages = Math.max(1, Math.ceil(filteredUniversities.length / 20))
  const visibleUniversities = filteredUniversities.slice((currentPage - 1) * 20, currentPage * 20)

  const hasFilters = Boolean(searchQuery.trim() || selectedCity || selectedRegion || selectedOrganizationType || branchFilter !== 'all')
  const comparisonUniversities = useMemo(() => (universities ?? []).filter((item) => comparisonIds.includes(item.id)), [universities, comparisonIds])
  const comparisonCount = comparisonIds.length + discoveredCount

  const askAIToCompare = () => {
    const candidates = comparisonUniversities.map((item) => {
      const programs = (item.programs ?? []).map((program) => program.name).slice(0, 8)
      return `- ${item.shortName || item.name}; ${item.city}; ${item.region ?? 'регион не указан'}; программы: ${programs.length ? programs.join(', ') : 'в базе пока нет списка программ'}`
    }).join('\n')
    const prompt = [
      'Сравни выбранные университеты с учётом моей анкеты и интересов.',
      'Используй только данные из контекста и приведённого списка. Не придумывай проходные баллы, стоимость, рейтинг, наличие программ или льготы.',
      'Сначала объясни, каких достоверных данных не хватает; затем сравни совпадение по региону и доступным программам и укажи, что нужно проверить на официальных сайтах.',
      candidates
    ].join('\n\n')
    navigate('/ai', { state: { sourcePath: '/universities', initialQuestion: prompt } })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCity('')
    setSelectedRegion('')
    setSelectedOrganizationType('')
    setBranchFilter('all')
    setSortBy('name')
  }

  const handleFavorite = (universityId: string) => {
    toggleFavorite(favoriteScope, 'university', universityId)
    setFavoriteIds(readFavorites(favoriteScope).filter((entry) => entry.kind === 'university').map((entry) => entry.id))
  }

  return (
    <div className="dashboard-container universities-page">
      <PageHeader eyebrow="СПРАВОЧНИК ОБРАЗОВАТЕЛЬНЫХ ОРГАНИЗАЦИЙ" title="Университеты" description="Найди вуз по названию, городу или региону, открой его подробную страницу и добавь подходящие варианты в сравнение." />

      <section className="university-catalog-controls" aria-label="Поиск университетов">
        <label className="university-search-field">
          <Search size={18} />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Название вуза, город, регион или программа..." aria-label="Поиск университетов" />
          {searchQuery && <button type="button" aria-label="Очистить поиск" onClick={() => setSearchQuery('')}><X size={15} /></button>}
        </label>
        <div className="university-filter-controls">
          <label className="university-select-field"><span className="visually-hidden">Город</span><select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}><option value="">Все города</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label className="university-select-field"><span className="visually-hidden">Регион</span><select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}><option value="">Все регионы</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select></label>
          <label className="university-select-field"><span className="visually-hidden">Тип организации</span><select value={selectedOrganizationType} onChange={(event) => setSelectedOrganizationType(event.target.value)}><option value="">Все типы</option>{organizationTypes.map((type) => <option key={type} value={type}>{organizationTypeLabel(type)}</option>)}</select></label>
          <label className="university-select-field"><span className="visually-hidden">Филиалы</span><select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value as BranchFilter)}><option value="all">Все организации</option><option value="main">Без филиалов</option><option value="branches">Только филиалы</option></select></label>
          <label className="university-select-field"><span className="visually-hidden">Сортировка</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}><option value="name">По названию</option><option value="city">По городу</option><option value="region">По региону</option></select></label>
        </div>
      </section>

      <details className="university-discovery-disclosure">
        <summary><span>Не нашли нужный вуз или программу?</span><span className="university-discovery-disclosure-action">Поиск по официальным сайтам</span></summary>
        <UniversityDiscoveryPanel />
      </details>

      <section className="university-catalog-results">
        <div className="university-results-bar"><span>Найдено организаций: <strong>{filteredUniversities.length}</strong></span>{hasFilters && <button type="button" className="university-reset-button" onClick={clearFilters}><X size={14} />Сбросить фильтры</button>}</div>
        {loading ? <LoadingState message="Загружаем справочник университетов..." /> : error ? <ErrorState message={error} onRetry={reload} /> : filteredUniversities.length === 0 ? <EmptyState icon={<Search size={25} />} title="Университеты не найдены" description="Измени запрос или фильтры. Если вуза нет в справочнике, попробуй поиск по официальным сайтам выше." /> : (
          <div className="university-list">
            {visibleUniversities.map((university: University) => {
              const campusMedia = campusMediaFor(university)
              const rawImageUrl = safeUrl(university.coverImageUrl)
              const storedSourceUrl = safeUrl(university.coverImageSourceUrl)
              const storedImageIsVerified = Boolean(rawImageUrl && storedSourceUrl && university.coverImageLicense?.trim())
              const imageUrl = !university.isBranch ? (campusMedia?.imageUrl ?? (storedImageIsVerified ? rawImageUrl : null)) : null
              const sourceUrl = campusMedia?.sourceUrl ?? (!university.isBranch && storedImageIsVerified ? storedSourceUrl : null)
              const photoCredit = campusMedia ? 'Фото: ' + campusMedia.author + ' · ' + campusMedia.license : (university.coverImageLicense || 'Проверенный источник')
              const favorited = favoriteIds.includes(university.id) || isFavorite(favoriteScope, 'university', university.id)
              return (
                <article className="university-card" key={university.id}>
                  <Link className="university-emblem university-photo-slot" to={`/universities/${encodeURIComponent(university.id)}`} aria-label={`Открыть ${university.shortName || university.name}`}>
                    {imageUrl ? <img src={imageUrl} alt={campusMedia?.alt || university.coverImageAlt || `Фотография ${university.shortName || university.name}`} loading="lazy" /> : <span className="university-photo-placeholder"><GraduationCap size={38} /><small>Фотография будет добавлена после проверки источника</small></span>}
                  </Link>
                  <div className="university-card-content">
                    <div className="university-card-heading">
                      <div><span className="university-short-name">{universityDisplayName(university)}</span><h2><Link to={`/universities/${encodeURIComponent(university.id)}`}>{university.name}</Link></h2></div>
                      <span className="university-location"><MapPin size={14} /><span>{university.city?.trim() || 'Город не указан'}</span></span>
                    </div>
                    {university.description && <p className="university-description">{university.description}</p>}
                    <div className="university-card-meta"><span>{university.region || 'Регион не указан'}</span>{university.organizationType && <span>{organizationTypeLabel(university.organizationType)}</span>}{university.isBranch && <span>Филиал</span>}{university.programs?.length ? <span>Программ в базе: {university.programs.length}</span> : <span>Программы уточняются</span>}</div>
                    <div className="university-card-actions">
                      <Link className="catalog-details-link" to={`/universities/${encodeURIComponent(university.id)}`}>Подробнее <ExternalLink size={15} /></Link>
                      <button type="button" className={`university-favorite-button${favorited ? ' is-active' : ''}`} onClick={() => handleFavorite(university.id)} aria-pressed={favorited}><Bookmark size={15} />{favorited ? 'В избранном' : 'В избранное'}</button>
                      {sourceUrl && <a className="university-photo-source" href={sourceUrl} target="_blank" rel="noopener noreferrer" title={photoCredit}>{photoCredit} <ExternalLink size={12} /></a>}
                    </div>
                  </div>
                </article>
              )
            })}
            {totalPages > 1 && (
              <nav className="university-pagination" aria-label="Страницы каталога университетов">
                <span>Показано {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, filteredUniversities.length)} из {filteredUniversities.length}</span>
                <div>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Назад</button>
                  <strong>Страница {currentPage} из {totalPages}</strong>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Далее</button>
                </div>
              </nav>
            )}
          </div>
        )}
      </section>

      <section className="university-comparison-inline">
        <div className="university-comparison-inline-heading"><div><span className="section-kicker">СРАВНЕНИЕ</span><h2>Выбранные университеты</h2><p>Добавляй вуз в сравнение на его подробной странице. Можно выбрать до пяти организаций.</p></div><div className="university-comparison-inline-actions"><Link to="/universities/compare" className="primary-button">Открыть сравнение <GitCompareArrows size={16} /></Link>{comparisonUniversities.length > 0 && <button type="button" className="secondary-button" onClick={askAIToCompare}>Сопоставить с моей анкетой <Sparkles size={15} /></button>}</div></div>
        {comparisonCount === 0 ? <p className="university-comparison-empty"><Info size={16} />Пока нет выбранных университетов. Открой карточку интересующего вуза и нажми «Добавить в сравнение».</p> : <div className="university-comparison-selected-list">{comparisonUniversities.map((item) => <span key={item.id}>{item.shortName}<button type="button" onClick={() => removeComparisonSelection(item.id)} aria-label={`Удалить ${item.shortName} из сравнения`}><X size={13} /></button></span>)}{discoveredCount > 0 && <small>Найдено через внешний поиск: {discoveredCount}</small>}</div>}
      </section>

      <p className="university-data-note"><Info size={16} />Сведения из государственного реестра подтверждают существование организации, но не заменяют актуальные правила приёма. Фотографии отображаются только после добавления проверенного источника и основания использования.</p>
    </div>
  )
}
