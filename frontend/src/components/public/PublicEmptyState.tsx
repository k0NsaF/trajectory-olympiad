import { ArrowUpRight, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import './public-components.css'

export interface PublicEmptyStateProps {
  title: string
  description: string
  action?: {
    label: string
    to: string
  }
}

/** Honest empty state for public catalogs when verified records are not available yet. */
export function PublicEmptyState({
  title,
  description,
  action
}: PublicEmptyStateProps) {
  return (
    <section className="public-empty-state" aria-live="polite">
      <span className="public-empty-state-icon" aria-hidden="true">
        <Compass size={21} strokeWidth={1.7} />
      </span>
      <div className="public-empty-state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action && (
        <Link className="public-empty-state-action" to={action.to}>
          {action.label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </section>
  )
}
