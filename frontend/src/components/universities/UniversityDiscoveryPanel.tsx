import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Search
} from 'lucide-react'

import type {
  UniversityDiscoveryResult,
  UniversityDiscoveryStatus
} from '@trajectory/shared'

import { universityService } from '@/services/university.service'
import './university-discovery.css'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить внешний поиск. Попробуй ещё раз.'
}

export function UniversityDiscoveryPanel() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<UniversityDiscoveryStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [results, setResults] = useState<UniversityDiscoveryResult[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityDiscoveryResult | null>(null)
  const [mode, setMode] = useState<'universities' | 'programs'>('universities')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    void universityService.getDiscoveryStatus()
      .then((value) => {
        if (active) setStatus(value)
      })
      .catch(() => {
        if (active) setStatusError(true)
      })

    return () => { active = false }
  }, [])

  const performSearch = async (
    searchTextValue: string,
    searchMode: 'universities' | 'programs',
    selected: UniversityDiscoveryResult | null
  ) => {
    const searchText = searchTextValue.trim()
    if (searchText.length < 3 || loading) return

    setLoading(true)
    setError(null)
    setResults([])
    setNote('')

    try {
      const response = await universityService.discover({
        query: searchText,
        mode: searchMode,
        ...(searchMode === 'programs' && selected?.domain
          ? { domain: selected.domain }
          : {})
      })
      setResults(response.results)
      setNote(response.note)
      setMode(searchMode)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void performSearch(query, mode, selectedUniversity)
  }

  const findPrograms = (university: UniversityDiscoveryResult) => {
    setSelectedUniversity(university)
    setMode('programs')
    const nextQuery = `образовательные программы бакалавриата ${university.title}`
    setQuery(nextQuery)
    void performSearch(nextQuery, 'programs', university)
  }

  const returnToUniversities = () => {
    setMode('universities')
    setSelectedUniversity(null)
    setQuery('')
    setResults([])
    setError(null)
    setNote('')
  }

  const unavailable = status !== null && (!status.enabled || !status.configured)

  return (
    <section className="panel university-discovery-panel" aria-labelledby="university-discovery-title">
      <div className="university-discovery-heading">
        <div className="university-discovery-heading-icon">
          <Globe2 size={21} />
        </div>
        <div className="university-discovery-heading-copy">
          <span className="section-kicker">РАСШИРЕННЫЙ ПОИСК</span>
          <h2 id="university-discovery-title">Найти университеты и программы автоматически</h2>
          <p>
            Ищем по внешним страницам интернета, а не только во встроенном справочнике проекта.
          </p>
        </div>
        <span className={`university-discovery-status${status?.enabled && status.configured ? ' is-ready' : ''}`}>
          {statusError
            ? 'Статус недоступен'
            : status?.enabled && status.configured
              ? 'Ключи указаны'
              : 'Ожидает подключения'}
        </span>
      </div>

      {mode === 'programs' && selectedUniversity && (
        <div className="university-discovery-selected">
          <button type="button" onClick={returnToUniversities}>
            <ArrowLeft size={15} /> К поиску вузов
          </button>
          <span>Ищем образовательные программы на сайте: <strong>{selectedUniversity.domain}</strong></span>
        </div>
      )}

      <form className="university-discovery-form" onSubmit={handleSearchSubmit}>
        <label className="university-discovery-input">
          <Search size={18} />
          <span className="visually-hidden">Поисковый запрос</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === 'programs'
              ? 'Укажи направление или название программы...'
              : 'Например: вузы Москвы с программой биоинформатика'}
            minLength={3}
            maxLength={150}
            disabled={loading}
          />
        </label>
        <button className="primary-button" type="submit" disabled={loading || query.trim().length < 3 || unavailable || status === null || statusError}>
          {loading ? <LoaderCircle size={17} className="university-discovery-spinner" /> : <Search size={17} />}
          {loading ? 'Ищем...' : mode === 'programs' ? 'Найти программы' : 'Найти в интернете'}
        </button>
      </form>

      {unavailable && (
        <div className="university-discovery-hint">
          <AlertCircle size={16} />
          <span>
            Внешний поиск пока не включён на сервере. Добавь ключ Tavily и включи TAVILY_SEARCH_ENABLED=true в настройках backend. Встроенный справочник вузов продолжает работать.
          </span>
        </div>
      )}

      {statusError && !unavailable && (
        <div className="university-discovery-hint">
          <AlertCircle size={16} />
          <span>Не удалось проверить готовность внешнего поиска. Попробуй обновить страницу.</span>
        </div>
      )}

      {error && (
        <div className="university-discovery-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="university-discovery-results" aria-live="polite">
          <div className="university-discovery-results-heading">
            <strong>{mode === 'programs' ? 'Найденные страницы программ' : 'Найденные университеты и сайты'}</strong>
            <span>{results.length} результатов</span>
          </div>
          <div className="university-discovery-list">
            {results.map((result) => (
              <article className="university-discovery-result" key={result.url}>
                <div className="university-discovery-result-icon">
                  {mode === 'programs' ? <BookOpen size={18} /> : <Globe2 size={18} />}
                </div>
                <div className="university-discovery-result-content">
                  <h3>{result.title}</h3>
                  <span className="university-discovery-domain">{result.domain}</span>
                  <p>{result.snippet}</p>
                  <div className="university-discovery-result-actions">
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      Открыть источник <ExternalLink size={14} />
                    </a>
                    {mode === 'universities' && (
                      <button type="button" onClick={() => findPrograms(result)}>
                        Найти программы на этом сайте <Search size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {note && <p className="university-discovery-note">{note}</p>}

      <p className="university-discovery-disclaimer">
        Внешние результаты помогают обнаружить сайты и страницы программ, но не являются подтверждением аккредитации или действующих правил приёма. Результаты поиска не добавляются в справочник автоматически — перед импортом их нужно проверить. Поиск выполняется через Tavily и расходует поисковые кредиты согласно тарифу. Индикатор проверяет наличие ключа и настройку сервиса, но не доступный остаток кредитов.
      </p>
    </section>
  )
}
