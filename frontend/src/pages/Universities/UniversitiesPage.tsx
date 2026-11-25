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
          <label className="university-select-field"><span className="visually-hidden">Тип организации</span><select value={selectedOrganizationType} onChange={(event) => setSelectedOrganizationType(event.target.value)}><option value="">Все типы</option>{organizationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
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
            {filteredUniversities.map((university: University) => {
              const rawImageUrl = safeUrl(university.coverImageUrl)
              const sourceUrl = safeUrl(university.coverImageSourceUrl)
              const imageUrl = rawImageUrl && sourceUrl && university.coverImageLicense?.trim() ? rawImageUrl : null
              const favorited = favoriteIds.includes(university.id) || isFavorite(favoriteScope, 'university', university.id)
              return (
                <article className="university-card" key={university.id}>
                  <Link className="university-emblem university-photo-slot" to={`/universities/${encodeURIComponent(university.id)}`} aria-label={`Открыть ${university.shortName || university.name}`}>
                    {imageUrl ? <img src={imageUrl} alt={university.coverImageAlt || `Фотография ${university.shortName || university.name}`} loading="lazy" /> : <span className="university-photo-placeholder"><GraduationCap size={38} /><small>Фотография будет добавлена после проверки источника</small></span>}
                  </Link>
                  <div className="university-card-content">
                    <div className="university-card-heading">
                      <div><span className="university-short-name">{university.shortName}</span><h2><Link to={`/universities/${encodeURIComponent(university.id)}`}>{university.name}</Link></h2></div>
                      <span className="university-location"><MapPin size={14} /><span>{university.city?.trim() || 'Город не указан'}</span></span>
                    </div>
                    {university.description && <p className="university-description">{university.description}</p>}
                    <div className="university-card-meta"><span>{university.region || 'Регион не указан'}</span>{university.organizationType && <span>{university.organizationType}</span>}{university.isBranch && <span>Филиал</span>}{university.programs?.length ? <span>Программ в базе: {university.programs.length}</span> : <span>Программы уточняются</span>}</div>
                    <div className="university-card-actions">
                      <Link className="catalog-details-link" to={`/universities/${encodeURIComponent(university.id)}`}>Подробнее <ExternalLink size={15} /></Link>
                      <button type="button" className={`university-favorite-button${favorited ? ' is-active' : ''}`} onClick={() => handleFavorite(university.id)} aria-pressed={favorited}><Bookmark size={15} />{favorited ? 'В избранном' : 'В избранное'}</button>
                      {sourceUrl && <a className="university-photo-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">Источник фото <ExternalLink size={12} /></a>}
                    </div>
                  </div>
                </article>
              )
            })}
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
