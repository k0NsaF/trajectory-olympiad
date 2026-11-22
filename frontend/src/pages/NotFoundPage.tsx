
import { Link } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="dashboard-container not-found-page">
      <div className="not-found-icon">
        <SearchX size={35} />
      </div>

      <span className="section-kicker">СТРАНИЦА НЕ НАЙДЕНА</span>
      <h1>Кажется, мы сбились с траектории</h1>
      <p>
        Такой страницы не существует или она была перемещена.
      </p>

      <Link to="/trajectory" className="primary-button">
        <ArrowLeft size={16} />
        Вернуться на главную
      </Link>
    </div>
  )
}
