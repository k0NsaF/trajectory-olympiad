import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Building2, GraduationCap, Medal, X } from 'lucide-react'

import type { OlympiadWithStatus, University } from '@trajectory/shared'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { useAuth } from '@/app/providers'
import { olympiadService } from '@/services/olympiad.service'
import { universityService } from '@/services/university.service'
import { readFavorites, removeFavorite, subscribeToFavorites, type FavoriteEntry } from '@/services/favorites.store'

export function FavoritesPage() {
  const { user } = useAuth()
  const scope = user?.id ? `user:${user.id}` : 'guest'
  const [entries, setEntries] = useState<FavoriteEntry[]>(() => readFavorites(scope))
  const [universities, setUniversities] = useState<University[]>([])
  const [olympiads, setOlympiads] = useState<OlympiadWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setEntries(readFavorites(scope))
    return subscribeToFavorites(scope, () => setEntries(readFavorites(scope)))
  }, [scope])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [loadedUniversities, loadedOlympiads] = await Promise.all([
        universityService.getAll(),
        olympiadService.getAll()
      ])
      setUniversities(loadedUniversities)
      setOlympiads(loadedOlympiads)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить избранное.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const favoriteUniversities = useMemo(() => {
    const ids = new Set(entries.filter((item) => item.kind === 'university').map((item) => item.id))
    return universities.filter((item) => ids.has(item.id))
  }, [entries, universities])
  const favoriteOlympiads = useMemo(() => {
    const ids = new Set(entries.filter((item) => item.kind === 'olympiad').map((item) => item.id))
    return olympiads.filter((item) => ids.has(item.id))
  }, [entries, olympiads])

  const remove = (kind: FavoriteEntry['kind'], id: string) => {
    removeFavorite(scope, kind, id)
    setEntries(readFavorites(scope))
  }

  return (
    <div className="dashboard-container favorites-page">
      <PageHeader eyebrow="СОХРАНЁННОЕ" title="Избранное" description="Университеты и олимпиады, которые ты сохранил для возвращения к ним позже." />
      {!user && <p className="favorites-storage-note">Избранное гостя хранится в этом браузере. После входа сохранённые элементы будут храниться отдельно в профиле аккаунта.</p>}
      {loading ? <LoadingState message="Загружаем сохранённые материалы..." /> : error ? <p className="form-error" role="alert">{error}</p> : entries.length === 0 ? <EmptyState icon={<Bookmark size={25} />} title="Здесь пока ничего нет" description="Добавляй интересные вузы и олимпиады в избранное на их страницах." /> : (
        <div className="favorites-content">
          <section className="favorites-section">
            <h2><Building2 size={20} /> Университеты <span>{favoriteUniversities.length}</span></h2>
            {favoriteUniversities.length ? <div className="favorites-list">{favoriteUniversities.map((item) => <article className="favorite-row" key={item.id}><div className="favorite-row-icon"><GraduationCap size={22} /></div><div className="favorite-row-content"><Link to={`/universities/${item.id}`}>{item.shortName || item.name}</Link><small>{item.city}</small></div><button type="button" onClick={() => remove('university', item.id)} aria-label={`Удалить ${item.name} из избранного`}><X size={17} /></button></article>)}</div> : <p className="favorites-empty-hint">Сохранённых университетов пока нет.</p>}
          </section>
          <section className="favorites-section">
            <h2><Medal size={20} /> Олимпиады и конкурсы <span>{favoriteOlympiads.length}</span></h2>
            {favoriteOlympiads.length ? <div className="favorites-list">{favoriteOlympiads.map((item) => <article className="favorite-row" key={item.id}><div className="favorite-row-icon"><Medal size={22} /></div><div className="favorite-row-content"><Link to={`/olympiads/${item.id}`}>{item.name}</Link><small>{item.organizer}</small></div><button type="button" onClick={() => remove('olympiad', item.id)} aria-label={`Удалить ${item.name} из избранного`}><X size={17} /></button></article>)}</div> : <p className="favorites-empty-hint">Сохранённых олимпиад пока нет.</p>}
          </section>
        </div>
      )}
    </div>
  )
}
