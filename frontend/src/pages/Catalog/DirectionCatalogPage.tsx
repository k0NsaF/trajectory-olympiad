import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Search } from 'lucide-react'

import type { CatalogPage, DirectionDetails, DirectionSummary, EducationLevel } from '@trajectory/shared'
import { catalogService } from '@/services/catalog.service'
import './catalog-pages.css'

const LEVEL_LABELS: Record<EducationLevel, string> = {
  bachelor: 'Бакалавриат',
  specialist: 'Специалитет',
  master: 'Магистратура'
}

function ContentStatus({ status }: { status: string }) {
  return (
    <span className={`catalog-status catalog-status-${status}`}>
      {status === 'official' ? 'Источник подтверждён' : 'Обзорная карточка'}
    </span>
  )
}

export function DirectionCatalogPage() {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<EducationLevel | ''>('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<CatalogPage<DirectionSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      void catalogService.getDirections({ search, level: level || undefined, page, pageSize: 12 })
        .then((data) => { if (active) setResult(data) })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить направления.')
        })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, level, page])

  return (
    <div className="catalog-public-page">
      <div className="catalog-public-container">
        <Link to="/" className="catalog-back-link"><ArrowLeft size={16} /> На главную</Link>
        <header className="catalog-page-heading">
          <span className="catalog-kicker">ВЫБИРАЙ ОБРАЗОВАТЕЛЬНЫЙ МАРШРУТ</span>
          <h1>Направления обучения</h1>
          <p>Знакомься с направлениями бакалавриата и специалитета. Смотри, какие профессии с ними связаны, и переходи к программам вузов, когда их связь подтверждена.</p>
        </header>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <Search size={19} />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Название или код направления..." />
          </label>
          <select className="catalog-select" value={level} onChange={(event) => { setLevel(event.target.value as EducationLevel | ''); setPage(1) }}>
            <option value="">Все уровни</option>
            <option value="bachelor">Бакалавриат</option>
            <option value="specialist">Специалитет</option>
            <option value="master">Магистратура</option>
          </select>
          <span className="catalog-result-count">{result?.total ?? 0} направлений</span>
        </div>

        {loading && <div className="catalog-state">Загружаем направления…</div>}
        {!loading && error && <div className="catalog-state catalog-state-error" role="alert">{error}</div>}
        {!loading && !error && result?.items.length === 0 && (
          <div className="catalog-state"><GraduationCap size={32} /><strong>Ничего не найдено</strong><span>Измени поисковый запрос или уровень обучения.</span></div>
        )}

        {!loading && !error && result && result.items.length > 0 && (
          <>
            <div className="catalog-card-grid">
              {result.items.map((direction) => (
                <Link to={`/directions/${direction.slug}`} className="catalog-entry-card" key={direction.id}>
                  <span className="catalog-entry-code">{direction.code}</span>
                  <span className="catalog-entry-category">{direction.category} · {LEVEL_LABELS[direction.education_level]}</span>
                  <strong>{direction.name}</strong>
                  <span className="catalog-entry-summary">{direction.summary}</span>
                  <span className="catalog-entry-footer">О направлении <ArrowRight size={16} /></span>
                </Link>
              ))}
            </div>
            <div className="catalog-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Назад</button>
              <span>Страница {result.page} из {result.totalPages}</span>
              <button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)}>Далее</button>
            </div>
          </>
        )}
        <p className="catalog-disclaimer">Код и название направления не заменяют описание конкретной образовательной программы и правила приёма выбранного университета.</p>
      </div>
    </div>
  )
}

export function DirectionDetailsPage() {
  const { slug = '' } = useParams()
  const [direction, setDirection] = useState<DirectionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void catalogService.getDirection(slug)
      .then((data) => { if (active) setDirection(data) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить направление.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  if (loading) return <div className="catalog-public-page"><div className="catalog-public-container"><div className="catalog-state">Загружаем направление…</div></div></div>
  if (error || !direction) return <div className="catalog-public-page"><div className="catalog-public-container"><div className="catalog-state catalog-state-error" role="alert">{error || 'Направление не найдено.'}</div><Link className="catalog-back-link" to="/directions"><ArrowLeft size={16} /> К направлениям</Link></div></div>

  return (
    <div className="catalog-public-page">
      <div className="catalog-public-container">
        <Link to="/directions" className="catalog-back-link"><ArrowLeft size={16} /> Все направления</Link>
        <header className="catalog-detail-hero">
          <span className="catalog-entry-icon"><GraduationCap size={26} /></span>
          <div className="catalog-detail-meta">
  <span className="catalog-entry-code catalog-entry-code-hero">{direction.code}</span>
  <span className="catalog-kicker">{LEVEL_LABELS[direction.education_level]}</span>
</div>
          <h1>{direction.name}</h1>
          <p>{direction.summary}</p>
          <ContentStatus status={direction.content_status} />
        </header>

        <section className="catalog-detail-panel">
          <h2>Что изучают на направлении</h2>
          <p>{direction.description}</p>
          {direction.source_url && <a className="catalog-source-link" href={direction.source_url} target="_blank" rel="noreferrer">Открыть перечень Минобрнауки <ArrowRight size={15} /></a>}
        </section>

        <section className="catalog-related-section">
          <div className="catalog-section-heading">
            <div><span className="catalog-kicker">ПРОФЕССИОНАЛЬНЫЕ МАРШРУТЫ</span><h2>Связанные профессии</h2></div>
            <BookOpen size={24} />
          </div>
          {direction.professions.length > 0 ? (
            <div className="catalog-card-grid catalog-card-grid-compact">
              {direction.professions.map((profession) => (
                <Link to={`/professions/${profession.slug}`} className="catalog-entry-card" key={profession.id}>
                  <span className="catalog-entry-category">{profession.category}</span>
                  <strong>{profession.name}</strong>
                  <span className="catalog-entry-summary">{profession.rationale}</span>
                  <span className="catalog-entry-footer">О профессии <ArrowRight size={16} /></span>
                </Link>
              ))}
            </div>
          ) : <div className="catalog-state">Связанные профессии пока не опубликованы.</div>}
        </section>

        <section className="catalog-related-section">
          <div className="catalog-section-heading">
            <div><span className="catalog-kicker">ВУЗЫ И ПРОГРАММЫ</span><h2>Подтверждённые образовательные программы</h2></div>
            <GraduationCap size={24} />
          </div>
          {direction.programs.length > 0 ? (
            <div className="catalog-card-grid catalog-card-grid-compact">
              {direction.programs.map((program) => (
                <Link to={`/universities/${program.university.id}`} className="catalog-entry-card" key={program.id}>
                  <span className="catalog-entry-category">{program.university.city}{program.university.region ? ` · ${program.university.region}` : ''}</span>
                  <strong>{program.name}</strong>
                  <span className="catalog-entry-summary">{program.university.name}</span>
                  <span className="catalog-entry-footer">О вузе <ArrowRight size={16} /></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalog-state catalog-state-note">
              <strong>Связи с программами пока не подтверждены</strong>
              <span>Мы не подставляем программы только по похожему тексту в старом поле направления. Связь появится после сверки с официальной страницей или документом программы.</span>
              <Link to="/universities">Пока можно изучить каталог вузов <ArrowRight size={15} /></Link>
            </div>
          )}
        </section>
        <div className="catalog-editorial-note">Название и код направления приведены для навигации. Условия поступления, профиль программы и вступительные испытания проверяй на сайте выбранного вуза.</div>
      </div>
    </div>
  )
}
