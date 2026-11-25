import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, Search } from 'lucide-react'

import type { CatalogPage, ProfessionDetails, ProfessionSummary } from '@trajectory/shared'
import { catalogService } from '@/services/catalog.service'
import './catalog-pages.css'

const PROFESSION_IMAGES: Record<string, string> = {
  'software-developer': 'https://images.pexels.com/photos/36706460/pexels-photo-36706460.jpeg?cs=srgb&dl=pexels-zayedhossain120-36706460.jpg&fm=jpg',
  'data-analyst': 'https://images.pexels.com/photos/9034246/pexels-photo-9034246.jpeg?cs=srgb&dl=pexels-rdne-9034246.jpg&fm=jpg',
  'cybersecurity-specialist': 'https://images.pexels.com/photos/5473298/pexels-photo-5473298.jpeg?cs=srgb&dl=pexels-cottonbro-5473298.jpg&fm=jpg',
  architect: 'https://images.pexels.com/photos/6615281/pexels-photo-6615281.jpeg?cs=srgb&dl=pexels-tima-miroshnichenko-6615281.jpg&fm=jpg',
  economist: 'https://images.pexels.com/photos/5833758/pexels-photo-5833758.jpeg?cs=srgb&dl=pexels-alphatradezone-5833758.jpg&fm=jpg',
  lawyer: 'https://images.pexels.com/photos/7875863/pexels-photo-7875863.jpeg?cs=srgb&dl=pexels-karola-g-7875863.jpg&fm=jpg',
  'electronics-engineer': 'https://images.pexels.com/photos/11679113/pexels-photo-11679113.jpeg?cs=srgb&dl=pexels-willquezada-904402-11679113.jpg&fm=jpg'
}

function ContentStatus({ status }: { status: string }) {
  return (
    <span className={`catalog-status catalog-status-${status}`}>
      {status === 'official' ? 'Источник подтверждён' : 'Обзорная карточка'}
    </span>
  )
}

export function ProfessionCatalogPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<CatalogPage<ProfessionSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      void catalogService.getProfessions({ search, page, pageSize: 12 })
        .then((data) => { if (active) setResult(data) })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить профессии.')
        })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, page])

  return (
    <div className="catalog-public-page">
      <div className="catalog-public-container">
        <Link to="/" className="catalog-back-link"><ArrowLeft size={16} /> На главную</Link>
        <header className="catalog-page-heading">
          <span className="catalog-kicker">ИССЛЕДУЙ СЕБЯ</span>
          <h1>Профессии</h1>
          <p>Изучи, чем занимаются специалисты, какие навыки используют и какие направления образования могут стать отправной точкой.</p>
        </header>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <Search size={19} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Найти профессию..."
              aria-label="Найти профессию"
            />
          </label>
          <span className="catalog-result-count">{result?.total ?? 0} профессий</span>
        </div>

        {loading && <div className="catalog-state">Загружаем каталог профессий…</div>}
        {!loading && error && <div className="catalog-state catalog-state-error" role="alert">{error}</div>}
        {!loading && !error && result?.items.length === 0 && (
          <div className="catalog-state">
            <BriefcaseBusiness size={32} />
            <strong>Ничего не найдено</strong>
            <span>Попробуй изменить поисковый запрос.</span>
          </div>
        )}

        {!loading && !error && result && result.items.length > 0 && (
          <>
            <div className="catalog-card-grid catalog-profession-grid">
              {result.items.map((profession) => (
                <Link
                  to={`/professions/${profession.slug}`}
                  className="catalog-entry-card catalog-profession-card"
                  key={profession.id}
                >
                  <span className="catalog-profession-card__media">
                    <img
                      src={PROFESSION_IMAGES[profession.slug]}
                      alt={`Фотография специалиста по профессии «${profession.name}»`}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.add('is-unavailable') }}
                    />
                  </span>
                  <span className="catalog-profession-card__body">
  <span className="catalog-profession-card__copy">
    <strong>{profession.name}</strong>
    {'summary' in profession && typeof profession.summary === 'string' && profession.summary.trim() && (
      <small>{profession.summary}</small>
    )}
  </span>
  <ArrowRight size={18} aria-hidden="true" />
</span>
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
        <p className="catalog-disclaimer">Карточки дают общее представление о профессиях. Реальные обязанности и требования зависят от специализации и работодателя.</p>
      </div>
    </div>
  )
}

export function ProfessionDetailsPage() {
  const { slug = '' } = useParams()
  const [profession, setProfession] = useState<ProfessionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void catalogService.getProfession(slug)
      .then((data) => { if (active) setProfession(data) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить профессию.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  if (loading) return <div className="catalog-public-page"><div className="catalog-public-container"><div className="catalog-state">Загружаем профессию…</div></div></div>
  if (error || !profession) return <div className="catalog-public-page"><div className="catalog-public-container"><div className="catalog-state catalog-state-error" role="alert">{error || 'Профессия не найдена.'}</div><Link className="catalog-back-link" to="/professions"><ArrowLeft size={16} /> К профессиям</Link></div></div>

  return (
    <div className="catalog-public-page">
      <div className="catalog-public-container">
        <Link to="/professions" className="catalog-back-link"><ArrowLeft size={16} /> Все профессии</Link>
        <header className="catalog-detail-hero">
          <span className="catalog-entry-icon"><BriefcaseBusiness size={26} /></span>
          <span className="catalog-kicker">{profession.category}</span>
          <h1>{profession.name}</h1>
          <p>{profession.summary}</p>
          <ContentStatus status={profession.content_status} />
        </header>

        <div className="catalog-detail-grid">
          <section className="catalog-detail-panel catalog-detail-panel-wide">
            <h2>Чем занимается специалист</h2>
            <p>{profession.description}</p>
            <h3>Типичные задачи</h3>
            <ul className="catalog-check-list">{profession.typical_tasks.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="catalog-detail-panel">
            <h2>Полезные навыки</h2>
            <ul className="catalog-tag-list">{profession.skills.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="catalog-detail-panel">
            <h2>Школьные предметы</h2>
            <ul className="catalog-tag-list">{profession.school_subjects.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Что может быть интересно</h3>
            <ul className="catalog-plain-list">{profession.interests.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>

        <section className="catalog-related-section">
          <div className="catalog-section-heading">
            <div><span className="catalog-kicker">СЛЕДУЮЩИЙ ШАГ</span><h2>Возможные направления обучения</h2></div>
            <BookOpen size={24} />
          </div>
          {profession.directions.length > 0 ? (
            <div className="catalog-card-grid catalog-card-grid-compact">
              {profession.directions.map((direction) => (
                <Link to={`/directions/${direction.slug}`} className="catalog-entry-card" key={direction.id}>
                  <span className="catalog-entry-code">{direction.code}</span>
                  <strong>{direction.name}</strong>
                  <span className="catalog-entry-summary">{direction.rationale}</span>
                  <span className="catalog-entry-footer">Изучить направление <ArrowRight size={16} /></span>
                </Link>
              ))}
            </div>
          ) : <div className="catalog-state">Связанные направления пока не опубликованы.</div>}
        </section>
        <div className="catalog-editorial-note">Это обзорная профориентационная информация, а не гарантия профессиональной пригодности или поступления.</div>
      </div>
    </div>
  )
}
