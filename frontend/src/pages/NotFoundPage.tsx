
import { Link } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="dashboard-container not-found-page">
      <div className="not-found-icon">
        <SearchX size={35} />
      </div>

      <span className="section-kicker">СТРАНИЦА НЕ НАЙДЕНА</span>
      <h1>Такой страницы пока нет</h1>
      <p>
        Проверь адрес или вернись на главную страницу Trajectory.
      </p>

      <Link to="/" className="primary-button">
        <ArrowLeft size={16} />
        На главную
      </Link>
    </div>
  )
}
